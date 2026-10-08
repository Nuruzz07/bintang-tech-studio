/**
 * Bintang Tech Studio — Billing & Onboarding Test Helpers.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import {
  InMemoryPlanRepository,
  InMemorySubscriptionRepository,
  InMemoryInvoiceRepository,
  InMemoryBillingPaymentRepository,
  InMemoryAddonRepository,
  InMemoryStoreAddonRepository,
  InMemoryOnboardingRepository,
  InMemoryProvisioningRepository,
  InMemoryBillingIdempotencyRepository,
} from '../src/repositories/memory-repository.js';
import { BillingService } from '../src/billing-service.js';
import { ProvisioningService } from '../src/provisioning-service.js';
import { OnboardingService } from '../src/onboarding-service.js';
import { MockBillingPaymentAdapter } from '../src/provider-adapter.js';
import { BillingCaller } from '../src/types.js';
import { InMemoryStoreRepository, InMemoryStoreMemberRepository } from '@bintang/tenancy';

export interface TestBillingHarness {
  planRepo: InMemoryPlanRepository;
  subRepo: InMemorySubscriptionRepository;
  invoiceRepo: InMemoryInvoiceRepository;
  paymentRepo: InMemoryBillingPaymentRepository;
  addonRepo: InMemoryAddonRepository;
  storeAddonRepo: InMemoryStoreAddonRepository;
  onboardingRepo: InMemoryOnboardingRepository;
  provisioningRepo: InMemoryProvisioningRepository;
  idempotencyRepo: InMemoryBillingIdempotencyRepository;
  storeRepo: InMemoryStoreRepository;
  storeMemberRepo: InMemoryStoreMemberRepository;
  paymentAdapter: MockBillingPaymentAdapter;
  billingService: BillingService;
  provisioningService: ProvisioningService;
  onboardingService: OnboardingService;
}

export function createTestBillingHarness(): TestBillingHarness {
  const planRepo = new InMemoryPlanRepository();
  const subRepo = new InMemorySubscriptionRepository();
  const invoiceRepo = new InMemoryInvoiceRepository();
  const paymentRepo = new InMemoryBillingPaymentRepository();
  const addonRepo = new InMemoryAddonRepository();
  const storeAddonRepo = new InMemoryStoreAddonRepository();
  const onboardingRepo = new InMemoryOnboardingRepository();
  const provisioningRepo = new InMemoryProvisioningRepository();
  const idempotencyRepo = new InMemoryBillingIdempotencyRepository();
  const storeRepo = new InMemoryStoreRepository();
  const storeMemberRepo = new InMemoryStoreMemberRepository();
  const paymentAdapter = new MockBillingPaymentAdapter();

  const billingService = new BillingService({
    planRepository: planRepo,
    subscriptionRepository: subRepo,
    invoiceRepository: invoiceRepo,
    billingPaymentRepository: paymentRepo,
    storeAddonRepository: storeAddonRepo,
    idempotencyRepository: idempotencyRepo,
    paymentAdapter,
  });

  const provisioningService = new ProvisioningService({
    provisioningRepository: provisioningRepo,
    storeRepository: storeRepo,
    storeMemberRepository: storeMemberRepo,
  });

  const onboardingService = new OnboardingService({
    onboardingRepository: onboardingRepo,
    billingService,
    provisioningService,
  });

  return {
    planRepo,
    subRepo,
    invoiceRepo,
    paymentRepo,
    addonRepo,
    storeAddonRepo,
    onboardingRepo,
    provisioningRepo,
    idempotencyRepo,
    storeRepo,
    storeMemberRepo,
    paymentAdapter,
    billingService,
    provisioningService,
    onboardingService,
  };
}

export function createPlatformCaller(userId = 'platform-admin-1'): BillingCaller {
  return {
    type: 'PLATFORM',
    userId,
  };
}

export function createSellerCaller(userId: string, storeId: string): BillingCaller {
  return {
    type: 'SELLER',
    userId,
    storeId,
    role: 'STORE_OWNER',
  };
}
