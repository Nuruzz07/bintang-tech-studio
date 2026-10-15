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
import {
  PaymentService,
  PaymentProviderAdapter,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  InMemoryPaymentIdempotencyRepository,
  TipzyPaymentProviderAdapter,
  MockPaymentProviderAdapter,
} from '@bintang/payments';
import { StructuredLogger } from '@bintang/observability';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApiServer } from './server.js';
import { ApiServerInstance } from './types.js';
import { TelegramBotDaemon } from './services/telegram-bot-daemon.js';
import { globalWhatsAppDaemon } from './services/whatsapp-bot-daemon.js';

export * from './types.js';
export * from './errors.js';
export * from './router.js';
export * from './server.js';
export * from './handlers/health.js';
export * from './handlers/catalog.js';
export * from './handlers/orders.js';
export * from './handlers/payments.js';
export * from './handlers/demo.js';
export * from './demo/state.js';

export const PRODUCTION_PROJECT_REF = 'nowyzlyruzlokiejvtne';
export const STAGING_PROJECT_REF = 'vaaixneyotrilqfkulqw';

export function validateSupabaseTarget(
  url: string,
  options: { allowLocalMock?: boolean } = {},
): { projectRef: string | null; isLocal: boolean } {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error('Supabase URL configuration is required and cannot be empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Malformed Supabase URL: "${trimmed}". Must be a valid absolute URL.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit lockout against production
  if (hostname.includes(PRODUCTION_PROJECT_REF) || trimmed.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Production Supabase project ref (${PRODUCTION_PROJECT_REF}) detected. API Gateway runtime is locked against direct production connection.`,
    );
  }

  // Local development / mock support
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    if (options.allowLocalMock ?? true) {
      return { projectRef: null, isLocal: true };
    }
    throw new Error('Local mock Supabase URL is not permitted for staging execution.');
  }

  // Remote Supabase: must strictly be staging project ref
  if (hostname.endsWith('.supabase.co')) {
    const ref = hostname.replace('.supabase.co', '');
    if (ref !== STAGING_PROJECT_REF) {
      throw new Error(
        `UNAUTHORIZED PROJECT TARGET: Supabase host "${hostname}" does not match staging ref "${STAGING_PROJECT_REF}". API Gateway only accepts staging target "${STAGING_PROJECT_REF}".`,
      );
    }
    return { projectRef: ref, isLocal: false };
  }

  throw new Error(
    `UNSUPPORTED SUPABASE TARGET: Host "${hostname}" is neither a valid local mock nor a recognized Supabase domain.`,
  );
}

export function assertNotProductionTarget(url: string): void {
  validateSupabaseTarget(url, { allowLocalMock: true });
}

export function resolveRuntimeSupabaseConfig(env: Record<string, string | undefined>): {
  supabaseUrl: string;
  supabaseKey: string;
  serviceRoleKey: string | undefined;
} {
  const isProductionRuntime = env['NODE_ENV'] === 'production';
  const configuredSupabaseUrl = env['SUPABASE_STAGING_URL'] ?? env['SUPABASE_URL'];
  if (isProductionRuntime && !configuredSupabaseUrl?.trim()) {
    throw new Error(
      'Production runtime requires SUPABASE_STAGING_URL or SUPABASE_URL; local mock fallback is disabled.',
    );
  }

  const supabaseUrl = configuredSupabaseUrl ?? 'http://127.0.0.1:54321';
  validateSupabaseTarget(supabaseUrl, { allowLocalMock: !isProductionRuntime });

  const serviceRoleKey =
    env['SUPABASE_STAGING_SERVICE_ROLE_KEY'] ?? env['SUPABASE_SERVICE_ROLE_KEY'];
  const anonKey = env['SUPABASE_STAGING_ANON_KEY'] ?? env['SUPABASE_ANON_KEY'];
  if (isProductionRuntime && !serviceRoleKey?.trim()) {
    throw new Error(
      'Production runtime requires a server-side Supabase service-role key; anon-key fallback is disabled.',
    );
  }

  return {
    supabaseUrl,
    supabaseKey: serviceRoleKey ?? anonKey ?? (isProductionRuntime ? '' : 'mock_key'),
    serviceRoleKey,
  };
}

export async function bootstrap(): Promise<ApiServerInstance> {
  const env = (typeof process !== 'undefined' ? process.env : {}) ?? {};

  // Load root .env if present
  const rootEnvPath = resolve('C:/BOT_WEB/Bintang-Tech-Project/.env');
  if (existsSync(rootEnvPath)) {
    try {
      const content = readFileSync(rootEnvPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!env[key]) {
              env[key] = val;
            }
            if (typeof process !== 'undefined' && process.env) {
              process.env[key] = val;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const port = Number(env['PORT'] ?? 3000);
  const host = env['HOST'] ?? '127.0.0.1';

  const logger = new StructuredLogger({ requestId: 'api-bootstrap' });
  const { supabaseUrl, supabaseKey, serviceRoleKey } = resolveRuntimeSupabaseConfig(env);

  const db = createSupabaseDatabase({
    supabaseUrl,
    supabaseKey,
    serviceRoleKey,
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

  // Setup Payment Adapters & Service
  const tipzyApiKey = env['TIPZY_API_KEY'];
  const tipzyMerchantCode = env['TIPZY_MERCHANT_CODE'];
  const tipzyCallbackSecret = env['TIPZY_CALLBACK_SECRET'];

  const adapters: PaymentProviderAdapter[] = [];
  if (tipzyApiKey && tipzyMerchantCode) {
    adapters.push(
      new TipzyPaymentProviderAdapter({
        apiKey: tipzyApiKey,
        merchantCode: tipzyMerchantCode,
        callbackSecret: tipzyCallbackSecret ?? '',
      }),
    );
  }
  adapters.push(new MockPaymentProviderAdapter({ providerName: 'MOCK_PAYMENT' }));

  const paymentService = new PaymentService({
    accountRepository: new InMemoryPaymentAccountRepository(),
    intentRepository: new InMemoryPaymentIntentRepository(),
    attemptRepository: new InMemoryPaymentAttemptRepository(),
    eventRepository: new InMemoryPaymentEventRepository(),
    refundRepository: new InMemoryRefundRepository(),
    idempotencyRepository: new InMemoryPaymentIdempotencyRepository(),
    authorizationService: authService,
    orderService,
    adapters,
  });

  const demoEnabled =
    env['DEMO_ENABLED'] === 'true' ||
    (env['NODE_ENV'] !== 'production' &&
      (host === '127.0.0.1' || host === 'localhost' || host === '::1'));

  const serverInstance = createApiServer({
    port,
    host,
    logger,
    demoEnabled,
    dependencies: {
      database: db,
      sessionRepo: db.sessions,
      storeMemberRepo: db.storeMembers,
      storeRepo: db.stores,
      customerRepo: db.customers,
      catalogService,
      inventoryService,
      orderService,
      paymentService,
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
  (process.argv[1]?.replace(/\\/g, '/').endsWith('dist/index.js') ||
    process.argv[1]?.replace(/\\/g, '/').endsWith('src/index.ts'))
) {
  void (async () => {
    const instance = await bootstrap();
    await instance.start();

    // Start interactive Telegram Bot Daemon
    const botDaemon = new TelegramBotDaemon();
    botDaemon.start();

    // Start WhatsApp Bot Daemon & dispatch QR to Telegram
    void globalWhatsAppDaemon.start();
  })();
}
