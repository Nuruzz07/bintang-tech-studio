/**
 * Bintang Tech Studio — Platform Owner Console Type Definitions.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Provides domain models, DTOs, and view contracts for all 14 platform control plane modules:
 * A. Platform Overview
 * B. Stores / Tenants
 * C. Sellers / Users
 * D. Plans
 * E. Subscriptions
 * F. Billing / Invoices
 * G. Add-ons
 * H. Templates
 * I. Bots / Channels (Strict Secret Masking)
 * J. Orders Overview (PII Minimized)
 * K. Support / Tickets
 * L. Activity / Audit Logs (Append-Only)
 * M. System Health (Foundation / Abstraction)
 * N. Platform Settings / Policies
 */

import { PlatformRole, StoreRole } from '@bintang/tenancy';
import { SubscriptionStatus, InvoiceStatus } from '@bintang/billing';

// ============================================================================
// 1. PLATFORM CONTEXT & AUTHENTICATED SESSION
// ============================================================================

export interface PlatformSession {
  readonly token: string;
  readonly userId: string;
  readonly email: string;
  readonly platformRole: PlatformRole; // PLATFORM_OWNER | PLATFORM_ADMIN
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface PlatformCaller {
  readonly userId: string;
  readonly email: string;
  readonly platformRole: PlatformRole;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly requestId?: string | undefined;
}

// ============================================================================
// 2. MODULE A: PLATFORM OVERVIEW & METRICS
// ============================================================================

export interface StoreLifecycleSummary {
  readonly total: number;
  readonly active: number;
  readonly setup: number;
  readonly suspended: number;
  readonly archived: number;
}

export interface SubscriptionStatusSummary {
  readonly total: number;
  readonly active: number;
  readonly trial: number;
  readonly pastDue: number;
  readonly suspended: number;
  readonly cancelled: number;
  readonly expired: number;
}

export interface BillingVolumeSummary {
  readonly totalInvoices: number;
  readonly paidInvoices: number;
  readonly pendingInvoices: number;
  readonly totalBilledAmount: string; // IDR decimal string
  readonly totalCollectedAmount: string; // IDR decimal string
  readonly formattedTotalCollected: string;
}

export interface PlatformOverviewMetrics {
  readonly stores: StoreLifecycleSummary;
  readonly users: {
    readonly total: number;
    readonly owners: number;
    readonly admins: number;
    readonly regularUsers: number;
  };
  readonly subscriptions: SubscriptionStatusSummary;
  readonly billing: BillingVolumeSummary;
  readonly bots: {
    readonly total: number;
    readonly connected: number;
    readonly disconnected: number;
    readonly error: number;
  };
  readonly supportTickets: {
    readonly total: number;
    readonly open: number;
    readonly inProgress: number;
    readonly resolved: number;
  };
  readonly systemHealthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly classification: 'FOUNDATION_IN_MEMORY' | 'PRODUCTION_PERSISTED';
  readonly generatedAt: string;
}

// ============================================================================
// 3. MODULE B: STORES / TENANT MANAGEMENT
// ============================================================================

export type StoreLifecycleStatus = 'SETUP' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface PlatformStoreSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: StoreLifecycleStatus;
  readonly ownerUserId: string;
  readonly ownerEmail?: string | undefined;
  readonly templateVersionId: string | null;
  readonly currency: string;
  readonly memberCount: number;
  readonly activePlanSlug?: string | undefined;
  readonly subscriptionStatus?: SubscriptionStatus | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformStoreDetail extends PlatformStoreSummary {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly channels: readonly {
    readonly channel: 'TELEGRAM' | 'WHATSAPP';
    readonly status: string;
  }[];
  readonly bots: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly username?: string | null | undefined;
    readonly status: string;
    readonly channel: string;
  }[];
}

export interface StoreListFilter {
  readonly status?: StoreLifecycleStatus | undefined;
  readonly search?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface UpdateStoreStatusInput {
  readonly status: StoreLifecycleStatus;
  readonly reason: string;
}

// ============================================================================
// 4. MODULE C: SELLERS / USER MANAGEMENT
// ============================================================================

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface PlatformUserSummary {
  readonly id: string;
  readonly email: string;
  readonly fullName?: string | null | undefined;
  readonly platformRole: PlatformRole;
  readonly status: UserAccountStatus;
  readonly storesOwnedCount: number;
  readonly storeMembershipsCount: number;
  readonly createdAt: string;
}

export interface PlatformUserDetail extends PlatformUserSummary {
  readonly storesOwned: readonly {
    readonly storeId: string;
    readonly storeName: string;
    readonly storeSlug: string;
    readonly status: StoreLifecycleStatus;
  }[];
  readonly memberships: readonly {
    readonly storeId: string;
    readonly storeName: string;
    readonly role: StoreRole;
    readonly status: string;
  }[];
}

export interface UserListFilter {
  readonly platformRole?: PlatformRole | undefined;
  readonly status?: UserAccountStatus | undefined;
  readonly search?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface UpdateUserPlatformRoleInput {
  readonly targetUserId: string;
  readonly newPlatformRole: PlatformRole;
  readonly reason: string;
}

// ============================================================================
// 5. MODULE D & E: PLANS & SUBSCRIPTIONS
// ============================================================================

export interface PlatformPlanView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly monthlyPrice: string;
  readonly formattedMonthlyPrice: string;
  readonly activationFee: string;
  readonly formattedActivationFee: string;
  readonly maxProducts: number;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  readonly features: Readonly<Record<string, unknown>>;
  readonly subscriberCount: number;
  readonly isPlaceholder: boolean;
}

export interface PlatformSubscriptionSummary {
  readonly id: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly planId: string;
  readonly planSlug: string;
  readonly planName: string;
  readonly status: SubscriptionStatus;
  readonly startedAt: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelledAt: string | null;
  readonly cancelAtPeriodEnd?: boolean | undefined;
}

export interface SubscriptionListFilter {
  readonly status?: SubscriptionStatus | undefined;
  readonly planSlug?: string | undefined;
  readonly storeId?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface SubscriptionActionInput {
  readonly action: 'ACTIVATE' | 'SUSPEND' | 'RESUME' | 'CANCEL' | 'EXPIRE';
  readonly reason: string;
  readonly immediate?: boolean | undefined;
}

// ============================================================================
// 6. MODULE F & G: BILLING, INVOICES & ADD-ONS
// ============================================================================

export interface PlatformInvoiceSummary {
  readonly id: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly invoiceNumber: string;
  readonly status: InvoiceStatus;
  readonly subtotal: string;
  readonly tax: string;
  readonly discount: string;
  readonly total: string;
  readonly formattedTotal: string;
  readonly currency: string;
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly paidAt: string | null;
  readonly hasActivationFee: boolean;
  readonly itemCount: number;
}

export interface InvoiceListFilter {
  readonly status?: InvoiceStatus | undefined;
  readonly storeId?: string | undefined;
  readonly search?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface PlatformAddonSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null | undefined;
  readonly monthlyPrice: string;
  readonly formattedMonthlyPrice: string;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly activeAssignmentsCount: number;
}

// ============================================================================
// 7. MODULE H: TEMPLATE MANAGEMENT
// ============================================================================

export type TemplateVersionStatus =
  'DRAFT' | 'TESTING' | 'PUBLISHED' | 'DEPRECATED' | 'SUSPENDED' | 'ARCHIVED';

export interface PlatformTemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null | undefined;
  readonly versionsCount: number;
  readonly publishedVersion?: string | undefined;
  readonly storesUsingCount: number;
  readonly createdAt: string;
}

export interface PlatformTemplateVersionSummary {
  readonly id: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly version: string;
  readonly status: TemplateVersionStatus;
  readonly compatibilityVersion: string;
  readonly storesUsingCount: number;
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

// ============================================================================
// 8. MODULE I: BOT & CHANNEL MANAGEMENT (SAFE METADATA - NO SECRETS)
// ============================================================================

export type BotStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SUSPENDED';

export interface PlatformBotSummary {
  readonly id: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly channel: 'TELEGRAM' | 'WHATSAPP';
  readonly provider: string;
  readonly displayName: string;
  readonly username?: string | null | undefined;
  readonly externalBotId?: string | null | undefined;
  readonly status: BotStatus;
  readonly webhookStatus: string;
  readonly maskedCredentialRef: string; // e.g. "ref_tg_***92" (NEVER RAW TOKEN)
  readonly connectedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly createdAt: string;
}

export interface PlatformChannelSummary {
  readonly id: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly channel: 'TELEGRAM' | 'WHATSAPP';
  readonly status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  readonly configured: boolean;
  readonly createdAt: string;
}

// ============================================================================
// 9. MODULE J: ORDERS OVERVIEW (PII MINIMIZED)
// ============================================================================

export interface PlatformOrderOverviewMetrics {
  readonly totalOrders: number;
  readonly pendingOrders: number;
  readonly paidOrders: number;
  readonly completedOrders: number;
  readonly cancelledOrders: number;
  readonly totalOrderVolume: string; // IDR string
  readonly formattedTotalVolume: string;
}

export interface PlatformOrderSummary {
  readonly id: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly totalAmount: string;
  readonly formattedTotalAmount: string;
  readonly currency: string;
  readonly customerMaskedIdentity: string; // e.g. "usr_***123 (Tg)" - NEVER RAW PHONE/TOKEN
  readonly itemCount: number;
  readonly createdAt: string;
}

// ============================================================================
// 10. MODULE K: SUPPORT / TICKETS FOUNDATION
// ============================================================================

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface PlatformSupportTicket {
  readonly id: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly userId?: string | null | undefined;
  readonly userEmail?: string | undefined;
  readonly ticketNumber: string;
  readonly subject: string;
  readonly category: string;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  readonly assignedAdminId?: string | null | undefined;
  readonly assignedAdminName?: string | undefined;
  readonly internalNotesCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSupportTicketInput {
  readonly storeId: string;
  readonly userId?: string | undefined;
  readonly subject: string;
  readonly category?: string | undefined;
  readonly priority?: TicketPriority | undefined;
  readonly message: string;
}

export interface UpdateSupportTicketInput {
  readonly status?: TicketStatus | undefined;
  readonly priority?: TicketPriority | undefined;
  readonly assignedAdminId?: string | null | undefined;
  readonly internalNote?: string | undefined;
}

// ============================================================================
// 11. MODULE L: ACTIVITY & AUDIT LOGS (APPEND-ONLY)
// ============================================================================

export type AuditActionType =
  | 'STORE_STATUS_UPDATED'
  | 'STORE_SUSPENDED'
  | 'STORE_ACTIVATED'
  | 'USER_ROLE_UPDATED'
  | 'SUBSCRIPTION_STATE_CHANGED'
  | 'TEMPLATE_PUBLISHED'
  | 'TEMPLATE_SUSPENDED'
  | 'SUPPORT_TICKET_UPDATED'
  | 'PLATFORM_POLICY_UPDATED'
  | 'SYSTEM_MAINTENANCE_TOGGLED';

export type AuditResult = 'SUCCESS' | 'FAILED';

export interface PlatformAuditLog {
  readonly id: string;
  readonly actorUserId: string;
  readonly actorEmail: string;
  readonly platformRole: PlatformRole;
  readonly action: AuditActionType | string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly storeId?: string | null | undefined;
  readonly details: Readonly<Record<string, unknown>>; // Sanitized, no secrets
  readonly result: AuditResult;
  readonly errorMessage?: string | null | undefined;
  readonly ipAddress?: string | null | undefined;
  readonly userAgent?: string | null | undefined;
  readonly requestId?: string | null | undefined;
  readonly timestamp: string;
}

export interface AuditLogFilter {
  readonly actorUserId?: string | undefined;
  readonly storeId?: string | undefined;
  readonly action?: string | undefined;
  readonly resourceType?: string | undefined;
  readonly result?: AuditResult | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

// ============================================================================
// 12. MODULE M: SYSTEM HEALTH (FOUNDATION / ABSTRACTION)
// ============================================================================

export type ComponentHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'MAINTENANCE';

export interface PlatformComponentHealth {
  readonly name: string;
  readonly status: ComponentHealthStatus;
  readonly lastHeartbeat: string;
  readonly latencyMs?: number | undefined;
  readonly message?: string | undefined;
  readonly isSimulation: boolean; // Explicitly true for mock/foundation components
}

export interface PlatformHealthReport {
  readonly overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly components: readonly PlatformComponentHealth[];
  readonly uptimeSeconds: number;
  readonly environment: string;
  readonly checkedAt: string;
  readonly classification: 'FOUNDATION_ABSTRACTION' | 'LIVE_TELEMETRY';
}

// ============================================================================
// 13. MODULE N: PLATFORM SETTINGS & POLICIES
// ============================================================================

export interface PlatformPolicy {
  readonly key: string;
  readonly value: unknown;
  readonly description: string;
  readonly isOwnerOnly: boolean; // True requires PLATFORM_OWNER
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface UpdatePlatformPolicyInput {
  readonly key: string;
  readonly value: unknown;
  readonly reason: string;
}

// ============================================================================
// 14. UI SHELL & NAVIGATION CONTRACTS
// ============================================================================

export type OwnerConsoleTab =
  | 'overview'
  | 'stores'
  | 'users'
  | 'plans'
  | 'subscriptions'
  | 'billing'
  | 'templates'
  | 'bots'
  | 'orders'
  | 'support'
  | 'audit'
  | 'health'
  | 'settings';

export interface OwnerConsoleViewData {
  readonly activeTab: OwnerConsoleTab;
  readonly caller: PlatformCaller;
  readonly metrics?: PlatformOverviewMetrics | undefined;
  readonly stores?: readonly PlatformStoreSummary[] | undefined;
  readonly users?: readonly PlatformUserSummary[] | undefined;
  readonly plans?: readonly PlatformPlanView[] | undefined;
  readonly subscriptions?: readonly PlatformSubscriptionSummary[] | undefined;
  readonly invoices?: readonly PlatformInvoiceSummary[] | undefined;
  readonly templates?: readonly PlatformTemplateSummary[] | undefined;
  readonly bots?: readonly PlatformBotSummary[] | undefined;
  readonly orders?: readonly PlatformOrderSummary[] | undefined;
  readonly tickets?: readonly PlatformSupportTicket[] | undefined;
  readonly auditLogs?: readonly PlatformAuditLog[] | undefined;
  readonly health?: PlatformHealthReport | undefined;
  readonly policies?: readonly PlatformPolicy[] | undefined;
}
