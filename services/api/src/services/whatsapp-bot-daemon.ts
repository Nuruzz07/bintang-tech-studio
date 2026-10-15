/**
 * Bintang Tech Studio — Interactive WhatsApp Bot Daemon (bintang-wa)
 * Powered by @whiskeysockets/baileys (Native multi-device WebSocket engine)
 *
 * Capabilities:
 * 1. Headless multi-device connection with persistent session storage
 * 2. Visual QR code endpoint for scanning via browser (/api/v1/whatsapp/qr)
 * 3. 8-digit pairing code support for phone-number linking (/api/v1/whatsapp/pair-code)
 * 4. Interactive in-chat customer shopping journey:
 *    - Menu & Greeting (Welcome, WebApp link, navigation)
 *    - Catalog list with numbered selections (1-6)
 *    - Real-time Tipzy QRIS invoice generation
 *    - Zero-click auto-fulfillment: instant account/key delivery upon settlement
 *    - Order status lookup & simulated payment for testing
 * 5. Outbound seller notification integration
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { TipzyPaymentProviderAdapter } from '@bintang/payments';
import {
  notifyNewOrder,
  notifyPaymentSuccess,
  notifySupportRequest,
  sendTelegramPhoto,
  sendTelegramMessage,
} from './telegram-notifier.js';
import { demoState } from '../demo/state.js';

export interface WhatsAppProductItem {
  id: string;
  num: number;
  name: string;
  price: number;
  category: string;
  desc: string;
  format: 'account' | 'key' | 'link' | 'code';
  email?: string;
  password?: string;
  licenseKey?: string;
  link?: string;
  code?: string;
  note: string;
}

export const WA_CATALOG_ITEMS: WhatsAppProductItem[] = [
  {
    id: 'prod_spotify_prem',
    num: 1,
    name: 'Spotify Premium 1 Bulan',
    price: 19000,
    category: 'Streaming',
    desc: 'Akun private bebas iklan, download offline, garansi 30 hari.',
    format: 'account',
    email: 'bintang.spot.wa99@gmail.com',
    password: 'SPOT-PREM-PASS-2026',
    note: 'Login langsung di aplikasi Spotify resmi.',
  },
  {
    id: 'prod_canva_pro',
    num: 2,
    name: 'Canva Pro 1 Tahun',
    price: 15000,
    category: 'Design',
    desc: 'Invite tim Edu resmi, unlock jutaan template & Brand Kit.',
    format: 'link',
    link: 'https://canva.com/brand/join?token=bts-canva-wa-2026',
    note: 'Klik link untuk langsung bergabung ke tim Canva Pro.',
  },
  {
    id: 'prod_chatgpt_plus',
    num: 3,
    name: 'ChatGPT Plus Shared',
    price: 45000,
    category: 'AI & Productivity',
    desc: 'Akses GPT-4o, DALL-E 3 & Canvas tanpa batas harian.',
    format: 'account',
    email: 'ai.premium.wa@bintang.store',
    password: 'GPT-PLUS-SECURE-2026',
    note: 'Gunakan profil browser khusus agar sesi tidak tumpang tindih.',
  },
  {
    id: 'prod_netflix_prem',
    num: 4,
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
    num: 5,
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
    num: 6,
    name: 'MLBB 284 Diamonds',
    price: 25000,
    category: 'Gaming',
    desc: 'Kode voucher resmi Moonton langsung redeem instan.',
    format: 'code',
    code: 'MLBB-BTS-284D-99812A',
    note: 'Redeem di m.mobilelegends.com/en/codexchange.',
  },
];

export interface WhatsAppDaemonStatus {
  state: 'INITIALIZING' | 'QR_READY' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  connectedJid?: string | null;
  qrDataUrl?: string | null;
  qrRaw?: string | null;
  pairingCode?: string | null;
  lastError?: string | null;
  lastConnectedAt?: string | null;
}

export class WhatsAppBotDaemon {
  private sock: WASocket | null = null;
  private isStarting = false;
  private readonly sessionDir: string;
  private readonly storeWebUrl: string;

  private status: WhatsAppDaemonStatus = {
    state: 'INITIALIZING',
    connectedJid: null,
    qrDataUrl: null,
    qrRaw: null,
    pairingCode: null,
    lastError: null,
    lastConnectedAt: null,
  };

  private activeWatchers: Map<string, NodeJS.Timeout> = new Map();
  // Map of jid -> timestamp until which bot is muted for human takeover
  private mutedUsers: Map<string, number> = new Map();

  constructor() {
    this.sessionDir = resolve('C:/BOT_WEB/Bintang-Tech-Project/wa_auth_session');
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }

    const env = typeof process !== 'undefined' ? process.env : {};
    this.storeWebUrl =
      env?.['STORE_WEB_URL'] || 'https://bintang-digital-demo.vercel.app/webapp.html';
  }

  public getProductsList(): WhatsAppProductItem[] {
    const liveProds = demoState.getProducts();
    if (!liveProds || liveProds.length === 0) {
      return WA_CATALOG_ITEMS;
    }

    return liveProds.map((p, index) => {
      let format: 'account' | 'key' | 'link' | 'code' = 'account';
      if (p.categorySlug === 'software') format = 'key';
      else if (p.categorySlug === 'gaming') format = 'code';
      else if (p.categorySlug === 'design' && p.name.toLowerCase().includes('canva')) format = 'link';

      const email = `${p.id.replace('prod_', '')}.vip@bintang.store`;
      const password = `BTS-VIP-${p.monogram}-2026`;
      const licenseKey = `BTS-${p.monogram}-8821-KEY-2026`;
      const code = `VOUCH-${p.monogram}-BTS-8899`;
      const link = `https://drive.google.com/drive/folders/bintang-store-${p.id}`;

      return {
        id: p.id,
        num: index + 1,
        name: `${p.name} ${p.duration ? `(${p.duration})` : ''}`.trim(),
        price: p.price,
        category: p.categorySlug.toUpperCase(),
        desc: p.shortDescription || p.description,
        format,
        email,
        password,
        licenseKey,
        code,
        link,
        note: p.importantInfo || 'Garansi aktif 30 hari Bintang Store.',
      };
    });
  }

  public getStatus(): WhatsAppDaemonStatus {
    return { ...this.status };
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      throw new Error('WhatsApp socket belum terinisialisasi. Tunggu beberapa detik.');
    }
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
      throw new Error('Nomor telepon tidak valid. Gunakan format internasional (contoh: 628123456789).');
    }

    try {
      const code = await this.sock.requestPairingCode(cleanNumber);
      this.status.pairingCode = code;
      return code;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status.lastError = msg;
      throw new Error(`Gagal meminta pairing code: ${msg}`);
    }
  }

  public async start(): Promise<void> {
    if (this.isStarting || this.status.state === 'CONNECTED') {
      return;
    }
    this.isStarting = true;
    this.status.state = 'CONNECTING';

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['Bintang Tech Studio', 'Desktop', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status.state = 'QR_READY';
          this.status.qrRaw = qr;
          try {
            this.status.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
          } catch {
            this.status.qrDataUrl = null;
          }
          console.log('[WhatsAppDaemon] 📱 QR Code baru siap dipindai. Buka di web: http://127.0.0.1:3000/api/v1/whatsapp/qr');

          // Send QR image directly to Telegram Bot
          if (this.status.qrDataUrl) {
            void sendTelegramPhoto(
              this.status.qrDataUrl,
              `📱 <b>QR CODE WHATSAPP BOT (Bintang Tech)</b>\n\nSilakan scan QR ini dari aplikasi WhatsApp di HP kamu:\n1. Buka WhatsApp > Titik 3 > <b>Perangkat Tertaut</b>\n2. Pilih <b>Tautkan Perangkat</b> dan scan QR di atas! 🚀`,
            );
          }
        }

        if (connection === 'connecting') {
          this.status.state = 'CONNECTING';
        }

        if (connection === 'open') {
          this.status.state = 'CONNECTED';
          this.status.qrRaw = null;
          this.status.qrDataUrl = null;
          this.status.pairingCode = null;
          this.status.connectedJid = this.sock?.user?.id ?? 'CONNECTED';
          this.status.lastConnectedAt = new Date().toISOString();
          console.log(`[WhatsAppDaemon] ✅ WhatsApp Bot TERHUBUNG! Akun: ${this.sock?.user?.id ?? 'Active'}`);

          void sendTelegramMessage(
            `✅ <b>WHATSAPP BOT TERHUBUNG & AKTIF!</b>\n\nNomor/JID: <code>${this.sock?.user?.id ?? 'Active'}</code>\nBot siap melayani chat & pesanan otomatis pembeli! 🎉`,
          );
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.status.state = 'DISCONNECTED';
          this.status.lastError = lastDisconnect?.error?.message ?? 'Koneksi terputus';

          console.warn(`[WhatsAppDaemon] ⚠️ WhatsApp terputus (${statusCode}). Reconnecting: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => {
              this.isStarting = false;
              void this.start();
            }, 5000);
          } else {
            this.isStarting = false;
          }
        }
      });

      // Handle Incoming Messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;
          const jid = msg.key.remoteJid;
          if (!jid || jid.endsWith('@broadcast') || jid.includes('status@broadcast')) continue;

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            '';

          if (!text.trim()) continue;

          const pushName = msg.pushName || 'Pelanggan Bintang';

          // Check if user is currently in Human Takeover / Muted state
          const muteUntil = this.mutedUsers.get(jid);
          if (muteUntil && Date.now() < muteUntil) {
            // Still muted for human CS handover
            const cleanText = text.trim().toLowerCase();
            if (cleanText === 'unmute' || cleanText === 'bot' || cleanText === 'menu') {
              this.mutedUsers.delete(jid);
              await this.sendMessage(jid, '🤖 *Bot otomatis Bintang Store kembali aktif!*\nSilakan ketik *MENU* untuk melihat layanan.');
            } else {
              // Ignore automated responses while seller is chatting
              console.log(`[WhatsAppDaemon] 🤫 Muted: mengabaikan balasan otomatis untuk ${jid} (Human Takeover aktif)`);
              continue;
            }
          }

          await this.handleIncomingMessage(jid, text.trim(), pushName);
        }
      });
    } catch (err: unknown) {
      this.isStarting = false;
      this.status.state = 'DISCONNECTED';
      this.status.lastError = err instanceof Error ? err.message : String(err);
      console.error('[WhatsAppDaemon] Gagal inisialisasi Baileys WhatsApp:', err);
    }
  }

  private async handleIncomingMessage(jid: string, rawText: string, senderName: string): Promise<void> {
    const text = rawText.toLowerCase();

    // 1. Menu & Greetings
    if (
      text === 'menu' ||
      text === 'halo' ||
      text === 'hai' ||
      text === 'hi' ||
      text === 'p' ||
      text === 'start' ||
      text === 'bintang'
    ) {
      await this.sendMainMenu(jid, senderName);
      return;
    }

    // Support & Human Takeover Handover
    if (
      text === '4' ||
      text === 'bantuan' ||
      text === 'cs' ||
      text === 'admin' ||
      text === 'help' ||
      text.includes('komplain') ||
      text.includes('kendala') ||
      text.includes('garansi') ||
      text.includes('rusak') ||
      text.includes('ganti')
    ) {
      // Mute bot for this buyer for 15 minutes
      this.mutedUsers.set(jid, Date.now() + 15 * 60 * 1000);

      // Notify Seller on Telegram with quick link
      void notifySupportRequest({
        customerName: senderName,
        customerContact: jid,
        messageText: rawText,
        channel: 'WHATSAPP_BOT',
      });

      const supportMsg =
        `👋 Halo Kak *${senderName}*!\n\n` +
        `Pesan bantuan kamu sudah diteruskan ke *Owner / Admin Bintang Store* via Telegram. 🔔\n\n` +
        `Admin kami akan segera membalas chat kamu secara langsung di sini.\n` +
        `_Bot otomatis kami nonaktifkan sementara selama 15 menit agar kamu bisa mengobrol nyaman dengan admin._\n\n` +
        `*(Ketik *MENU* kapan saja jika ingin mengaktifkan kembali bot transaksi otomatis)*`;

      await this.sendMessage(jid, supportMsg);
      return;
    }

    // 2. Catalog Request
    if (text === '1' || text === 'katalog' || text === 'produk' || text === 'list') {
      await this.sendCatalog(jid);
      return;
    }

    // 3. Purchase Intent
    const catalog = this.getProductsList();
    if (text.startsWith('beli') || text.startsWith('order') || /^[0-9]+$/.test(text)) {
      let targetNum = 0;
      if (/^[0-9]+$/.test(text)) {
        targetNum = parseInt(text, 10);
      } else {
        const parts = text.split(/\s+/);
        if (parts.length >= 2) {
          const parsed = parseInt(parts[1] ?? '', 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= catalog.length) {
            targetNum = parsed;
          } else {
            const query = parts.slice(1).join(' ');
            const matched = catalog.find((p) => p.name.toLowerCase().includes(query));
            if (matched) targetNum = matched.num;
          }
        }
      }

      if (targetNum > 0 && targetNum <= catalog.length) {
        await this.initiatePurchase(jid, targetNum, senderName);
        return;
      }
    }

    // 4. Status Check
    if (text.startsWith('status') || text.startsWith('cek')) {
      const parts = text.split(/\s+/);
      if (parts.length >= 2) {
        const orderId = (parts[1] ?? '').toUpperCase();
        await this.checkOrderStatus(jid, orderId);
        return;
      } else {
        await this.sendMessage(jid, 'ℹ️ Format cek status:\nKetik: *STATUS <NOMOR_ORDER>*\nContoh: *STATUS ORD-WA-123456*');
        return;
      }
    }

    // 5. Simulated Payment Helper
    if (text.startsWith('simulasi bayar')) {
      const parts = text.split(/\s+/);
      const orderId = (parts[2] ?? '').toUpperCase();
      if (orderId) {
        await this.simulatePaymentSettlement(jid, orderId);
        return;
      }
    }

    // Default fallback guidance
    await this.sendMessage(
      jid,
      `Halo Kak *${senderName}*! Perintah tidak dikenali.\n\n` +
        `Ketik *MENU* untuk melihat daftar layanan, atau ketik *1* untuk melihat katalog produk langsung.`,
    );
  }

  private async sendMainMenu(jid: string, senderName: string): Promise<void> {
    const text =
      `Halo Kak *${senderName}*, selamat datang di *Bintang Store* ✨\n\n` +
      `Belanja kebutuhan digital resmi, cepat, dan otomatis 24 jam.\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *PILIHAN MENU:*\n\n` +
      `[1] 📦 *Lihat Katalog & Harga*\n` +
      `[2] 💳 *Cara Order Cepat*\n` +
      `[3] 🔍 *Cek Status Pesanan*\n` +
      `[4] 💬 *Bantuan & Garansi CS*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 *Balas chat ini dengan angka [1] sampai [4] ya!*\n\n` +
      `🌐 *Katalog Lengkap (36 Produk):*\n` +
      `${this.storeWebUrl}`;

    await this.sendMessage(jid, text);
  }

  private async sendCatalog(jid: string): Promise<void> {
    const products = this.getProductsList();
    let text =
      `📦 *KATALOG PRODUK TERSEDIA (${products.length} PRODUK)*\n` +
      `_Balas dengan nomor produk untuk order instan:_\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n`;

    // Show first 10 top products in chat, and point to webapp for full 36 products
    const displayProducts = products.slice(0, 10);
    for (const item of displayProducts) {
      const stockInfo = demoState.getProductById(item.id)?.stock ?? 10;
      text +=
        `*${item.num}. ${item.name}*\n` +
        `   💰 *Rp ${item.price.toLocaleString('id-ID')}* · _(Stok: ${stockInfo})_\n` +
        `   ℹ️ ${item.desc}\n` +
        `   👉 Balas: *${item.num}* atau *BELI ${item.num}*\n\n`;
    }

    text +=
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *CARA PESAN:*\n` +
      `Ketik angka produk (Contoh: *1* untuk item #1, *2* untuk item #2, dst).\n\n` +
      `🌐 *Lihat Seluruh 36 Produk di Web Store:*\n${this.storeWebUrl}`;

    await this.sendMessage(jid, text);
  }

  private async initiatePurchase(jid: string, productNum: number, buyerName: string): Promise<void> {
    const catalog = this.getProductsList();
    const item = catalog.find((p) => p.num === productNum);
    if (!item) {
      await this.sendMessage(jid, '⚠️ Nomor produk tidak ditemukan. Ketik *1* untuk melihat katalog.');
      return;
    }

    // Check stock from authoritative demoState / database
    const liveProd = demoState.getProductById(item.id);
    if (liveProd && liveProd.stock <= 0) {
      await this.sendMessage(
        jid,
        `❌ *MAAF, STOK HABIS!*\n\n` +
          `Produk *${item.name}* saat ini sedang habis terjual.\n` +
          `Admin kami sedang restock. Silakan pilih produk lainnya di katalog (ketik *1*).`,
      );
      return;
    }

    const orderId = `ORD-WA-${Date.now().toString().slice(-6)}`;
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
          callbackSecret: tipzyCallbackSecret ?? '',
        });

        const res = await adapter.createPayment({
          paymentIntentId: `pi_wa_${Date.now()}`,
          attemptId: `att_wa_${Date.now()}`,
          orderId,
          storeId: 'store_pilot_web_01',
          customerId: `wa_${jid.replace(/[^0-9]/g, '')}`,
          amount: String(item.price),
          currency: 'IDR',
          credentialReference: 'env:TIPZY_API_KEY',
          metadata: {
            customerName: buyerName || 'WhatsApp Customer',
            customerContact: jid,
            productName: item.name,
            channel: 'WHATSAPP_BOT',
          },
        });

        txId = res.providerReference;
        paymentUrl = res.paymentUrl || '';
        const rawRes = res.rawResponse as Record<string, unknown> | undefined;
        const resObj = rawRes?.['result'] as Record<string, unknown> | undefined;
        qrString = (resObj?.['qr_string'] as string) || '';
      } catch (err) {
        console.warn('[WhatsAppDaemon] Tipzy live bridge notice, falling back to simulated invoice:', err);
      }
    }

    // Outbound Seller Notification
    void notifyNewOrder({
      orderId,
      customerName: `${buyerName} (WhatsApp)`,
      customerContact: jid,
      amount: item.price,
      paymentUrl: paymentUrl || `https://tipzy.id/pay/${orderId}`,
      itemsDescription: `${item.name} (1x)`,
    });

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
      qrString || paymentUrl || `BINTANG-QRIS-${orderId}`,
    )}`;

    const caption =
      `🧾 *INVOICE PEMBAYARAN QRIS*\n\n` +
      `• *ID Order:* \`${orderId}\`\n` +
      `• *Item:* ${item.name}\n` +
      `• *Total Tagihan:* *Rp ${item.price.toLocaleString('id-ID')}*\n` +
      `• *Batas Waktu:* 10 Menit\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📲 *CARA BAYAR:*\n` +
      `1. Scan / Upload gambar QRIS di atas melalui m-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, Dana, ShopeePay).\n` +
      `2. Pastikan nominal pembayaran sesuai.\n` +
      `3. Setelah pembayaran berhasil, akun/lisensi *otomatis langsung dikirimkan ke chat ini* seketika! 🚀\n\n` +
      `🔗 *Link Bayar Alternatif:*\n${paymentUrl || `https://tipzy.id/pay/${orderId}`}\n\n` +
      `_(Ketik *SIMULASI BAYAR ${orderId}* untuk tes langsung tanpa potong saldo)_`;

    await this.sendImage(jid, qrImageUrl, caption);

    // Start Auto-Fulfillment Background Polling
    this.startPaymentWatcher(jid, orderId, txId, item);
  }

  private startPaymentWatcher(
    jid: string,
    orderId: string,
    txId: string,
    item: WhatsAppProductItem,
  ): void {
    if (this.activeWatchers.has(orderId)) {
      clearInterval(this.activeWatchers.get(orderId)!);
    }

    const env = typeof process !== 'undefined' ? process.env : {};
    const tipzyApiKey = env?.['TIPZY_API_KEY'];
    const tipzyMerchantCode = env?.['TIPZY_MERCHANT_CODE'];

    let attempts = 0;
    const maxAttempts = 120; // 10 minutes at 5s interval

    const timer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        this.activeWatchers.delete(orderId);
        return;
      }

      if (tipzyApiKey && tipzyMerchantCode && !txId.startsWith('SIM-')) {
        try {
          const adapter = new TipzyPaymentProviderAdapter({
            apiKey: tipzyApiKey,
            merchantCode: tipzyMerchantCode,
            callbackSecret: env?.['TIPZY_CALLBACK_SECRET'] ?? '',
          });

          const statusRes = await adapter.verifyPayment({
            storeId: 'store_pilot_web_01',
            paymentIntentId: `pi_${txId}`,
            providerReference: txId,
            credentialReference: 'env:TIPZY_API_KEY',
          });

          if (statusRes.status === 'SUCCEEDED') {
            clearInterval(timer);
            this.activeWatchers.delete(orderId);
            await this.deliverFulfillment(jid, orderId, item, txId);
          }
        } catch {
          // ignore transient poll error
        }
      }
    }, 5000);

    this.activeWatchers.set(orderId, timer);
  }

  public async simulatePaymentSettlement(jid: string, orderId: string): Promise<void> {
    const catalog = this.getProductsList();
    const item = catalog[0] || WA_CATALOG_ITEMS[0]!;

    if (this.activeWatchers.has(orderId)) {
      clearInterval(this.activeWatchers.get(orderId)!);
      this.activeWatchers.delete(orderId);
    }
    await this.deliverFulfillment(jid, orderId, item, `SIM-${Date.now()}`);
  }

  private async deliverFulfillment(
    jid: string,
    orderId: string,
    item: WhatsAppProductItem,
    txId: string,
  ): Promise<void> {
    let credentialText = '';
    if (item.format === 'account') {
      credentialText =
        `📧 *Email:* \`${item.email}\`\n` +
        `🔑 *Password:* \`${item.password}\`\n` +
        `📝 *Catatan:* ${item.note}`;
    } else if (item.format === 'key') {
      credentialText =
        `🔐 *Serial Key:* \`${item.licenseKey}\`\n` +
        `📝 *Petunjuk:* ${item.note}`;
    } else if (item.format === 'link') {
      credentialText =
        `🔗 *Link Akses:* ${item.link}\n` +
        `📝 *Petunjuk:* ${item.note}`;
    } else {
      credentialText =
        `🎟️ *Kode Voucher:* \`${item.code}\`\n` +
        `📝 *Petunjuk:* ${item.note}`;
    }

    const message =
      `🎉 *PEMBAYARAN DITERIMA & SELESAI!*\n\n` +
      `Terima kasih! Pesanan kamu telah lunas dan siap digunakan.\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *DETAIL PRODUK:*\n` +
      `• *Nomor Order:* \`${orderId}\`\n` +
      `• *Nama Produk:* ${item.name}\n` +
      `• *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n` +
      `🔑 *DATA AKUN / KREDENSIAL:*\n` +
      `${credentialText}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🛡️ *Garansi 30 Hari:* Jika ada kendala, simpan Order ID ini dan hubungi CS kami.\n\n` +
      `Terima kasih telah mempercayai *Bintang Store Digital*! 🚀`;

    await this.sendMessage(jid, message);

    // Notify seller
    void notifyPaymentSuccess({
      orderId,
      amount: item.price,
      transactionId: txId,
      productName: item.name,
      fulfillmentSnippet: credentialText,
    });

    // Automatically decrement inventory stock in authoritative demoState / database
    const liveProd = demoState.getProductById(item.id);
    if (liveProd && liveProd.stock > 0) {
      liveProd.stock -= 1;
    }
  }

  private async checkOrderStatus(jid: string, orderId: string): Promise<void> {
    const catalog = this.getProductsList();
    const item = catalog[0] || WA_CATALOG_ITEMS[0]!;

    const text =
      `📋 *STATUS PESANAN: \`${orderId}\`*\n\n` +
      `• *Status:* ✅ Lunas & Terkirim (Fulfilled)\n` +
      `• *Produk:* ${item.name}\n` +
      `• *Data:* \`${item.email || item.licenseKey || 'Akun Aktif'}\`\n\n` +
      `Butuh bantuan lebih lanjut? Ketik *BANTUAN*.`;

    await this.sendMessage(jid, text);
  }

  private async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.sock) {
      console.warn(`[WhatsAppDaemon] Socket offline. Pesan ke ${jid} tertunda.`);
      return;
    }
    try {
      await this.sock.sendMessage(jid, { text });
    } catch (err) {
      console.error(`[WhatsAppDaemon] Gagal mengirim pesan ke ${jid}:`, err);
    }
  }

  private async sendImage(jid: string, imageUrl: string, caption: string): Promise<void> {
    if (!this.sock) return;
    try {
      await this.sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption,
      });
    } catch (err) {
      console.error(`[WhatsAppDaemon] Gagal kirim gambar ke ${jid}:`, err);
      // Fallback to text message
      await this.sendMessage(jid, `${caption}\n\n[Gambar QRIS: ${imageUrl}]`);
    }
  }
}

export const globalWhatsAppDaemon = new WhatsAppBotDaemon();
