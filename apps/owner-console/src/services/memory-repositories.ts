/**
 * Bintang Tech Studio — In-Memory Owner Console Repository Adapters.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import {
  PlatformUserSummary,
  UserAccountStatus,
  UserListFilter,
  PlatformSupportTicket,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
  PlatformAuditLog,
  AuditLogFilter,
  PlatformHealthReport,
  PlatformComponentHealth,
  PlatformPolicy,
  PlatformTemplateSummary,
  PlatformTemplateVersionSummary,
  TemplateVersionStatus,
} from '../types.js';
import {
  PlatformStoreRepository,
  PlatformUserRepository,
  PlatformSupportTicketRepository,
  PlatformAuditLogRepository,
  PlatformHealthRepository,
  PlatformSettingsRepository,
  PlatformTemplateRepository,
} from './interfaces.js';
import { PlatformRole, Store } from '@bintang/tenancy';
import {
  PlatformUserNotFoundError,
  PlatformTicketNotFoundError,
  PlatformPolicyNotFoundError,
} from '../errors.js';

// ============================================================================
// 0. IN-MEMORY PLATFORM STORE REPOSITORY
// ============================================================================

export class InMemoryPlatformStoreRepository implements PlatformStoreRepository {
  private readonly stores = new Map<string, Store>();

  async list(filter?: {
    status?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<readonly Store[]> {
    let result = Array.from(this.stores.values());
    if (filter?.status) {
      result = result.filter((s) => s.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
      );
    }
    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  async findById(id: string): Promise<Store | null> {
    return this.stores.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Store | null> {
    for (const store of this.stores.values()) {
      if (store.slug.toLowerCase() === slug.toLowerCase()) {
        return store;
      }
    }
    return null;
  }

  async findByOwnerUserId(ownerUserId: string): Promise<Store[]> {
    return Array.from(this.stores.values()).filter((s) => s.ownerUserId === ownerUserId);
  }

  async create(store: Omit<Store, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Store> {
    const id = store.id || `store_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    const newStore: Store = {
      ...store,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.stores.set(id, newStore);
    return newStore;
  }

  async update(
    id: string,
    updates: Partial<Omit<Store, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) {
      throw new Error(`Store with id ${id} not found`);
    }
    const updated: Store = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.stores.set(id, updated);
    return updated;
  }

  async updateOwner(id: string, newOwnerUserId: string): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) {
      throw new Error(`Store with id ${id} not found`);
    }
    const updated: Store = {
      ...existing,
      ownerUserId: newOwnerUserId,
      updatedAt: new Date().toISOString(),
    };
    this.stores.set(id, updated);
    return updated;
  }
}

// ============================================================================
// 1. IN-MEMORY USER REPOSITORY
// ============================================================================

export const DEFAULT_PLATFORM_USERS: readonly PlatformUserSummary[] = [
  {
    id: 'usr_plat_owner_1',
    email: 'owner@bintang.tech',
    fullName: 'Bintang Platform Owner',
    platformRole: 'PLATFORM_OWNER',
    status: 'ACTIVE',
    storesOwnedCount: 1,
    storeMembershipsCount: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'usr_plat_admin_1',
    email: 'admin@bintang.tech',
    fullName: 'Bintang Platform Ops Admin',
    platformRole: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
    storesOwnedCount: 0,
    storeMembershipsCount: 0,
    createdAt: '2026-10-02T00:00:00.000Z',
  },
  {
    id: 'usr_seller_1',
    email: 'seller1@example.com',
    fullName: 'Merchant Seller One',
    platformRole: 'USER',
    status: 'ACTIVE',
    storesOwnedCount: 1,
    storeMembershipsCount: 1,
    createdAt: '2026-10-03T00:00:00.000Z',
  },
];

export class InMemoryPlatformUserRepository implements PlatformUserRepository {
  private users = new Map<string, PlatformUserSummary>();

  constructor(initialUsers: readonly PlatformUserSummary[] = DEFAULT_PLATFORM_USERS) {
    for (const u of initialUsers) {
      this.users.set(u.id, { ...u });
    }
  }

  public async list(filter?: UserListFilter): Promise<readonly PlatformUserSummary[]> {
    let result = Array.from(this.users.values());
    if (filter?.platformRole) {
      result = result.filter((u) => u.platformRole === filter.platformRole);
    }
    if (filter?.status) {
      result = result.filter((u) => u.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) || (u.fullName && u.fullName.toLowerCase().includes(q)),
      );
    }
    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  public async findById(id: string): Promise<PlatformUserSummary | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  public async findByEmail(email: string): Promise<PlatformUserSummary | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u };
      }
    }
    return null;
  }

  public async create(user: PlatformUserSummary): Promise<PlatformUserSummary> {
    const copy = { ...user };
    this.users.set(copy.id, copy);
    return { ...copy };
  }

  public async updatePlatformRole(id: string, newRole: PlatformRole): Promise<PlatformUserSummary> {
    const user = this.users.get(id);
    if (!user) throw new PlatformUserNotFoundError(id);
    const updated: PlatformUserSummary = { ...user, platformRole: newRole };
    this.users.set(id, updated);
    return { ...updated };
  }

  public async updateStatus(
    id: string,
    newStatus: UserAccountStatus,
  ): Promise<PlatformUserSummary> {
    const user = this.users.get(id);
    if (!user) throw new PlatformUserNotFoundError(id);
    const updated: PlatformUserSummary = { ...user, status: newStatus };
    this.users.set(id, updated);
    return { ...updated };
  }

  public async countByRole(role: PlatformRole): Promise<number> {
    let count = 0;
    for (const u of this.users.values()) {
      if (u.platformRole === role) count++;
    }
    return count;
  }
}

// ============================================================================
// 2. IN-MEMORY SUPPORT TICKET REPOSITORY
// ============================================================================

export class InMemoryPlatformSupportTicketRepository implements PlatformSupportTicketRepository {
  private tickets = new Map<string, PlatformSupportTicket>();

  public async list(filter?: {
    storeId?: string | undefined;
    status?: string | undefined;
  }): Promise<readonly PlatformSupportTicket[]> {
    let result = Array.from(this.tickets.values());
    if (filter?.storeId) {
      result = result.filter((t) => t.storeId === filter.storeId);
    }
    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    return result;
  }

  public async findById(id: string): Promise<PlatformSupportTicket | null> {
    const ticket = this.tickets.get(id);
    return ticket ? { ...ticket } : null;
  }

  public async create(
    input: CreateSupportTicketInput,
    ticketNumber: string,
  ): Promise<PlatformSupportTicket> {
    const now = new Date().toISOString();
    const ticket: PlatformSupportTicket = {
      id: `tck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      storeId: input.storeId,
      storeName: `Store ${input.storeId}`,
      userId: input.userId,
      ticketNumber,
      subject: input.subject,
      category: input.category || 'GENERAL',
      priority: input.priority || 'NORMAL',
      status: 'OPEN',
      internalNotesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(ticket.id, ticket);
    return { ...ticket };
  }

  public async update(
    id: string,
    updates: UpdateSupportTicketInput,
  ): Promise<PlatformSupportTicket> {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new PlatformTicketNotFoundError(id);
    const updated: PlatformSupportTicket = {
      ...ticket,
      status: updates.status || ticket.status,
      priority: updates.priority || ticket.priority,
      assignedAdminId:
        updates.assignedAdminId !== undefined ? updates.assignedAdminId : ticket.assignedAdminId,
      internalNotesCount: updates.internalNote
        ? ticket.internalNotesCount + 1
        : ticket.internalNotesCount,
      updatedAt: new Date().toISOString(),
    };
    this.tickets.set(id, updated);
    return { ...updated };
  }

  public async countByStatus(status: string): Promise<number> {
    let count = 0;
    for (const t of this.tickets.values()) {
      if (t.status === status) count++;
    }
    return count;
  }
}

// ============================================================================
// 3. IN-MEMORY AUDIT LOG REPOSITORY (APPEND-ONLY)
// ============================================================================

export class InMemoryPlatformAuditLogRepository implements PlatformAuditLogRepository {
  private logs: PlatformAuditLog[] = [];

  public async append(log: PlatformAuditLog): Promise<PlatformAuditLog> {
    const copy = { ...log };
    this.logs.unshift(copy); // latest first
    return { ...copy };
  }

  public async list(filter?: AuditLogFilter): Promise<readonly PlatformAuditLog[]> {
    let result = [...this.logs];
    if (filter?.actorUserId) {
      result = result.filter((l) => l.actorUserId === filter.actorUserId);
    }
    if (filter?.storeId) {
      result = result.filter((l) => l.storeId === filter.storeId);
    }
    if (filter?.action) {
      result = result.filter((l) => l.action === filter.action);
    }
    if (filter?.resourceType) {
      result = result.filter((l) => l.resourceType === filter.resourceType);
    }
    if (filter?.result) {
      result = result.filter((l) => l.result === filter.result);
    }
    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  public async findById(id: string): Promise<PlatformAuditLog | null> {
    const log = this.logs.find((l) => l.id === id);
    return log ? { ...log } : null;
  }
}

// ============================================================================
// 4. IN-MEMORY HEALTH REPOSITORY (FOUNDATION / ABSTRACTION)
// ============================================================================

export class InMemoryPlatformHealthRepository implements PlatformHealthRepository {
  private components = new Map<string, PlatformComponentHealth>([
    [
      'api',
      {
        name: 'API Gateway & Services',
        status: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        latencyMs: 12,
        isSimulation: true,
      },
    ],
    [
      'database',
      {
        name: 'Supabase PostgreSQL (nowyzlyruzlokiejvtne)',
        status: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        latencyMs: 24,
        isSimulation: true,
      },
    ],
    [
      'bot_engine',
      {
        name: 'Telegram Bot Engine',
        status: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        latencyMs: 45,
        isSimulation: true,
      },
    ],
    [
      'billing_gateway',
      {
        name: 'Billing Gateway Adapter (Mock)',
        status: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        latencyMs: 5,
        isSimulation: true,
      },
    ],
    [
      'webhook_worker',
      {
        name: 'Webhook Event Processor',
        status: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        latencyMs: 10,
        isSimulation: true,
      },
    ],
    [
      'storage',
      {
        name: 'Cloud Storage & CDN',
        status: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        latencyMs: 18,
        isSimulation: true,
      },
    ],
  ]);

  public async getLatestReport(): Promise<PlatformHealthReport> {
    const components = Array.from(this.components.values());
    const hasUnhealthy = components.some((c) => c.status === 'UNHEALTHY');
    const hasDegraded = components.some((c) => c.status === 'DEGRADED');

    const overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = hasUnhealthy
      ? 'UNHEALTHY'
      : hasDegraded
        ? 'DEGRADED'
        : 'HEALTHY';

    return {
      overallStatus,
      components,
      uptimeSeconds: 86400,
      environment: 'foundation-staging',
      checkedAt: new Date().toISOString(),
      classification: 'FOUNDATION_ABSTRACTION',
    };
  }

  public async updateComponentStatus(
    name: string,
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'MAINTENANCE',
    message?: string,
    latencyMs?: number,
  ): Promise<PlatformComponentHealth> {
    const existing = this.components.get(name) || {
      name,
      status,
      lastHeartbeat: new Date().toISOString(),
      isSimulation: true,
    };
    const updated: PlatformComponentHealth = {
      ...existing,
      status,
      lastHeartbeat: new Date().toISOString(),
      message,
      latencyMs: latencyMs !== undefined ? latencyMs : existing.latencyMs,
    };
    this.components.set(name, updated);
    return { ...updated };
  }
}

// ============================================================================
// 5. IN-MEMORY SETTINGS & POLICIES REPOSITORY
// ============================================================================

export class InMemoryPlatformSettingsRepository implements PlatformSettingsRepository {
  private policies = new Map<string, PlatformPolicy>([
    [
      'platform.maintenance_mode',
      {
        key: 'platform.maintenance_mode',
        value: false,
        description: 'Toggles global platform maintenance mode for merchants and storefronts',
        isOwnerOnly: true,
        updatedAt: '2026-10-01T00:00:00.000Z',
        updatedBy: 'usr_plat_owner_1',
      },
    ],
    [
      'platform.onboarding_enabled',
      {
        key: 'platform.onboarding_enabled',
        value: true,
        description: 'Controls whether new merchant onboarding registrations are accepted',
        isOwnerOnly: false,
        updatedAt: '2026-10-01T00:00:00.000Z',
        updatedBy: 'usr_plat_owner_1',
      },
    ],
    [
      'platform.allowed_channels',
      {
        key: 'platform.allowed_channels',
        value: ['TELEGRAM', 'WHATSAPP'],
        description: 'Whitelist of allowed commerce channel integrations',
        isOwnerOnly: false,
        updatedAt: '2026-10-01T00:00:00.000Z',
        updatedBy: 'usr_plat_owner_1',
      },
    ],
  ]);

  public async listPolicies(): Promise<readonly PlatformPolicy[]> {
    return Array.from(this.policies.values()).map((p) => ({ ...p }));
  }

  public async getPolicyByKey(key: string): Promise<PlatformPolicy | null> {
    const p = this.policies.get(key);
    return p ? { ...p } : null;
  }

  public async setPolicy(key: string, value: unknown, updatedBy: string): Promise<PlatformPolicy> {
    const existing = this.policies.get(key);
    if (!existing) throw new PlatformPolicyNotFoundError(key);
    const updated: PlatformPolicy = {
      ...existing,
      value,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    this.policies.set(key, updated);
    return { ...updated };
  }
}

// ============================================================================
// 6. IN-MEMORY TEMPLATE REPOSITORY
// ============================================================================

export class InMemoryPlatformTemplateRepository implements PlatformTemplateRepository {
  private templates: PlatformTemplateSummary[] = [
    {
      id: 'tmpl_official_store_01',
      name: 'Template 01 — Modern Storefront',
      slug: 'template-01',
      description: 'Default high-conversion Telegram Mini App and Web storefront template',
      versionsCount: 1,
      publishedVersion: '1.0.0',
      storesUsingCount: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  private versions: PlatformTemplateVersionSummary[] = [
    {
      id: 'tmpl_ver_1',
      templateId: 'tmpl_official_store_01',
      templateName: 'Template 01 — Modern Storefront',
      version: '1.0.0',
      status: 'PUBLISHED',
      compatibilityVersion: '1.0',
      storesUsingCount: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      publishedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  public async listTemplates(): Promise<readonly PlatformTemplateSummary[]> {
    return this.templates.map((t) => ({ ...t }));
  }

  public async listVersions(
    templateId?: string,
  ): Promise<readonly PlatformTemplateVersionSummary[]> {
    if (templateId) {
      return this.versions.filter((v) => v.templateId === templateId).map((v) => ({ ...v }));
    }
    return this.versions.map((v) => ({ ...v }));
  }

  public async findById(templateId: string): Promise<PlatformTemplateSummary | null> {
    const t = this.templates.find((x) => x.id === templateId);
    return t ? { ...t } : null;
  }

  public async findVersionById(versionId: string): Promise<PlatformTemplateVersionSummary | null> {
    const v = this.versions.find((x) => x.id === versionId);
    return v ? { ...v } : null;
  }

  public async updateVersionStatus(
    versionId: string,
    status: TemplateVersionStatus,
  ): Promise<PlatformTemplateVersionSummary> {
    const idx = this.versions.findIndex((x) => x.id === versionId);
    if (idx === -1) throw new Error(`Template version not found: ${versionId}`);
    const existing = this.versions[idx]!;
    const updated: PlatformTemplateVersionSummary = {
      ...existing,
      status,
      publishedAt: status === 'PUBLISHED' ? new Date().toISOString() : existing.publishedAt,
    };
    this.versions[idx] = updated;
    return { ...updated };
  }
}
