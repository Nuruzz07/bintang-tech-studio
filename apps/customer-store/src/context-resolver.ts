/**
 * Bintang Tech Studio — Store Context & Customer Session Resolvers.
 * Baseline: Milestone M10 Customer Store Migration.
 *
 * Golden Rule: Every business operation MUST execute within an explicit Store Context.
 * NEVER trust a client-supplied store_id as authorization proof.
 */

import { AuthenticatedStoreContext, createAuthenticatedStoreContext } from '@bintang/tenancy';
import { CustomerContext } from '@bintang/orders';
import { ResolvedStoreContext, CustomerSession } from './types.js';
import {
  StoreContextResolutionError,
  CustomerSessionError,
  CustomerAccessDeniedError,
} from './errors.js';

export interface StoreMappingConfig {
  readonly storeId: string;
  readonly storeName: string;
  readonly tenantSlug: string;
  readonly domain?: string | undefined;
  readonly currency?: string | undefined;
}

/**
 * Server-side Store Context Resolver.
 * Maps hostnames, route slugs, or application configuration to an authoritative Store Context.
 * Strips and ignores any untrusted client-supplied store_id parameters.
 */
export class StoreContextResolver {
  private readonly storeRegistry = new Map<string, StoreMappingConfig>();
  private readonly domainIndex = new Map<string, string>(); // domain -> storeId
  private readonly slugIndex = new Map<string, string>(); // slug -> storeId
  private defaultStoreId: string | null = null;

  constructor(initialConfigs: readonly StoreMappingConfig[] = [], defaultStoreId?: string) {
    for (const config of initialConfigs) {
      this.registerStore(config);
    }
    if (defaultStoreId) {
      this.defaultStoreId = defaultStoreId;
    }
  }

  public registerStore(config: StoreMappingConfig): void {
    this.storeRegistry.set(config.storeId, config);
    this.slugIndex.set(config.tenantSlug.toLowerCase(), config.storeId);
    if (config.domain) {
      this.domainIndex.set(config.domain.toLowerCase(), config.storeId);
    }
    if (!this.defaultStoreId) {
      this.defaultStoreId = config.storeId;
    }
  }

  /**
   * Resolves the authoritative store context based on domain or tenant slug.
   * If neither is provided, falls back to the configured default store.
   * Untrusted client inputs cannot override this resolution.
   */
  public resolveStore(input?: {
    domain?: string | undefined;
    slug?: string | undefined;
  }): ResolvedStoreContext {
    let matchedStoreId: string | undefined;

    if (input?.domain) {
      const normalizedDomain = input.domain.toLowerCase().trim();
      matchedStoreId = this.domainIndex.get(normalizedDomain);
    }

    if (!matchedStoreId && input?.slug) {
      const normalizedSlug = input.slug.toLowerCase().trim();
      matchedStoreId = this.slugIndex.get(normalizedSlug);
    }

    if (!matchedStoreId && this.defaultStoreId) {
      matchedStoreId = this.defaultStoreId;
    }

    if (!matchedStoreId) {
      throw new StoreContextResolutionError(
        'Unable to resolve store context: no matching tenant or default configured',
      );
    }

    const config = this.storeRegistry.get(matchedStoreId);
    if (!config) {
      throw new StoreContextResolutionError(
        `Store configuration not found for resolved store ID "${matchedStoreId}"`,
      );
    }

    return {
      storeId: config.storeId,
      storeName: config.storeName,
      tenantSlug: config.tenantSlug,
      domain: config.domain,
      currency: config.currency ?? 'IDR',
    };
  }

  /**
   * Generates a tenancy-compliant AuthenticatedStoreContext for internal service calls.
   */
  public toStoreContext(resolved: ResolvedStoreContext): AuthenticatedStoreContext {
    return createAuthenticatedStoreContext({
      storeId: resolved.storeId,
      tenantSlug: resolved.tenantSlug,
      userId: `system:customer-store:${resolved.storeId}`,
      membershipId: `sys_mem_${resolved.storeId}`,
      role: 'STORE_ADMIN',
    });
  }
}

/**
 * Customer Session Manager.
 * Issues and validates session tokens, binding each customer strictly to a verified store context.
 */
export interface ICustomerSessionStore {
  get(token: string): Promise<CustomerSession | null>;
  set(token: string, session: CustomerSession): Promise<void>;
  delete(token: string): Promise<void>;
}

export class CustomerSessionManager {
  private readonly sessions = new Map<string, CustomerSession>();

  constructor(private readonly sessionStore?: ICustomerSessionStore | undefined) {}

  /**
   * Creates an authenticated customer session.
   */
  public createSession(input: {
    storeId: string;
    customerId: string;
    customerName?: string | undefined;
    customerEmail?: string | undefined;
    customerPhone?: string | undefined;
    ttlSeconds?: number | undefined;
  }): CustomerSession {
    const sessionToken = `csess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();
    const ttl = input.ttlSeconds ?? 86400 * 7; // 7 days default
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    const session: CustomerSession = {
      sessionToken,
      storeId: input.storeId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.sessions.set(sessionToken, session);
    if (this.sessionStore) {
      void this.sessionStore.set(sessionToken, session);
    }
    return session;
  }

  /**
   * Asynchronously creates an authenticated customer session, awaiting durable persistence.
   */
  public async createSessionAsync(input: {
    storeId: string;
    customerId: string;
    customerName?: string | undefined;
    customerEmail?: string | undefined;
    customerPhone?: string | undefined;
    ttlSeconds?: number | undefined;
  }): Promise<CustomerSession> {
    const sessionToken = `csess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();
    const ttl = input.ttlSeconds ?? 86400 * 7; // 7 days default
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    const session: CustomerSession = {
      sessionToken,
      storeId: input.storeId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.sessions.set(sessionToken, session);
    if (this.sessionStore) {
      await this.sessionStore.set(sessionToken, session);
    }
    return session;
  }

  /**
   * Resolves and verifies a customer session token against the expected store.
   */
  public resolveSession(sessionToken: string, expectedStoreId: string): CustomerSession {
    if (!sessionToken || typeof sessionToken !== 'string') {
      throw new CustomerSessionError('Missing customer session token');
    }

    const session = this.sessions.get(sessionToken);
    if (!session) {
      throw new CustomerSessionError('Invalid customer session token');
    }

    const now = new Date().toISOString();
    if (session.expiresAt < now) {
      this.sessions.delete(sessionToken);
      if (this.sessionStore) {
        void this.sessionStore.delete(sessionToken);
      }
      throw new CustomerSessionError('Customer session has expired');
    }

    if (session.storeId !== expectedStoreId) {
      throw new CustomerAccessDeniedError('Customer session belongs to a different store');
    }

    return session;
  }

  /**
   * Asynchronously resolves session, fetching from durable store if not present in memory.
   */
  public async resolveSessionAsync(
    sessionToken: string,
    expectedStoreId: string,
  ): Promise<CustomerSession> {
    if (!sessionToken || typeof sessionToken !== 'string') {
      throw new CustomerSessionError('Missing customer session token');
    }

    let session = this.sessions.get(sessionToken);
    if (!session && this.sessionStore) {
      session = (await this.sessionStore.get(sessionToken)) ?? undefined;
      if (session) {
        this.sessions.set(sessionToken, session);
      }
    }

    if (!session) {
      throw new CustomerSessionError('Invalid customer session token');
    }

    const now = new Date().toISOString();
    if (session.expiresAt < now) {
      this.sessions.delete(sessionToken);
      if (this.sessionStore) {
        await this.sessionStore.delete(sessionToken);
      }
      throw new CustomerSessionError('Customer session has expired');
    }

    if (session.storeId !== expectedStoreId) {
      throw new CustomerAccessDeniedError('Customer session belongs to a different store');
    }

    return session;
  }

  /**
   * Derives a CustomerContext for orders/payments/fulfillment service calls.
   */
  public toCustomerContext(session: CustomerSession): CustomerContext {
    return {
      storeId: session.storeId,
      customerId: session.customerId,
      name: session.customerName,
      email: session.customerEmail,
    };
  }
}
