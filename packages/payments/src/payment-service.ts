import {
  AuthenticatedStoreContext,
  StoreContext,
  createAuthenticatedStoreContext,
} from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import { OrderService, OrderCaller, CustomerOrderAccessDeniedError } from '@bintang/orders';
import {
  PaymentAccount,
  PublicPaymentAccount,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentAttempt,
  PaymentEvent,
  Refund,
  PaymentCaller,
  CreatePaymentAccountInput,
  CreatePaymentIntentInput,
  CreatePaymentAttemptInput,
  ProcessPaymentWebhookInput,
  WebhookProcessingResult,
  CreateRefundInput,
  PaymentIntentFilter,
} from './types.js';
import { PaymentAccountRepository } from './payment-account-repository.js';
import { PaymentIntentRepository } from './payment-intent-repository.js';
import { PaymentAttemptRepository } from './payment-attempt-repository.js';
import { PaymentEventRepository } from './payment-event-repository.js';
import { RefundRepository } from './refund-repository.js';
import { PaymentIdempotencyRepository } from './idempotency-repository.js';
import { PaymentProviderAdapter } from './provider-adapter.js';
import {
  PaymentError,
  PaymentNotFoundError,
  PaymentAccountNotFoundError,
  PaymentIntentNotFoundError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  PaymentStoreMismatchError,
  PaymentOrderMismatchError,
  PaymentCustomerAccessDeniedError,
  PaymentProviderUnsupportedError,
  PaymentIdempotencyConflictError,
  PaymentEventConflictError,
  PaymentSignatureVerificationError,
  OrderNotPayableError,
  RefundAmountExceededError,
  RefundUnsupportedError,
} from './errors.js';
import { validatePositiveAmount, generateUUID } from './validation.js';
import { normalizeMoney, addMoney, subtractMoney, compareMoney } from './money.js';

export interface PaymentServiceOptions {
  readonly accountRepository: PaymentAccountRepository;
  readonly intentRepository: PaymentIntentRepository;
  readonly attemptRepository: PaymentAttemptRepository;
  readonly eventRepository: PaymentEventRepository;
  readonly refundRepository: RefundRepository;
  readonly idempotencyRepository?: PaymentIdempotencyRepository | undefined;
  readonly authorizationService: AuthorizationService;
  readonly orderService: OrderService;
  readonly adapters?: readonly PaymentProviderAdapter[] | undefined;
}

/**
 * Tenant-scoped Payment Application Service.
 * Coordinates seller payment accounts, payment intents, payment attempts,
 * provider adapters, webhooks, refunds, idempotency, and M07 order transitions.
 */
export class PaymentService {
  private readonly accountRepo: PaymentAccountRepository;
  private readonly intentRepo: PaymentIntentRepository;
  private readonly attemptRepo: PaymentAttemptRepository;
  private readonly eventRepo: PaymentEventRepository;
  private readonly refundRepo: RefundRepository;
  private readonly idempotencyRepo?: PaymentIdempotencyRepository | undefined;
  private readonly authService: AuthorizationService;
  private readonly orderService: OrderService;
  private readonly adapters = new Map<string, PaymentProviderAdapter>();
  private readonly inFlightLocks = new Map<string, Promise<void>>();

  constructor(options: PaymentServiceOptions) {
    this.accountRepo = options.accountRepository;
    this.intentRepo = options.intentRepository;
    this.attemptRepo = options.attemptRepository;
    this.eventRepo = options.eventRepository;
    this.refundRepo = options.refundRepository;
    this.idempotencyRepo = options.idempotencyRepository;
    this.authService = options.authorizationService;
    this.orderService = options.orderService;

    if (options.adapters) {
      for (const adapter of options.adapters) {
        const fallbackName = (adapter as unknown as { name?: string }).name;
        const key = (adapter.provider ?? fallbackName ?? '').toUpperCase();
        if (key) {
          this.adapters.set(key, adapter);
        }
      }
    }
  }

  /**
   * Registers a provider adapter at runtime.
   */
  registerAdapter(adapter: PaymentProviderAdapter): void {
    const fallbackName = (adapter as unknown as { name?: string }).name;
    const key = (adapter.provider ?? fallbackName ?? '').toUpperCase();
    if (key) {
      this.adapters.set(key, adapter);
    }
  }

  private getAdapter(provider: string): PaymentProviderAdapter {
    const adapter = this.adapters.get(provider.toUpperCase());
    if (!adapter) {
      throw new PaymentProviderUnsupportedError(provider);
    }
    return adapter;
  }

  private async acquireInFlightLock(key: string): Promise<() => void> {
    while (this.inFlightLocks.has(key)) {
      await this.inFlightLocks.get(key);
    }
    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.inFlightLocks.delete(key);
        resolve();
      };
    });
    this.inFlightLocks.set(key, lockPromise);
    return release;
  }

  // ==============================================================================
  // 1. PAYMENT ACCOUNTS (Seller-Owned Integration)
  // ==============================================================================

  /**
   * Creates a payment account for a store.
   * Requires seller role with 'payments.manage'.
   */
  async createPaymentAccount(
    sellerContext: AuthenticatedStoreContext | StoreContext,
    input: CreatePaymentAccountInput,
  ): Promise<PaymentAccount> {
    await this.authService.assertAuthorizedStoreAction({
      context: sellerContext,
      permission: 'payments.manage',
      targetStoreId: sellerContext.storeId,
    });

    const storeId = sellerContext.storeId;
    const provider = input.provider.toUpperCase();

    // Verify provider is supported
    const adapter = this.getAdapter(provider);
    const capabilities = (input.capabilities ??
      Object.keys(adapter.getCapabilities()).filter(
        (k) => (adapter.getCapabilities() as unknown as Record<string, boolean>)[k],
      )) as readonly import('./types.js').PaymentProviderCapability[];

    const now = new Date().toISOString();
    const account: PaymentAccount = {
      id: generateUUID(),
      storeId,
      provider,
      displayName: input.displayName.trim(),
      status: 'ACTIVE',
      currency: input.currency ?? 'IDR',
      credentialReference: input.credentialReference.trim(),
      capabilities,
      configuration: Object.freeze({ ...(input.configuration ?? {}) }),
      createdAt: now,
      updatedAt: now,
    };

    return this.accountRepo.create(storeId, account);
  }

  /**
   * Retrieves a payment account.
   * Sellers receive full account with safe credential reference.
   * Customers receive PublicPaymentAccount (credential references completely stripped).
   */
  async getPaymentAccount(
    caller: PaymentCaller,
    accountId: string,
  ): Promise<PaymentAccount | PublicPaymentAccount> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'payments.read',
        targetStoreId: storeId,
      });

      const account = await this.accountRepo.findById(storeId, accountId);
      if (!account) {
        throw new PaymentAccountNotFoundError(accountId);
      }
      return account;
    }

    // Customer caller: strictly strip all sensitive configuration and credential references
    const account = await this.accountRepo.findById(storeId, accountId);
    if (!account) {
      throw new PaymentAccountNotFoundError(accountId);
    }

    const publicAccount: PublicPaymentAccount = {
      id: account.id,
      storeId: account.storeId,
      provider: account.provider,
      displayName: account.displayName,
      status: account.status,
      currency: account.currency,
      capabilities: account.capabilities,
      createdAt: account.createdAt,
    };

    return Object.freeze(publicAccount);
  }

  /**
   * Lists payment accounts for a store.
   * Requires seller role with 'payments.read'.
   */
  async listPaymentAccounts(
    caller: AuthenticatedStoreContext | StoreContext | PaymentCaller,
  ): Promise<readonly PaymentAccount[]> {
    if ('type' in caller && caller.type === 'CUSTOMER') {
      throw new PaymentCustomerAccessDeniedError('Customers cannot list merchant payment accounts');
    }

    const sellerContext =
      'type' in caller && caller.type === 'SELLER'
        ? caller.context
        : (caller as AuthenticatedStoreContext | StoreContext);

    await this.authService.assertAuthorizedStoreAction({
      context: sellerContext,
      permission: 'payments.read',
      targetStoreId: sellerContext.storeId,
    });

    return this.accountRepo.list(sellerContext.storeId);
  }

  /**
   * Lists customer-safe public payment accounts for store checkout.
   */
  async listPublicPaymentAccounts(caller: PaymentCaller): Promise<readonly PublicPaymentAccount[]> {
    const storeId = caller.context.storeId;
    const accounts = await this.accountRepo.list(storeId);
    return Object.freeze(
      accounts
        .filter((acc) => acc.status === 'ACTIVE')
        .map((acc) =>
          Object.freeze({
            id: acc.id,
            storeId: acc.storeId,
            provider: acc.provider,
            displayName: acc.displayName,
            status: acc.status,
            currency: acc.currency,
            capabilities: acc.capabilities,
            createdAt: acc.createdAt,
          }),
        ),
    );
  }

  // ==============================================================================
  // 2. PAYMENT INTENT (Order-Bound Intention to Pay)
  // ==============================================================================

  /**
   * Creates a PaymentIntent linked to an authoritative M07 Order.
   * Validates authoritative order amount, currency, status, customer ownership, and tenant boundary.
   */
  async createPaymentIntent(
    caller: PaymentCaller,
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntent> {
    let storeId: string;
    let customerId: string | undefined = undefined;
    let actorId: string;

    if (caller.type === 'CUSTOMER') {
      storeId = caller.context.storeId;
      customerId = caller.context.customerId;
      actorId = caller.context.customerId;
    } else {
      storeId = caller.context.storeId;
      actorId = caller.context.userId ?? 'merchant';
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'orders.update',
        targetStoreId: storeId,
      });
    }

    // Acquire lock if idempotencyKey is provided to prevent concurrent duplicates
    let releaseLock: (() => void) | undefined;
    if (input.idempotencyKey) {
      const lockKey = `${storeId}:${actorId}:${input.idempotencyKey.trim()}`;
      releaseLock = await this.acquireInFlightLock(lockKey);
    }

    try {
      // 1. Idempotency Check
      let requestPayloadHash = '';
      if (input.idempotencyKey && this.idempotencyRepo) {
        requestPayloadHash = JSON.stringify({
          storeId,
          orderId: input.orderId,
          paymentAccountId: input.paymentAccountId,
          amount: input.amount,
          currency: input.currency,
        });

        const existingRecord = await this.idempotencyRepo.get(
          storeId,
          actorId,
          input.idempotencyKey,
        );
        if (existingRecord) {
          if (existingRecord.requestHash !== requestPayloadHash) {
            throw new PaymentIdempotencyConflictError(
              `Idempotency key "${input.idempotencyKey}" was previously used with a different request payload`,
            );
          }
          return existingRecord.response as PaymentIntent;
        }
      }

      // 2. Retrieve & Validate Authoritative Order from M07
      let order: Awaited<ReturnType<typeof this.orderService.getOrderById>>;
      try {
        order = await this.orderService.getOrderById(caller, input.orderId);
      } catch (err: unknown) {
        if (err instanceof PaymentError) throw err;
        const errObj = err as { name?: string; code?: string } | null;
        if (
          err instanceof CustomerOrderAccessDeniedError ||
          errObj?.name === 'CustomerOrderAccessDeniedError' ||
          errObj?.code === 'FORBIDDEN'
        ) {
          throw new PaymentCustomerAccessDeniedError(
            'Customer is not authorized to access this order',
          );
        }
        throw new PaymentOrderMismatchError(
          `Order "${input.orderId}" not found or does not belong to store ${storeId}`,
        );
      }

      if (order.storeId !== storeId) {
        throw new PaymentStoreMismatchError(
          `Order storeId (${order.storeId}) does not match payment storeId (${storeId})`,
        );
      }

      if (caller.type === 'CUSTOMER' && order.customerId !== customerId) {
        throw new PaymentCustomerAccessDeniedError(
          'Customer cannot create a payment intent for another customer order',
        );
      }

      if (order.status !== 'PENDING_PAYMENT') {
        throw new OrderNotPayableError(order.id, order.status);
      }

      // 3. Amount & Currency Security: Derive or strictly verify against authoritative order
      const authoritativeAmount = normalizeMoney(
        order.grandTotal,
        'authoritative order grandTotal',
      );
      const authoritativeCurrency = order.currency;

      if (input.amount) {
        const suppliedAmount = normalizeMoney(input.amount, 'supplied amount');
        if (suppliedAmount !== authoritativeAmount) {
          throw new PaymentAmountMismatchError(authoritativeAmount, suppliedAmount);
        }
      }

      if (input.currency && input.currency !== authoritativeCurrency) {
        throw new PaymentCurrencyMismatchError(authoritativeCurrency, input.currency);
      }

      // 4. Resolve Payment Account & Adapter
      let paymentAccount: PaymentAccount | null = null;
      if (input.paymentAccountId) {
        paymentAccount = await this.accountRepo.findById(storeId, input.paymentAccountId);
      } else {
        paymentAccount = await this.accountRepo.findActiveByStore(storeId);
      }

      if (!paymentAccount || paymentAccount.status !== 'ACTIVE') {
        throw new PaymentAccountNotFoundError(
          input.paymentAccountId ?? `No active payment account configured for store ${storeId}`,
        );
      }

      // Verify adapter exists
      this.getAdapter(paymentAccount.provider);

      // 5. Persist Payment Intent
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hour expiry default

      const intent: PaymentIntent = {
        id: generateUUID(),
        storeId,
        orderId: order.id,
        customerId: order.customerId,
        amount: authoritativeAmount,
        currency: authoritativeCurrency,
        status: 'PENDING',
        paymentAccountId: paymentAccount.id,
        provider: paymentAccount.provider,
        idempotencyKey: input.idempotencyKey?.trim() ?? null,
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
      };

      const createdIntent = await this.intentRepo.create(storeId, intent);

      // 6. Record Idempotency
      if (input.idempotencyKey && this.idempotencyRepo) {
        await this.idempotencyRepo.set({
          key: input.idempotencyKey.trim(),
          storeId,
          actorId,
          requestHash: requestPayloadHash,
          response: createdIntent,
          createdAt: now.toISOString(),
        });
      }

      return createdIntent;
    } finally {
      if (releaseLock) {
        releaseLock();
      }
    }
  }

  /**
   * Retrieves a PaymentIntent by ID.
   */
  async getPaymentIntentById(caller: PaymentCaller, intentId: string): Promise<PaymentIntent> {
    const storeId = caller.context.storeId;
    const intent = await this.intentRepo.findById(storeId, intentId);
    if (!intent) {
      throw new PaymentIntentNotFoundError(intentId);
    }

    if (caller.type === 'CUSTOMER' && intent.customerId !== caller.context.customerId) {
      throw new PaymentCustomerAccessDeniedError();
    }

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'payments.read',
        targetStoreId: storeId,
      });
    }

    return intent;
  }

  /**
   * Lists PaymentIntents for a store.
   */
  async listPaymentIntents(
    caller: PaymentCaller,
    filter?: PaymentIntentFilter,
  ): Promise<readonly PaymentIntent[]> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'payments.read',
        targetStoreId: storeId,
      });
      return this.intentRepo.list(storeId, filter);
    }

    // Customer strictly sees only their own intents
    return this.intentRepo.list(storeId, {
      ...filter,
      customerId: caller.context.customerId,
    });
  }

  // ==============================================================================
  // 3. PAYMENT ATTEMPTS (Historical Discrete Charges)
  // ==============================================================================

  /**
   * Spawns a PaymentAttempt under a PaymentIntent via the designated provider adapter.
   */
  async createPaymentAttempt(
    caller: PaymentCaller,
    input: CreatePaymentAttemptInput,
  ): Promise<PaymentAttempt> {
    const storeId = caller.context.storeId;
    const intent = await this.getPaymentIntentById(caller, input.paymentIntentId);

    if (intent.status === 'SUCCEEDED' || intent.status === 'REFUNDED') {
      throw new PaymentError(
        `Cannot create payment attempt for intent in terminal status ${intent.status}`,
      );
    }

    const account = await this.accountRepo.findById(storeId, intent.paymentAccountId);
    if (!account) {
      throw new PaymentAccountNotFoundError(intent.paymentAccountId);
    }

    const adapter = this.getAdapter(account.provider);
    const existingAttempts = await this.attemptRepo.findByIntentId(storeId, intent.id);
    const attemptNumber = existingAttempts.length + 1;
    const attemptId = generateUUID();

    // Call provider adapter
    const providerResult = await adapter.createPayment({
      storeId,
      paymentIntentId: intent.id,
      attemptId,
      orderId: intent.orderId,
      amount: intent.amount,
      currency: intent.currency,
      customerId: intent.customerId,
      credentialReference: account.credentialReference,
      metadata: input.metadata,
    });

    const now = new Date().toISOString();
    const attempt: PaymentAttempt = {
      id: attemptId,
      storeId,
      paymentIntentId: intent.id,
      attemptNumber,
      provider: account.provider,
      providerReference: providerResult.providerReference,
      paymentUrl: providerResult.paymentUrl,
      amount: intent.amount,
      currency: intent.currency,
      status: providerResult.status,
      failureCode: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };

    const createdAttempt = await this.attemptRepo.create(storeId, attempt);

    // If intent was PENDING, transition it to PROCESSING
    if (intent.status === 'PENDING') {
      await this.intentRepo.updateStatus(storeId, intent.id, 'PROCESSING');
    }

    return createdAttempt;
  }

  /**
   * Lists attempts for a payment intent.
   */
  async listPaymentAttempts(
    caller: PaymentCaller,
    intentId: string,
  ): Promise<readonly PaymentAttempt[]> {
    // Validate intent access first
    await this.getPaymentIntentById(caller, intentId);
    return this.attemptRepo.findByIntentId(caller.context.storeId, intentId);
  }

  // ==============================================================================
  // 4. WEBHOOK & EVENT INGRESS (Replay Defense & Order Coordination)
  // ==============================================================================

  /**
   * Processes an incoming payment webhook event with signature verification and deduplication.
   */
  async processPaymentWebhook(input: ProcessPaymentWebhookInput): Promise<WebhookProcessingResult> {
    const provider = input.provider.toUpperCase();
    const adapter = this.getAdapter(provider);

    // Acquire in-flight lock on provider + eventId to serialize concurrent deliveries
    const releaseLock = await this.acquireInFlightLock(`${provider}:event:${input.eventId}`);
    try {
      // 1. Event Deduplication & Replay Protection
      const existingEvent = await this.eventRepo.findByProviderEventId(provider, input.eventId);
      if (existingEvent) {
        // If event exists with identical payload hash, resolve idempotently
        const existingHash = JSON.stringify(existingEvent.payload);
        const incomingHash = JSON.stringify(input.payload);

        if (existingHash !== incomingHash) {
          throw new PaymentEventConflictError(
            provider,
            input.eventId,
            'Payload differs from previously recorded event with the same eventId',
          );
        }

        // Duplicate event reconciliation:
        // If this previously recorded successful payment event is associated with a payment intent,
        // verify whether the order requires reconciliation (i.e. PaymentIntent = SUCCEEDED but Order != PAID).
        let reconciledCurrentStatus: PaymentIntentStatus | undefined = undefined;
        if (existingEvent.paymentIntentId && existingEvent.storeId) {
          const intent = await this.intentRepo.findById(
            existingEvent.storeId,
            existingEvent.paymentIntentId,
          );
          if (intent && intent.status === 'SUCCEEDED') {
            reconciledCurrentStatus = intent.status;
            const systemContext = createAuthenticatedStoreContext({
              storeId: intent.storeId,
              userId: `system:payment-engine:${intent.storeId}`,
              membershipId: `sys_pay_${intent.storeId}`,
              role: 'STORE_ADMIN',
            });

            const orderCaller: OrderCaller = {
              type: 'SELLER',
              context: systemContext,
            };

            const order = await this.orderService.getOrderById(orderCaller, intent.orderId);
            if (order && order.status !== 'PAID') {
              await this.orderService.transitionStatus(systemContext, intent.orderId, 'PAID', {
                paymentIntentId: intent.id,
                provider,
              });
            }
          }
        }

        return {
          eventId: input.eventId,
          provider,
          processingStatus: existingEvent.processingStatus,
          paymentIntentId: existingEvent.paymentIntentId,
          previousStatus: reconciledCurrentStatus,
          currentStatus: reconciledCurrentStatus,
          isDuplicate: true,
        };
      }

      // 2. Parse Event via Provider Adapter
      const parsed = await adapter.parseWebhookEvent({
        payload: input.payload,
      });

      // 3. Resolve Target Payment Attempt / Intent
      const providerRef = input.providerReference ?? parsed.providerReference;
      let attempt: PaymentAttempt | null = null;
      if (providerRef) {
        attempt = await this.attemptRepo.findByProviderReference(provider, providerRef);
      }

      let intent: PaymentIntent | null = null;
      let storeId: string;

      if (attempt) {
        storeId = attempt.storeId;
        intent = await this.intentRepo.findById(storeId, attempt.paymentIntentId);
      } else {
        const targetStoreId = input.storeId ?? parsed.storeId;
        const targetIntentId = input.paymentIntentId ?? parsed.paymentIntentId;
        if (targetIntentId && targetStoreId) {
          storeId = targetStoreId;
          intent = await this.intentRepo.findById(storeId, targetIntentId);
        } else {
          throw new PaymentNotFoundError(
            `Unable to resolve target payment intent for provider reference "${providerRef ?? 'unknown'}"`,
          );
        }
      }

      if (!intent) {
        throw new PaymentIntentNotFoundError(
          input.paymentIntentId ?? parsed.paymentIntentId ?? 'unknown',
        );
      }

      // 4. Validate Tenant Isolation & Store Matching
      if (input.storeId && input.storeId !== storeId) {
        throw new PaymentStoreMismatchError(
          `Expected store "${storeId}", received "${input.storeId}"`,
        );
      }
      if (parsed.storeId && parsed.storeId !== storeId) {
        throw new PaymentStoreMismatchError(
          `Expected store "${storeId}", received "${parsed.storeId}"`,
        );
      }

      // Validate Intent Matching
      if (input.paymentIntentId && input.paymentIntentId !== intent.id) {
        throw new PaymentOrderMismatchError(
          `Expected intent "${intent.id}", received "${input.paymentIntentId}"`,
        );
      }
      if (parsed.paymentIntentId && parsed.paymentIntentId !== intent.id) {
        throw new PaymentOrderMismatchError(
          `Expected intent "${intent.id}", received "${parsed.paymentIntentId}"`,
        );
      }
      if (attempt && attempt.paymentIntentId !== intent.id) {
        throw new PaymentOrderMismatchError(
          `Attempt intent "${attempt.paymentIntentId}" does not match target intent "${intent.id}"`,
        );
      }

      // 5. Validate Store & Payment Account Matching
      const account = await this.accountRepo.findById(storeId, intent.paymentAccountId);
      if (!account) {
        throw new PaymentAccountNotFoundError(intent.paymentAccountId);
      }
      if (account.storeId !== storeId) {
        throw new PaymentStoreMismatchError(
          `Payment account store "${account.storeId}" does not match target store "${storeId}"`,
        );
      }
      if (account.provider.toUpperCase() !== provider) {
        throw new PaymentProviderUnsupportedError(account.provider);
      }

      // 6. Signature Verification via Adapter
      const signature =
        input.signature ??
        input.headers?.['x-webhook-signature'] ??
        input.headers?.['x-signature'] ??
        input.headers?.['signature'];

      if (!signature) {
        throw new PaymentSignatureVerificationError(
          `Missing webhook signature for provider ${provider}`,
        );
      }

      const isSignatureValid = await adapter.verifyWebhookSignature({
        payload: input.payload,
        rawBody: input.rawBody,
        headers: input.headers,
        signature,
        credentialReference: account.credentialReference,
      });

      if (!isSignatureValid) {
        throw new PaymentSignatureVerificationError(
          `Invalid or missing webhook signature for provider ${provider}`,
        );
      }

      // 7. Amount & Currency Authenticity Verification
      const effectiveAmount = input.amount ?? parsed.amount;
      if (effectiveAmount !== undefined && effectiveAmount !== null) {
        const eventAmount = normalizeMoney(effectiveAmount, 'webhook amount');
        if (eventAmount !== intent.amount) {
          throw new PaymentAmountMismatchError(intent.amount, eventAmount);
        }
      }
      const effectiveCurrency = input.currency ?? parsed.currency;
      if (effectiveCurrency && effectiveCurrency !== intent.currency) {
        throw new PaymentCurrencyMismatchError(intent.currency, effectiveCurrency);
      }

      const previousStatus = intent.status;
      let currentStatus = previousStatus;

      // 8. Execute State Transitions & Event Persistence
      if (parsed.status === 'SUCCEEDED') {
        if (attempt && attempt.status !== 'SUCCEEDED') {
          await this.attemptRepo.updateStatus(storeId, attempt.id, 'SUCCEEDED');
        }

        if (intent.status !== 'SUCCEEDED') {
          const updatedIntent = await this.intentRepo.updateStatus(
            storeId,
            intent.id,
            'SUCCEEDED',
            {
              paidAt: new Date().toISOString(),
              providerReference: providerRef ?? parsed.providerReference,
            },
          );
          currentStatus = updatedIntent.status;
        }
      } else if (parsed.status === 'FAILED') {
        if (attempt && attempt.status !== 'FAILED') {
          await this.attemptRepo.updateStatus(storeId, attempt.id, 'FAILED', {
            failureReason: parsed.failureReason ?? 'Payment declined by provider',
          });
        }
      }

      // Record Payment Event BEFORE downstream order coordination so that ingress receipt is safely recorded
      // in eventRepo even if downstream order coordination experiences transient failure.
      const now = new Date().toISOString();
      const eventRecord: PaymentEvent = {
        id: generateUUID(),
        storeId,
        paymentIntentId: intent.id,
        paymentAttemptId: attempt?.id ?? null,
        provider,
        eventId: input.eventId,
        eventType: input.eventType ?? parsed.eventType,
        payload: Object.freeze({ ...input.payload }),
        processingStatus: 'PROCESSED',
        processedAt: now,
        createdAt: now,
      };

      await this.eventRepo.create(eventRecord);

      // 9. Coordinate with M07 Order Foundation: Mark Order as PAID
      if (parsed.status === 'SUCCEEDED') {
        const systemContext = createAuthenticatedStoreContext({
          storeId,
          userId: `system:payment-engine:${storeId}`,
          membershipId: `sys_pay_${storeId}`,
          role: 'STORE_ADMIN',
        });

        const orderCaller: OrderCaller = {
          type: 'SELLER',
          context: systemContext,
        };

        const order = await this.orderService.getOrderById(orderCaller, intent.orderId);
        if (order && order.status !== 'PAID') {
          await this.orderService.transitionStatus(systemContext, intent.orderId, 'PAID', {
            paymentIntentId: intent.id,
            provider,
          });
        }
      }

      return {
        eventId: input.eventId,
        provider,
        processingStatus: 'PROCESSED',
        paymentIntentId: intent.id,
        previousStatus,
        currentStatus,
        isDuplicate: false,
      };
    } finally {
      releaseLock();
    }
  }

  // ==============================================================================
  // 5. REFUND FOUNDATION
  // ==============================================================================

  /**
   * Creates and processes a refund for a succeeded payment.
   */
  async createRefund(
    caller: AuthenticatedStoreContext | StoreContext | PaymentCaller,
    input: CreateRefundInput,
  ): Promise<Refund> {
    if ('type' in caller && caller.type === 'CUSTOMER') {
      throw new PaymentCustomerAccessDeniedError('Customers cannot issue refunds');
    }
    const sellerContext =
      'type' in caller && caller.type === 'SELLER'
        ? caller.context
        : (caller as AuthenticatedStoreContext | StoreContext);

    await this.authService.assertAuthorizedStoreAction({
      context: sellerContext,
      permission: 'payments.manage',
      targetStoreId: sellerContext.storeId,
    });

    const storeId = sellerContext.storeId;
    const releaseLock = await this.acquireInFlightLock(
      `${storeId}:refund:${input.paymentIntentId}`,
    );
    try {
      const intent = await this.intentRepo.findById(storeId, input.paymentIntentId);
      if (!intent) {
        throw new PaymentIntentNotFoundError(input.paymentIntentId);
      }

      if (intent.status !== 'SUCCEEDED' && intent.status !== 'PARTIALLY_REFUNDED') {
        throw new PaymentError(
          `Cannot refund payment in status "${intent.status}". Only SUCCEEDED payments are refundable.`,
        );
      }

      const requestedAmount = validatePositiveAmount(input.amount, 'refund amount');

      // Calculate maximum refundable balance
      const existingRefunds = await this.refundRepo.findByIntentId(storeId, intent.id);
      let totalRefunded = '0.00';
      for (const r of existingRefunds) {
        if (r.status === 'SUCCEEDED') {
          totalRefunded = addMoney(totalRefunded, r.amount);
        }
      }

      const remainingRefundable = subtractMoney(intent.amount, totalRefunded);
      if (compareMoney(requestedAmount, remainingRefundable) > 0) {
        throw new RefundAmountExceededError(remainingRefundable, requestedAmount);
      }

      const account = await this.accountRepo.findById(storeId, intent.paymentAccountId);
      if (!account) {
        throw new PaymentAccountNotFoundError(intent.paymentAccountId);
      }

      const adapter = this.getAdapter(account.provider);
      const capabilities = adapter.getCapabilities();
      if (!capabilities.refund || !adapter.createRefund) {
        throw new RefundUnsupportedError(
          `Provider "${account.provider}" does not support refund operations`,
        );
      }

      if (
        compareMoney(requestedAmount, intent.amount) < 0 &&
        capabilities.partialRefund === false
      ) {
        throw new RefundUnsupportedError(
          `Provider "${account.provider}" does not support partial refund operations`,
        );
      }

      const refundId = generateUUID();
      const providerRefund = await adapter.createRefund({
        storeId,
        paymentIntentId: intent.id,
        providerReference: intent.id,
        refundId,
        amount: requestedAmount,
        currency: intent.currency,
        reason: input.reason,
        credentialReference: account.credentialReference,
      });

      const now = new Date().toISOString();
      const refund: Refund = {
        id: refundId,
        storeId,
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        provider: account.provider,
        providerRefundId: providerRefund.providerRefundId,
        amount: requestedAmount,
        currency: intent.currency,
        status: providerRefund.status,
        reason: input.reason ?? null,
        requestedAt: now,
        processedAt: providerRefund.status === 'SUCCEEDED' ? now : null,
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      };

      const createdRefund = await this.refundRepo.create(storeId, refund);

      // Update PaymentIntent status: REFUNDED (full) vs PARTIALLY_REFUNDED
      const newTotalRefunded = addMoney(totalRefunded, requestedAmount);
      const targetStatus =
        compareMoney(newTotalRefunded, intent.amount) === 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      await this.intentRepo.updateStatus(storeId, intent.id, targetStatus);

      return createdRefund;
    } finally {
      releaseLock();
    }
  }

  /**
   * Lists refunds for a payment intent.
   */
  async listRefunds(
    sellerContext: AuthenticatedStoreContext | StoreContext,
    paymentIntentId: string,
  ): Promise<readonly Refund[]> {
    await this.authService.assertAuthorizedStoreAction({
      context: sellerContext,
      permission: 'payments.read',
      targetStoreId: sellerContext.storeId,
    });

    return this.refundRepo.findByIntentId(sellerContext.storeId, paymentIntentId);
  }
}
