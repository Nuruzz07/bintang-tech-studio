/**
 * Bintang Tech Studio — Platform Owner Console Session Manager.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Enforces canonical platform authentication & context resolution:
 * - Only PLATFORM_OWNER and PLATFORM_ADMIN can authenticate into Owner Console.
 * - USER, STORE_OWNER, STORE_ADMIN, STORE_STAFF are strictly denied access.
 * - Sessions are isolated in Platform Context, never Store Context.
 */

import { PlatformRole } from '@bintang/tenancy';
import { PlatformSession, PlatformCaller } from './types.js';
import { PlatformAccessDeniedError } from './errors.js';

export interface CreatePlatformSessionParams {
  readonly userId: string;
  readonly email: string;
  readonly platformRole: PlatformRole;
  readonly ttlMs?: number | undefined;
}

export interface IPlatformSessionStore {
  get(token: string): Promise<PlatformSession | null>;
  set(token: string, session: PlatformSession): Promise<void>;
  delete(token: string): Promise<void>;
}

export class OwnerConsoleSessionManager {
  private sessions = new Map<string, PlatformSession>();

  constructor(
    private readonly defaultTtlMs = 8 * 60 * 60 * 1000,
    private readonly sessionStore?: IPlatformSessionStore | undefined,
  ) {} // 8 hours default

  /**
   * Creates an authenticated platform session.
   * Rejects any user who does not have PLATFORM_OWNER or PLATFORM_ADMIN role.
   */
  public async createSession(params: CreatePlatformSessionParams): Promise<PlatformSession> {
    if (params.platformRole !== 'PLATFORM_OWNER' && params.platformRole !== 'PLATFORM_ADMIN') {
      throw new PlatformAccessDeniedError(
        `Peran "${params.platformRole}" tidak memiliki akses administratif ke Bintang Tech Owner Console.`,
      );
    }

    const token = `pos_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (params.ttlMs || this.defaultTtlMs));

    const session: PlatformSession = {
      token,
      userId: params.userId,
      email: params.email,
      platformRole: params.platformRole,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.sessions.set(token, session);
    if (this.sessionStore) {
      await this.sessionStore.set(token, session);
    }
    return session;
  }

  /**
   * Resolves and verifies an active platform session token.
   */
  public async resolveSession(token: string): Promise<PlatformSession> {
    if (!token || !token.startsWith('pos_')) {
      throw new PlatformAccessDeniedError('Token sesi Owner Console tidak valid.');
    }

    let session = this.sessions.get(token);
    if (!session && this.sessionStore) {
      session = (await this.sessionStore.get(token)) ?? undefined;
      if (session) {
        this.sessions.set(token, session);
      }
    }
    if (!session) {
      throw new PlatformAccessDeniedError(
        'Sesi Owner Console tidak ditemukan atau telah kedaluwarsa.',
      );
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      if (this.sessionStore) {
        await this.sessionStore.delete(token);
      }
      throw new PlatformAccessDeniedError('Sesi Owner Console telah kedaluwarsa.');
    }

    return session;
  }

  /**
   * Resolves PlatformCaller from token for service invocations.
   */
  public async resolveCaller(
    token: string,
    metadata?: {
      ipAddress?: string | undefined;
      userAgent?: string | undefined;
      requestId?: string | undefined;
    },
  ): Promise<PlatformCaller> {
    const session = await this.resolveSession(token);
    return {
      userId: session.userId,
      email: session.email,
      platformRole: session.platformRole,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      requestId: metadata?.requestId,
    };
  }

  /**
   * Revokes an active platform session (logout).
   */
  public async revokeSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}
