/**
 * Bintang Tech Studio — Platform Owner Console Orchestration Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Coordinates platform control plane modules:
 * A. Platform Overview
 * B. Stores / Tenants
 * C. Sellers / Users
 * D. Plans
 * E. Subscriptions
 * F. Billing / Invoices
 * G. Add-ons
 * H. Templates
 * I. Bots / Channels
 * J. Orders Overview
 * K. Support / Tickets
 * L. Activity / Audit Logs
 * M. System Health
 * N. Platform Settings / Policies
 *
 * MANDATORY SECURITY PIPELINE:
 * token -> SessionManager -> PlatformCaller -> AuthorizationService -> Policy -> Sub-service -> AuditLog
 */

import {
  PlatformOverviewMetrics,
  PlatformStoreSummary,
  PlatformStoreDetail,
  StoreListFilter,
  StoreLifecycleStatus,
  PlatformUserSummary,
  PlatformUserDetail,
  UserListFilter,
  UpdateUserPlatformRoleInput,
  PlatformPlanView,
  PlatformSubscriptionSummary,
  SubscriptionListFilter,
  SubscriptionActionInput,
  PlatformInvoiceSummary,
  InvoiceListFilter,
  PlatformAddonSummary,
  PlatformTemplateSummary,
  PlatformTemplateVersionSummary,
  TemplateVersionStatus,
  PlatformBotSummary,
  PlatformChannelSummary,
  PlatformOrderOverviewMetrics,
  PlatformOrderSummary,
  PlatformSupportTicket,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
  PlatformAuditLog,
  AuditLogFilter,
  PlatformHealthReport,
  PlatformPolicy,
  UpdatePlatformPolicyInput,
  OwnerConsoleViewData,
  OwnerConsoleTab,
} from './types.js';
import { OwnerConsoleSessionManager } from './session-manager.js';
import { AuthorizationService } from '@bintang/authorization';
import { PlatformOverviewService } from './services/overview-service.js';
import { PlatformStoreService } from './services/store-service.js';
import { PlatformUserService } from './services/user-service.js';
import { PlatformBillingService } from './services/billing-service.js';
import { PlatformTemplateService } from './services/template-service.js';
import { PlatformBotService } from './services/bot-service.js';
import { PlatformOrderService } from './services/order-service.js';
import { PlatformSupportService } from './services/support-service.js';
import { PlatformAuditService } from './services/audit-service.js';
import { PlatformHealthService } from './services/health-service.js';
import { PlatformSettingsService } from './services/settings-service.js';
import { createPlatformContext } from '@bintang/tenancy';

export interface OwnerConsoleServiceDeps {
  readonly sessionManager: OwnerConsoleSessionManager;
  readonly authorizationService: AuthorizationService;
  readonly overviewService: PlatformOverviewService;
  readonly storeService: PlatformStoreService;
  readonly userService: PlatformUserService;
  readonly billingService: PlatformBillingService;
  readonly templateService: PlatformTemplateService;
  readonly botService: PlatformBotService;
  readonly orderService: PlatformOrderService;
  readonly supportService: PlatformSupportService;
  readonly auditService: PlatformAuditService;
  readonly healthService: PlatformHealthService;
  readonly settingsService: PlatformSettingsService;
}

export class OwnerConsoleService {
  constructor(private readonly deps: OwnerConsoleServiceDeps) {}

  // ==========================================================================
  // MODULE A: PLATFORM OVERVIEW
  // ==========================================================================

  public async getOverview(sessionToken: string): Promise<PlatformOverviewMetrics> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.analytics.read',
    });

    return this.deps.overviewService.getOverviewMetrics();
  }

  // ==========================================================================
  // MODULE B: STORES / TENANTS
  // ==========================================================================

  public async listStores(
    sessionToken: string,
    filter?: StoreListFilter,
  ): Promise<readonly PlatformStoreSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.read',
    });

    return this.deps.storeService.listStores(filter);
  }

  public async getStoreDetail(sessionToken: string, storeId: string): Promise<PlatformStoreDetail> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.read',
    });

    return this.deps.storeService.getStoreDetail(storeId);
  }

  public async updateStoreStatus(
    sessionToken: string,
    storeId: string,
    newStatus: StoreLifecycleStatus,
    reason: string,
  ): Promise<PlatformStoreSummary> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.manage',
    });

    return this.deps.storeService.updateStoreStatus(caller, storeId, newStatus, reason);
  }

  // ==========================================================================
  // MODULE C: SELLERS / USERS
  // ==========================================================================

  public async listUsers(
    sessionToken: string,
    filter?: UserListFilter,
  ): Promise<readonly PlatformUserSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.users.read',
    });

    return this.deps.userService.listUsers(filter);
  }

  public async getUserDetail(sessionToken: string, userId: string): Promise<PlatformUserDetail> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.users.read',
    });

    return this.deps.userService.getUserDetail(userId);
  }

  public async updateUserPlatformRole(
    sessionToken: string,
    input: UpdateUserPlatformRoleInput,
  ): Promise<PlatformUserSummary> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.system.manage', // Root owner-only permission required
    });

    return this.deps.userService.updateUserPlatformRole(caller, input);
  }

  // ==========================================================================
  // MODULE D & E: PLANS & SUBSCRIPTIONS
  // ==========================================================================

  public async listPlans(sessionToken: string): Promise<readonly PlatformPlanView[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.plans.manage',
    });

    return this.deps.billingService.listPlans();
  }

  public async listSubscriptions(
    sessionToken: string,
    filter?: SubscriptionListFilter,
  ): Promise<readonly PlatformSubscriptionSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.plans.manage',
    });

    return this.deps.billingService.listSubscriptions(filter);
  }

  public async executeSubscriptionAction(
    sessionToken: string,
    storeId: string,
    input: SubscriptionActionInput,
  ): Promise<PlatformSubscriptionSummary> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.plans.manage',
    });

    return this.deps.billingService.executeSubscriptionAction(caller, storeId, input);
  }

  // ==========================================================================
  // MODULE F & G: BILLING & ADD-ONS
  // ==========================================================================

  public async listInvoices(
    sessionToken: string,
    filter?: InvoiceListFilter,
  ): Promise<readonly PlatformInvoiceSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.plans.manage',
    });

    return this.deps.billingService.listInvoices(filter);
  }

  public async listAddons(sessionToken: string): Promise<readonly PlatformAddonSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.plans.manage',
    });

    return this.deps.billingService.listAddons();
  }

  // ==========================================================================
  // MODULE H: TEMPLATES
  // ==========================================================================

  public async listTemplates(sessionToken: string): Promise<readonly PlatformTemplateSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.templates.manage',
    });

    return this.deps.templateService.listTemplates();
  }

  public async updateTemplateVersionStatus(
    sessionToken: string,
    versionId: string,
    newStatus: TemplateVersionStatus,
    reason: string,
  ): Promise<PlatformTemplateVersionSummary> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.templates.manage',
    });

    return this.deps.templateService.updateVersionStatus(caller, versionId, newStatus, reason);
  }

  // ==========================================================================
  // MODULE I: BOTS & CHANNELS
  // ==========================================================================

  public async listBots(sessionToken: string): Promise<readonly PlatformBotSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.read',
    });

    return this.deps.botService.listBots();
  }

  public async listChannels(sessionToken: string): Promise<readonly PlatformChannelSummary[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.read',
    });

    return this.deps.botService.listChannels();
  }

  // ==========================================================================
  // MODULE J: ORDERS OVERVIEW
  // ==========================================================================

  public async getOrderOverview(sessionToken: string): Promise<{
    metrics: PlatformOrderOverviewMetrics;
    recentOrders: readonly PlatformOrderSummary[];
  }> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.analytics.read',
    });

    const metrics = await this.deps.orderService.getOrderMetrics();
    const recentOrders = await this.deps.orderService.listRecentOrders();
    return { metrics, recentOrders };
  }

  // ==========================================================================
  // MODULE K: SUPPORT / TICKETS
  // ==========================================================================

  public async listTickets(
    sessionToken: string,
    filter?: { storeId?: string | undefined; status?: string | undefined },
  ): Promise<readonly PlatformSupportTicket[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.read',
    });

    return this.deps.supportService.listTickets(filter);
  }

  public async createTicket(
    sessionToken: string,
    input: CreateSupportTicketInput,
  ): Promise<PlatformSupportTicket> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.manage',
    });

    return this.deps.supportService.createTicket(caller, input);
  }

  public async updateTicket(
    sessionToken: string,
    ticketId: string,
    updates: UpdateSupportTicketInput,
  ): Promise<PlatformSupportTicket> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.stores.manage',
    });

    return this.deps.supportService.updateTicket(caller, ticketId, updates);
  }

  // ==========================================================================
  // MODULE L: AUDIT LOGS
  // ==========================================================================

  public async listAuditLogs(
    sessionToken: string,
    filter?: AuditLogFilter,
  ): Promise<readonly PlatformAuditLog[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.analytics.read',
    });

    return this.deps.auditService.listLogs(filter);
  }

  // ==========================================================================
  // MODULE M: SYSTEM HEALTH
  // ==========================================================================

  public async getSystemHealth(sessionToken: string): Promise<PlatformHealthReport> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.analytics.read',
    });

    return this.deps.healthService.getHealthReport();
  }

  // ==========================================================================
  // MODULE N: PLATFORM SETTINGS & POLICIES
  // ==========================================================================

  public async listPolicies(sessionToken: string): Promise<readonly PlatformPolicy[]> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.analytics.read',
    });

    return this.deps.settingsService.listPolicies();
  }

  public async updatePolicy(
    sessionToken: string,
    input: UpdatePlatformPolicyInput,
  ): Promise<PlatformPolicy> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);
    // Requires platform.system.manage for sensitive toggles
    await this.deps.authorizationService.assertAuthorizedPlatformAction({
      context: createPlatformContext({ userId: caller.userId, platformRole: caller.platformRole }),
      permission: 'platform.system.manage',
    });

    return this.deps.settingsService.updatePolicy(caller, input);
  }

  // ==========================================================================
  // UI VIEW DATA AGGREGATOR
  // ==========================================================================

  public async getViewData(
    sessionToken: string,
    tab: OwnerConsoleTab = 'overview',
  ): Promise<OwnerConsoleViewData> {
    const caller = await this.deps.sessionManager.resolveCaller(sessionToken);

    const data: OwnerConsoleViewData = {
      activeTab: tab,
      caller,
    };

    switch (tab) {
      case 'overview':
        return { ...data, metrics: await this.getOverview(sessionToken) };
      case 'stores':
        return { ...data, stores: await this.listStores(sessionToken) };
      case 'users':
        return { ...data, users: await this.listUsers(sessionToken) };
      case 'plans':
        return { ...data, plans: await this.listPlans(sessionToken) };
      case 'subscriptions':
        return { ...data, subscriptions: await this.listSubscriptions(sessionToken) };
      case 'billing':
        return { ...data, invoices: await this.listInvoices(sessionToken) };
      case 'templates':
        return { ...data, templates: await this.listTemplates(sessionToken) };
      case 'bots':
        return { ...data, bots: await this.listBots(sessionToken) };
      case 'orders': {
        const o = await this.getOrderOverview(sessionToken);
        return { ...data, orders: o.recentOrders };
      }
      case 'support':
        return { ...data, tickets: await this.listTickets(sessionToken) };
      case 'audit':
        return { ...data, auditLogs: await this.listAuditLogs(sessionToken) };
      case 'health':
        return { ...data, health: await this.getSystemHealth(sessionToken) };
      case 'settings':
        return { ...data, policies: await this.listPolicies(sessionToken) };
      default:
        return data;
    }
  }
}
