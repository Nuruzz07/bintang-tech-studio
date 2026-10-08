import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
  PermissionDeniedError,
} from '@bintang/authorization';
import { OrderService, InMemoryOrderRepository, InMemoryCustomerRepository } from '@bintang/orders';
import { InMemoryProductRepository } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  PaymentService,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  MockPaymentProviderAdapter,
  PaymentAccountNotFoundError,
  PublicPaymentAccount,
} from '../src/index.js';

describe('M08 Payment Accounts Suite', () => {
  let accountRepo: InMemoryPaymentAccountRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let attemptRepo: InMemoryPaymentAttemptRepository;
  let eventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let authService: AuthorizationService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let mockAdapter: MockPaymentProviderAdapter;

  const storeId = 'store_test_payment_accounts';
  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner_acc',
    membershipId: 'mem_owner_acc',
    role: 'STORE_OWNER',
  });

  const staffContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_staff_acc',
    membershipId: 'mem_staff_acc',
    role: 'STORE_STAFF',
  });

  beforeEach(() => {
    accountRepo = new InMemoryPaymentAccountRepository();
    intentRepo = new InMemoryPaymentIntentRepository();
    attemptRepo = new InMemoryPaymentAttemptRepository();
    eventRepo = new InMemoryPaymentEventRepository();
    refundRepo = new InMemoryRefundRepository();
    authService = new AuthorizationService(new InMemoryEntitlementResolver());

    const orderRepo = new InMemoryOrderRepository();
    const customerRepo = new InMemoryCustomerRepository();
    const productRepo = new InMemoryProductRepository();
    const inventoryRepo = new InMemoryInventoryRepository();
    const inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    orderService = new OrderService({
      orderRepository: orderRepo,
      customerRepository: customerRepo,
      productRepository: productRepo,
      inventoryService,
      authorizationService: authService,
    });

    mockAdapter = new MockPaymentProviderAdapter({ providerName: 'TIPZY' });

    paymentService = new PaymentService({
      accountRepository: accountRepo,
      intentRepository: intentRepo,
      attemptRepository: attemptRepo,
      eventRepository: eventRepo,
      refundRepository: refundRepo,
      authorizationService: authService,
      orderService,
      adapters: [mockAdapter],
    });
  });

  it('allows STORE_OWNER to create a payment account', async () => {
    const account = await paymentService.createPaymentAccount(ownerContext, {
      provider: 'TIPZY',
      displayName: 'Main Tipzy Gateway',
      currency: 'IDR',
      credentialReference: 'vault:secret:tipzy_prod_key_v1',
      configuration: { merchantId: 'tipzy_mid_123' },
    });

    expect(account.id).toBeDefined();
    expect(account.storeId).toBe(storeId);
    expect(account.provider).toBe('TIPZY');
    expect(account.status).toBe('ACTIVE');
    expect(account.credentialReference).toBe('vault:secret:tipzy_prod_key_v1');
  });

  it('prohibits STORE_STAFF from creating payment account with PermissionDeniedError', async () => {
    await expect(
      paymentService.createPaymentAccount(staffContext, {
        provider: 'TIPZY',
        displayName: 'Unauthorized Account',
        credentialReference: 'vault:secret:tipzy_key',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('returns full account including credentialReference to authorized merchant', async () => {
    const created = await paymentService.createPaymentAccount(ownerContext, {
      provider: 'TIPZY',
      displayName: 'Tipzy Secret Gateway',
      credentialReference: 'vault:secret:tipzy_key_secure',
    });

    const fetched = await paymentService.getPaymentAccount(
      { type: 'SELLER', context: ownerContext },
      created.id,
    );

    expect(fetched.id).toBe(created.id);
    expect((fetched as PaymentAccount).credentialReference).toBe('vault:secret:tipzy_key_secure');
  });

  it('strictly strips credentialReference and private configs when queried by customer', async () => {
    const created = await paymentService.createPaymentAccount(ownerContext, {
      provider: 'TIPZY',
      displayName: 'Customer-Facing Account',
      credentialReference: 'vault:secret:SUPER_SECRET_TOKEN',
      configuration: { privateKey: 'secret_jwt' },
    });

    const customerAccount = (await paymentService.getPaymentAccount(
      { type: 'CUSTOMER', context: { storeId, customerId: 'cust_001' } },
      created.id,
    )) as PublicPaymentAccount;

    expect(customerAccount.id).toBe(created.id);
    expect(customerAccount.displayName).toBe('Customer-Facing Account');
    expect(
      (customerAccount as unknown as Record<string, unknown>).credentialReference,
    ).toBeUndefined();
    expect((customerAccount as unknown as Record<string, unknown>).configuration).toBeUndefined();
  });

  it('throws PaymentAccountNotFoundError when querying non-existent account', async () => {
    await expect(
      paymentService.getPaymentAccount(
        { type: 'SELLER', context: ownerContext },
        'non_existent_account_id',
      ),
    ).rejects.toThrow(PaymentAccountNotFoundError);
  });

  it('lists payment accounts for a store when queried by merchant', async () => {
    await paymentService.createPaymentAccount(ownerContext, {
      provider: 'TIPZY',
      displayName: 'Account A',
      credentialReference: 'vault:ref:1',
    });
    await paymentService.createPaymentAccount(ownerContext, {
      provider: 'TIPZY',
      displayName: 'Account B',
      credentialReference: 'vault:ref:2',
    });

    const list = await paymentService.listPaymentAccounts(ownerContext);
    expect(list.length).toBe(2);
  });
});
