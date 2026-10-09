/**
 * Bintang Tech Studio — Seller Session & Multi-Store Context Manager.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 *
 * Implements server-side trusted Store Context resolution.
 * Untrusted client parameters (e.g. store_id in HTTP headers/body)
 * are NEVER treated as proof of authorization.
 */

import {
  StoreRepository,
  StoreMemberRepository,
  createAuthenticatedStoreContext,
} from '@bintang/tenancy';
import {
  SellerUser,
  SellerSession,
  SellerMembershipSummary,
  ActiveSellerStoreContext,
} from './types.js';
import {
  SellerUnauthenticatedError,
  SellerStoreAccessDeniedError,
  StoreSuspendedError,
  StoreSwitchUnauthorizedError,
} from './errors.js';

export interface ISellerSessionStore {
  get(token: string): Promise<SellerSession | null>;
  set(token: string, session: SellerSession): Promise<void>;
  delete(token: string): Promise<void>;
}

export class SellerSessionManager {
  private readonly sessions = new Map<string, SellerSession>();
  private readonly sessionTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly storeRepository: StoreRepository,
    private readonly memberRepository: StoreMemberRepository,
    private readonly sessionStore?: ISellerSessionStore | undefined,
  ) {}

  /**
   * Creates a new authenticated seller session, resolving all store memberships.
   */
  public async createSession(user: SellerUser, preferredStoreId?: string): Promise<SellerSession> {
    if (!user.isActive) {
      throw new SellerUnauthenticatedError('Akun pengguna tidak aktif.');
    }

    const availableStores = await this.resolveAvailableStores(user.id);
    if (availableStores.length === 0) {
      throw new SellerStoreAccessDeniedError(
        'Akun Anda belum terdaftar sebagai anggota atau pemilik toko mana pun.',
      );
    }

    // Determine initial active store
    let activeStoreSummary: SellerMembershipSummary;
    if (preferredStoreId) {
      const match = availableStores.find((s) => s.storeId === preferredStoreId);
      if (!match) {
        throw new SellerStoreAccessDeniedError(
          `Anda tidak memiliki akses ke toko yang diminta: ${preferredStoreId}`,
        );
      }
      activeStoreSummary = match;
    } else {
      activeStoreSummary = availableStores[0]!;
    }

    // Verify active store is not suspended
    const store = await this.storeRepository.findById(activeStoreSummary.storeId);
    if (!store) {
      throw new SellerStoreAccessDeniedError('Toko tidak ditemukan.');
    }
    if (store.status === 'SUSPENDED') {
      throw new StoreSuspendedError();
    }

    const sessionToken = this.generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);

    const session: SellerSession = {
      sessionToken,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      activeStoreId: activeStoreSummary.storeId,
      activeRole: activeStoreSummary.role,
      activeMembershipId: activeStoreSummary.membershipId,
      availableStores,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.sessions.set(sessionToken, session);
    if (this.sessionStore) {
      await this.sessionStore.set(sessionToken, session);
    }
    return session;
  }

  /**
   * Switches the active Store Context for a session.
   * Strictly re-verifies membership, role, and store status on the server.
   */
  public async switchActiveStore(
    sessionToken: string,
    targetStoreId: string,
  ): Promise<SellerSession> {
    let existing = this.sessions.get(sessionToken);
    if (!existing && this.sessionStore) {
      existing = (await this.sessionStore.get(sessionToken)) ?? undefined;
      if (existing) {
        this.sessions.set(sessionToken, existing);
      }
    }
    if (!existing) {
      throw new SellerUnauthenticatedError('Sesi tidak valid atau telah kedaluwarsa.');
    }

    if (new Date() > new Date(existing.expiresAt)) {
      this.sessions.delete(sessionToken);
      if (this.sessionStore) {
        await this.sessionStore.delete(sessionToken);
      }
      throw new SellerUnauthenticatedError('Sesi telah kedaluwarsa.');
    }

    // Refresh all memberships dynamically from persistence (protects against revoked access)
    const availableStores = await this.resolveAvailableStores(existing.userId);
    const target = availableStores.find((s) => s.storeId === targetStoreId);
    if (!target) {
      throw new StoreSwitchUnauthorizedError(
        `Perpindahan ditolak: Anda tidak memiliki keanggotaan aktif di toko ${targetStoreId}.`,
      );
    }

    const store = await this.storeRepository.findById(target.storeId);
    if (!store) {
      throw new StoreSwitchUnauthorizedError('Toko target tidak ditemukan.');
    }
    if (store.status === 'SUSPENDED') {
      throw new StoreSuspendedError();
    }

    const updatedSession: SellerSession = {
      ...existing,
      activeStoreId: target.storeId,
      activeRole: target.role,
      activeMembershipId: target.membershipId,
      availableStores,
    };

    this.sessions.set(sessionToken, updatedSession);
    if (this.sessionStore) {
      await this.sessionStore.set(sessionToken, updatedSession);
    }
    return updatedSession;
  }

  /**
   * Resolves the authoritative ActiveSellerStoreContext from a session token.
   * Throws if session is missing, expired, or membership was revoked.
   */
  public async resolveActiveContext(sessionToken: string): Promise<ActiveSellerStoreContext> {
    let session = this.sessions.get(sessionToken);
    if (!session && this.sessionStore) {
      session = (await this.sessionStore.get(sessionToken)) ?? undefined;
      if (session) {
        this.sessions.set(sessionToken, session);
      }
    }
    if (!session) {
      throw new SellerUnauthenticatedError('Sesi tidak ditemukan atau tidak valid.');
    }

    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(sessionToken);
      if (this.sessionStore) {
        await this.sessionStore.delete(sessionToken);
      }
      throw new SellerUnauthenticatedError('Sesi telah kedaluwarsa.');
    }

    // Authoritative check against Store & Membership repositories
    const store = await this.storeRepository.findById(session.activeStoreId);
    if (!store) {
      throw new SellerStoreAccessDeniedError('Toko tidak ditemukan.');
    }
    if (store.status === 'SUSPENDED') {
      throw new StoreSuspendedError();
    }

    const member = await this.memberRepository.findById(session.activeMembershipId);
    if (!member || member.status !== 'ACTIVE' || member.userId !== session.userId) {
      throw new SellerStoreAccessDeniedError(
        'Keanggotaan Anda di toko ini sudah tidak aktif atau dicabut.',
      );
    }

    // Construct authoritative AuthenticatedStoreContext from @bintang/tenancy
    const authenticatedContext = createAuthenticatedStoreContext({
      storeId: store.id,
      tenantSlug: store.slug,
      userId: session.userId,
      membershipId: member.id,
      role: member.role,
    });

    return {
      storeId: store.id,
      storeName: store.name,
      tenantSlug: store.slug,
      role: member.role,
      userId: session.userId,
      membershipId: member.id,
      currency: store.currency || 'IDR',
      authenticatedContext,
    };
  }

  /**
   * Retrieves an active session without modifying or verifying it.
   */
  public getSession(sessionToken: string): SellerSession | null {
    return this.sessions.get(sessionToken) || null;
  }

  /**
   * Revokes an existing session.
   */
  public async revokeSession(sessionToken: string): Promise<void> {
    this.sessions.delete(sessionToken);
    if (this.sessionStore) {
      await this.sessionStore.delete(sessionToken);
    }
  }

  /**
   * Alias for revokeSession.
   */
  public async invalidateSession(sessionToken: string): Promise<void> {
    return this.revokeSession(sessionToken);
  }

  private async resolveAvailableStores(
    userId: string,
  ): Promise<readonly SellerMembershipSummary[]> {
    const memberships = await this.memberRepository.findByUserId(userId);
    const result: SellerMembershipSummary[] = [];

    for (const m of memberships) {
      if (m.status !== 'ACTIVE') continue;

      const store = await this.storeRepository.findById(m.storeId);
      if (!store || store.status === 'ARCHIVED') continue;

      result.push({
        membershipId: m.id,
        storeId: store.id,
        storeName: store.name,
        tenantSlug: store.slug,
        role: m.role,
        status: m.status,
      });
    }

    return result;
  }

  private generateToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'ses_seller_';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}
