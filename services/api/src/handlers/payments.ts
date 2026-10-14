import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { OrderCaller } from '@bintang/orders';
import { PaymentCaller, PaymentError } from '@bintang/payments';
import { FulfillmentCaller } from '@bintang/fulfillment';
import { ParsedRequest } from '../router.js';
import { ApiDependencies, ApiResponse } from '../types.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  UnprocessableEntityError,
} from '../errors.js';

export interface PaymentAttemptResponseView {
  readonly paymentIntentId: string;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: string;
  readonly amount: string;
  readonly currency: string;
  readonly provider: string;
  readonly paymentUrl: string | null;
  readonly providerReference: string | null;
  readonly expiresAt: string;
}

export interface WebhookProcessingResponseView {
  readonly received: boolean;
  readonly eventId: string;
  readonly provider: string;
  readonly processingStatus: string;
  readonly isDuplicate: boolean;
}

/**
 * Resolves caller identity from Bearer token or guest headers.
 */
async function resolveAuthContext(
  req: ParsedRequest,
  deps: ApiDependencies,
  storeId: string,
): Promise<{
  readonly customerId: string | null;
  readonly isSeller: boolean;
  readonly sellerUserId: string | null;
}> {
  let customerId: string | null = null;
  let isSeller = false;
  let sellerUserId: string | null = null;

  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const sessionRepo = deps.sessionRepo || deps.database?.sessions;
      if (sessionRepo) {
        const session = await sessionRepo.findByToken(token);
        if (session && !session.revokedAt && new Date(session.expiresAt) >= new Date()) {
          if (session.storeId && session.storeId !== storeId) {
            throw new ForbiddenError('Authentication token belongs to a different store');
          }
          if (session.sessionType === 'CUSTOMER' && session.userId) {
            customerId = session.userId;
          } else if (session.sessionType === 'SELLER' && session.userId) {
            const memberRepo = deps.storeMemberRepo || deps.database?.storeMembers;
            const member = memberRepo
              ? await memberRepo.findByStoreAndUser(storeId, session.userId)
              : null;
            if (member && member.status === 'ACTIVE') {
              isSeller = true;
              sellerUserId = session.userId;
            }
          }
        }
      }
    }
  }

  return { customerId, isSeller, sellerUserId };
}

/**
 * POST /api/v1/stores/:storeId/orders/:orderId/payments
 * Initiates payment intent and generates a payment attempt (QRIS / payment URL).
 */
export async function handleCreateOrderPayment(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<PaymentAttemptResponseView> }> {
  const storeId = req.params.storeId?.trim();
  const orderId = req.params.orderId?.trim();

  if (!storeId || !orderId) {
    throw new BadRequestError('Missing storeId or orderId parameter');
  }

  if (!deps.paymentService) {
    throw new NotFoundError('Payment service is not configured');
  }

  // 1. Authoritative Store Check
  const store = await deps.storeRepo.findById(storeId);
  if (!store || store.status !== 'ACTIVE') {
    throw new NotFoundError(`Store not found or inactive: ${storeId}`);
  }

  // 2. Resolve Auth
  const {
    customerId: authCustomerId,
    isSeller,
    sellerUserId,
  } = await resolveAuthContext(req, deps, storeId);

  // 3. Retrieve Authoritative Order
  const systemContext = createAuthenticatedStoreContext({
    storeId,
    userId: `system:api-payment:${storeId}`,
    membershipId: `sys_pay_${storeId}`,
    role: 'STORE_ADMIN',
  });
  const systemCaller: OrderCaller = { type: 'SELLER', context: systemContext };

  const order = await deps.orderService.getOrderById(systemCaller, orderId);
  if (!order || order.storeId !== storeId) {
    throw new NotFoundError(`Order not found in store: ${orderId}`);
  }

  // Access validation: Caller must be the owning customer or authorized seller
  if (!isSeller && authCustomerId && order.customerId !== authCustomerId) {
    throw new ForbiddenError('Customer is not authorized to initiate payment for this order');
  }

  const effectiveCustomerId = authCustomerId || order.customerId;
  const caller: PaymentCaller = isSeller
    ? {
        type: 'SELLER',
        context: createAuthenticatedStoreContext({
          storeId,
          userId: sellerUserId || 'seller',
          membershipId: `mem_${sellerUserId || 'seller'}`,
          role: 'STORE_OWNER',
        }),
      }
    : {
        type: 'CUSTOMER',
        context: {
          storeId,
          customerId: effectiveCustomerId,
        },
      };

  if (order.status !== 'PENDING_PAYMENT') {
    throw new UnprocessableEntityError(
      `Cannot initiate payment for order in status "${order.status}". Only PENDING_PAYMENT orders can be paid.`,
    );
  }

  // 4. Extract Idempotency Key
  const rawIdempotencyKey =
    req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || undefined;
  const idempotencyKey =
    typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
      ? rawIdempotencyKey.trim()
      : undefined;

  // Parse optional body
  const body = await req.getBody<{
    paymentAccountId?: string;
    metadata?: Record<string, unknown>;
  }>();

  try {
    // 5. Create or Resolve PaymentIntent
    const intent = await deps.paymentService.createPaymentIntent(caller, {
      orderId: order.id,
      paymentAccountId: body?.paymentAccountId,
      idempotencyKey,
      metadata: body?.metadata,
    });

    // 6. Create Payment Attempt (Provider Call)
    const attempt = await deps.paymentService.createPaymentAttempt(caller, {
      paymentIntentId: intent.id,
      metadata: body?.metadata,
    });

    return {
      status: 201,
      body: {
        data: {
          paymentIntentId: intent.id,
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          amount: intent.amount,
          currency: intent.currency,
          provider: attempt.provider,
          paymentUrl: attempt.paymentUrl,
          providerReference: attempt.providerReference,
          expiresAt: intent.expiresAt,
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof PaymentError) {
      if (err.statusCode === 409 || err.code === 'PAYMENT_RECONCILIATION_REQUIRED') {
        throw new UnprocessableEntityError(err.message);
      }
    }
    throw err;
  }
}

/**
 * POST /api/v1/webhooks/payments/:provider
 * Ingress webhook for asynchronous payment callbacks (Midtrans, Tipzy, Sandbox).
 */
export async function handleProcessPaymentWebhook(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<WebhookProcessingResponseView> }> {
  const provider = req.params.provider?.trim();
  if (!provider) {
    throw new BadRequestError('Missing payment provider in webhook URL');
  }

  if (!deps.paymentService) {
    throw new NotFoundError('Payment service is not configured');
  }

  const rawBody = await req.getBody<Record<string, unknown>>();
  if (!rawBody || typeof rawBody !== 'object') {
    throw new BadRequestError('Webhook payload must be a valid JSON object');
  }

  // Resolve Event ID from header or body
  const headerEventId = req.headers['x-event-id'] || req.headers['x-callback-id'];
  const bodyEventId =
    typeof rawBody['eventId'] === 'string'
      ? rawBody['eventId']
      : typeof rawBody['id'] === 'string'
        ? rawBody['id']
        : typeof rawBody['transaction_id'] === 'string'
          ? rawBody['transaction_id']
          : undefined;

  const eventId =
    typeof headerEventId === 'string' && headerEventId.trim()
      ? headerEventId.trim()
      : bodyEventId?.trim();

  if (!eventId) {
    throw new BadRequestError('Webhook event is missing an event identifier (eventId)');
  }

  // Resolve Signature
  const rawSignature =
    req.headers['x-signature'] ||
    req.headers['x-callback-signature'] ||
    req.headers['x-hub-signature'];
  const signature = typeof rawSignature === 'string' ? rawSignature.trim() : undefined;

  const eventType =
    typeof req.headers['x-event-type'] === 'string'
      ? req.headers['x-event-type'].trim()
      : typeof rawBody['eventType'] === 'string'
        ? (rawBody['eventType'] as string)
        : 'PAYMENT_SETTLED';

  const result = await deps.paymentService.processPaymentWebhook({
    provider: provider.toUpperCase(),
    eventId,
    eventType,
    payload: rawBody,
    signature,
  });

  return {
    status: 200,
    body: {
      data: {
        received: true,
        eventId,
        provider: provider.toUpperCase(),
        processingStatus: result.processingStatus,
        isDuplicate: result.isDuplicate || false,
      },
    },
  };
}

/**
 * GET /api/v1/stores/:storeId/orders/:orderId/fulfillment
 * Customer & Seller view of fulfilled digital items.
 */
export async function handleGetOrderFulfillment(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<readonly unknown[]> }> {
  const storeId = req.params.storeId?.trim();
  const orderId = req.params.orderId?.trim();

  if (!storeId || !orderId) {
    throw new BadRequestError('Missing storeId or orderId parameter');
  }

  if (!deps.fulfillmentService) {
    throw new NotFoundError('Fulfillment service is not configured');
  }

  // Authoritative store check
  const store = await deps.storeRepo.findById(storeId);
  if (!store || store.status !== 'ACTIVE') {
    throw new NotFoundError(`Store not found or inactive: ${storeId}`);
  }

  // Resolve Auth
  const {
    customerId: authCustomerId,
    isSeller,
    sellerUserId,
  } = await resolveAuthContext(req, deps, storeId);

  if (!authCustomerId && !isSeller) {
    throw new UnauthorizedError('Authentication required to view order fulfillment details');
  }

  const caller: FulfillmentCaller = isSeller
    ? {
        type: 'SELLER',
        context: createAuthenticatedStoreContext({
          storeId,
          userId: sellerUserId || 'seller',
          membershipId: `mem_${sellerUserId || 'seller'}`,
          role: 'STORE_OWNER',
        }),
      }
    : {
        type: 'CUSTOMER',
        context: {
          storeId,
          customerId: authCustomerId!,
        },
      };

  const fulfillments = await deps.fulfillmentService.listFulfillments(caller, { orderId });

  return {
    status: 200,
    body: {
      data: fulfillments,
    },
  };
}
