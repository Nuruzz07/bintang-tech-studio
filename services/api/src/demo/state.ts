/**
 * Bintang Tech Studio : Shared In-Memory Demo State
 * Baseline : Milestone M15 Hardening and Ecosystem Demo
 *
 * Provides authoritative, synchronized, in-process state for all 7 demo views:
 * - Customer Telegram Mini App
 * - Customer WhatsApp Bot Simulator
 * - Customer Web Store (Optional Add-on)
 * - Seller Telegram Bot Simulator
 * - Seller Dashboard
 * - Platform Owner Console
 * - Platform Landing Page
 */

import { TEMPLATE_01_CATEGORIES, TEMPLATE_01_PRODUCTS } from '@bintang/customer-store';

export interface DemoCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly icon: string;
  readonly description: string;
  readonly badge: string;
}

export interface DemoProduct {
  readonly id: string;
  readonly name: string;
  readonly categorySlug: string;
  readonly price: number;
  readonly originalPrice: number;
  readonly duration: string;
  readonly shortDescription: string;
  readonly description: string;
  stock: number;
  readonly badge: string;
  readonly rating: number;
  readonly soldCount: number;
  readonly monogram: string;
  readonly benefits: readonly string[];
  readonly importantInfo: string;
  readonly credentialSecret: string;
}

export interface DemoOrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly subtotal: number;
  readonly duration: string;
}

export interface DemoOrder {
  readonly orderId: string;
  readonly storeId: string;
  readonly customerName: string;
  readonly customerContact: string;
  readonly channel: 'telegram_mini_app' | 'whatsapp_bot' | 'web_store';
  readonly items: readonly DemoOrderItem[];
  readonly totalAmount: number;
  readonly paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  readonly paymentMethod: string;
  fulfillmentStatus: 'FULFILLED' | 'PROCESSING' | 'UNFULFILLED';
  readonly createdAt: string;
  readonly fulfilledItems?: readonly { readonly name: string; readonly serialOrAccount: string }[];
}

export interface DemoBotMessage {
  readonly id: string;
  readonly sender: 'bot' | 'seller' | 'customer';
  readonly message: string;
  readonly timestamp: string;
  readonly orderId?: string;
  readonly buttons?: readonly { readonly label: string; readonly action: string }[];
}

export interface DemoActivityLog {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly details: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class DemoStateManager {
  private categories: DemoCategory[] = [];
  private products: Map<string, DemoProduct> = new Map();
  private orders: DemoOrder[] = [];
  private telegramMessages: DemoBotMessage[] = [];
  private whatsAppMessages: DemoBotMessage[] = [];
  private activityLogs: DemoActivityLog[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.categories = TEMPLATE_01_CATEGORIES.map((c) => ({ ...c }));
    this.products.clear();
    for (const p of TEMPLATE_01_PRODUCTS) {
      this.products.set(p.id, {
        ...p,
        stock: p.stock,
      });
    }

    // Seed 2 realistic baseline orders for Seller Dashboard & Bots
    const now = new Date();
    const order1Time = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const order2Time = new Date(now.getTime() - 45 * 60 * 1000).toISOString();

    this.orders = [
      {
        orderId: 'ORD-PILOT-8921',
        storeId: 'store_pilot_bintang_01',
        customerName: 'Ahmad Fauzi',
        customerContact: '@ahmad_fauzi_tg',
        channel: 'telegram_mini_app',
        items: [
          {
            productId: 'prod_spotify_prem',
            productName: 'Spotify Premium 1 Bulan',
            unitPrice: 19000,
            quantity: 1,
            subtotal: 19000,
            duration: '1 Bulan (Private)',
          },
        ],
        totalAmount: 19000,
        paymentStatus: 'PAID',
        paymentMethod: 'QRIS Instan (Simulasi)',
        fulfillmentStatus: 'FULFILLED',
        createdAt: order1Time,
        fulfilledItems: [
          {
            name: 'Spotify Premium 1 Bulan',
            serialOrAccount: 'SIMULATED_DELIVERY_ONLY',
          },
        ],
      },
      {
        orderId: 'ORD-PILOT-8922',
        storeId: 'store_pilot_bintang_01',
        customerName: 'Rina Kusuma',
        customerContact: '+6281298765432',
        channel: 'whatsapp_bot',
        items: [
          {
            productId: 'prod_canva_pro',
            productName: 'Canva Pro Edu Lifetime',
            unitPrice: 25000,
            quantity: 1,
            subtotal: 25000,
            duration: 'Lifetime Garansi',
          },
        ],
        totalAmount: 25000,
        paymentStatus: 'PAID',
        paymentMethod: 'BCA Virtual Account (Simulasi)',
        fulfillmentStatus: 'PROCESSING',
        createdAt: order2Time,
      },
    ];

    this.telegramMessages = [
      {
        id: 'msg-tg-01',
        sender: 'bot',
        message: '👋 Halo Seller! Bot Operasional Toko Bintang siap membantu kelola tokomu.',
        timestamp: new Date(now.getTime() - 3 * 3600 * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        buttons: [
          { label: '🛍️ Buka Toko (Mini App)', action: 'open_store' },
          { label: '📦 Cek Pesanan Masuk', action: 'check_orders' },
          { label: '📊 Buka Seller Dashboard', action: 'open_dashboard' },
        ],
      },
      {
        id: 'msg-tg-02',
        sender: 'bot',
        message:
          '🔔 <b>PESANAN BARU MASUK!</b>\nOrder ID: <code>ORD-PILOT-8921</code>\nPelanggan: Ahmad Fauzi\nItem: 1x Spotify Premium (Rp19.000)\nPembayaran: QRIS (PAID)\nStatus: Terkirim Otomatis ✅',
        timestamp: new Date(now.getTime() - 2 * 3600 * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        orderId: 'ORD-PILOT-8921',
        buttons: [{ label: '🔍 Detail Pesanan', action: 'order_detail_8921' }],
      },
    ];

    this.whatsAppMessages = [
      {
        id: 'msg-wa-01',
        sender: 'bot',
        message:
          'Halo! Selamat datang di Layanan Otomatis WhatsApp Toko Bintang. Produk digital apa yang sedang kamu cari?',
        timestamp: new Date(now.getTime() - 50 * 60 * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      {
        id: 'msg-wa-02',
        sender: 'customer',
        message: 'Mau beli Canva Pro dong kak.',
        timestamp: new Date(now.getTime() - 48 * 60 * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      {
        id: 'msg-wa-03',
        sender: 'bot',
        message:
          '✅ Canva Pro Edu Lifetime tersedia! Harga Rp25.000 (Stok ready).\nSilakan klik tombol di bawah untuk checkout instan tanpa antre.',
        timestamp: new Date(now.getTime() - 46 * 60 * 1000).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        buttons: [{ label: '⚡ Checkout Canva Pro', action: 'checkout_canva' }],
      },
    ];

    this.activityLogs = [
      {
        id: 'log-01',
        timestamp: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
        actor: 'Customer: Ahmad Fauzi',
        action: 'ORDER_COMPLETED',
        details: 'Store store_pilot_bintang_01: Order ORD-PILOT-8921 (Rp19.000) paid via QRIS',
      },
      {
        id: 'log-02',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
        actor: 'Customer: Rina Kusuma',
        action: 'ORDER_COMPLETED',
        details: 'Store store_pilot_bintang_01: Order ORD-PILOT-8922 (Rp25.000) paid via VA',
      },
    ];
  }

  public getCategories(): readonly DemoCategory[] {
    return this.categories;
  }

  public getProducts(categorySlug?: string): readonly DemoProduct[] {
    const list = Array.from(this.products.values());
    if (!categorySlug || categorySlug === 'all') {
      return list;
    }
    return list.filter((p) => p.categorySlug === categorySlug);
  }

  public getProductById(id: string): DemoProduct | undefined {
    return this.products.get(id);
  }

  public getOrders(): readonly DemoOrder[] {
    return this.orders;
  }

  public getOrderById(orderId: string): DemoOrder | undefined {
    return this.orders.find((o) => o.orderId === orderId);
  }

  public getTelegramMessages(): readonly DemoBotMessage[] {
    return this.telegramMessages;
  }

  public getWhatsAppMessages(): readonly DemoBotMessage[] {
    return this.whatsAppMessages;
  }

  public getActivityLogs(): readonly DemoActivityLog[] {
    return this.activityLogs;
  }

  public createOrder(input: {
    readonly customerName: string;
    readonly customerContact: string;
    readonly channel?: 'telegram_mini_app' | 'whatsapp_bot' | 'web_store';
    readonly paymentMethod?: string;
    readonly items: readonly { readonly productId: string; readonly quantity: number }[];
  }): DemoOrder {
    const sanitizedName = escapeHtml((input.customerName || 'Pelanggan Demo').trim());
    const sanitizedContact = escapeHtml(
      (input.customerContact || 'contact_demo@bintang.tech').trim(),
    );
    const channel = input.channel ?? 'telegram_mini_app';
    const paymentMethod = escapeHtml(input.paymentMethod ?? 'QRIS Instan (Simulasi)');

    if (!input.items || input.items.length === 0) {
      throw new Error('Pesanan harus memiliki minimal 1 item produk.');
    }

    const orderItems: DemoOrderItem[] = [];
    let totalAmount = 0;
    const fulfilledItems: { readonly name: string; readonly serialOrAccount: string }[] = [];

    for (const item of input.items) {
      const prod = this.products.get(item.productId);
      if (!prod) {
        throw new Error(`Produk dengan ID "${item.productId}" tidak ditemukan.`);
      }
      if (item.quantity <= 0) {
        throw new Error('Jumlah pesanan produk harus lebih dari 0.');
      }
      if (prod.stock < item.quantity) {
        throw new Error(`Stok produk "${prod.name}" tidak mencukupi (Tersisa: ${prod.stock}).`);
      }

      // Decrement stock in demo state
      prod.stock -= item.quantity;

      const subtotal = prod.price * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        productId: prod.id,
        productName: prod.name,
        unitPrice: prod.price,
        quantity: item.quantity,
        subtotal,
        duration: prod.duration,
      });

      for (let q = 0; q < item.quantity; q++) {
        fulfilledItems.push({
          name: prod.name,
          serialOrAccount: prod.credentialSecret || `LICENSE-${prod.monogram}-2026-OK-${q + 1}`,
        });
      }
    }

    const counter = 8923 + this.orders.length;
    const orderId = `ORD-PILOT-${counter}`;
    const timestamp = new Date().toISOString();

    const order: DemoOrder = {
      orderId,
      storeId: 'store_pilot_bintang_01',
      customerName: sanitizedName,
      customerContact: sanitizedContact,
      channel,
      items: orderItems,
      totalAmount,
      paymentStatus: 'PAID',
      paymentMethod,
      fulfillmentStatus: 'FULFILLED',
      createdAt: timestamp,
      fulfilledItems,
    };

    // Prepend new order so it appears at top of lists
    this.orders.unshift(order);

    // Add alert to Telegram Seller Bot Simulator
    const timeFormatted = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    this.telegramMessages.unshift({
      id: `msg-tg-${counter}`,
      sender: 'bot',
      message: `🔔 <b>PESANAN BARU MASUK!</b>\nOrder ID: <code>${orderId}</code>\nPelanggan: ${sanitizedName}\nItem: ${orderItems
        .map((i) => `${i.quantity}x ${i.productName}`)
        .join(
          ', ',
        )}\nTotal: Rp${totalAmount.toLocaleString('id-ID')}\nPembayaran: ${paymentMethod} (PAID)\nStatus: Terkirim Otomatis ✅`,
      timestamp: timeFormatted,
      orderId,
      buttons: [
        { label: '🔍 Detail Pesanan', action: `order_detail_${counter}` },
        { label: '📊 Buka Seller Dashboard', action: 'open_dashboard' },
      ],
    });

    // Add activity log for Owner Console
    this.activityLogs.unshift({
      id: `log-${counter}`,
      timestamp,
      actor: `Customer: ${sanitizedName}`,
      action: 'ORDER_COMPLETED',
      details: `Store store_pilot_bintang_01: Order ${orderId} (Rp${totalAmount.toLocaleString('id-ID')}) paid via ${paymentMethod}`,
    });

    return order;
  }

  public fulfillOrder(orderId: string): boolean {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) {
      return false;
    }
    order.fulfillmentStatus = 'FULFILLED';
    const timestamp = new Date().toISOString();
    this.activityLogs.unshift({
      id: `log-fulfill-${Date.now()}`,
      timestamp,
      actor: 'Seller: Toko Bintang Tech',
      action: 'ORDER_FULFILLED',
      details: `Order ${orderId} ditandai FULFILLED oleh seller melalui dashboard.`,
    });
    return true;
  }

  public restockProduct(productId: string, amount: number): number {
    const prod = this.products.get(productId);
    if (!prod) {
      throw new Error(`Produk dengan ID "${productId}" tidak ditemukan.`);
    }
    prod.stock += Math.max(1, amount);
    const timestamp = new Date().toISOString();
    this.activityLogs.unshift({
      id: `log-restock-${Date.now()}`,
      timestamp,
      actor: 'Seller: Toko Bintang Tech',
      action: 'STOCK_RESTOCKED',
      details: `Produk ${prod.name} ditambah stok +${amount}. Stok baru: ${prod.stock}.`,
    });
    return prod.stock;
  }

  public addTelegramMessage(msg: {
    readonly sender: 'bot' | 'seller';
    readonly message: string;
    readonly buttons?: readonly { readonly label: string; readonly action: string }[];
  }): DemoBotMessage {
    const timeFormatted = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const newMsg: DemoBotMessage = {
      id: `msg-tg-${Date.now()}`,
      sender: msg.sender,
      message: msg.message,
      timestamp: timeFormatted,
      ...(msg.buttons ? { buttons: msg.buttons } : {}),
    };
    this.telegramMessages.unshift(newMsg);
    return newMsg;
  }

  public addWhatsAppMessage(msg: {
    readonly sender: 'bot' | 'customer';
    readonly message: string;
    readonly buttons?: readonly { readonly label: string; readonly action: string }[];
  }): DemoBotMessage {
    const timeFormatted = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const newMsg: DemoBotMessage = {
      id: `msg-wa-${Date.now()}`,
      sender: msg.sender,
      message: msg.message,
      timestamp: timeFormatted,
      ...(msg.buttons ? { buttons: msg.buttons } : {}),
    };
    this.whatsAppMessages.push(newMsg);
    return newMsg;
  }
}

export const demoState = new DemoStateManager();
