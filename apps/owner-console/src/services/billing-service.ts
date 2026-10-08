/**
 * Bintang Tech Studio — Platform Billing, Plans, Subscriptions & Invoices Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Integrates authoritatively with M13 @bintang/billing:
 * - Never duplicates pricing or entitlement calculation.
 * - Enforces financial immutability for final invoices and payments.
 * - Executes subscription lifecycle actions strictly through the M13 state machine.
 */

import {
  PlatformPlanView,
  PlatformSubscriptionSummary,
  SubscriptionListFilter,
  SubscriptionActionInput,
  PlatformInvoiceSummary,
  InvoiceListFilter,
  PlatformAddonSummary,
  PlatformCaller,
} from '../types.js';
import {
  BillingService,
  PlanRepository,
  SubscriptionRepository,
  InvoiceRepository,
  AddonRepository,
  StoreAddonRepository,
  formatCurrency,
  SubscriptionStatus,
} from '@bintang/billing';
import { PlatformStoreRepository } from './interfaces.js';
import { PlatformAuditService } from './audit-service.js';

export interface PlatformBillingServiceDeps {
  readonly billingService: BillingService;
  readonly planRepository: PlanRepository;
  readonly subscriptionRepository: SubscriptionRepository;
  readonly invoiceRepository: InvoiceRepository;
  readonly addonRepository?: AddonRepository | undefined;
  readonly storeAddonRepository?: StoreAddonRepository | undefined;
  readonly storeRepository?: PlatformStoreRepository | undefined;
  readonly auditService: PlatformAuditService;
}

export class PlatformBillingService {
  constructor(private readonly deps: PlatformBillingServiceDeps) {}

  // ==========================================================================
  // 1. PLANS
  // ==========================================================================

  public async listPlans(): Promise<readonly PlatformPlanView[]> {
    const plans = await this.deps.planRepository.list();
    const result: PlatformPlanView[] = [];

    for (const p of plans) {
      result.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        monthlyPrice: p.monthlyPrice,
        formattedMonthlyPrice: formatCurrency(p.monthlyPrice),
        activationFee: p.activationFee,
        formattedActivationFee: formatCurrency(p.activationFee),
        maxProducts: p.maxProducts,
        status: p.status,
        features: p.features,
        subscriberCount: 0,
        isPlaceholder: p.slug === 'pro' || p.slug === 'business',
      });
    }

    return result;
  }

  // ==========================================================================
  // 2. SUBSCRIPTIONS
  // ==========================================================================

  public async listSubscriptions(
    filter?: SubscriptionListFilter,
  ): Promise<readonly PlatformSubscriptionSummary[]> {
    // Collect subscriptions across stores
    const stores = this.deps.storeRepository ? await this.deps.storeRepository.list() : [];
    const result: PlatformSubscriptionSummary[] = [];

    for (const s of stores) {
      if (filter?.storeId && s.id !== filter.storeId) continue;

      const sub = await this.deps.subscriptionRepository.findByStoreId(s.id);
      if (!sub) continue;

      if (filter?.status && sub.status !== filter.status) continue;

      const plan = await this.deps.planRepository.findById(sub.planId);
      if (filter?.planSlug && plan?.slug !== filter.planSlug) continue;

      result.push({
        id: sub.id,
        storeId: s.id,
        storeName: s.name,
        planId: sub.planId,
        planSlug: plan?.slug || 'starter',
        planName: plan?.name || 'Starter Merchant',
        status: sub.status,
        startedAt: sub.startedAt,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelledAt: sub.cancelledAt,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      });
    }

    if (filter?.offset) {
      return result.slice(filter.offset);
    }
    if (filter?.limit) {
      return result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Executes controlled subscription lifecycle action through M13 service.
   */
  public async executeSubscriptionAction(
    caller: PlatformCaller,
    storeId: string,
    input: SubscriptionActionInput,
  ): Promise<PlatformSubscriptionSummary> {
    const sub = await this.deps.subscriptionRepository.findByStoreId(storeId);
    if (!sub) {
      throw new Error(`Subscription for store ${storeId} not found`);
    }

    const previousStatus = sub.status;
    const platformBillingCaller = {
      type: 'PLATFORM' as const,
      userId: caller.userId,
      storeId,
    };

    try {
      let updatedSub;
      switch (input.action) {
        case 'ACTIVATE':
        case 'RESUME':
          updatedSub = await this.deps.billingService.activateSubscription(
            platformBillingCaller,
            storeId,
            sub.id,
          );
          break;
        case 'SUSPEND':
          updatedSub = await this.deps.billingService.suspendSubscription(
            platformBillingCaller,
            storeId,
            input.reason,
          );
          break;
        case 'CANCEL':
          updatedSub = await this.deps.billingService.cancelSubscription(
            platformBillingCaller,
            storeId,
            { immediate: input.immediate ?? true, reason: input.reason },
          );
          break;
        case 'EXPIRE':
          updatedSub = await this.deps.billingService.expireSubscription(
            platformBillingCaller,
            storeId,
          );
          break;
      }

      await this.deps.auditService.logAction({
        caller,
        action: 'SUBSCRIPTION_STATE_CHANGED',
        resourceType: 'subscription',
        resourceId: sub.id,
        storeId,
        details: {
          action: input.action,
          previousStatus,
          newStatus: updatedSub.status,
          reason: input.reason,
        },
        result: 'SUCCESS',
      });

      const store = this.deps.storeRepository
        ? await this.deps.storeRepository.findById(storeId)
        : null;
      const plan = await this.deps.planRepository.findById(updatedSub.planId);

      return {
        id: updatedSub.id,
        storeId,
        storeName: store?.name || `Store ${storeId}`,
        planId: updatedSub.planId,
        planSlug: plan?.slug || 'starter',
        planName: plan?.name || 'Starter Merchant',
        status: updatedSub.status as SubscriptionStatus,
        startedAt: updatedSub.startedAt,
        currentPeriodStart: updatedSub.currentPeriodStart,
        currentPeriodEnd: updatedSub.currentPeriodEnd,
        cancelledAt: updatedSub.cancelledAt,
        cancelAtPeriodEnd: updatedSub.cancelAtPeriodEnd,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Subscription action failed';
      await this.deps.auditService.logAction({
        caller,
        action: 'SUBSCRIPTION_STATE_CHANGED',
        resourceType: 'subscription',
        resourceId: sub.id,
        storeId,
        details: { action: input.action, reason: input.reason },
        result: 'FAILED',
        errorMessage: msg,
      });
      throw err;
    }
  }

  // ==========================================================================
  // 3. INVOICES
  // ==========================================================================

  public async listInvoices(
    filter?: InvoiceListFilter,
  ): Promise<readonly PlatformInvoiceSummary[]> {
    const stores = this.deps.storeRepository ? await this.deps.storeRepository.list() : [];
    const result: PlatformInvoiceSummary[] = [];

    for (const s of stores) {
      if (filter?.storeId && s.id !== filter.storeId) continue;

      const listFilter = filter?.status ? { status: filter.status } : undefined;
      const invoices = await this.deps.invoiceRepository.listByStoreId(s.id, listFilter);

      for (const inv of invoices) {
        if (filter?.search) {
          const q = filter.search.toLowerCase();
          if (!inv.invoiceNumber.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) {
            continue;
          }
        }

        const hasActivationFee = inv.items.some((it) => it.type === 'ACTIVATION');

        result.push({
          id: inv.id,
          storeId: s.id,
          storeName: s.name,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          subtotal: inv.subtotal,
          tax: inv.tax,
          discount: inv.discount,
          total: inv.total,
          formattedTotal: formatCurrency(inv.total, inv.currency),
          currency: inv.currency,
          issuedAt: inv.issuedAt,
          dueAt: inv.dueAt,
          paidAt: inv.paidAt,
          hasActivationFee,
          itemCount: inv.items.length,
        });
      }
    }

    if (filter?.offset) {
      return result.slice(filter.offset);
    }
    if (filter?.limit) {
      return result.slice(0, filter.limit);
    }

    return result;
  }

  // ==========================================================================
  // 4. ADD-ONS
  // ==========================================================================

  public async listAddons(): Promise<readonly PlatformAddonSummary[]> {
    if (!this.deps.addonRepository) return [];
    const addons = await this.deps.addonRepository.list();

    return addons.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      description: a.description,
      monthlyPrice: a.monthlyPrice,
      formattedMonthlyPrice: formatCurrency(a.monthlyPrice),
      status: a.status,
      configuration: a.configuration,
      activeAssignmentsCount: 0,
    }));
  }
}
