import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { StructuredLogger } from '@bintang/observability';
import { CatalogService } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import { OrderService, CustomerRepository } from '@bintang/orders';
import { StoreRepository } from '@bintang/tenancy';
import { parseRequest, sendJson } from './router.js';
import { mapErrorToHttpResponse, NotFoundError } from './errors.js';
import { handleHealthCheck } from './handlers/health.js';
import { handleListProducts, handleGetProduct } from './handlers/catalog.js';
import { handleCreateOrder, handleGetOrder } from './handlers/orders.js';
import { ApiDependencies, ApiServerOptions, ApiServerInstance } from './types.js';

export function createApiServer(options: ApiServerOptions = {}): ApiServerInstance {
  const logger = options.logger ?? new StructuredLogger({ requestId: 'api-gateway' });

  // Fallback defaults or injected dependencies
  const deps: ApiDependencies = {
    database: options.dependencies?.database,
    sessionRepo:
      options.dependencies?.sessionRepo ?? options.dependencies?.database?.sessions,
    storeMemberRepo:
      options.dependencies?.storeMemberRepo ??
      options.dependencies?.database?.storeMembers,
    storeRepo:
      options.dependencies?.storeRepo ??
      (options.dependencies?.database?.stores as unknown as StoreRepository),
    customerRepo:
      options.dependencies?.customerRepo ??
      (options.dependencies?.database?.customers as unknown as CustomerRepository),
    catalogService: options.dependencies?.catalogService as CatalogService,
    inventoryService: options.dependencies?.inventoryService as InventoryService,
    orderService: options.dependencies?.orderService as OrderService,
    logger,
  };

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const startTime = Date.now();
    let requestId = 'unknown';

    try {
      const parsed = parseRequest(req);
      requestId = parsed.requestId;

      // CORS Preflight handling
      if (parsed.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Request-Id, X-Customer-Id, Idempotency-Key, X-Idempotency-Key',
          'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
      }

      // Route Dispatch
      // 1. Health
      if (parsed.method === 'GET' && parsed.pathname === '/api/v1/health') {
        const result = await handleHealthCheck(parsed, deps);
        sendJson(res, 200, result, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 2. Products List
      if (
        parsed.method === 'GET' &&
        parsed.params.storeId &&
        !parsed.params.productId &&
        parsed.pathname === `/api/v1/stores/${encodeURIComponent(parsed.params.storeId)}/products`
      ) {
        const result = await handleListProducts(parsed, deps);
        sendJson(res, 200, result, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 3. Product Detail
      if (
        parsed.method === 'GET' &&
        parsed.params.storeId &&
        parsed.params.productId &&
        parsed.pathname ===
          `/api/v1/stores/${encodeURIComponent(parsed.params.storeId)}/products/${encodeURIComponent(parsed.params.productId)}`
      ) {
        const result = await handleGetProduct(parsed, deps);
        sendJson(res, 200, result, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 4. Order Create (Checkout)
      if (
        parsed.method === 'POST' &&
        parsed.params.storeId &&
        !parsed.params.orderId &&
        parsed.pathname === `/api/v1/stores/${encodeURIComponent(parsed.params.storeId)}/orders`
      ) {
        const result = await handleCreateOrder(parsed, deps);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 5. Order Detail
      if (
        parsed.method === 'GET' &&
        parsed.params.storeId &&
        parsed.params.orderId &&
        parsed.pathname ===
          `/api/v1/stores/${encodeURIComponent(parsed.params.storeId)}/orders/${encodeURIComponent(parsed.params.orderId)}`
      ) {
        const result = await handleGetOrder(parsed, deps);
        sendJson(res, 200, result, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // Unmatched Route
      throw new NotFoundError(`Endpoint not found: ${parsed.method} ${parsed.pathname}`);
    } catch (err: unknown) {
      const { status, body } = mapErrorToHttpResponse(err, requestId);
      sendJson(res, status, body, requestId);
      logRequest(
        logger,
        req.method ?? 'UNKNOWN',
        req.url ?? '/',
        status,
        startTime,
        requestId,
        err instanceof Error ? err.message : String(err),
      );
    }
  });

  const configuredPort = options.port ?? 3000;
  const configuredHost = options.host ?? '0.0.0.0';

  return {
    server,
    port: configuredPort,
    host: configuredHost,
    dependencies: deps,
    async start(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.listen(configuredPort, configuredHost, () => {
          const addr = server.address() as AddressInfo | null;
          const actualPort = addr ? addr.port : configuredPort;
          logger.info(`HTTP API Gateway listening on ${configuredHost}:${actualPort}`, {
            port: actualPort,
            host: configuredHost,
          });
          resolve();
        });
        server.once('error', reject);
      });
    },
    async stop(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

function logRequest(
  logger: StructuredLogger,
  method: string,
  pathname: string,
  statusCode: number,
  startTime: number,
  requestId: string,
  errorMessage?: string,
): void {
  const durationMs = Date.now() - startTime;
  const payload = {
    method,
    pathname,
    statusCode,
    durationMs,
    requestId,
    ...(errorMessage ? { error: errorMessage } : {}),
  };

  if (statusCode >= 500) {
    logger.error(`HTTP ${method} ${pathname} -> ${statusCode} (${durationMs}ms)`, payload);
  } else if (statusCode >= 400) {
    logger.warn(`HTTP ${method} ${pathname} -> ${statusCode} (${durationMs}ms)`, payload);
  } else {
    logger.info(`HTTP ${method} ${pathname} -> ${statusCode} (${durationMs}ms)`, payload);
  }
}
