import { ComponentHealth } from '@bintang/observability';
import { PostgrestClient } from './client.js';
import { SupabaseConfig } from './types.js';
import { SupabaseStoreRepository } from './repositories/store-repository.js';
import { SupabaseProfileRepository } from './repositories/profile-repository.js';
import { SupabaseStoreMemberRepository } from './repositories/store-member-repository.js';
import { SupabaseCategoryRepository } from './repositories/category-repository.js';
import { SupabaseProductRepository } from './repositories/product-repository.js';
import { SupabaseInventoryRepository } from './repositories/inventory-repository.js';
import { SupabaseInventoryItemRepository } from './repositories/inventory-item-repository.js';
import { SupabaseCustomerRepository } from './repositories/customer-repository.js';
import { SupabaseOrderRepository } from './repositories/order-repository.js';
import { SupabasePaymentAccountRepository } from './repositories/payment-account-repository.js';
import { SupabasePaymentRepository } from './repositories/payment-repository.js';
import { SupabasePaymentEventRepository } from './repositories/payment-event-repository.js';
import { SupabaseFulfillmentRepository } from './repositories/fulfillment-repository.js';
import { SupabaseFulfillmentItemRepository } from './repositories/fulfillment-item-repository.js';
import { SupabaseOutboxRepository } from './repositories/outbox-repository.js';
import { SupabaseJobRepository } from './repositories/job-repository.js';
import { SupabaseSecurityEventRepository } from './repositories/security-event-repository.js';
import {
  SupabaseIdempotencyRepository,
  OrdersIdempotencyAdapter,
  PaymentsIdempotencyAdapter,
  FulfillmentIdempotencyAdapter,
} from './repositories/idempotency-repository.js';
import {
  SupabaseSessionRepository,
  SellerSessionStoreAdapter,
  CustomerSessionStoreAdapter,
  PlatformSessionStoreAdapter,
} from './repositories/session-repository.js';
import { DurableQueueWorker } from './worker.js';

export interface SupabaseDatabase {
  readonly client: PostgrestClient;
  readonly stores: SupabaseStoreRepository;
  readonly profiles: SupabaseProfileRepository;
  readonly storeMembers: SupabaseStoreMemberRepository;
  readonly categories: SupabaseCategoryRepository;
  readonly products: SupabaseProductRepository;
  readonly inventory: SupabaseInventoryRepository;
  readonly inventoryItems: SupabaseInventoryItemRepository;
  readonly customers: SupabaseCustomerRepository;
  readonly orders: SupabaseOrderRepository;
  readonly paymentAccounts: SupabasePaymentAccountRepository;
  readonly payments: SupabasePaymentRepository;
  readonly paymentEvents: SupabasePaymentEventRepository;
  readonly fulfillments: SupabaseFulfillmentRepository;
  readonly fulfillmentItems: SupabaseFulfillmentItemRepository;
  readonly outbox: SupabaseOutboxRepository;
  readonly jobs: SupabaseJobRepository;
  readonly securityEvents: SupabaseSecurityEventRepository;
  readonly idempotency: SupabaseIdempotencyRepository;
  readonly ordersIdempotency: OrdersIdempotencyAdapter;
  readonly paymentsIdempotency: PaymentsIdempotencyAdapter;
  readonly fulfillmentIdempotency: FulfillmentIdempotencyAdapter;
  readonly sessions: SupabaseSessionRepository;
  readonly sellerSessionStore: SellerSessionStoreAdapter;
  readonly customerSessionStore: CustomerSessionStoreAdapter;
  readonly platformSessionStore: PlatformSessionStoreAdapter;
  readonly worker: DurableQueueWorker;
  checkHealth(): Promise<ComponentHealth>;
}

export function createSupabaseDatabase(config: SupabaseConfig): SupabaseDatabase {
  const client = new PostgrestClient(config);

  const idempotency = new SupabaseIdempotencyRepository(client);
  const sessions = new SupabaseSessionRepository(client);

  return {
    client,
    stores: new SupabaseStoreRepository(client),
    profiles: new SupabaseProfileRepository(client),
    storeMembers: new SupabaseStoreMemberRepository(client),
    categories: new SupabaseCategoryRepository(client),
    products: new SupabaseProductRepository(client),
    inventory: new SupabaseInventoryRepository(client),
    inventoryItems: new SupabaseInventoryItemRepository(client),
    customers: new SupabaseCustomerRepository(client),
    orders: new SupabaseOrderRepository(client),
    paymentAccounts: new SupabasePaymentAccountRepository(client),
    payments: new SupabasePaymentRepository(client),
    paymentEvents: new SupabasePaymentEventRepository(client),
    fulfillments: new SupabaseFulfillmentRepository(client),
    fulfillmentItems: new SupabaseFulfillmentItemRepository(client),
    outbox: new SupabaseOutboxRepository(client),
    jobs: new SupabaseJobRepository(client),
    securityEvents: new SupabaseSecurityEventRepository(client),
    idempotency,
    ordersIdempotency: new OrdersIdempotencyAdapter(client),
    paymentsIdempotency: new PaymentsIdempotencyAdapter(client),
    fulfillmentIdempotency: new FulfillmentIdempotencyAdapter(client),
    sessions,
    sellerSessionStore: new SellerSessionStoreAdapter(sessions, client),
    customerSessionStore: new CustomerSessionStoreAdapter(sessions, client),
    platformSessionStore: new PlatformSessionStoreAdapter(sessions, client),
    worker: new DurableQueueWorker(client),
    async checkHealth(): Promise<ComponentHealth> {
      const pingRes = await client.ping();
      return {
        name: 'database',
        status: pingRes.ok ? 'UP' : 'DOWN',
        isCritical: true,
        latencyMs: pingRes.latencyMs,
        message: pingRes.error,
        timestamp: new Date().toISOString(),
        details: {
          url: config.supabaseUrl,
        },
      };
    },
  };
}

export interface ProductionDomainWiring {
  readonly ordersIdempotency: OrdersIdempotencyAdapter;
  readonly paymentsIdempotency: PaymentsIdempotencyAdapter;
  readonly fulfillmentIdempotency: FulfillmentIdempotencyAdapter;
  readonly sellerSessionStore: SellerSessionStoreAdapter;
  readonly customerSessionStore: CustomerSessionStoreAdapter;
  readonly platformSessionStore: PlatformSessionStoreAdapter;
}

/**
 * Composition Root helper: Extracts and returns the production domain idempotency adapters
 * and app session store adapters wired to PostgreSQL / Supabase persistence.
 */
export function createProductionDomainServices(db: SupabaseDatabase): ProductionDomainWiring {
  return {
    ordersIdempotency: db.ordersIdempotency,
    paymentsIdempotency: db.paymentsIdempotency,
    fulfillmentIdempotency: db.fulfillmentIdempotency,
    sellerSessionStore: db.sellerSessionStore,
    customerSessionStore: db.customerSessionStore,
    platformSessionStore: db.platformSessionStore,
  };
}
