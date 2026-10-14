import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AddressInfo } from 'node:net';
import { StructuredLogger } from '@bintang/observability';
import { CatalogService } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import { OrderService, CustomerRepository } from '@bintang/orders';
import { StoreRepository } from '@bintang/tenancy';
import { TipzyPaymentProviderAdapter } from '@bintang/payments';
import { parseRequest, sendJson, sendHtml } from './router.js';
import { mapErrorToHttpResponse, NotFoundError } from './errors.js';
import { handleHealthCheck } from './handlers/health.js';
import { handleListProducts, handleGetProduct } from './handlers/catalog.js';
import { handleCreateOrder, handleGetOrder } from './handlers/orders.js';
import {
  handleCreateOrderPayment,
  handleProcessPaymentWebhook,
  handleGetOrderFulfillment,
} from './handlers/payments.js';
import {
  handleRenderLandingPage,
  handleRenderTelegramMiniApp,
  handleRenderTelegramSellerBot,
  handleRenderSellerDashboard,
  handleRenderWhatsAppCustomerBot,
  handleRenderCustomerWebStore,
  handleRenderOwnerConsole,
  handleRenderPortfolioPage,
  handleDemoCheckout,
  handleDemoReset,
  handleDemoGetOrders,
  handleDemoFulfillOrder,
  handleDemoRestockProduct,
  handleDemoTelegramCommand,
  handleDemoWhatsAppMessage,
} from './handlers/demo.js';
import { ApiDependencies, ApiServerOptions, ApiServerInstance } from './types.js';

export function createApiServer(options: ApiServerOptions = {}): ApiServerInstance {
  const logger = options.logger ?? new StructuredLogger({ requestId: 'api-gateway' });
  const corsAllowedOrigins = new Set(options.corsAllowedOrigins ?? []);
  const configuredPort = options.port ?? 3000;
  const configuredHost = options.host ?? '0.0.0.0';
  const demoEnabled = options.demoEnabled === true;
  const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost']);
  if (demoEnabled && !loopbackHosts.has(configuredHost)) {
    throw new Error('Demo routes can only be enabled when the API binds to a loopback host.');
  }

  // Fallback defaults or injected dependencies
  const deps: ApiDependencies = {
    database: options.dependencies?.database,
    sessionRepo: options.dependencies?.sessionRepo ?? options.dependencies?.database?.sessions,
    storeMemberRepo:
      options.dependencies?.storeMemberRepo ?? options.dependencies?.database?.storeMembers,
    storeRepo:
      options.dependencies?.storeRepo ??
      (options.dependencies?.database?.stores as unknown as StoreRepository),
    customerRepo:
      options.dependencies?.customerRepo ??
      (options.dependencies?.database?.customers as unknown as CustomerRepository),
    catalogService: options.dependencies?.catalogService as CatalogService,
    inventoryService: options.dependencies?.inventoryService as InventoryService,
    orderService: options.dependencies?.orderService as OrderService,
    paymentService: options.dependencies?.paymentService,
    fulfillmentService: options.dependencies?.fulfillmentService,
    logger,
  };

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const startTime = Date.now();
    let requestId = 'unknown';

    try {
      const parsed = parseRequest(req);
      requestId = parsed.requestId;
      const requestOrigin = req.headers.origin;
      if (typeof requestOrigin === 'string' && corsAllowedOrigins.has(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
      }

      // CORS is opt-in and exact-origin only. Never enable wildcard access by default.
      if (parsed.method === 'OPTIONS') {
        const origin = req.headers.origin;
        const corsHeaders: Record<string, string> = {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Request-Id, X-Customer-Id, Idempotency-Key, X-Idempotency-Key',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        };
        if (typeof origin === 'string' && corsAllowedOrigins.has(origin)) {
          corsHeaders['Access-Control-Allow-Origin'] = origin;
        }
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      // Route Dispatch
      // 1. Health
      if (
        parsed.method === 'GET' &&
        (parsed.pathname === '/api/v1/health' || parsed.pathname === '/health')
      ) {
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

      // 6. Order Payment (Initiate Payment Intent & Attempt)
      if (
        parsed.method === 'POST' &&
        parsed.params.storeId &&
        parsed.params.orderId &&
        parsed.pathname ===
          `/api/v1/stores/${encodeURIComponent(parsed.params.storeId)}/orders/${encodeURIComponent(parsed.params.orderId)}/payments`
      ) {
        const result = await handleCreateOrderPayment(parsed, deps);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 7. Order Fulfillment Detail (Sanitized License / Items View)
      if (
        parsed.method === 'GET' &&
        parsed.params.storeId &&
        parsed.params.orderId &&
        parsed.pathname ===
          `/api/v1/stores/${encodeURIComponent(parsed.params.storeId)}/orders/${encodeURIComponent(parsed.params.orderId)}/fulfillment`
      ) {
        const result = await handleGetOrderFulfillment(parsed, deps);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 8. Payment Webhook Ingress (Async Provider Callbacks)
      if (
        parsed.method === 'POST' &&
        parsed.params.provider &&
        parsed.pathname ===
          `/api/v1/webhooks/payments/${encodeURIComponent(parsed.params.provider)}`
      ) {
        const result = await handleProcessPaymentWebhook(parsed, deps);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 6. Master Showcase & Touchpoint Visual Blueprints
      if (
        parsed.method === 'GET' &&
        (parsed.pathname === '/showcase' || parsed.pathname === '/demo/collage')
      ) {
        const filePath = 'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/master-collage.html';
        if (existsSync(filePath)) {
          const html = readFileSync(filePath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      if (parsed.method === 'GET' && parsed.pathname === '/demo/showcase/storefront') {
        const filePath =
          'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/touchpoint-3-web-storefront.html';
        if (existsSync(filePath)) {
          const html = readFileSync(filePath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      if (parsed.method === 'GET' && parsed.pathname === '/demo/showcase/miniapp') {
        const filePath =
          'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/touchpoint-1-telegram-miniapp.html';
        if (existsSync(filePath)) {
          const html = readFileSync(filePath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      if (parsed.method === 'GET' && parsed.pathname === '/demo/showcase/seller') {
        const filePath =
          'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/touchpoint-2-seller-dashboard.html';
        if (existsSync(filePath)) {
          const html = readFileSync(filePath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      if (parsed.method === 'GET' && parsed.pathname === '/demo/showcase/owner') {
        const filePath =
          'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/touchpoint-4-owner-dashboard.html';
        if (existsSync(filePath)) {
          const html = readFileSync(filePath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      if (parsed.method === 'GET' && parsed.pathname === '/demo/showcase/bots') {
        const filePath =
          'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/touchpoints-5-6-bots.html';
        if (existsSync(filePath)) {
          const html = readFileSync(filePath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      // Preview New Storefront Design
      if (
        parsed.method === 'GET' &&
        (parsed.pathname === '/preview' || parsed.pathname === '/preview/store')
      ) {
        const mockupPath =
          'C:/BOT_WEB/Bintang-Tech-Project/docs/design-mockup/storefront-preview.html';
        if (existsSync(mockupPath)) {
          const html = readFileSync(mockupPath, 'utf8');
          sendHtml(res, 200, html, requestId);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      // 7. Interactive Bintang Store WebApp (Mounted Live Storefront & Mini App)
      if (parsed.method === 'GET') {
        const publicDir = resolve('C:/BOT_WEB/Bintang-Tech-Project/services/api/public');
        const normalizedPath = parsed.pathname.toLowerCase();
        let targetFile: string | null = null;

        if (
          normalizedPath === '/app' ||
          normalizedPath === '/app/' ||
          normalizedPath === '/live' ||
          normalizedPath === '/live/' ||
          normalizedPath === '/index.html' ||
          normalizedPath === '/app/index.html'
        ) {
          targetFile = join(publicDir, 'index.html');
        } else if (
          normalizedPath === '/store' ||
          normalizedPath === '/store/' ||
          normalizedPath === '/app/store' ||
          normalizedPath === '/webapp.html' ||
          normalizedPath === '/app/webapp.html'
        ) {
          targetFile = join(publicDir, 'webapp.html');
        } else if (
          normalizedPath === '/seller' ||
          normalizedPath === '/seller/' ||
          normalizedPath === '/app/seller' ||
          normalizedPath === '/admin.html' ||
          normalizedPath === '/app/admin.html'
        ) {
          targetFile = join(publicDir, 'admin.html');
        } else if (
          normalizedPath === '/telegram' ||
          normalizedPath === '/telegram/' ||
          normalizedPath === '/app/telegram' ||
          normalizedPath === '/telegram.html' ||
          normalizedPath === '/app/telegram.html'
        ) {
          targetFile = join(publicDir, 'telegram.html');
        } else if (
          normalizedPath === '/telegram-admin' ||
          normalizedPath === '/telegram-admin/' ||
          normalizedPath === '/telegram-admin.html' ||
          normalizedPath === '/app/telegram-admin.html'
        ) {
          targetFile = join(publicDir, 'telegram-admin.html');
        } else if (!normalizedPath.startsWith('/api/') && !parsed.pathname.includes('..')) {
          const cleanRel = parsed.pathname.replace(/^\/app/i, '').replace(/^\//, '');
          const candidate = join(publicDir, cleanRel);
          if (cleanRel && existsSync(candidate)) {
            targetFile = candidate;
          }
        }

        if (targetFile && existsSync(targetFile)) {
          const ext = targetFile.split('.').pop()?.toLowerCase();
          const mimeTypes: Record<string, string> = {
            html: 'text/html; charset=utf-8',
            js: 'application/javascript; charset=utf-8',
            mjs: 'application/javascript; charset=utf-8',
            css: 'text/css; charset=utf-8',
            json: 'application/json; charset=utf-8',
            svg: 'image/svg+xml',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            ico: 'image/x-icon',
          };
          const contentType = (ext && mimeTypes[ext]) || 'application/octet-stream';
          const content = readFileSync(targetFile);
          res.writeHead(200, {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-cache',
            ...(requestId ? { 'X-Request-Id': requestId } : {}),
          });
          res.end(content);
          logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
          return;
        }
      }

      // --- DEMO ECOSYSTEM ROUTES ---
      // 7. Landing Page
      if (
        !demoEnabled &&
        (parsed.pathname === '/' ||
          parsed.pathname.startsWith('/demo') ||
          parsed.pathname.startsWith('/api/v1/demo'))
      ) {
        throw new NotFoundError(`Endpoint not found: ${parsed.method} ${parsed.pathname}`);
      }
      if (parsed.method === 'GET' && (parsed.pathname === '/' || parsed.pathname === '/demo')) {
        const html = handleRenderLandingPage();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 7. Customer Telegram Mini App
      if (
        parsed.method === 'GET' &&
        (parsed.pathname === '/demo/store' || parsed.pathname === '/demo/mini-app')
      ) {
        const html = handleRenderTelegramMiniApp(parsed);
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 8. Telegram Seller Bot Simulator
      if (parsed.method === 'GET' && parsed.pathname === '/demo/telegram-seller') {
        const html = handleRenderTelegramSellerBot();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 9. Seller Dashboard
      if (parsed.method === 'GET' && parsed.pathname === '/demo/seller') {
        const html = handleRenderSellerDashboard();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 10. WhatsApp Customer Bot Simulator
      if (parsed.method === 'GET' && parsed.pathname === '/demo/whatsapp') {
        const html = handleRenderWhatsAppCustomerBot();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 11. Customer Web Store (Optional Add-on)
      if (parsed.method === 'GET' && parsed.pathname === '/demo/web-store') {
        const html = handleRenderCustomerWebStore();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 12. Platform Owner Console
      if (parsed.method === 'GET' && parsed.pathname === '/demo/owner') {
        const html = handleRenderOwnerConsole();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 12.5. Portfolio & Proven Ecosystem Directory
      if (parsed.method === 'GET' && parsed.pathname === '/demo/portfolio') {
        const html = handleRenderPortfolioPage();
        sendHtml(res, 200, html, requestId);
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 13. Demo Interactive Checkout Endpoint
      if (parsed.method === 'POST' && parsed.pathname === '/api/v1/demo/checkout') {
        const result = await handleDemoCheckout(parsed);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 14. Demo Reset Endpoint
      if (parsed.method === 'POST' && parsed.pathname === '/api/v1/demo/reset') {
        const result = handleDemoReset();
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 15. Demo Orders List Endpoint
      if (parsed.method === 'GET' && parsed.pathname === '/api/v1/demo/orders') {
        const result = handleDemoGetOrders();
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 16. Demo Order Fulfillment Endpoint
      if (
        parsed.method === 'POST' &&
        parsed.pathname.startsWith('/api/v1/demo/orders/') &&
        parsed.pathname.endsWith('/fulfill')
      ) {
        const parts = parsed.pathname.split('/');
        const orderId = parts[5] ?? '';
        const result = handleDemoFulfillOrder(orderId);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 17. Demo Product Restock Endpoint
      if (
        parsed.method === 'POST' &&
        parsed.pathname.startsWith('/api/v1/demo/products/') &&
        parsed.pathname.endsWith('/restock')
      ) {
        const parts = parsed.pathname.split('/');
        const productId = parts[5] ?? '';
        const result = await handleDemoRestockProduct(parsed, productId);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 18. Demo Telegram Bot Interactive Command Endpoint
      if (parsed.method === 'POST' && parsed.pathname === '/api/v1/demo/telegram/command') {
        const result = await handleDemoTelegramCommand(parsed);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 19. Demo WhatsApp Bot Interactive Message Endpoint
      if (parsed.method === 'POST' && parsed.pathname === '/api/v1/demo/whatsapp/message') {
        const result = await handleDemoWhatsAppMessage(parsed);
        sendJson(res, result.status, result.body, requestId);
        logRequest(logger, parsed.method, parsed.pathname, result.status, startTime, requestId);
        return;
      }

      // 20. Tipzy Live QRIS Initiation Bridge
      if (parsed.method === 'POST' && parsed.pathname === '/api/v1/tipzy/create-qris') {
        const body = await parsed.getBody<{
          orderId?: string;
          amount?: number;
          customerName?: string;
          customerEmail?: string;
        }>();

        const tipzyApiKey =
          typeof process !== 'undefined' ? process.env?.['TIPZY_API_KEY'] : undefined;
        const tipzyMerchantCode =
          typeof process !== 'undefined' ? process.env?.['TIPZY_MERCHANT_CODE'] : undefined;
        const tipzyCallbackSecret =
          typeof process !== 'undefined' ? process.env?.['TIPZY_CALLBACK_SECRET'] : undefined;

        if (tipzyApiKey && tipzyMerchantCode) {
          try {
            const tipzyAdapter = new TipzyPaymentProviderAdapter({
              apiKey: tipzyApiKey,
              merchantCode: tipzyMerchantCode,
              callbackSecret: tipzyCallbackSecret,
            });

            const numericAmount = Math.max(1000, Number(body.amount) || 5000);
            const result = await tipzyAdapter.createPayment({
              paymentIntentId: `pi_${Date.now()}`,
              attemptId: `att_${Date.now()}`,
              orderId: body.orderId || `ORD-${Date.now()}`,
              storeId: 'store_pilot_web_01',
              customerId: 'cust_bintang',
              amount: String(numericAmount),
              currency: 'IDR',
              credentialReference: 'env:TIPZY_API_KEY',
              metadata: {
                customerName: body.customerName || 'Customer Bintang',
                customerEmail: body.customerEmail || 'customer@bintang.store',
                description: `Bintang Store Order ${body.orderId || ''}`,
              },
            });

            sendJson(
              res,
              201,
              {
                success: true,
                data: {
                  ...result,
                  qrImageUrl: (() => {
                    const resp = result.rawResponse as Record<string, unknown> | undefined;
                    const resObj = resp?.['result'] as Record<string, unknown> | undefined;
                    const dataObj = resp?.['data'] as Record<string, unknown> | undefined;
                    return (
                      (typeof resObj?.['qr_url'] === 'string' ? resObj['qr_url'] : null) ??
                      (typeof resObj?.['qr_image_url'] === 'string'
                        ? resObj['qr_image_url']
                        : null) ??
                      (typeof dataObj?.['qr_image_url'] === 'string'
                        ? dataObj['qr_image_url']
                        : null) ??
                      (typeof resp?.['qr_url'] === 'string' ? resp['qr_url'] : null) ??
                      null
                    );
                  })(),
                  qrString: (() => {
                    const resp = result.rawResponse as Record<string, unknown> | undefined;
                    const resObj = resp?.['result'] as Record<string, unknown> | undefined;
                    const dataObj = resp?.['data'] as Record<string, unknown> | undefined;
                    return (
                      (typeof resObj?.['qr_string'] === 'string' ? resObj['qr_string'] : null) ??
                      (typeof dataObj?.['qr_string'] === 'string' ? dataObj['qr_string'] : null) ??
                      (typeof resp?.['qr_string'] === 'string' ? resp['qr_string'] : null) ??
                      null
                    );
                  })(),
                },
              },
              requestId,
            );
            logRequest(logger, parsed.method, parsed.pathname, 201, startTime, requestId);
            return;
          } catch (err: unknown) {
            logger.warn('Tipzy live creation error, falling back:', { error: String(err) });
          }
        }

        sendJson(
          res,
          200,
          {
            success: true,
            data: {
              providerReference: `SIM-${Date.now()}`,
              status: 'PENDING',
              paymentUrl: null,
            },
          },
          requestId,
        );
        logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
        return;
      }

      // 21. Tipzy Live Payment Status Verification Endpoint
      if (
        parsed.method === 'GET' &&
        (parsed.pathname.startsWith('/api/v1/tipzy/check-status') ||
          parsed.pathname.includes('/tipzy/check-status'))
      ) {
        const parts = parsed.pathname.split('/');
        const lastPart = parts[parts.length - 1];
        const txId =
          (lastPart && lastPart !== 'check-status' ? lastPart : '') ||
          parsed.searchParams.get('transactionId') ||
          parsed.searchParams.get('id') ||
          '';

        const tipzyApiKey =
          typeof process !== 'undefined' ? process.env?.['TIPZY_API_KEY'] : undefined;
        const tipzyMerchantCode =
          typeof process !== 'undefined' ? process.env?.['TIPZY_MERCHANT_CODE'] : undefined;
        const tipzyCallbackSecret =
          typeof process !== 'undefined' ? process.env?.['TIPZY_CALLBACK_SECRET'] : undefined;

        if (txId && tipzyApiKey) {
          try {
            const tipzyAdapter = new TipzyPaymentProviderAdapter({
              apiKey: tipzyApiKey,
              merchantCode: tipzyMerchantCode,
              callbackSecret: tipzyCallbackSecret,
            });

            const statusRes = await tipzyAdapter.verifyPayment({
              storeId: 'store_pilot_web_01',
              paymentIntentId: `pi_${txId}`,
              providerReference: txId,
              credentialReference: 'env:TIPZY_API_KEY',
            });

            const isPaid = statusRes.status === 'SUCCEEDED';
            sendJson(
              res,
              200,
              {
                success: true,
                transactionId: txId,
                status: statusRes.status,
                paid: isPaid,
                amount: statusRes.amount,
                currency: statusRes.currency,
              },
              requestId,
            );
            logRequest(logger, parsed.method, parsed.pathname, 200, startTime, requestId);
            return;
          } catch (err: unknown) {
            logger.warn('Tipzy verification query error:', { error: String(err), txId });
          }
        }

        sendJson(
          res,
          200,
          {
            success: true,
            transactionId: txId || 'SIM-DEMO',
            status: 'PENDING',
            paid: false,
          },
          requestId,
        );
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
