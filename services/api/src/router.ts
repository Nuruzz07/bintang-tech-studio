import { IncomingMessage, ServerResponse } from 'node:http';
import { BadRequestError } from './errors.js';

export interface RouteParams {
  readonly storeId?: string | undefined;
  readonly productId?: string | undefined;
  readonly orderId?: string | undefined;
  readonly provider?: string | undefined;
}

export interface ParsedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly params: RouteParams;
  readonly headers: IncomingMessage['headers'];
  readonly requestId: string;
  getBody<T>(): Promise<T>;
}

export function parseRequest(req: IncomingMessage): ParsedRequest {
  const method = req.method?.toUpperCase() ?? 'GET';
  const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
  const pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
  const searchParams = urlObj.searchParams;

  const rawRequestId = req.headers['x-request-id'];
  const requestId =
    typeof rawRequestId === 'string' && rawRequestId.trim()
      ? rawRequestId.trim()
      : `req_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

  let parsedBodyPromise: Promise<unknown> | null = null;

  const getBody = async <T>(): Promise<T> => {
    if (parsedBodyPromise) {
      return (await parsedBodyPromise) as T;
    }

    parsedBodyPromise = new Promise<unknown>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;
      const MAX_BODY_SIZE = 1024 * 1024; // 1MB

      req.on('data', (chunk: Buffer) => {
        totalLength += chunk.length;
        if (totalLength > MAX_BODY_SIZE) {
          reject(new BadRequestError('Payload too large: maximum 1MB allowed'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new BadRequestError('Malformed JSON payload'));
        }
      });

      req.on('error', (err: unknown) => {
        reject(err);
      });
    });

    return (await parsedBodyPromise) as T;
  };

  const params = matchRouteParams(pathname);

  return {
    method,
    pathname,
    searchParams,
    params,
    headers: req.headers,
    requestId,
    getBody,
  };
}

/**
 * Matches URL path segments against supported route templates.
 */
function matchRouteParams(pathname: string): RouteParams {
  // /api/v1/stores/:storeId/products/:productId
  const productDetailMatch = pathname.match(/^\/api\/v1\/stores\/([^/]+)\/products\/([^/]+)$/);
  if (productDetailMatch && productDetailMatch[1] && productDetailMatch[2]) {
    return {
      storeId: decodeURIComponent(productDetailMatch[1]),
      productId: decodeURIComponent(productDetailMatch[2]),
    };
  }

  // /api/v1/stores/:storeId/products
  const productsMatch = pathname.match(/^\/api\/v1\/stores\/([^/]+)\/products$/);
  if (productsMatch && productsMatch[1]) {
    return {
      storeId: decodeURIComponent(productsMatch[1]),
    };
  }

  // /api/v1/stores/:storeId/orders/:orderId/payments
  const orderPaymentsMatch = pathname.match(
    /^\/api\/v1\/stores\/([^/]+)\/orders\/([^/]+)\/payments$/,
  );
  if (orderPaymentsMatch && orderPaymentsMatch[1] && orderPaymentsMatch[2]) {
    return {
      storeId: decodeURIComponent(orderPaymentsMatch[1]),
      orderId: decodeURIComponent(orderPaymentsMatch[2]),
    };
  }

  // /api/v1/stores/:storeId/orders/:orderId/fulfillment
  const orderFulfillmentMatch = pathname.match(
    /^\/api\/v1\/stores\/([^/]+)\/orders\/([^/]+)\/fulfillment$/,
  );
  if (orderFulfillmentMatch && orderFulfillmentMatch[1] && orderFulfillmentMatch[2]) {
    return {
      storeId: decodeURIComponent(orderFulfillmentMatch[1]),
      orderId: decodeURIComponent(orderFulfillmentMatch[2]),
    };
  }

  // /api/v1/webhooks/payments/:provider
  const webhookPaymentsMatch = pathname.match(/^\/api\/v1\/webhooks\/payments\/([^/]+)$/);
  if (webhookPaymentsMatch && webhookPaymentsMatch[1]) {
    return {
      provider: decodeURIComponent(webhookPaymentsMatch[1]),
    };
  }

  // /api/v1/stores/:storeId/orders/:orderId
  const orderDetailMatch = pathname.match(/^\/api\/v1\/stores\/([^/]+)\/orders\/([^/]+)$/);
  if (orderDetailMatch && orderDetailMatch[1] && orderDetailMatch[2]) {
    return {
      storeId: decodeURIComponent(orderDetailMatch[1]),
      orderId: decodeURIComponent(orderDetailMatch[2]),
    };
  }

  // /api/v1/stores/:storeId/orders
  const ordersMatch = pathname.match(/^\/api\/v1\/stores\/([^/]+)\/orders$/);
  if (ordersMatch && ordersMatch[1]) {
    return {
      storeId: decodeURIComponent(ordersMatch[1]),
    };
  }

  return {};
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  requestId?: string,
): void {
  const jsonPayload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...(requestId ? { 'X-Request-Id': requestId } : {}),
  });
  res.end(jsonPayload);
}

export function sendHtml(
  res: ServerResponse,
  status: number,
  html: string,
  requestId?: string,
): void {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...(requestId ? { 'X-Request-Id': requestId } : {}),
  });
  res.end(html);
}
