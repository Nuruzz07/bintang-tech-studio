/**
 * Bintang Tech Studio — Platform Owner Console Test Harness & Helpers.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { OwnerConsoleSessionManager } from '../src/session-manager.js';
import { AuthorizationService } from '@bintang/authorization';
import {
  InMemoryPlatformStoreRepository,
  InMemoryPlatformUserRepository,
  InMemoryPlatformSupportTicketRepository,
  InMemoryPlatformAuditLogRepository,
  InMemoryPlatformHealthRepository,
  InMemoryPlatformSettingsRepository,
  InMemoryPlatformTemplateRepository,
} from '../src/services/memory-repositories.js';
import { PlatformAuditService } from '../src/services/audit-service.js';
import { PlatformOverviewService } from '../src/services/overview-service.js';
import { PlatformStoreService } from '../src/services/store-service.js';
import { PlatformUserService } from '../src/services/user-service.js';
import { PlatformBillingService } from '../src/services/billing-service.js';
import { PlatformTemplateService } from '../src/services/template-service.js';
import { PlatformBotService } from '../src/services/bot-service.js';
import { PlatformOrderService } from '../src/services/order-service.js';
import { PlatformSupportService } from '../src/services/support-service.js';
import { PlatformHealthService } from '../src/services/health-service.js';
import { PlatformSettingsService } from '../src/services/settings-service.js';
import { OwnerConsoleService } from '../src/owner-console-service.js';
import { InMemoryStoreMemberRepository } from '@bintang/tenancy';
import {
  BillingService,
  InMemoryPlanRepository,
  InMemorySubscriptionRepository,
  InMemoryInvoiceRepository,
  InMemoryBillingPaymentRepository,
  InMemoryAddonRepository,
  InMemoryBillingIdempotencyRepository,
  MockBillingPaymentAdapter,
} from '@bintang/billing';
import { InMemoryOrderRepository } from '@bintang/orders';

export interface TestOwnerConsoleHarness {
  readonly service: OwnerConsoleService;
  readonly sessionManager: OwnerConsoleSessionManager;
  readonly userRepo: InMemoryPlatformUserRepository;
  readonly storeRepo: InMemoryPlatformStoreRepository;
  readonly storeMemberRepo: InMemoryStoreMemberRepository;
  readonly subRepo: InMemorySubscriptionRepository;
  readonly invoiceRepo: InMemoryInvoiceRepository;
  readonly planRepo: InMemoryPlanRepository;
  readonly ticketRepo: InMemoryPlatformSupportTicketRepository;
  readonly auditRepo: InMemoryPlatformAuditLogRepository;
  readonly healthRepo: InMemoryPlatformHealthRepository;
  readonly settingsRepo: InMemoryPlatformSettingsRepository;
  readonly templateRepo: InMemoryPlatformTemplateRepository;
  readonly orderRepo: InMemoryOrderRepository;
  readonly auditService: PlatformAuditService;
  createOwnerSession(): Promise<string>;
  createAdminSession(): Promise<string>;
}

export function createTestOwnerConsoleHarness(): TestOwnerConsoleHarness {
  const sessionManager = new OwnerConsoleSessionManager();
  const authService = new AuthorizationService();

  // Repositories
  const userRepo = new InMemoryPlatformUserRepository();
  const storeRepo = new InMemoryPlatformStoreRepository();
  const storeMemberRepo = new InMemoryStoreMemberRepository();
  const planRepo = new InMemoryPlanRepository();
  const subRepo = new InMemorySubscriptionRepository();
  const invoiceRepo = new InMemoryInvoiceRepository();
  const paymentRepo = new InMemoryBillingPaymentRepository();
  const addonRepo = new InMemoryAddonRepository();
  const billingIdempotencyRepo = new InMemoryBillingIdempotencyRepository();
  const ticketRepo = new InMemoryPlatformSupportTicketRepository();
  const auditRepo = new InMemoryPlatformAuditLogRepository();
  const healthRepo = new InMemoryPlatformHealthRepository();
  const settingsRepo = new InMemoryPlatformSettingsRepository();
  const templateRepo = new InMemoryPlatformTemplateRepository();
  const orderRepo = new InMemoryOrderRepository();

  const billingPaymentAdapter = new MockBillingPaymentAdapter();

  const billingService = new BillingService({
    planRepository: planRepo,
    subscriptionRepository: subRepo,
    invoiceRepository: invoiceRepo,
    billingPaymentRepository: paymentRepo,
    idempotencyRepository: billingIdempotencyRepo,
    paymentAdapter: billingPaymentAdapter,
  });

  // Services
  const auditService = new PlatformAuditService(auditRepo);
  const overviewService = new PlatformOverviewService({
    storeRepository: storeRepo,
    userRepository: userRepo,
    subscriptionRepository: subRepo,
    invoiceRepository: invoiceRepo,
    ticketRepository: ticketRepo,
    healthRepository: healthRepo,
  });
  const storeService = new PlatformStoreService({
    storeRepository: storeRepo,
    storeMemberRepository: storeMemberRepo,
    userRepository: userRepo,
    subscriptionRepository: subRepo,
    auditService,
  });
  const userService = new PlatformUserService({
    userRepository: userRepo,
    storeRepository: storeRepo,
    storeMemberRepository: storeMemberRepo,
    auditService,
  });
  const platformBillingService = new PlatformBillingService({
    billingService,
    planRepository: planRepo,
    subscriptionRepository: subRepo,
    invoiceRepository: invoiceRepo,
    addonRepository: addonRepo,
    storeRepository: storeRepo,
    auditService,
  });
  const templateService = new PlatformTemplateService({
    templateRepository: templateRepo,
    auditService,
  });
  const botService = new PlatformBotService({
    storeRepository: storeRepo,
  });
  const orderService = new PlatformOrderService({
    orderRepository: orderRepo,
    storeRepository: storeRepo,
  });
  const supportService = new PlatformSupportService({
    ticketRepository: ticketRepo,
    auditService,
  });
  const healthService = new PlatformHealthService(healthRepo);
  const settingsService = new PlatformSettingsService({
    settingsRepository: settingsRepo,
    auditService,
  });

  const service = new OwnerConsoleService({
    sessionManager,
    authorizationService: authService,
    overviewService,
    storeService,
    userService,
    billingService: platformBillingService,
    templateService,
    botService,
    orderService,
    supportService,
    auditService,
    healthService,
    settingsService,
  });

  return {
    service,
    sessionManager,
    userRepo,
    storeRepo,
    storeMemberRepo,
    subRepo,
    invoiceRepo,
    planRepo,
    ticketRepo,
    auditRepo,
    healthRepo,
    settingsRepo,
    templateRepo,
    orderRepo,
    auditService,
    async createOwnerSession() {
      const s = await sessionManager.createSession({
        userId: 'usr_plat_owner_1',
        email: 'owner@bintang.tech',
        platformRole: 'PLATFORM_OWNER',
      });
      return s.token;
    },
    async createAdminSession() {
      const s = await sessionManager.createSession({
        userId: 'usr_plat_admin_1',
        email: 'admin@bintang.tech',
        platformRole: 'PLATFORM_ADMIN',
      });
      return s.token;
    },
  };
}
