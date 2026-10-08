/**
 * Bintang Tech Studio — Customer Onboarding Workflow & Session Service.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Coordinates the 9-stage onboarding lifecycle:
 * NOT_STARTED -> ACCOUNT_CREATED -> PLAN_SELECTED -> PAYMENT_PENDING ->
 * PAYMENT_CONFIRMED -> PROVISIONING -> STORE_READY -> CONFIGURATION -> COMPLETED.
 */

import { OnboardingSession, OnboardingChecklist, SelectPlanInput, BillingCaller } from './types.js';
import { OnboardingRepository } from './repositories/interfaces.js';
import { BillingService } from './billing-service.js';
import { ProvisioningService } from './provisioning-service.js';
import { OnboardingSessionNotFoundError, OnboardingError } from './errors.js';
import { validateOnboardingStateTransition, generateUUID } from './validation.js';

export interface OnboardingServiceDeps {
  readonly onboardingRepository: OnboardingRepository;
  readonly billingService: BillingService;
  readonly provisioningService: ProvisioningService;
}

export class OnboardingService {
  constructor(private readonly deps: OnboardingServiceDeps) {}

  public async getOrCreateSession(userId: string): Promise<OnboardingSession> {
    const existing = await this.deps.onboardingRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const checklist: OnboardingChecklist = {
      accountCreated: true,
      planSelected: false,
      paymentConfirmed: false,
      storeProvisioned: false,
      templateApplied: false,
      firstProductConfigured: false,
      channelConfigured: false,
    };

    const session: OnboardingSession = {
      id: generateUUID('onb'),
      userId,
      storeId: null,
      status: 'ACCOUNT_CREATED',
      selectedPlanSlug: null,
      subscriptionId: null,
      invoiceId: null,
      billingPaymentId: null,
      checklist,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    return this.deps.onboardingRepository.create(session);
  }

  public async getSession(userId: string): Promise<OnboardingSession> {
    const session = await this.deps.onboardingRepository.findByUserId(userId);
    if (!session) {
      throw new OnboardingSessionNotFoundError(userId);
    }
    return session;
  }

  public async selectPlan(userId: string, input: SelectPlanInput): Promise<OnboardingSession> {
    const session = await this.getSession(userId);

    // Validate plan exists
    const plan = await this.deps.billingService.getPlanBySlug(input.planSlug);

    validateOnboardingStateTransition(session.status, 'PLAN_SELECTED');

    return this.deps.onboardingRepository.update(session.id, {
      status: 'PLAN_SELECTED',
      selectedPlanSlug: plan.slug,
      checklist: {
        ...session.checklist,
        planSelected: true,
      },
      metadata: {
        ...session.metadata,
        preferredStoreName: input.storeName || `${plan.name} Store`,
        preferredStoreSlug:
          input.storeSlug || `store-${plan.slug}-${Math.random().toString(36).substring(2, 7)}`,
      },
    });
  }

  public async initiatePayment(
    userId: string,
    params?: { storeId?: string },
  ): Promise<{
    session: OnboardingSession;
    invoiceId: string;
    paymentId: string;
    paymentUrl: string | null;
  }> {
    const session = await this.getSession(userId);
    if (!session.selectedPlanSlug) {
      throw new OnboardingError('Paket langganan belum dipilih.');
    }

    validateOnboardingStateTransition(session.status, 'PAYMENT_PENDING');

    const storeId = params?.storeId || session.storeId || generateUUID('store_draft');
    const caller: BillingCaller = { type: 'SELLER', userId, storeId };

    // 1. Create Subscription
    const subscription = await this.deps.billingService.createSubscription(caller, {
      storeId,
      planSlug: session.selectedPlanSlug,
    });

    // 2. Generate Authoritative Invoice (Includes one-time activation fee)
    const invoice = await this.deps.billingService.generateInvoice(caller, {
      storeId,
      subscriptionId: subscription.id,
      idempotencyKey: `inv_onb_${session.id}`,
    });

    // 3. Create Billing Payment
    const payment = await this.deps.billingService.createBillingPayment(caller, {
      invoiceId: invoice.id,
      idempotencyKey: `pay_onb_${session.id}`,
    });

    const updatedSession = await this.deps.onboardingRepository.update(session.id, {
      status: 'PAYMENT_PENDING',
      storeId,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      billingPaymentId: payment.id,
    });

    return {
      session: updatedSession,
      invoiceId: invoice.id,
      paymentId: payment.id,
      paymentUrl: payment.paymentUrl,
    };
  }

  public async confirmPaymentAndProvision(userId: string): Promise<OnboardingSession> {
    const session = await this.getSession(userId);
    if (!session.invoiceId || !session.billingPaymentId) {
      throw new OnboardingError('Belum ada transaksi pembayaran untuk dikonfirmasi.');
    }

    validateOnboardingStateTransition(session.status, 'PAYMENT_CONFIRMED');

    // Transition to PAYMENT_CONFIRMED
    let updated = await this.deps.onboardingRepository.update(session.id, {
      status: 'PAYMENT_CONFIRMED',
      checklist: {
        ...session.checklist,
        paymentConfirmed: true,
      },
    });

    // Transition to PROVISIONING
    validateOnboardingStateTransition(updated.status, 'PROVISIONING');
    updated = await this.deps.onboardingRepository.update(session.id, {
      status: 'PROVISIONING',
    });

    // Execute Store Provisioning
    const storeName = (session.metadata?.['preferredStoreName'] as string) || 'Official Store';
    const storeSlug =
      (session.metadata?.['preferredStoreSlug'] as string) || `store-${Date.now().toString(36)}`;
    const planSlug = session.selectedPlanSlug || 'starter';

    const provResult = await this.deps.provisioningService.provisionStore({
      userId,
      storeName,
      storeSlug,
      planSlug,
      idempotencyKey: `prov_onb_${session.id}`,
    });

    // Transition to STORE_READY
    validateOnboardingStateTransition(updated.status, 'STORE_READY');
    updated = await this.deps.onboardingRepository.update(session.id, {
      status: 'STORE_READY',
      storeId: provResult.storeId,
      checklist: {
        ...updated.checklist,
        storeProvisioned: true,
        templateApplied: true,
      },
    });

    return updated;
  }

  public async updateChecklistStep(
    userId: string,
    step: keyof OnboardingChecklist,
    value = true,
  ): Promise<OnboardingSession> {
    const session = await this.getSession(userId);
    if (session.status !== 'STORE_READY' && session.status !== 'CONFIGURATION') {
      throw new OnboardingError('Toko belum siap untuk tahap konfigurasi.');
    }

    const updatedChecklist = {
      ...session.checklist,
      [step]: value,
    };

    const newStatus = session.status === 'STORE_READY' ? 'CONFIGURATION' : session.status;
    if (session.status === 'STORE_READY') {
      validateOnboardingStateTransition(session.status, 'CONFIGURATION');
    }

    return this.deps.onboardingRepository.update(session.id, {
      status: newStatus,
      checklist: updatedChecklist,
    });
  }

  public async completeOnboarding(userId: string): Promise<OnboardingSession> {
    const session = await this.getSession(userId);

    if (session.status !== 'STORE_READY' && session.status !== 'CONFIGURATION') {
      throw new OnboardingError('Tahap onboarding belum siap diselesaikan.');
    }

    if (!session.checklist.storeProvisioned) {
      throw new OnboardingError('Toko belum berhasil diprovisi.');
    }

    validateOnboardingStateTransition(session.status, 'COMPLETED');

    return this.deps.onboardingRepository.update(session.id, {
      status: 'COMPLETED',
    });
  }
}
