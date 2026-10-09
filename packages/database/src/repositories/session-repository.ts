import { PostgrestClient } from '../client.js';
import { DbAppSession, DbStoreMember, DbStore } from '../types.js';

export class SessionExpiredError extends Error {
  constructor(message = 'Session has expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class SessionRevokedError extends Error {
  constructor(message = 'Session has been revoked') {
    super(message);
    this.name = 'SessionRevokedError';
  }
}

export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface AppSession {
  readonly id: string;
  readonly sessionType: 'SELLER' | 'CUSTOMER' | 'PLATFORM';
  readonly tokenHash: string;
  readonly sessionToken: string;
  readonly userId: string | null;
  readonly storeId: string | null;
  readonly activeMembershipId: string | null;
  readonly role: string;
  readonly metadata: Record<string, unknown>;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
}

function toDomain(row: DbAppSession, plaintextToken?: string): AppSession {
  return {
    id: row.id,
    sessionType: row.session_type,
    tokenHash: row.token_hash,
    sessionToken: plaintextToken ?? '',
    userId: row.user_id,
    storeId: row.store_id,
    activeMembershipId: row.active_membership_id,
    role: row.role,
    metadata: row.metadata ?? {},
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export class SupabaseSessionRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async createSession(input: {
    sessionType: 'SELLER' | 'CUSTOMER' | 'PLATFORM';
    sessionToken: string;
    userId?: string | undefined;
    storeId?: string | undefined;
    activeMembershipId?: string | undefined;
    role: string;
    metadata?: Record<string, unknown> | undefined;
    ttlSeconds?: number | undefined;
  }): Promise<AppSession> {
    const ttl = input.ttlSeconds ?? 86400; // 24h default
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
    const tokenHash = await hashSessionToken(input.sessionToken);

    const payload: Partial<DbAppSession> = {
      session_type: input.sessionType,
      token_hash: tokenHash,
      role: input.role,
      metadata: input.metadata ?? {},
      expires_at: expiresAt,
    };
    if (input.userId) payload.user_id = input.userId;
    if (input.storeId) payload.store_id = input.storeId;
    if (input.activeMembershipId) payload.active_membership_id = input.activeMembershipId;

    const rows = await this.client.from<DbAppSession>('app_sessions').insert(payload);
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to insert app session: empty response');
    }
    return toDomain(row, input.sessionToken);
  }

  async findByToken(sessionToken: string): Promise<AppSession | null> {
    const tokenHash = await hashSessionToken(sessionToken);
    const row = await this.client
      .from<DbAppSession>('app_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    return row ? toDomain(row, sessionToken) : null;
  }

  async validateSession(sessionToken: string): Promise<AppSession> {
    const session = await this.findByToken(sessionToken);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.revokedAt) {
      throw new SessionRevokedError();
    }

    if (new Date(session.expiresAt) < new Date()) {
      throw new SessionExpiredError();
    }

    return session;
  }

  async validateSellerSessionMembership(sessionToken: string): Promise<{
    session: AppSession;
    store: DbStore;
    member: DbStoreMember;
  }> {
    const session = await this.validateSession(sessionToken);
    if (session.sessionType !== 'SELLER') {
      throw new Error(`Expected SELLER session, found ${session.sessionType}`);
    }
    if (!session.storeId || !session.activeMembershipId || !session.userId) {
      throw new Error('Malformed seller session: missing store or membership reference');
    }

    // Verify Store is not SUSPENDED
    const store = await this.client
      .from<DbStore>('stores')
      .select('*')
      .eq('id', session.storeId)
      .single();

    if (store.status === 'SUSPENDED') {
      throw new Error('Store is suspended');
    }

    // Dynamic membership verification against PostgreSQL
    const member = await this.client
      .from<DbStoreMember>('store_members')
      .select('*')
      .eq('id', session.activeMembershipId)
      .eq('store_id', session.storeId)
      .eq('user_id', session.userId)
      .single();

    if (member.status !== 'ACTIVE') {
      throw new Error('Store membership has been revoked or is inactive');
    }

    return { session, store, member };
  }

  async revokeSession(sessionToken: string): Promise<void> {
    const tokenHash = await hashSessionToken(sessionToken);
    await this.client.from<DbAppSession>('app_sessions').eq('token_hash', tokenHash).update({
      revoked_at: new Date().toISOString(),
    });
  }
}

function toUuidOrNull(val: string | undefined | null): string | null {
  if (!val) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) ? val : null;
}

export interface SellerSessionRecord {
  readonly sessionToken: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userName: string;
  readonly activeStoreId: string;
  readonly activeRole: unknown;
  readonly activeMembershipId: string;
  readonly availableStores: readonly unknown[];
  readonly createdAt: string;
  readonly expiresAt: string;
}

export class SellerSessionStoreAdapter {
  private readonly repo: SupabaseSessionRepository;
  private readonly client: PostgrestClient;

  constructor(repo: SupabaseSessionRepository, client: PostgrestClient) {
    this.repo = repo;
    this.client = client;
  }

  async get(token: string): Promise<SellerSessionRecord | null> {
    const session = await this.repo.findByToken(token);
    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      return null;
    }
    return {
      sessionToken: token,
      userId: session.userId ?? (session.metadata['userId'] as string) ?? '',
      userEmail: (session.metadata['userEmail'] as string) ?? '',
      userName: (session.metadata['userName'] as string) ?? '',
      activeStoreId: session.storeId ?? (session.metadata['activeStoreId'] as string) ?? '',
      activeRole: session.role,
      activeMembershipId:
        session.activeMembershipId ?? (session.metadata['activeMembershipId'] as string) ?? '',
      availableStores: (session.metadata['availableStores'] as unknown[]) ?? [],
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  async set(token: string, session: SellerSessionRecord): Promise<void> {
    const existing = await this.repo.findByToken(token);
    const tokenHash = await hashSessionToken(token);
    const metadata = {
      userId: session.userId,
      userEmail: session.userEmail,
      userName: session.userName,
      activeStoreId: session.activeStoreId,
      activeMembershipId: session.activeMembershipId,
      availableStores: session.availableStores,
    };

    if (existing) {
      await this.client
        .from<DbAppSession>('app_sessions')
        .eq('token_hash', tokenHash)
        .update({
          user_id: toUuidOrNull(session.userId),
          store_id: toUuidOrNull(session.activeStoreId),
          active_membership_id: toUuidOrNull(session.activeMembershipId),
          role: String(session.activeRole),
          metadata,
          expires_at: session.expiresAt,
        });
    } else {
      const payload: Partial<DbAppSession> = {
        session_type: 'SELLER',
        token_hash: tokenHash,
        role: String(session.activeRole),
        metadata,
        expires_at: session.expiresAt,
      };
      const u = toUuidOrNull(session.userId);
      if (u) payload.user_id = u;
      const s = toUuidOrNull(session.activeStoreId);
      if (s) payload.store_id = s;
      const m = toUuidOrNull(session.activeMembershipId);
      if (m) payload.active_membership_id = m;

      await this.client.from<DbAppSession>('app_sessions').insert(payload);
    }
  }

  async delete(token: string): Promise<void> {
    await this.repo.revokeSession(token);
  }
}

export interface CustomerSessionRecord {
  readonly sessionToken: string;
  readonly storeId: string;
  readonly customerId: string;
  readonly customerName?: string | undefined;
  readonly customerEmail?: string | undefined;
  readonly customerPhone?: string | undefined;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export class CustomerSessionStoreAdapter {
  private readonly repo: SupabaseSessionRepository;
  private readonly client: PostgrestClient;

  constructor(repo: SupabaseSessionRepository, client: PostgrestClient) {
    this.repo = repo;
    this.client = client;
  }

  async get(token: string): Promise<CustomerSessionRecord | null> {
    const session = await this.repo.findByToken(token);
    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      return null;
    }
    return {
      sessionToken: token,
      storeId: session.storeId ?? (session.metadata['storeId'] as string) ?? '',
      customerId: (session.metadata['customerId'] as string) ?? session.userId ?? '',
      customerName: (session.metadata['customerName'] as string) ?? undefined,
      customerEmail: (session.metadata['customerEmail'] as string) ?? undefined,
      customerPhone: (session.metadata['customerPhone'] as string) ?? undefined,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  async set(token: string, session: CustomerSessionRecord): Promise<void> {
    const existing = await this.repo.findByToken(token);
    const tokenHash = await hashSessionToken(token);
    const metadata = {
      storeId: session.storeId,
      customerId: session.customerId,
      customerName: session.customerName,
      customerEmail: session.customerEmail,
      customerPhone: session.customerPhone,
    };

    if (existing) {
      await this.client
        .from<DbAppSession>('app_sessions')
        .eq('token_hash', tokenHash)
        .update({
          store_id: toUuidOrNull(session.storeId),
          user_id: toUuidOrNull(session.customerId),
          metadata,
          expires_at: session.expiresAt,
        });
    } else {
      const payload: Partial<DbAppSession> = {
        session_type: 'CUSTOMER',
        token_hash: tokenHash,
        role: 'CUSTOMER',
        metadata,
        expires_at: session.expiresAt,
      };
      const s = toUuidOrNull(session.storeId);
      if (s) payload.store_id = s;
      const u = toUuidOrNull(session.customerId);
      if (u) payload.user_id = u;

      await this.client.from<DbAppSession>('app_sessions').insert(payload);
    }
  }

  async delete(token: string): Promise<void> {
    await this.repo.revokeSession(token);
  }
}

export interface PlatformSessionRecord {
  readonly token: string;
  readonly userId: string;
  readonly email: string;
  readonly platformRole: unknown;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export class PlatformSessionStoreAdapter {
  private readonly repo: SupabaseSessionRepository;
  private readonly client: PostgrestClient;

  constructor(repo: SupabaseSessionRepository, client: PostgrestClient) {
    this.repo = repo;
    this.client = client;
  }

  async get(token: string): Promise<PlatformSessionRecord | null> {
    const session = await this.repo.findByToken(token);
    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      return null;
    }
    return {
      token: token,
      userId: session.userId ?? (session.metadata['userId'] as string) ?? '',
      email: (session.metadata['email'] as string) ?? '',
      platformRole: session.role,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  async set(token: string, session: PlatformSessionRecord): Promise<void> {
    const existing = await this.repo.findByToken(token);
    const tokenHash = await hashSessionToken(token);
    const metadata = {
      userId: session.userId,
      email: session.email,
    };

    if (existing) {
      await this.client
        .from<DbAppSession>('app_sessions')
        .eq('token_hash', tokenHash)
        .update({
          user_id: toUuidOrNull(session.userId),
          role: String(session.platformRole),
          metadata,
          expires_at: session.expiresAt,
        });
    } else {
      const payload: Partial<DbAppSession> = {
        session_type: 'PLATFORM',
        token_hash: tokenHash,
        role: String(session.platformRole),
        metadata,
        expires_at: session.expiresAt,
      };
      const u = toUuidOrNull(session.userId);
      if (u) payload.user_id = u;

      await this.client.from<DbAppSession>('app_sessions').insert(payload);
    }
  }

  async delete(token: string): Promise<void> {
    await this.repo.revokeSession(token);
  }
}
