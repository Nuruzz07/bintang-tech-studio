import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { Customer, OrderCaller, OrderWithItems, generateUUID } from '@bintang/orders';
import { ParsedRequest } from '../router.js';
import { ApiDependencies, ApiResponse } from '../types.js';
import { BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '../errors.js';

export interface CreateOrderRequestBody {
  readonly items: readonly {
    readonly productId: string;
    readonly quantity: number;
  }[];
  readonly customer: {
    readonly id?: string | undefined;
    readonly name: string;
    readonly email?: string | undefined;
    readonly phone?: string | undefined;
  };
  readonly notes?: string | undefined;
}

export interface OrderItemView {
  readonly id: string;
  readonly productId: string | null;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly subtotal: string;
}

export interface OrderDetailView {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly fulfillmentStatus: string;
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly grandTotal: string;
  readonly currency: string;
  readonly customerId: string;
  readonly createdAt: string;
  readonly items: readonly OrderItemView[];
}

function toSanitizedOrderView(order: OrderWithItems): OrderDetailView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    grandTotal: order.grandTotal,
    currency: order.currency,
    customerId: order.customerId,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
  };
}

export async function handleCreateOrder(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<OrderDetailView> }> {
  const storeId = req.params.storeId?.trim();
  if (!storeId) {
    throw new BadRequestError('Missing storeId parameter');
  }

  // 1. Authoritative store validation
  const store = await deps.storeRepo.findById(storeId);
  if (!store || store.status !== 'ACTIVE') {
    throw new NotFoundError(`Store not found or inactive: ${storeId}`);
  }

  // 2. Parse and validate body
  const body = await req.getBody<CreateOrderRequestBody>();
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Request body is required');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new BadRequestError('Order items array is required and must not be empty');
  }

  for (let idx = 0; idx < body.items.length; idx++) {
    const item = body.items[idx];
    if (!item?.productId || typeof item.productId !== 'string') {
      throw new BadRequestError(`Item at index ${idx} is missing a valid productId`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new BadRequestError(
        `Item at index ${idx} has invalid quantity (${item?.quantity}): must be an integer >= 1`,
      );
    }
  }

  if (!body.customer || typeof body.customer !== 'object') {
    throw new BadRequestError('Customer information is required');
  }
  if (!body.customer.name || typeof body.customer.name !== 'string' || !body.customer.name.trim()) {
    throw new BadRequestError('Customer name is required');
  }

  // 3. Resolve caller & customer authentication
  let authenticatedCustomerId: string | null = null;
  let isSeller = false;

  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const sessionRepo = deps.sessionRepo ?? deps.database?.sessions;
      if (sessionRepo) {
        const session = await sessionRepo.findByToken(token);
        if (session && !session.revokedAt && new Date(session.expiresAt) >= new Date()) {
          if (session.storeId && session.storeId !== storeId) {
            throw new ForbiddenError('Authentication token belongs to a different store');
          }
          if (session.sessionType === 'CUSTOMER' && session.userId) {
            authenticatedCustomerId = session.userId;
          } else if (session.sessionType === 'SELLER' && session.userId) {
            const memberRepo = deps.storeMemberRepo ?? deps.database?.storeMembers;
            const member = memberRepo
              ? await memberRepo.findByStoreAndUser(storeId, session.userId)
              : null;
            if (member && member.status === 'ACTIVE') {
              isSeller = true;
            }
          }
        }
      }
    }
  }

  const rawCustomerId = body.customer.id?.trim();
  if (rawCustomerId && !isSeller && authenticatedCustomerId !== rawCustomerId) {
    if (!authenticatedCustomerId) {
      throw new BadRequestError(
        'Unauthenticated guest checkout cannot specify an explicit customer id',
      );
    } else {
      throw new ForbiddenError(
        'Explicit customer id does not match authenticated customer session',
      );
    }
  }

  // 4. Resolve customer persistence
  let customer: Customer | null = null;
  const targetCustomerId = authenticatedCustomerId ?? (isSeller ? rawCustomerId : undefined);

  if (targetCustomerId) {
    customer = await deps.customerRepo.findById(storeId, targetCustomerId);
  }

  if (!customer && body.customer.email?.trim()) {
    customer = await deps.customerRepo.findByEmail(storeId, body.customer.email.trim());
  }

  if (!customer) {
    const newCustomerId = targetCustomerId || generateUUID();
    customer = await deps.customerRepo.create(storeId, {
      id: newCustomerId,
      storeId,
      name: body.customer.name.trim(),
      email: body.customer.email?.trim() || null,
      phone: body.customer.phone?.trim() || null,
      telegramId: null,
      whatsappNumber: null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderAt: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // 4. Read idempotency key from headers
  const rawIdempotencyKey =
    req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || undefined;
  const idempotencyKey =
    typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
      ? rawIdempotencyKey.trim()
      : undefined;

  // 5. Build customer caller context
  const caller: OrderCaller = {
    type: 'CUSTOMER',
    context: {
      storeId,
      customerId: customer.id,
      name: customer.name,
      email: customer.email ?? undefined,
    },
  };

  // 6. Invoke OrderService (executing server price calculation, stock reservation, and M15 atomic RPC)
  const orderWithItems = await deps.orderService.createOrder(caller, {
    customerId: customer.id,
    items: body.items.map((i) => ({
      productId: i.productId.trim(),
      quantity: i.quantity,
    })),
    currency: store.currency,
    idempotencyKey,
    metadata: {
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      notes: body.notes?.trim(),
      channel: 'HTTP_API_GATEWAY_V1',
    },
  });

  return {
    status: 201,
    body: {
      data: toSanitizedOrderView(orderWithItems),
    },
  };
}

export async function handleGetOrder(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<ApiResponse<OrderDetailView>> {
  const storeId = req.params.storeId?.trim();
  const orderId = req.params.orderId?.trim();

  if (!storeId) {
    throw new BadRequestError('Missing storeId parameter');
  }
  if (!orderId) {
    throw new BadRequestError('Missing orderId parameter');
  }

  // 1. Authoritative store validation
  const store = await deps.storeRepo.findById(storeId);
  if (!store || store.status !== 'ACTIVE') {
    throw new NotFoundError(`Store not found or inactive: ${storeId}`);
  }

  // 2. Authentication Enforcement
  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    const rawCustomerId = req.headers['x-customer-id'];
    if (typeof rawCustomerId === 'string' && rawCustomerId.trim()) {
      throw new UnauthorizedError(
        'Authentication token required to view order details: X-Customer-Id header is not a valid authentication proof',
      );
    }
    throw new UnauthorizedError('Authentication token required to view order details');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError('Authentication token cannot be empty');
  }

  const sessionRepo = deps.sessionRepo ?? deps.database?.sessions;
  if (!sessionRepo) {
    throw new UnauthorizedError('Session verification repository unavailable');
  }

  const session = await sessionRepo.findByToken(token);
  if (!session) {
    throw new UnauthorizedError('Invalid authentication token');
  }

  if (session.revokedAt) {
    throw new UnauthorizedError('Authentication token has been revoked');
  }

  if (new Date(session.expiresAt) < new Date()) {
    throw new UnauthorizedError('Authentication token has expired');
  }

  if (session.storeId && session.storeId !== storeId) {
    throw new ForbiddenError('Authentication token belongs to a different store');
  }

  let caller: OrderCaller;

  if (session.sessionType === 'CUSTOMER') {
    if (!session.userId) {
      throw new UnauthorizedError('Malformed customer session: missing customer id');
    }

    const rawCustomerIdHeader = req.headers['x-customer-id'];
    if (
      typeof rawCustomerIdHeader === 'string' &&
      rawCustomerIdHeader.trim() &&
      rawCustomerIdHeader.trim() !== session.userId
    ) {
      throw new ForbiddenError(
        'X-Customer-Id header does not match authenticated customer session',
      );
    }

    caller = {
      type: 'CUSTOMER',
      context: {
        storeId,
        customerId: session.userId,
      },
    };
  } else if (session.sessionType === 'SELLER') {
    if (!session.userId) {
      throw new UnauthorizedError('Malformed seller session: missing user id');
    }

    const memberRepo = deps.storeMemberRepo ?? deps.database?.storeMembers;
    const member = memberRepo ? await memberRepo.findByStoreAndUser(storeId, session.userId) : null;

    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenError('User is not an active member of this store');
    }

    caller = {
      type: 'SELLER',
      context: createAuthenticatedStoreContext({
        storeId,
        userId: session.userId,
        membershipId: member.id,
        role: member.role,
        requestId: req.requestId,
      }),
    };
  } else {
    throw new ForbiddenError('Unrecognized session type for order access');
  }

  // 4. Retrieve order via OrderService (enforces store boundary and customer ownership)
  const orderWithItems = await deps.orderService.getOrderById(caller, orderId);

  return {
    data: toSanitizedOrderView(orderWithItems),
  };
}
