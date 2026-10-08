/**
 * Bintang Tech Studio — Core SaaS Billing & Subscription Application Service.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Coordinates plans, subscriptions, invoices, billing payments, and webhooks.
 * Enforces strict separation from Seller Commerce Payments (M08).
 */

import {
  Plan,
  Subscription,
  InvoiceWithItems,
  InvoiceItem,
  BillingPayment,
  BillingCaller,
  CreateSubscriptionInput,
  CreateBillingPaymentInput,
  BillingWebhookEvent,
  WebhookProcessingResult,
  PublicSubscriptionView,
  PublicInvoiceView,
  PublicBillingPaymentView,
  PublicPlanView,
  InvoiceItemType,
  BillingPaymentStatus,
} from './types.js';
import {
  PlanRepository,
  SubscriptionRepository,
  InvoiceRepository,
  BillingPaymentRepository,
  StoreAddonRepository,
  BillingIdempotencyRepository,
} from './repositories/interfaces.js';
import {
  BillingError,
  PlanNotFoundError,
  SubscriptionNotFoundError,
  InvoiceNotFoundError,
  BillingPaymentNotFoundError,
  BillingStoreAccessDeniedError,
  BillingPaymentAmountMismatchError,
  BillingPaymentCurrencyMismatchError,
  BillingPaymentStoreMismatchError,
  BillingPaymentConflictEventError,
  SubscriptionCancelledError,
  InvoiceAlreadyPaidError,
  BillingWebhookSignatureError,
} from './errors.js';
import {
  validateSubscriptionStateTransition,
  validateInvoiceStateTransition,
  validateBillingPaymentStateTransition,
  generateUUID,
} from './validation.js';
import { addMoney, compareMoney, formatCurrency, normalizeMoney } from './money.js';
import { BillingPaymentAdapter } from './provider-adapter.js';
import { toPublicPlanView } from './plan-catalog.js';
import {
  resolveEffectiveStoreEntitlements,
  EffectiveStoreEntitlements,
} from './entitlement-resolver.js';
import { AuthorizationService } from '@bintang/authorization';

export interface BillingServiceDeps {
  readonly planRepository: PlanRepository;
  readonly subscriptionRepository: SubscriptionRepository;
  readonly invoiceRepository: InvoiceRepository;
  readonly billingPaymentRepository: BillingPaymentRepository;
  readonly storeAddonRepository?: StoreAddonRepository;
  readonly idempotencyRepository: BillingIdempotencyRepository;
  readonly paymentAdapter: BillingPaymentAdapter;
  readonly authorizationService?: AuthorizationService;
}

export class BillingService {
  constructor(private readonly deps: BillingServiceDeps) {}

  // ==========================================================================
  // 1. PLANS
  // ==========================================================================

  public async listPlans(): Promise<readonly PublicPlanView[]> {
    const plans = await this.deps.planRepository.list({ status: 'ACTIVE' });
    return plans.map(toPublicPlanView);
  }

  public async getPlanBySlug(slug: string): Promise<Plan> {
    const plan = await this.deps.planRepository.findBySlug(slug);
    if (!plan) {
      throw new PlanNotFoundError(slug);
    }
    return plan;
  }

  // ==========================================================================
  // 2. SUBSCRIPTIONS
  // ==========================================================================

  public async createSubscription(
    caller: BillingCaller,
    input: CreateSubscriptionInput,
  ): Promise<Subscription> {
    this.assertCallerCanManageStore(caller, input.storeId);

    const plan = await this.getPlanBySlug(input.planSlug);
    const existing = await this.deps.subscriptionRepository.findByStoreId(input.storeId);

    if (existing) {
      if (existing.status !== 'CANCELLED' && existing.status !== 'EXPIRED') {
        throw new BillingError(
          `Toko ${input.storeId} sudah memiliki langganan aktif (${existing.status}).`,
          'SUBSCRIPTION_ALREADY_EXISTS',
          409,
        );
      }
      validateSubscriptionStateTransition(existing.status, 'ACTIVE');
      return existing;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const subscription: Subscription = {
      id: generateUUID('sub'),
      storeId: input.storeId,
      planId: plan.id,
      status: 'TRIAL',
      startedAt: now.toISOString(),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return this.deps.subscriptionRepository.create(subscription);
  }

  public async getSubscription(
    caller: BillingCaller,
    storeId: string,
  ): Promise<PublicSubscriptionView> {
    this.assertCallerCanReadStore(caller, storeId);

    const sub = await this.deps.subscriptionRepository.findByStoreId(storeId);
    if (!sub) {
      throw new SubscriptionNotFoundError(`Store ${storeId}`);
    }

    const plan = await this.deps.planRepository.findById(sub.planId);
    if (!plan) {
      throw new PlanNotFoundError(sub.planId);
    }

    const isRestricted =
      sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' || sub.status === 'EXPIRED';

    return {
      id: sub.id,
      storeId: sub.storeId,
      planId: sub.planId,
      planSlug: plan.slug,
      planName: plan.name,
      status: sub.status,
      startedAt: sub.startedAt,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      isOperationallyRestricted: isRestricted,
      cancelledAt: sub.cancelledAt,
    };
  }

  public async activateSubscription(
    caller: BillingCaller,
    storeId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    this.assertCallerCanManageStore(caller, storeId);

    const sub = await this.deps.subscriptionRepository.findById(subscriptionId);
    if (!sub || sub.storeId !== storeId) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    validateSubscriptionStateTransition(sub.status, 'ACTIVE');

    const now = new Date();
    const nextPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return this.deps.subscriptionRepository.update(sub.id, {
      status: 'ACTIVE',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: nextPeriodEnd.toISOString(),
    });
  }

  public async suspendSubscription(
    caller: BillingCaller,
    storeId: string,
    _reason?: string,
  ): Promise<Subscription> {
    this.assertCallerCanManageStore(caller, storeId);

    const sub = await this.deps.subscriptionRepository.findByStoreId(storeId);
    if (!sub) throw new SubscriptionNotFoundError(`Store ${storeId}`);

    validateSubscriptionStateTransition(sub.status, 'SUSPENDED');

    return this.deps.subscriptionRepository.update(sub.id, {
      status: 'SUSPENDED',
    });
  }

  public async cancelSubscription(
    caller: BillingCaller,
    targetId: string,
    options?: { immediate?: boolean; reason?: string },
  ): Promise<Subscription> {
    let sub = await this.deps.subscriptionRepository.findById(targetId);
    if (!sub) {
      sub = await this.deps.subscriptionRepository.findByStoreId(targetId);
    }
    if (!sub) throw new SubscriptionNotFoundError(targetId);

    this.assertCallerCanManageStore(caller, sub.storeId);

    if (sub.status === 'CANCELLED') {
      throw new SubscriptionCancelledError();
    }

    if (options?.immediate === false) {
      return this.deps.subscriptionRepository.update(sub.id, {
        cancelAtPeriodEnd: true,
      });
    }

    validateSubscriptionStateTransition(sub.status, 'CANCELLED');

    return this.deps.subscriptionRepository.update(sub.id, {
      status: 'CANCELLED',
      cancelAtPeriodEnd: false,
      cancelledAt: new Date().toISOString(),
    });
  }

  public async changeSubscriptionPlan(
    caller: BillingCaller,
    targetId: string,
    newPlanSlug: string,
  ): Promise<Subscription> {
    let sub = await this.deps.subscriptionRepository.findById(targetId);
    if (!sub) {
      sub = await this.deps.subscriptionRepository.findByStoreId(targetId);
    }
    if (!sub) throw new SubscriptionNotFoundError(targetId);

    this.assertCallerCanManageStore(caller, sub.storeId);

    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      throw new SubscriptionCancelledError();
    }

    const newPlan = await this.getPlanBySlug(newPlanSlug);
    return this.deps.subscriptionRepository.update(sub.id, {
      planId: newPlan.id,
    });
  }

  public async expireSubscription(caller: BillingCaller, storeId: string): Promise<Subscription> {
    this.assertCallerCanManageStore(caller, storeId);

    const sub = await this.deps.subscriptionRepository.findByStoreId(storeId);
    if (!sub) throw new SubscriptionNotFoundError(`Store ${storeId}`);

    validateSubscriptionStateTransition(sub.status, 'EXPIRED');

    return this.deps.subscriptionRepository.update(sub.id, {
      status: 'EXPIRED',
    });
  }

  // ==========================================================================
  // 3. INVOICES
  // ==========================================================================

  public async generateInvoice(
    caller: BillingCaller,
    params: {
      storeId: string;
      subscriptionId: string;
      idempotencyKey?: string;
    },
  ): Promise<InvoiceWithItems> {
    this.assertCallerCanManageStore(caller, params.storeId);

    if (params.idempotencyKey) {
      const cached = await this.deps.idempotencyRepository.get(params.idempotencyKey);
      if (cached) return cached as InvoiceWithItems;
    }

    const sub = await this.deps.subscriptionRepository.findById(params.subscriptionId);
    if (!sub || sub.storeId !== params.storeId) {
      throw new SubscriptionNotFoundError(params.subscriptionId);
    }

    if (sub.status === 'CANCELLED') {
      throw new SubscriptionCancelledError();
    }

    const plan = await this.deps.planRepository.findById(sub.planId);
    if (!plan) {
      throw new PlanNotFoundError(sub.planId);
    }

    // Check if store has already paid the one-time activation fee
    const hasPaidActivation = await this.deps.invoiceRepository.hasStorePaidActivationFee(
      params.storeId,
    );

    const now = new Date();
    const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days payment terms
    const invoiceId = generateUUID('inv');
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const items: InvoiceItem[] = [];
    let subtotal = '0.00';

    // 1. Subscription recurring fee
    const subPrice = normalizeMoney(plan.monthlyPrice);
    items.push({
      id: generateUUID('inv_it'),
      storeId: params.storeId,
      invoiceId,
      type: 'SUBSCRIPTION',
      description: `Langganan Paket ${plan.name} (1 Bulan)`,
      quantity: 1,
      unitPrice: subPrice,
      amount: subPrice,
      createdAt: now.toISOString(),
    });
    subtotal = addMoney(subtotal, subPrice);

    // 2. Activation fee (ONE-TIME ONLY)
    if (!hasPaidActivation && compareMoney(plan.activationFee, '0.00') > 0) {
      const actFee = normalizeMoney(plan.activationFee);
      items.push({
        id: generateUUID('inv_it'),
        storeId: params.storeId,
        invoiceId,
        type: 'ACTIVATION',
        description: 'Biaya Aktivasi & Setup Toko Bintang Tech (Sekali Bayar)',
        quantity: 1,
        unitPrice: actFee,
        amount: actFee,
        createdAt: now.toISOString(),
      });
      subtotal = addMoney(subtotal, actFee);
    }

    const discount = '0.00';
    const tax = '0.00';
    const total = subtotal;

    const invoice: InvoiceWithItems = {
      id: invoiceId,
      storeId: params.storeId,
      subscriptionId: sub.id,
      invoiceNumber,
      status: 'PENDING',
      subtotal,
      discount,
      tax,
      total,
      currency: 'IDR',
      issuedAt: now.toISOString(),
      dueAt: dueAt.toISOString(),
      paidAt: null,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      metadata: {},
      items,
    };

    const saved = await this.deps.invoiceRepository.create(invoice, items);

    if (params.idempotencyKey) {
      await this.deps.idempotencyRepository.set(params.idempotencyKey, saved);
    }

    return saved;
  }

  public async createInvoice(
    caller: BillingCaller,
    params: {
      storeId: string;
      subscriptionId?: string | null;
      items: Array<{
        type: InvoiceItemType;
        description: string;
        amount: string;
        quantity?: number;
      }>;
      tax?: string;
      discount?: string;
      idempotencyKey?: string;
    },
  ): Promise<PublicInvoiceView> {
    this.assertCallerCanManageStore(caller, params.storeId);

    if (params.idempotencyKey) {
      const cached = await this.deps.idempotencyRepository.get(params.idempotencyKey);
      if (cached) return cached as PublicInvoiceView;
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invoiceId = generateUUID('inv');
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const items: InvoiceItem[] = [];
    let subtotal = '0.00';

    for (const item of params.items) {
      const itemAmount = normalizeMoney(item.amount);
      const qty = item.quantity ?? 1;
      items.push({
        id: generateUUID('inv_it'),
        storeId: params.storeId,
        invoiceId,
        type: item.type,
        description: item.description,
        quantity: qty,
        unitPrice: itemAmount,
        amount: itemAmount,
        createdAt: now.toISOString(),
      });
      subtotal = addMoney(subtotal, itemAmount);
    }

    const discount = params.discount ? normalizeMoney(params.discount) : '0.00';
    const tax = params.tax ? normalizeMoney(params.tax) : '0.00';
    const total = subtotal;

    const invoice: InvoiceWithItems = {
      id: invoiceId,
      storeId: params.storeId,
      subscriptionId: params.subscriptionId ?? null,
      invoiceNumber,
      status: 'PENDING',
      subtotal,
      discount,
      tax,
      total,
      currency: 'IDR',
      issuedAt: now.toISOString(),
      dueAt: dueAt.toISOString(),
      paidAt: null,
      periodStart: now.toISOString(),
      periodEnd: dueAt.toISOString(),
      metadata: {},
      items,
    };

    const saved = await this.deps.invoiceRepository.create(invoice, items);

    const publicView: PublicInvoiceView = {
      id: saved.id,
      storeId: saved.storeId,
      subscriptionId: saved.subscriptionId,
      invoiceNumber: saved.invoiceNumber,
      status: saved.status,
      subtotal: saved.subtotal,
      discount: saved.discount,
      tax: saved.tax,
      total: saved.total,
      formattedTotal: formatCurrency(saved.total, saved.currency),
      currency: saved.currency,
      issuedAt: saved.issuedAt,
      dueAt: saved.dueAt,
      paidAt: saved.paidAt,
      items: saved.items,
    };

    if (params.idempotencyKey) {
      await this.deps.idempotencyRepository.set(params.idempotencyKey, publicView);
    }

    return publicView;
  }

  public async getInvoice(caller: BillingCaller, invoiceId: string): Promise<PublicInvoiceView> {
    const inv = await this.deps.invoiceRepository.findById(invoiceId);
    if (!inv) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    this.assertCallerCanReadStore(caller, inv.storeId);

    return {
      id: inv.id,
      storeId: inv.storeId,
      subscriptionId: inv.subscriptionId,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      subtotal: inv.subtotal,
      discount: inv.discount,
      tax: inv.tax,
      total: inv.total,
      formattedTotal: formatCurrency(inv.total, inv.currency),
      currency: inv.currency,
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      paidAt: inv.paidAt,
      items: inv.items,
    };
  }

  public async listInvoices(
    caller: BillingCaller,
    storeId: string,
  ): Promise<readonly PublicInvoiceView[]> {
    this.assertCallerCanReadStore(caller, storeId);

    const invoices = await this.deps.invoiceRepository.listByStoreId(storeId);
    return invoices.map((inv) => ({
      id: inv.id,
      storeId: inv.storeId,
      subscriptionId: inv.subscriptionId,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      subtotal: inv.subtotal,
      discount: inv.discount,
      tax: inv.tax,
      total: inv.total,
      formattedTotal: formatCurrency(inv.total, inv.currency),
      currency: inv.currency,
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      paidAt: inv.paidAt,
      items: inv.items,
    }));
  }

  // ==========================================================================
  // 4. BILLING PAYMENTS
  // ==========================================================================

  public async createBillingPayment(
    caller: BillingCaller,
    input: CreateBillingPaymentInput,
  ): Promise<PublicBillingPaymentView> {
    const inv = await this.deps.invoiceRepository.findById(input.invoiceId);
    if (!inv) {
      throw new InvoiceNotFoundError(input.invoiceId);
    }

    this.assertCallerCanManageStore(caller, inv.storeId);

    if (input.idempotencyKey) {
      const cached = await this.deps.idempotencyRepository.get(input.idempotencyKey);
      if (cached) return cached as PublicBillingPaymentView;
    }

    // Check if invoice already paid
    if (inv.status === 'PAID') {
      throw new InvoiceAlreadyPaidError(inv.id);
    }

    const now = new Date();
    const expiredAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h payment window
    const paymentId = generateUUID('bpay');

    const payment: BillingPayment = {
      id: paymentId,
      storeId: inv.storeId,
      invoiceId: inv.id,
      provider: input.provider || this.deps.paymentAdapter.providerId,
      providerTransactionId: null,
      amount: inv.total,
      currency: inv.currency,
      status: 'PENDING',
      paymentUrl: null,
      paidAt: null,
      expiredAt: expiredAt.toISOString(),
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const saved = await this.deps.billingPaymentRepository.create(payment);

    // Call provider adapter
    const adapterResult = await this.deps.paymentAdapter.createPayment(saved);

    const updated = await this.deps.billingPaymentRepository.updateStatus(
      saved.id,
      adapterResult.status,
      {
        providerTransactionId: adapterResult.providerTransactionId,
        paymentUrl: adapterResult.paymentUrl,
      },
    );

    const publicView = this.toPublicPaymentView(updated);

    if (input.idempotencyKey) {
      await this.deps.idempotencyRepository.set(input.idempotencyKey, publicView);
    }

    return publicView;
  }

  public async getBillingPayment(
    caller: BillingCaller,
    paymentId: string,
  ): Promise<PublicBillingPaymentView> {
    const p = await this.deps.billingPaymentRepository.findById(paymentId);
    if (!p) {
      throw new BillingPaymentNotFoundError(paymentId);
    }

    this.assertCallerCanReadStore(caller, p.storeId);

    return this.toPublicPaymentView(p);
  }

  // ==========================================================================
  // 5. WEBHOOK PROCESSING
  // ==========================================================================

  public async processWebhook(event: BillingWebhookEvent): Promise<WebhookProcessingResult> {
    return this.processPaymentWebhook(event);
  }

  public async processPaymentWebhook(event: BillingWebhookEvent): Promise<WebhookProcessingResult> {
    // 1. Signature verification
    const isValidSignature = this.deps.paymentAdapter.verifyWebhookSignature(event);
    if (!isValidSignature) {
      throw new BillingWebhookSignatureError();
    }

    // 2. Idempotency & duplicate check
    const eventKey = `webhook_event_${event.providerId}_${event.eventId}`;
    const previous = await this.deps.idempotencyRepository.get(eventKey);
    if (previous) {
      const prevRecord = previous as Record<string, unknown>;
      return {
        processed: true,
        alreadyProcessed: true,
        paymentId: (prevRecord['paymentId'] as string) || '',
        status: (prevRecord['status'] as BillingPaymentStatus) || 'PAID',
      };
    }

    const payload = event.payload;
    const paymentId = (payload['paymentId'] as string) || (payload['id'] as string);
    if (!paymentId) {
      throw new BillingPaymentConflictEventError('Missing paymentId in webhook payload');
    }

    const payment = await this.deps.billingPaymentRepository.findById(paymentId);
    if (!payment) {
      throw new BillingPaymentNotFoundError(paymentId);
    }

    const invoice = await this.deps.invoiceRepository.findById(payment.invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundError(payment.invoiceId);
    }

    // 3. Validation: Store, Currency, Amount matching
    if (payload['storeId'] && payload['storeId'] !== payment.storeId) {
      throw new BillingPaymentStoreMismatchError();
    }

    if (payload['currency'] && payload['currency'] !== payment.currency) {
      throw new BillingPaymentCurrencyMismatchError(
        payment.currency,
        payload['currency'] as string,
      );
    }

    if (payload['amount'] && compareMoney(String(payload['amount']), payment.amount) !== 0) {
      throw new BillingPaymentAmountMismatchError(payment.amount, String(payload['amount']));
    }

    let activatedSubscriptionId: string | undefined;

    if (event.eventType === 'payment.succeeded') {
      validateBillingPaymentStateTransition(payment.status, 'PAID');
      validateInvoiceStateTransition(invoice.status, 'PAID');

      const now = new Date().toISOString();

      // 4. Update Payment to PAID
      await this.deps.billingPaymentRepository.updateStatus(payment.id, 'PAID', {
        paidAt: now,
      });

      // 5. Update Invoice to PAID
      await this.deps.invoiceRepository.updateStatus(invoice.id, 'PAID', now);

      // 6. Authoritative Subscription Activation
      if (invoice.subscriptionId) {
        const sub = await this.deps.subscriptionRepository.findById(invoice.subscriptionId);
        if (sub && sub.status !== 'CANCELLED') {
          const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await this.deps.subscriptionRepository.update(sub.id, {
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
          });
          activatedSubscriptionId = sub.id;
        }
      }

      const result: WebhookProcessingResult = {
        processed: true,
        alreadyProcessed: false,
        paymentId: payment.id,
        status: 'PAID',
        activatedSubscriptionId,
      };

      await this.deps.idempotencyRepository.set(eventKey, result);
      return result;
    } else if (event.eventType === 'payment.failed') {
      validateBillingPaymentStateTransition(payment.status, 'FAILED');
      await this.deps.billingPaymentRepository.updateStatus(payment.id, 'FAILED');

      const result: WebhookProcessingResult = {
        processed: true,
        alreadyProcessed: false,
        paymentId: payment.id,
        status: 'FAILED',
      };

      await this.deps.idempotencyRepository.set(eventKey, result);
      return result;
    }

    return {
      processed: false,
      alreadyProcessed: false,
      paymentId: payment.id,
      status: payment.status,
    };
  }

  // ==========================================================================
  // 6. ENTITLEMENTS & PLAN RESOLUTION
  // ==========================================================================

  public async getEffectiveEntitlements(
    caller: BillingCaller,
    storeId: string,
  ): Promise<EffectiveStoreEntitlements> {
    this.assertCallerCanReadStore(caller, storeId);

    const sub = await this.deps.subscriptionRepository.findByStoreId(storeId);
    let plan: Plan | null = null;
    if (sub) {
      plan = await this.deps.planRepository.findById(sub.planId);
    }
    if (!plan) {
      // Default to Starter plan if no subscription created yet
      plan = (await this.deps.planRepository.findBySlug('starter')) || null;
      if (!plan) {
        throw new PlanNotFoundError('starter');
      }
    }

    const activeAddons = this.deps.storeAddonRepository
      ? await this.deps.storeAddonRepository.listByStoreId(storeId)
      : [];

    return resolveEffectiveStoreEntitlements({
      plan,
      subscription: sub,
      activeAddons,
    });
  }

  // ==========================================================================
  // SECURITY & AUTHORIZATION HELPERS
  // ==========================================================================

  private assertCallerCanReadStore(caller: BillingCaller, storeId: string): void {
    if (caller.type === 'PLATFORM') return;
    if (caller.storeId && caller.storeId !== storeId) {
      throw new BillingStoreAccessDeniedError(
        `Akses ditolak: Anda tidak memiliki akses ke data billing toko ${storeId}.`,
      );
    }
  }

  private assertCallerCanManageStore(caller: BillingCaller, storeId: string): void {
    if (caller.type === 'PLATFORM') return;
    if (caller.storeId && caller.storeId !== storeId) {
      throw new BillingStoreAccessDeniedError(
        `Akses ditolak: Anda tidak berwenang mengelola billing toko ${storeId}.`,
      );
    }
  }

  private toPublicPaymentView(p: BillingPayment): PublicBillingPaymentView {
    return {
      id: p.id,
      storeId: p.storeId,
      invoiceId: p.invoiceId,
      provider: p.provider,
      amount: p.amount,
      formattedAmount: formatCurrency(p.amount, p.currency),
      currency: p.currency,
      status: p.status,
      paymentUrl: p.paymentUrl,
      paidAt: p.paidAt,
    };
  }
}
