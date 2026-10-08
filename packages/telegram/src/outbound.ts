/**
 * Bintang Tech Studio — Telegram Outbound Presentation Service.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Handles formatting of customer-facing Telegram text, inline keyboards,
 * and error messages.
 *
 * Rules:
 * 1. Business services determine WHAT happened.
 * 2. Telegram presentation determines HOW to format.
 * 3. Never leak credentials, internal database IDs, or stack traces.
 */

import { Product } from '@bintang/commerce';
import { Order } from '@bintang/orders';
import { PublicFulfillment } from '@bintang/fulfillment';
import { TelegramMessagePayload, TelegramInlineButton } from './types.js';
import { TelegramMiniAppHelper } from './mini-app.js';

export class TelegramOutboundService {
  constructor(private readonly miniAppHelper: TelegramMiniAppHelper) {}

  /**
   * Formats /start welcome message.
   */
  public formatWelcomeMessage(
    chatId: string,
    storeName: string,
    miniAppUrl?: string,
  ): TelegramMessagePayload {
    const text =
      `*Selamat datang di ${this.escapeMarkdown(storeName)}!* 🌟\n\n` +
      `Kami menyediakan produk digital premium, lisensi resmi, dan voucher instan dengan garansi penuh 24 jam.\n\n` +
      `Gunakan menu di bawah untuk menjelajah katalog atau membuka toko langsung di Telegram:`;

    const keyboard: TelegramInlineButton[][] = [];

    const openStoreBtn = this.miniAppHelper.createOpenStoreButton(
      miniAppUrl,
      '🛍️ Buka Toko (Mini App)',
    );
    if (openStoreBtn) {
      keyboard.push([openStoreBtn]);
    }

    keyboard.push([
      { text: '📦 Lihat Produk', callbackData: 'action:list_products' },
      { text: '📋 Pesanan Saya', callbackData: 'action:list_orders' },
    ]);
    keyboard.push([{ text: 'ℹ️ Bantuan & Garansi', callbackData: 'action:help' }]);

    return {
      chatId,
      text,
      parseMode: 'Markdown',
      replyMarkup: { inlineKeyboard: keyboard },
    };
  }

  /**
   * Formats /products catalog list.
   */
  public formatProductList(
    chatId: string,
    storeName: string,
    products: readonly Product[],
    miniAppUrl?: string,
  ): TelegramMessagePayload {
    if (products.length === 0) {
      return {
        chatId,
        text: `*Katalog Produk ${this.escapeMarkdown(storeName)}*\n\nSaat ini belum ada produk yang tersedia.`,
        parseMode: 'Markdown',
      };
    }

    let text = `*Katalog Produk ${this.escapeMarkdown(storeName)}* 📦\n\nPilih produk untuk melihat rincian dan harga:\n\n`;

    const keyboard: TelegramInlineButton[][] = [];

    // Show up to 8 representative products as buttons
    for (const p of products.slice(0, 8)) {
      const formattedPrice = this.formatCurrency(p.price);
      text += `• *${this.escapeMarkdown(p.name)}* — ${formattedPrice}\n`;
      keyboard.push([
        {
          text: `🔍 ${p.name.slice(0, 24)} (${formattedPrice})`,
          callbackData: `product:view:${p.id}`,
        },
      ]);
    }

    if (products.length > 8) {
      text += `\n_...dan ${products.length - 8} produk lainnya di Mini App._`;
    }

    const openStoreBtn = this.miniAppHelper.createOpenStoreButton(
      miniAppUrl,
      '✨ Buka Katalog Lengkap',
    );
    if (openStoreBtn) {
      keyboard.push([openStoreBtn]);
    }

    return {
      chatId,
      text,
      parseMode: 'Markdown',
      replyMarkup: { inlineKeyboard: keyboard },
    };
  }

  /**
   * Formats single product detail card.
   */
  public formatProductDetail(
    chatId: string,
    product: Product,
    miniAppUrl?: string,
  ): TelegramMessagePayload {
    const formattedPrice = this.formatCurrency(product.price);
    const duration = (product.metadata as Record<string, unknown>)?.duration;
    const durationText = duration ? ` ⏳ _${duration}_` : '';

    const text =
      `*${this.escapeMarkdown(product.name)}*${durationText}\n` +
      `Harga: *${formattedPrice}*\n\n` +
      `${this.escapeMarkdown(product.description || 'Produk digital instan dan bergaransi.')}\n`;

    const keyboard: TelegramInlineButton[][] = [];

    const openStoreBtn = this.miniAppHelper.createOpenStoreButton(
      miniAppUrl,
      '🛒 Beli di Mini App',
      `p_${product.id}`,
    );
    if (openStoreBtn) {
      keyboard.push([openStoreBtn]);
    }

    keyboard.push([{ text: '◀️ Kembali ke Produk', callbackData: 'action:list_products' }]);

    return {
      chatId,
      text,
      parseMode: 'Markdown',
      replyMarkup: { inlineKeyboard: keyboard },
    };
  }

  /**
   * Formats customer order history (/orders).
   */
  public formatOrderList(
    chatId: string,
    orders: readonly Order[],
    miniAppUrl?: string,
  ): TelegramMessagePayload {
    if (orders.length === 0) {
      const keyboard: TelegramInlineButton[][] = [];
      const openStoreBtn = this.miniAppHelper.createOpenStoreButton(miniAppUrl, '🛍️ Mulai Belanja');
      if (openStoreBtn) keyboard.push([openStoreBtn]);

      return {
        chatId,
        text: `*Pesanan Saya* 📋\n\nAnda belum memiliki riwayat pesanan di toko ini.`,
        parseMode: 'Markdown',
        replyMarkup: { inlineKeyboard: keyboard },
      };
    }

    let text = `*Riwayat Pesanan Anda* 📋\n\n`;
    const keyboard: TelegramInlineButton[][] = [];

    for (const ord of orders.slice(0, 5)) {
      const statusIcon = this.getOrderStatusIcon(ord.status);
      text += `• *#${ord.orderNumber}* (${statusIcon} ${ord.status})\n  Total: ${this.formatCurrency(ord.grandTotal)}\n`;
      keyboard.push([
        {
          text: `📄 Rincian #${ord.orderNumber}`,
          callbackData: `order:view:${ord.id}`,
        },
      ]);
    }

    const openStoreBtn = this.miniAppHelper.createOpenStoreButton(
      miniAppUrl,
      '📱 Buka Daftar Pesanan',
    );
    if (openStoreBtn) keyboard.push([openStoreBtn]);

    return {
      chatId,
      text,
      parseMode: 'Markdown',
      replyMarkup: { inlineKeyboard: keyboard },
    };
  }

  /**
   * Formats single order detail (/order <id>) with sanitized fulfillment projection.
   * Strips internal inventory credentials and provider secret references.
   */
  public formatOrderDetail(
    chatId: string,
    order: Order,
    fulfillment?: PublicFulfillment | null,
    miniAppUrl?: string,
  ): TelegramMessagePayload {
    const statusIcon = this.getOrderStatusIcon(order.status);
    let text =
      `*Rincian Pesanan #${order.orderNumber}* 🧾\n\n` +
      `Status Pembayaran: *${statusIcon} ${order.status}*\n` +
      `Total Pembayaran: *${this.formatCurrency(order.grandTotal)}*\n` +
      `Tanggal: ${new Date(order.createdAt).toLocaleDateString('id-ID')}\n\n`;

    if (fulfillment) {
      text += `*Status Pengiriman:* ${fulfillment.status}\n`;
      if (fulfillment.trackingInfo) {
        const infoStr =
          typeof (fulfillment.trackingInfo as unknown) === 'string'
            ? (fulfillment.trackingInfo as unknown as string)
            : typeof fulfillment.trackingInfo['message'] === 'string'
              ? String(fulfillment.trackingInfo['message'])
              : typeof fulfillment.trackingInfo['trackingNumber'] === 'string'
                ? String(fulfillment.trackingInfo['trackingNumber'])
                : Object.keys(fulfillment.trackingInfo).length > 0
                  ? JSON.stringify(fulfillment.trackingInfo)
                  : '';
        if (infoStr) {
          text += `Info: ${this.escapeMarkdown(infoStr)}\n`;
        }
      }
      if (fulfillment.items && fulfillment.items.length > 0) {
        text += `\n*Item Terkirim:*\n`;
        for (const it of fulfillment.items) {
          // Strictly show only public payloadReference (e.g. token or reference id), never internal credentials
          text += `• ${it.status}: \`${it.payloadReference || 'Terkirim'}\`\n`;
        }
      }
    }

    const keyboard: TelegramInlineButton[][] = [];
    const openStoreBtn = this.miniAppHelper.createOpenStoreButton(
      miniAppUrl,
      '📱 Buka Pesanan di Toko',
    );
    if (openStoreBtn) keyboard.push([openStoreBtn]);
    keyboard.push([{ text: '◀️ Kembali ke Daftar', callbackData: 'action:list_orders' }]);

    return {
      chatId,
      text,
      parseMode: 'Markdown',
      replyMarkup: { inlineKeyboard: keyboard },
    };
  }

  /**
   * Formats /help message.
   */
  public formatHelpMessage(chatId: string, storeName: string): TelegramMessagePayload {
    const text =
      `*Pusat Bantuan — ${this.escapeMarkdown(storeName)}* ℹ️\n\n` +
      `Perintah yang tersedia:\n` +
      `• /start — Menampilkan menu utama dan tombol toko\n` +
      `• /products — Menjelajahi katalog produk digital\n` +
      `• /orders — Melihat riwayat pesanan Anda\n` +
      `• /help — Menampilkan panduan ini\n\n` +
      `*Jaminan & Garansi:*\n` +
      `Semua produk bergaransi ganti baru selama masa aktif. Pembayaran QRIS terverifikasi instan 24 jam.`;

    return {
      chatId,
      text,
      parseMode: 'Markdown',
    };
  }

  /**
   * Formats safe customer-facing error messages.
   */
  public formatErrorMessage(
    chatId: string,
    message: string = 'Layanan sedang mengalami kendala. Silakan coba sesaat lagi.',
  ): TelegramMessagePayload {
    return {
      chatId,
      text: `⚠️ *Pemberitahuan*\n\n${this.escapeMarkdown(message)}`,
      parseMode: 'Markdown',
    };
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  private formatCurrency(amount: string): string {
    const num = Math.round(parseFloat(amount) || 0);
    return `Rp ${num.toLocaleString('id-ID')}`;
  }

  private getOrderStatusIcon(status: string): string {
    switch (status) {
      case 'PAID':
      case 'FULFILLED':
        return '✅';
      case 'PROCESSING':
        return '⏳';
      case 'PENDING_PAYMENT':
        return '💳';
      case 'CANCELLED':
      case 'EXPIRED':
        return '❌';
      default:
        return '📦';
    }
  }
}
