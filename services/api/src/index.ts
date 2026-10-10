declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly argv: readonly string[];
  readonly on?: (signal: string, callback: () => void) => void;
  readonly exit: (code?: number) => void;
};

import { createSupabaseDatabase } from '@bintang/database';
import { AuthorizationService } from '@bintang/authorization';
import { CatalogService } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import { OrderService } from '@bintang/orders';
import { StructuredLogger } from '@bintang/observability';
import { createApiServer } from './server.js';
import { ApiServerInstance } from './types.js';

export * from './types.js';
export * from './errors.js';
export * from './router.js';
export * from './server.js';
export * from './handlers/health.js';
export * from './handlers/catalog.js';
export * from './handlers/orders.js';

export async function bootstrap(): Promise<ApiServerInstance> {
  const env = (typeof process !== 'undefined' ? process.env : {}) ?? {};
  const port = Number(env['PORT'] ?? 3000);
  const host = env['HOST'] ?? '0.0.0.0';

  const logger = new StructuredLogger({ requestId: 'api-bootstrap' });

  const supabaseUrl = env['SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
  const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? env['SUPABASE_ANON_KEY'] ?? 'mock_key';

  const db = createSupabaseDatabase({
    supabaseUrl,
    supabaseKey,
    serviceRoleKey: env['SUPABASE_SERVICE_ROLE_KEY'],
  });

  const authService = new AuthorizationService();

  const catalogService = new CatalogService({
    categoryRepository: db.categories,
    productRepository: db.products,
    authorizationService: authService,
  });

  const inventoryService = new InventoryService({
    inventoryRepository: db.inventory,
    productRepository: db.products,
    authorizationService: authService,
    inventoryItemRepository: db.inventoryItems,
  });

  const orderService = new OrderService({
    orderRepository: db.orders,
    customerRepository: db.customers,
    productRepository: db.products,
    inventoryService,
    authorizationService: authService,
    idempotencyRepository: db.ordersIdempotency,
  });

  const serverInstance = createApiServer({
    port,
    host,
    logger,
    dependencies: {
      database: db,
      storeRepo: db.stores,
      customerRepo: db.customers,
      catalogService,
      inventoryService,
      orderService,
      logger,
    },
  });

  if (typeof process !== 'undefined' && process.on) {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down HTTP API Gateway...`);
      await serverInstance.stop();
      logger.info('HTTP API Gateway closed.');
      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  }

  return serverInstance;
}

// Auto-run if executed directly
if (
  typeof process !== 'undefined' &&
  process.argv &&
  (process.argv[1]?.endsWith('dist/index.js') || process.argv[1]?.endsWith('src/index.ts'))
) {
  void (async () => {
    const instance = await bootstrap();
    await instance.start();
  })();
}
