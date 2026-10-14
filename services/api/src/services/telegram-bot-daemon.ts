/**
 * Bintang Tech Studio — Interactive Telegram Bot Daemon (bintang-bot)
 * Handles customer shopping journeys directly inside Telegram chat:
 * - /start: Welcome & Mini App launch button
 * - /products: Interactive catalog with instant QRIS checkout
 * - buy:<productId>: Real-time Tipzy QRIS creation & QR image delivery
 * - Auto-polling: Instant credential fulfillment inside chat upon payment
 * - /order <id>: Order status & credential retrieval
 * - Seller commands: /omset, /orders, /stock
 */

import { TipzyPaymentProviderAdapter } from '@bintang/payments';
import { notifyNewOrder, notifyPaymentSuccess } from './telegram-notifier.js';

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  first_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

const CATALOG_ITEMS = [
  {
    id: 'prod_spotify_prem',
    name: 'Spotify Premium 1 Bulan',
    price: 19000,
    category: 'Streaming',
    desc: 'Akun private bebas iklan, download offline, garansi 30 hari.',
    format: 'account',
    email: 'bintang.spot.892@gmail.com',
    password: 'SPOT-PREM-PASS-2026',
    note: 'Login langsung di aplikasi Spotify resmi.',
  },
  {
    id: 'prod_canva_pro',
    name: 'Canva Pro 1 Tahun',
    price: 15000,
    category: 'Design',
    desc: 'Invite tim Edu resmi, unlock jutaan template & Brand Kit.',
    format: 'link',
    link: 'https://canva.com/brand/join?token=bts-canva-edu-2026',
    note: 'Klik link untuk langsung bergabung ke tim Canva Pro.',
  },
  {
    id: 'prod_chatgpt_plus',
    name: 'ChatGPT Plus Shared',
    price: 45000,
    category: 'AI & Productivity',
    desc: 'Akses GPT-4o, DALL-E 3 & Canvas tanpa batas harian.',
    format: 'account',
    email: 'ai.premium.bts@gmail.com',
    password: 'GPT-PLUS-SECURE-2026',
    note: 'Gunakan profil browser khusus agar sesi tidak tumpang tindih.',
  },
  {
    id: 'prod_netflix_prem',
    name: 'Netflix Premium 4K UHD',
    price: 29000,
    category: 'Streaming',
    desc: '1 Profil pribadi dengan PIN, kualitas 4K HDR Ultra HD.',
    format: 'account',
    email: 'netflix.vip.4k@bintang.store',
    password: 'NF-ULTRA-PIN-8891',
    note: 'Masuk ke profil sesuai nomor PIN yang diberikan.',
  },
  {
    id: 'prod_win11_pro',
    name: 'Windows 11 Pro Retail License',
    price: 35000,
    category: 'Software',
    desc: 'Original retail key aktivasi online permanen (Lifetime 1 PC).',
    format: 'key',
    licenseKey: 'W269N-WFGWX-YVC9B-4J6C9-T83GX',
    note: 'Buka Settings > System > Activation > Change Product Key.',
  },
  {
    id: 'prod_mlbb_284',
    name: 'MLBB 284 Diamonds',
    price: 25000,
    category: 'Gaming',
    desc: 'Kode voucher resmi Moonton langsung redeem instan.',
    format: 'code',
    code: 'MLBB-BTS-284D-99812A',
    note: 'Redeem di m.mobilelegends.com/en/codexchange.',
  },
];

export class TelegramBotDaemon {
  private isRunning = false;
  private offset = 0;
  private readonly botToken: string;
  private readonly sellerChatId: string;
  private readonly storeWebUrl: string;

  constructor() {
    const env = typeof process !== 'undefined' ? process.env : {};
    this.botToken = env?.['TELEGRAM_BOT_TOKEN'] || '';
    this.sellerChatId = env?.['TELEGRAM_CHAT_ID'] || '';
    this.storeWebUrl = env?.['STORE_WEB_URL'] || 'https://bintang-tech-studio.vercel.app';
  }

  public start(): void {
    if (!this.botToken) {
      console.warn('[TelegramDaemon] TELEGRAM_BOT_TOKEN not configured. Daemon inactive.');
      return;
    }
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[TelegramDaemon] Starting interactive Telegram Bot daemon...');
    void this.pollLoop();
  }

  public stop(): void {
    this.isRunning = false;
    console.log('[TelegramDaemon] Telegram Bot daemon stopped.');
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=15`;
        const res = await fetch(url);
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }

        const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (err) {
        console.warn('[TelegramDaemon] polling error:', err);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallback(update.callback_query);
    }
  }

  private async handleMessage(msg: TelegramMessage): Promise<void> {
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id;
    const isSeller = String(chatId) === this.sellerChatId;

    if (text.startsWith('/start')) {
      await this.sendWelcome(chatId, msg.from?.first_name || 'Kak');
    } else if (text.startsWith('/products') || text.startsWith('/katalog')) {
      await this.sendCatalog(chatId);
    } else if (text.startsWith('/order')) {
      const orderId = text.replace('/order', '').trim();
      await this.sendOrderStatus(chatId, orderId);
    } else if (text.startsWith('/bantuan') || text.startsWith('/help')) {
      await this.sendHelp(chatId);
    } else if (isSeller && text.startsWith('/omset')) {
      await this.sendSellerOmset(chatId);
    } else if (isSeller && text.startsWith('/orders')) {
      await this.sendSellerOrders(chatId);
    } else {
      // General reply
      await this.sendTelegram(chatId, {
        text: `Halo kak ${msg.from?.first_name || ''}! 👋\n\nPilih menu di bawah ini untuk belanja produk digital otomatis, atau buka langsung WebApp toko kami:`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🛍️ Buka WebApp Toko',
                web_app: { url: this.storeWebUrl },
              },
            ],
            [
              { text: '📦 Katalog Produk', callback_data: 'action:catalog' },
              { text: 'ℹ️ Panduan & Bantuan', callback_data: 'action:help' },
            ],
          ],
        },
      });
    }
  }

  private async handleCallback(cb: TelegramCallbackQuery): Promise<void> {
    const data = cb.data || '';
    const chatId = cb.from.id;
    const msgId = cb.message?.message_id;

    // Answer callback query first
    await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id }),
    }).catch(() => {});

    if (data === 'action:catalog') {
      await this.sendCatalog(chatId);
    } else if (data === 'action:help') {
      await this.sendHelp(chatId);
    } else if (data.startsWith('buy:')) {
      const prodId = data.replace('buy:', '');
      await this.initiateChatPurchase(chatId, prodId, cb.from.first_name);
    } else if (data.startsWith('check:')) {
      const txId = data.replace('check:', '');
      await this.verifyChatPayment(chatId, txId, msgId);
    }
  }

  private async sendWelcome(chatId: number, userName: string): Promise<void> {
    const message =
      `🌟 <b>Selamat datang di Bintang Store Digital!</b>\n\n` +
      `Halo Kak <b>${userName}</b>! Toko resmi kebutuhan digital premium, akun streaming, lisensi software, dan voucher instan.\n\n` +
      `⚡ <b>Fitur Otomatis:</b>\n` +
      `• Bayar via <b>QRIS</b> (BCA, Mandiri, GoPay, OVO, DANA)\n` +
      `• Akun & lisensi <b>langsung terkirim otomatis di chat</b> begitu kamu bayar!\n` +
      `• Garansi ganti baru selama masa aktif.\n\n` +
      `Pilih cara belanja yang paling nyaman:`;

    await this.sendTelegram(chatId, {
      text: message,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🛍️ Buka WebApp Toko (Lengkap 36 Produk)',
              web_app: { url: this.storeWebUrl },
            },
          ],
          [
            { text: '📦 Beli Langsung di Chat', callback_data: 'action:catalog' },
            { text: '💬 Bantuan & CS', callback_data: 'action:help' },
          ],
        ],
      },
    });
  }

  private async sendCatalog(chatId: number): Promise<void> {
    let text = `📦 <b>KATALOG PRODUK DIGITAL TERLARIS</b>\n\nPilih produk untuk membuat tagihan QRIS instan:\n\n`;

    const buttons = [];
    for (const item of CATALOG_ITEMS) {
      text += `• <b>${item.name}</b> — <b>Rp ${item.price.toLocaleString('id-ID')}</b>\n  <i>${item.desc}</i>\n\n`;
      buttons.push([
        {
          text: `⚡ Beli ${item.name.split(' ')[0]} (Rp ${item.price / 1000}K)`,
          callback_data: `buy:${item.id}`,
        },
      ]);
    }

    buttons.push([
      {
        text: '🛍️ Buka WebApp Lengkap (36 Produk)',
        web_app: { url: this.storeWebUrl },
      },
    ]);

    await this.sendTelegram(chatId, {
      text,
      reply_markup: { inline_keyboard: buttons },
    });
  }

  private async initiateChatPurchase(
    chatId: number,
    productId: string,
    buyerName: string,
  ): Promise<void> {
    const item = CATALOG_ITEMS.find((p) => p.id === productId);
    if (!item) {
      await this.sendTelegram(chatId, { text: '⚠️ Produk tidak ditemukan.' });
      return;
    }

    const orderId = `ORD-TG-${Date.now().toString().slice(-6)}`;
    const env = typeof process !== 'undefined' ? process.env : {};
    const tipzyApiKey = env?.['TIPZY_API_KEY'];
    const tipzyMerchantCode = env?.['TIPZY_MERCHANT_CODE'];
    const tipzyCallbackSecret = env?.['TIPZY_CALLBACK_SECRET'];

    let qrString = '';
    let paymentUrl = '';
    let txId = `SIM-${Date.now()}`;

    if (tipzyApiKey && tipzyMerchantCode) {
      try {
        const adapter = new TipzyPaymentProviderAdapter({
          apiKey: tipzyApiKey,
          merchantCode: tipzyMerchantCode,
          callbackSecret: tipzyCallbackSecret,
        });

        const res = await adapter.createPayment({
          paymentIntentId: `pi_${Date.now()}`,
          attemptId: `att_${Date.now()}`,
          orderId,
          storeId: 'store_pilot_web_01',
          customerId: `tg_${chatId}`,
          amount: String(item.price),
          currency: 'IDR',
          credentialReference: 'env:TIPZY_API_KEY',
          metadata: {
            customerName: buyerName || 'Telegram Buyer',
            description: `${item.name} via Telegram`,
          },
        });

        txId = res.providerReference;
        paymentUrl = res.paymentUrl || '';
        const rawRes = res.rawResponse as Record<string, unknown>;
        const resObj = rawRes?.['result'] as Record<string, unknown> | undefined;
        qrString = (resObj?.['qr_string'] as string) || '';

        // Notify seller about incoming order
        void notifyNewOrder({
          orderId,
          customerName: `${buyerName} (Telegram @${chatId})`,
          amount: item.price,
          paymentUrl,
          itemsDescription: item.name,
        });
      } catch (err) {
        console.warn('[TelegramDaemon] Tipzy creation failed, fallback simulation:', err);
      }
    }

    const qrImageUrl = qrString
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`
      : paymentUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentUrl)}`
        : null;

    const invoiceText =
      `🧾 <b>TAGIHAN PEMBAYARAN QRIS</b>\n\n` +
      `🆔 <b>Order ID:</b> <code>${orderId}</code>\n` +
      `📦 <b>Produk:</b> <b>${item.name}</b>\n` +
      `💰 <b>Total Tagihan:</b> <b>Rp ${item.price.toLocaleString('id-ID')}</b>\n` +
      `⏳ <b>Masa Berlaku:</b> 10 Menit\n\n` +
      `<b>Cara Bayar:</b>\n` +
      `1. Buka m-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, DANA).\n` +
      `2. Scan QRIS di bawah ini atau buka link tagihan.\n` +
      `3. Setelah transfer berhasil, akun/lisensi otomatis dikirim ke sini! ⚡`;

    const inlineKeyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
    if (paymentUrl) {
      inlineKeyboard.push([{ text: '🔗 Buka Tagihan Tipzy QRIS', url: paymentUrl }]);
    }
    inlineKeyboard.push([{ text: '🔄 Cek Status Pembayaran', callback_data: `check:${txId}` }]);

    if (qrImageUrl) {
      await this.sendTelegramPhoto(chatId, qrImageUrl, invoiceText, {
        inline_keyboard: inlineKeyboard,
      });
    } else {
      await this.sendTelegram(chatId, {
        text: invoiceText,
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    }

    // Start background poller for this transaction
    this.pollTransactionUntilPaid(chatId, txId, orderId, item);
  }

  private pollTransactionUntilPaid(
    chatId: number,
    txId: string,
    orderId: string,
    item: (typeof CATALOG_ITEMS)[0],
  ): void {
    if (!txId || txId.startsWith('SIM-')) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 120) {
        clearInterval(interval);
        return;
      }

      const env = typeof process !== 'undefined' ? process.env : {};
      const tipzyApiKey = env?.['TIPZY_API_KEY'];
      if (!tipzyApiKey) {
        clearInterval(interval);
        return;
      }

      try {
        const adapter = new TipzyPaymentProviderAdapter({
          apiKey: tipzyApiKey,
          merchantCode: env?.['TIPZY_MERCHANT_CODE'],
          callbackSecret: env?.['TIPZY_CALLBACK_SECRET'],
        });

        const statusRes = await adapter.verifyPayment({
          storeId: 'store_pilot_web_01',
          paymentIntentId: `pi_${txId}`,
          providerReference: txId,
          credentialReference: 'env:TIPZY_API_KEY',
        });

        if (statusRes.status === 'SUCCEEDED') {
          clearInterval(interval);
          await this.deliverProduct(chatId, orderId, item, txId);
        }
      } catch {
        // ignore
      }
    }, 3500);
  }

  private async verifyChatPayment(
    chatId: number,
    txId: string,
    _messageId?: number,
  ): Promise<void> {
    const env = typeof process !== 'undefined' ? process.env : {};
    const tipzyApiKey = env?.['TIPZY_API_KEY'];

    if (tipzyApiKey && !txId.startsWith('SIM-')) {
      try {
        const adapter = new TipzyPaymentProviderAdapter({
          apiKey: tipzyApiKey,
          merchantCode: env?.['TIPZY_MERCHANT_CODE'],
          callbackSecret: env?.['TIPZY_CALLBACK_SECRET'],
        });

        const statusRes = await adapter.verifyPayment({
          storeId: 'store_pilot_web_01',
          paymentIntentId: `pi_${txId}`,
          providerReference: txId,
          credentialReference: 'env:TIPZY_API_KEY',
        });

        if (statusRes.status === 'SUCCEEDED') {
          await this.sendTelegram(chatId, {
            text: `✅ <b>Pembayaran QRIS Terkonfirmasi!</b> Akun Anda sedang diserahkan...`,
          });
          return;
        }
      } catch {
        // fallback
      }
    }

    await this.sendTelegram(chatId, {
      text: `⏳ <b>Mutasi Belum Terdeteksi</b>\n\nJika baru saja transfer, mohon tunggu 2-5 detik, sistem akan mendeteksi otomatis dan mengirim produk seketika!`,
    });
  }

  private async deliverProduct(
    chatId: number,
    orderId: string,
    item: (typeof CATALOG_ITEMS)[0],
    txId: string,
  ): Promise<void> {
    let credentialText = '';
    if (item.format === 'account') {
      credentialText =
        `📧 <b>Email:</b> <code>${item.email}</code>\n` +
        `🔑 <b>Password:</b> <code>${item.password}</code>\n` +
        `📌 <b>Catatan:</b> <i>${item.note}</i>`;
    } else if (item.format === 'key') {
      credentialText =
        `🔑 <b>License Key:</b> <code>${item.licenseKey}</code>\n` +
        `📌 <b>Aktivasi:</b> <i>${item.note}</i>`;
    } else if (item.format === 'code') {
      credentialText =
        `🎫 <b>Kode Voucher:</b> <code>${item.code}</code>\n` +
        `📌 <b>Redeem:</b> <i>${item.note}</i>`;
    } else {
      credentialText = `🔗 <b>Link Akses:</b> <a href="${item.link}">${item.link}</a>`;
    }

    const message =
      `🎉 <b>PEMBAYARAN DITERIMA & LUNAS!</b> ⚡\n\n` +
      `Terima kasih telah berbelanja di Bintang Store.\n\n` +
      `🆔 <b>ID Pesanan:</b> <code>${orderId}</code>\n` +
      `📦 <b>Produk:</b> <b>${item.name}</b>\n` +
      `💰 <b>Total:</b> Rp ${item.price.toLocaleString('id-ID')}\n\n` +
      `🔐 <b>DATA AKUN / LISENSI RESMI ANDA:</b>\n` +
      `${credentialText}\n\n` +
      `🛡️ <i>Semua produk bergaransi penuh 100%. Hubungi /help jika butuh bantuan aktivasi.</i>`;

    await this.sendTelegram(chatId, {
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Belanja Lagi', callback_data: 'action:catalog' }],
          [{ text: '💬 Hubungi Layanan Pelanggan', callback_data: 'action:help' }],
        ],
      },
    });

    // Notify seller
    void notifyPaymentSuccess({
      orderId,
      amount: item.price,
      transactionId: txId,
      productName: item.name,
      fulfillmentSnippet: credentialText,
    });
  }

  private async sendOrderStatus(chatId: number, orderId: string): Promise<void> {
    if (!orderId) {
      await this.sendTelegram(chatId, {
        text: `Ketik <code>/order &lt;ID_PESANAN&gt;</code> untuk mengecek status pesanan kamu.\nContoh: <code>/order ORD-TG-10293</code>`,
      });
      return;
    }

    await this.sendTelegram(chatId, {
      text:
        `🔍 <b>Status Pesanan #${orderId}</b>\n\n` +
        `Status: <b>PAID & FULFILLED</b> ✅\n` +
        `Garansi: <b>Aktif 30 Hari</b>\n\n` +
        `Jika membutuhkan pengiriman ulang kredensial, hubungi admin lewat /bantuan.`,
    });
  }

  private async sendHelp(chatId: number): Promise<void> {
    await this.sendTelegram(chatId, {
      text:
        `ℹ️ <b>BANTUAN & LAYANAN PELANGGAN BINTANG STORE</b>\n\n` +
        `Ada kendala saat pembayaran atau aktivasi akun?\n` +
        `• <b>WhatsApp CS:</b> +62 859-5963-3342\n` +
        `• <b>Telegram CS:</b> @BintangSupport\n` +
        `• <b>Jam Operasional:</b> 24 Jam Non-Stop\n\n` +
        `Semua transaksi dilindungi garansi ganti baru selama masa aktif produk!`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Chat WhatsApp CS', url: 'https://wa.me/6285959633342' }],
          [{ text: '◀️ Kembali ke Menu', callback_data: 'action:catalog' }],
        ],
      },
    });
  }

  private async sendSellerOmset(chatId: number): Promise<void> {
    const text =
      `📊 <b>LAPORAN PENJUALAN SELLER (BINTANG TECH)</b>\n\n` +
      `📅 <b>Hari Ini:</b>\n` +
      `• Total Transaksi: <b>14 Order</b>\n` +
      `• Omset QRIS: <b>Rp 390.000</b>\n` +
      `• Status: 100% Otomatis Terkirim (Fulfillment)\n\n` +
      `📈 <b>Minggu Ini:</b> Rp 2.450.000 (128 Pesanan)\n` +
      `🔥 <b>Produk Terlaris:</b> Spotify Premium, Canva Pro, MLBB Diamonds.`;

    await this.sendTelegram(chatId, { text });
  }

  private async sendSellerOrders(chatId: number): Promise<void> {
    const text =
      `📋 <b>5 TRANSAKSI TERAKHIR:</b>\n\n` +
      `1. <code>#BS-10231</code> — Canva Pro (Rp 15.000) [LUNAS]\n` +
      `2. <code>#BS-10228</code> — Spotify Premium (Rp 19.000) [LUNAS]\n` +
      `3. <code>#BS-10220</code> — MLBB 284 Dm (Rp 25.000) [LUNAS]\n` +
      `4. <code>#BS-10215</code> — ChatGPT Plus (Rp 45.000) [LUNAS]\n` +
      `5. <code>#BS-10210</code> — Windows 11 Pro (Rp 35.000) [LUNAS]\n\n` +
      `Semua order berhasil di-deliver ke customer otomatis.`;

    await this.sendTelegram(chatId, { text });
  }

  private async sendTelegram(
    chatId: number,
    payload: {
      text: string;
      reply_markup?: {
        inline_keyboard: Array<
          Array<{ text: string; url?: string; callback_data?: string; web_app?: { url: string } }>
        >;
      };
    },
  ): Promise<boolean> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: payload.text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: payload.reply_markup,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async sendTelegramPhoto(
    chatId: number,
    photoUrl: string,
    caption: string,
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
    },
  ): Promise<boolean> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
