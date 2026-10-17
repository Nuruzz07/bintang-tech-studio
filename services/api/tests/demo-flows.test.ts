import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createApiServer } from '../src/server.js';
import { ApiServerInstance } from '../src/types.js';
import { demoState } from '../src/demo/state.js';

describe('Demo route deployment guard', () => {
  it('rejects enabling demo routes on a non-loopback bind address', () => {
    expect(() => createApiServer({ host: '0.0.0.0', demoEnabled: true })).toThrow(/loopback host/);
  });

  it('hides all demo surfaces unless explicitly enabled', async () => {
    const instance = createApiServer({ port: 0, host: '127.0.0.1' });
    await instance.start();
    try {
      const addr = instance.server.address() as AddressInfo;
      const base = `http://127.0.0.1:${addr.port}`;
      for (const path of ['/', '/demo', '/demo/store', '/api/v1/demo/reset']) {
        const response = await fetch(`${base}${path}`, {
          method: path.includes('/reset') ? 'POST' : 'GET',
        });
        expect(response.status, path).toBe(404);
      }
    } finally {
      await instance.stop();
    }
  });
});

describe('Bintang Tech Studio : Master Ecosystem Interactive Demo Suite', () => {
  let serverInstance: ApiServerInstance;
  let baseUrl: string;

  beforeAll(async () => {
    // Start on random available port
    serverInstance = createApiServer({
      port: 0,
      host: '127.0.0.1',
      demoEnabled: true,
    });
    await serverInstance.start();
    const addr = serverInstance.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await serverInstance.stop();
  });

  beforeEach(() => {
    demoState.reset();
  });

  function makeRequest(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {},
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: options.headers || {},
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: data,
            });
          });
        },
      );

      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  // 1. LANDING PAGE
  it('GET / & /demo renders Platform Landing Page with business architecture and pricing', async () => {
    const res = await makeRequest('/demo');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Ubah jualan digital manual menjadi lebih otomatis.');
    expect(res.body).toContain('Bintang Tech Studio');
    expect(res.body).toContain('Platform Owner');
    expect(res.body).toContain('Seller / Merchant');
    expect(res.body).toContain('Pelanggan Toko');
    expect(res.body).toContain('Rp50.000');
    expect(res.body).toContain('Rp100.000');
    expect(res.body).toContain('Starter');
    expect(res.body).toContain('Hubungi Kami');
  });

  it('GET / redirects or renders Landing Page directly', async () => {
    const res = await makeRequest('/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Bintang Tech Studio');
  });

  // 2. CUSTOMER TELEGRAM MINI APP
  it('GET /demo/store renders Customer Telegram Mini App with 36 products and honest simulation label', async () => {
    const res = await makeRequest('/demo/store');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Mode Simulasi Telegram WebApp');
    expect(res.body).toContain('Spotify Premium');
    expect(res.body).toContain('YouTube Premium');
    expect(res.body).toContain('Canva Pro');
    expect(res.body).toContain('Keranjang Belanja');
    expect(res.body).toContain('Semua (36)');
  });

  it('GET /demo/store?cat=streaming filters products by category', async () => {
    const res = await makeRequest('/demo/store?cat=streaming');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Spotify Premium');
    expect(res.body).not.toContain('ChatGPT Plus (Private)');
  });

  // 3. TELEGRAM SELLER BOT SIMULATOR
  it('GET /demo/telegram-seller renders Telegram Seller Bot with incoming order alerts', async () => {
    const res = await makeRequest('/demo/telegram-seller');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('@BintangSellerBot');
    expect(res.body).toContain('Bintang Seller Assistant');
    expect(res.body).toContain('PESANAN BARU MASUK!');
    expect(res.body).toContain('Ahmad Fauzi');
  });

  // 4. SELLER DASHBOARD
  it('GET /demo/seller renders Seller Dashboard SaaS with order list and inventory', async () => {
    const res = await makeRequest('/demo/seller');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Seller Dashboard');
    expect(res.body).toContain('store_pilot_bintang_01');
    expect(res.body).toContain('Total Omset Penjualan');
    expect(res.body).toContain('Daftar Pesanan Masuk');
    expect(res.body).toContain('Inventaris & Stok');
    expect(res.body).toContain('ORD-PILOT-8921');
  });

  // 5. CUSTOMER WHATSAPP BOT SIMULATOR
  it('GET /demo/whatsapp renders WhatsApp Customer Bot Simulator', async () => {
    const res = await makeRequest('/demo/whatsapp');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('WhatsApp Customer Bot Simulator');
    expect(res.body).toContain('Bukan Meta Cloud Live');
    expect(res.body).toContain('Toko Bintang Digital');
  });

  // 6. CUSTOMER WEB STORE ADD-ON
  it('GET /demo/web-store renders Customer Web Store add-on view', async () => {
    const res = await makeRequest('/demo/web-store');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Customer Web Store (Add-on Opsional)');
    expect(res.body).toContain('Bintang Tech Web Store');
  });

  // 7. PLATFORM OWNER CONSOLE
  it('GET /demo/owner renders Platform Owner Console with tenant directory and system health', async () => {
    const res = await makeRequest('/demo/owner');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Platform Owner Console');
    expect(res.body).toContain('Toko Bintang Tech');
    expect(res.body).toContain('Digital Studio Beta');
    expect(res.body).toContain('Audit Aktivitas Platform');
    expect(res.body).toContain('Sistem Sehat (Healthy)');
  });

  // 8. INTERACTIVE END-TO-END FLOW (Checkout -> Seller Dashboard -> Seller Bot -> Owner Console)
  it('executes end-to-end checkout flow and verifies cross-view state synchronization', async () => {
    // 1. Submit checkout via demo API
    const checkoutRes = await makeRequest('/api/v1/demo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Siti Rahmawati',
        customerContact: '@siti_rahma_tg',
        channel: 'telegram_mini_app',
        paymentMethod: 'QRIS Instan (Simulasi)',
        items: [{ productId: 'prod_spotify_prem', quantity: 2 }],
      }),
    });

    expect(checkoutRes.status).toBe(201);
    const checkoutData = JSON.parse(checkoutRes.body);
    expect(checkoutData.success).toBe(true);
    expect(checkoutData.order).toBeDefined();
    expect(checkoutData.order.customerName).toBe('Siti Rahmawati');
    expect(checkoutData.order.totalAmount).toBe(38000);
    expect(checkoutData.order.paymentStatus).toBe('PAID');
    expect(checkoutData.order.fulfilledItems.length).toBe(2);
    expect(JSON.stringify(checkoutData.order.fulfilledItems)).not.toMatch(/user=|pass=|@/i);
    expect(checkoutData.order.fulfilledItems[0].serialOrAccount).toBe('SIMULATED_DELIVERY_ONLY');

    const newOrderId = checkoutData.order.orderId;

    // 2. Verify order list endpoint includes the new order
    const ordersListRes = await makeRequest('/api/v1/demo/orders');
    expect(ordersListRes.status).toBe(200);
    const ordersListData = JSON.parse(ordersListRes.body);
    expect(
      ordersListData.orders.some((o: { readonly orderId: string }) => o.orderId === newOrderId),
    ).toBe(true);

    // 3. Verify Seller Dashboard reflects the newly placed order
    const sellerRes = await makeRequest('/demo/seller');
    expect(sellerRes.status).toBe(200);
    expect(sellerRes.body).toContain(newOrderId);
    expect(sellerRes.body).toContain('Siti Rahmawati');

    // 4. Verify Telegram Seller Bot Simulator displays the new order alert
    const botRes = await makeRequest('/demo/telegram-seller');
    expect(botRes.status).toBe(200);
    expect(botRes.body).toContain(newOrderId);
    expect(botRes.body).toContain('Siti Rahmawati');

    // 5. Verify Owner Console logs the transaction in activity audit
    const ownerRes = await makeRequest('/demo/owner');
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body).toContain(newOrderId);
    expect(ownerRes.body).toContain('Siti Rahmawati');
  });

  // 9. VALIDATION AND SECURITY TESTS
  it('rejects checkout with empty items array', async () => {
    const res = await makeRequest('/api/v1/demo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Invalid Buyer',
        items: [],
      }),
    });
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
  });

  it('rejects checkout when buyer name or contact is missing or whitespace', async () => {
    const invalidBuyers = [
      { customerName: '', customerContact: '@valid_contact' },
      { customerName: 'Buyer', customerContact: '   ' },
      { customerContact: '@valid_contact' },
      { customerName: 'Buyer' },
    ];

    for (const buyer of invalidBuyers) {
      const res = await makeRequest('/api/v1/demo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buyer,
          items: [{ productId: 'prod_spotify_prem', quantity: 1 }],
        }),
      });
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).success).toBe(false);
    }

    expect(demoState.getOrders()).toHaveLength(2);
  });

  it('renders demo buyer fields as empty, explicitly labeled required inputs', async () => {
    const res = await makeRequest('/demo/store');
    expect(res.status).toBe(200);
    expect(res.body).toMatch(/<label[^>]*for="input-customer-name"/);
    expect(res.body).toMatch(/<input[^>]*id="input-customer-name"[^>]*required/);
    expect(res.body).not.toMatch(/id="input-customer-name"[^>]*value=/);
    expect(res.body).toMatch(/<label[^>]*for="input-customer-contact"/);
    expect(res.body).toMatch(/<input[^>]*id="input-customer-contact"[^>]*required/);
    expect(res.body).not.toMatch(/id="input-customer-contact"[^>]*value=/);
  });

  it('rejects checkout with nonexistent product ID', async () => {
    const res = await makeRequest('/api/v1/demo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Invalid Buyer',
        customerContact: '@invalid_buyer',
        items: [{ productId: 'prod_nonexistent_xyz', quantity: 1 }],
      }),
    });
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
    expect(data.error).toContain('tidak ditemukan');
  });

  it('rejects checkout with zero or negative quantity', async () => {
    const res = await makeRequest('/api/v1/demo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Invalid Buyer',
        items: [{ productId: 'prod_spotify_prem', quantity: 0 }],
      }),
    });
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
  });

  it('sanitizes XSS attempts in customer name and contact', async () => {
    const res = await makeRequest('/api/v1/demo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: '<script>alert("xss")</script>',
        customerContact: '<img src=x onerror=alert(1)>',
        items: [{ productId: 'prod_spotify_prem', quantity: 1 }],
      }),
    });
    expect(res.status).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.order.customerName).not.toContain('<script>');
    expect(data.order.customerName).toContain('&lt;script&gt;');
  });

  it('POST /api/v1/demo/reset restores state to baseline', async () => {
    // 1. Create an order
    await makeRequest('/api/v1/demo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Temporary User',
        items: [{ productId: 'prod_spotify_prem', quantity: 1 }],
      }),
    });

    // 2. Call reset
    const resetRes = await makeRequest('/api/v1/demo/reset', { method: 'POST' });
    expect(resetRes.status).toBe(200);

    // 3. Verify order list is back to baseline (2 seeded orders)
    const ordersRes = await makeRequest('/api/v1/demo/orders');
    const ordersData = JSON.parse(ordersRes.body);
    expect(ordersData.orders.length).toBe(2);
    expect(
      ordersData.orders.some(
        (o: { readonly customerName: string }) => o.customerName === 'Temporary User',
      ),
    ).toBe(false);
  });

  // 9. PORTFOLIO & PROYEK EKOSISTEM DIRECTORY
  it('GET /demo/portfolio renders portfolio directory with F&B jastip, digital store, and tracker', async () => {
    const res = await makeRequest('/demo/portfolio');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Ekosistem Dagang Terpadu Bintang Tech');
    expect(res.body).toContain('Bintang Store : F&B Jastip Online');
    expect(res.body).toContain('1.328 Outlet');
    expect(res.body).toContain('Haversine Formula');
    expect(res.body).toContain('Bintang SplitPay');
    expect(res.body).toContain('Unified Live Order Tracker');
    expect(res.body).toContain('Digital Minimal Reference Template');
  });

  // 10. ORDER FULFILLMENT ENDPOINT
  it('POST /api/v1/demo/orders/:orderId/fulfill marks processing order as FULFILLED', async () => {
    // ORD-PILOT-8922 is seeded as PROCESSING
    const res = await makeRequest('/api/v1/demo/orders/ORD-PILOT-8922/fulfill', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);

    const order = demoState.getOrderById('ORD-PILOT-8922');
    expect(order?.fulfillmentStatus).toBe('FULFILLED');
  });

  // 11. PRODUCT RESTOCK ENDPOINT
  it('POST /api/v1/demo/products/:productId/restock adds stock to demo product', async () => {
    const initialProduct = demoState.getProductById('prod_spotify_prem');
    const initialStock = initialProduct?.stock ?? 0;

    const res = await makeRequest('/api/v1/demo/products/prod_spotify_prem/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 15 }),
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.newStock).toBe(initialStock + 15);
  });

  // 12. TELEGRAM BOT INTERACTIVE COMMANDS
  it('POST /api/v1/demo/telegram/command handles /orders, /stock, /omset, and /broadcast', async () => {
    const resOrders = await makeRequest('/api/v1/demo/telegram/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/orders' }),
    });
    expect(resOrders.status).toBe(200);
    expect(JSON.parse(resOrders.body).reply).toContain('DAFTAR 3 PESANAN TERBARU');

    const resStock = await makeRequest('/api/v1/demo/telegram/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/stock' }),
    });
    expect(resStock.status).toBe(200);

    const resOmset = await makeRequest('/api/v1/demo/telegram/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/omset' }),
    });
    expect(resOmset.status).toBe(200);
    expect(JSON.parse(resOmset.body).reply).toContain('RINGKASAN OMSET');
  });

  it('renders unknown Telegram commands as escaped text, not HTML', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const res = await makeRequest('/api/v1/demo/telegram/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: payload }),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).reply).not.toContain('<img');
    const page = await makeRequest('/demo/telegram-seller');
    expect(page.body).not.toContain(payload);
    expect(page.body).toContain('&lt;img');
  });

  // 13. WHATSAPP BOT INTERACTIVE MESSAGES
  it('POST /api/v1/demo/whatsapp/message handles customer text and returns simulated bot reply', async () => {
    const res = await makeRequest('/api/v1/demo/whatsapp/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '1. Lihat Katalog' }),
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.reply).toContain('KATALOG AKUN TERLARIS');
  });

  it('renders customer WhatsApp input as escaped text, not HTML', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    await makeRequest('/api/v1/demo/whatsapp/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload }),
    });
    const page = await makeRequest('/demo/whatsapp');
    expect(page.body).not.toContain(payload);
    expect(page.body).toContain('&lt;img');
  });
});
