// Bintang Tech Studio — Template 01: DIGITAL MINIMAL
// Telegram Bot Simulation Page (Branded & Polished)

import { store } from '../state/store.js';
import { formatRupiah } from '../utils/currency.js';
import { escapeHtml, sleep, copyToClipboard, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';
import { openModal } from '../components/modal.js';
import { showPaymentSimulation } from '../components/qris-modal.js';

export function renderTelegramBotPage() {
  return `
    <div class="view-container bg-[#090B0E] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-900/60 via-[#0B0D11] to-[#07090C] min-h-[calc(100vh-40px)] flex flex-col items-center justify-center p-2 sm:p-6 select-none">
      
      <!-- Desktop Framing Header (Controlled Presentation) -->
      <div class="hidden sm:flex items-center justify-between max-w-md w-full mb-3 px-2 text-[11px] font-mono text-stone-400">
        <div class="flex items-center gap-2">
          <span class="w-4 h-4">${BRAND_LOGO_SVG}</span>
          <span class="tracking-wider uppercase font-semibold text-stone-300">Telegram Bot Experience</span>
        </div>
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-emerald-400">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Simulasi Siap
        </span>
      </div>

      <!-- Telegram Mobile Container -->
      <div class="telegram-frame flex flex-col w-full h-[750px] max-w-md bg-[#0E1621] rounded-3xl border border-stone-800/90 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        
        <!-- TELEGRAM STATUS / HEADER -->
        <header class="bg-[#17212B] px-4 py-3 border-b border-stone-800/80 flex items-center justify-between shrink-0 z-20">
          <div class="flex items-center gap-3">
            <a href="#landing" class="text-stone-400 hover:text-white p-1 -ml-1 transition-colors" title="Kembali ke Portfolio">
              ${ICONS.chevronLeft}
            </a>
            <!-- Bot Avatar with Official Logo -->
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-stone-900 border border-stone-700/80 p-1 flex items-center justify-center shadow-inner overflow-hidden">
                ${BRAND_LOGO_SVG}
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#17212B]"></span>
            </div>
            <!-- Bot Title & Status -->
            <div>
              <div class="flex items-center gap-1.5 leading-tight">
                <span class="font-bold text-white text-sm">Bintang Store</span>
                <span class="text-sky-400" title="Verified Official Bot">
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </span>
              </div>
              <div id="tg-bot-substatus" class="text-xs text-stone-400">bot · online 24/7</div>
            </div>
          </div>

          <!-- Header Right Actions: Open WebApp Mini App -->
          <div class="flex items-center gap-2">
            <a href="#webapp" class="px-2.5 py-1 rounded-lg bg-terracotta-500/20 text-terracotta-300 hover:bg-terracotta-500 hover:text-white text-xs font-semibold border border-terracotta-500/30 transition-all flex items-center gap-1">
              <span>Buka WebApp</span>
              ${ICONS.externalLink}
            </a>
          </div>
        </header>

        <!-- CHAT MESSAGE SCROLL AREA WITH LARGE WATERMARK -->
        <div id="tg-chat-box" class="telegram-chat-area flex-1 overflow-y-auto p-4 space-y-4 relative">
          
          <!-- LARGE BRAND WATERMARK (Subtle, elegant background) -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
            <div class="w-72 h-72 opacity-[0.045] transform scale-125 filter drop-shadow">
              ${BRAND_LOGO_SVG}
            </div>
          </div>

          <!-- Messages wrapper with relative z-10 for perfect contrast -->
          <div class="relative z-10 space-y-4">
            <!-- Welcome Message from Bot -->
            <div class="tg-bubble-bot space-y-2">
              <div class="flex items-center gap-1.5">
                <span class="w-4 h-4">${BRAND_LOGO_SVG}</span>
                <span class="font-bold text-amber-300 text-sm">Bintang Store</span>
              </div>
              <div class="text-stone-200">
                Selamat datang 👋<br>
                <span class="text-stone-400 text-xs italic">"Produk digital, langsung beres."</span>
              </div>
              <div class="text-stone-300 text-xs pt-1">
                Mau cari produk apa hari ini? Pilih menu di bawah untuk mulai:
              </div>
              <div class="text-[10px] text-stone-500 text-right font-mono">10:00 · bot</div>
            </div>

            <!-- Pinned CTA: Open WebApp -->
            <div class="flex justify-center my-1">
              <a href="#webapp" class="w-full max-w-xs py-2.5 px-4 rounded-xl font-heading font-bold text-xs bg-gradient-to-r from-terracotta-500 to-amber-600 hover:from-terracotta-600 hover:to-amber-700 text-white shadow-md text-center transition-all flex items-center justify-center gap-2">
                <span>🌐</span>
                <span>BELANJA SEKARANG (BUKA WEBAPP)</span>
              </a>
            </div>

            <!-- Dynamic Chat Container -->
            <div id="tg-dynamic-messages" class="space-y-4"></div>

            <!-- Bot Typing Indicator -->
            <div id="tg-typing" class="hidden tg-bubble-bot py-2 px-3 w-20">
              <div class="typing-dots flex gap-1">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>

        </div>

        <!-- KEYBOARD BUTTONS AREA -->
        <div class="bg-[#17212B] p-2.5 border-t border-stone-800/80 shrink-0 z-20">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
            <button type="button" class="btn-tg-menu tg-btn-keyboard" data-cmd="produk">
              📦 Produk
            </button>
            <button type="button" class="btn-tg-menu tg-btn-keyboard" data-cmd="bestseller">
              ⭐ Best Seller
            </button>
            <button type="button" class="btn-tg-menu tg-btn-keyboard" data-cmd="pesanan">
              📋 Pesanan Saya
            </button>
            <button type="button" class="btn-tg-menu tg-btn-keyboard" data-cmd="voucher">
              🏷️ Voucher
            </button>
            <button type="button" class="btn-tg-menu tg-btn-keyboard" data-cmd="akun">
              👤 Akun
            </button>
            <button type="button" class="btn-tg-menu tg-btn-keyboard" data-cmd="bantuan">
              💬 Bantuan
            </button>
          </div>

          <!-- Input Bar -->
          <form id="tg-input-form" class="mt-2 flex items-center gap-2">
            <input id="tg-text-input"
                   type="text"
                   placeholder="Ketik pesan atau perintah (/stok, /help)..."
                   class="flex-1 bg-[#242F3D] text-white text-xs px-3.5 py-2.5 rounded-xl border border-stone-700/60 focus:outline-none focus:border-terracotta-500 placeholder-stone-500">
            <button type="submit"
                    class="p-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white transition-colors"
                    title="Kirim">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  `;
}

export function initTelegramBotEvents() {
  const chatBox = document.getElementById('tg-chat-box');
  const dynamicMessages = document.getElementById('tg-dynamic-messages');
  const typingIndicator = document.getElementById('tg-typing');
  const botSubstatus = document.getElementById('tg-bot-substatus');
  const menuButtons = document.querySelectorAll('.btn-tg-menu');
  const inputForm = document.getElementById('tg-input-form');
  const textInput = document.getElementById('tg-text-input');

  if (!chatBox || !dynamicMessages) return;

  const scrollToBottom = () => {
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  const showBotTyping = async (duration = 600) => {
    if (typingIndicator) typingIndicator.classList.remove('hidden');
    if (botSubstatus) botSubstatus.textContent = 'mengetik...';
    scrollToBottom();
    await sleep(duration);
    if (typingIndicator) typingIndicator.classList.add('hidden');
    if (botSubstatus) botSubstatus.textContent = 'bot · online 24/7';
  };

  const appendUserMessage = (text) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'tg-bubble-user';
    bubble.innerHTML = `
      <div>${escapeHtml(text)}</div>
      <div class="text-[10px] text-sky-200 text-right font-mono mt-0.5">${time} ✓✓</div>
    `;
    dynamicMessages.appendChild(bubble);
    scrollToBottom();
  };

  const appendBotMessage = (htmlContent) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'tg-bubble-bot space-y-2';
    bubble.innerHTML = `
      ${htmlContent}
      <div class="text-[10px] text-stone-500 text-right font-mono mt-1">${time} · bot</div>
    `;
    dynamicMessages.appendChild(bubble);
    scrollToBottom();
    attachMessageEvents(bubble);
  };

  const handleCommand = async (cmd) => {
    const clean = cmd.trim().toLowerCase();

    if (clean === 'produk' || clean === '/katalog' || clean === '/produk') {
      appendUserMessage('📦 Produk');
      await showBotTyping(650);

      const products = store.getActiveProducts().slice(0, 6);
      const html = `
        <div class="font-bold text-amber-300">📦 Katalog Produk Pilihan:</div>
        <div class="text-xs text-stone-300">Pilih produk di bawah untuk detail atau order cepat:</div>
        <div class="space-y-1.5 mt-2">
          ${products
            .map(
              (p) => `
            <div class="bg-[#1C2530] p-2.5 rounded-xl border border-stone-700/40 flex items-center justify-between gap-2">
              <div>
                <div class="font-bold text-xs text-white">${escapeHtml(p.name)}</div>
                <div class="text-[11px] font-mono text-stone-400">${p.duration || '1 Bulan'} · <span class="text-amber-300 font-semibold">${formatRupiah(p.price)}</span></div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" class="btn-tg-detail px-2 py-1 rounded-lg bg-stone-700/80 hover:bg-stone-700 text-[11px] text-stone-200" data-id="${p.id}">Detail</button>
                <button type="button" class="btn-tg-buy px-2.5 py-1 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 font-bold text-[11px] text-white shadow-sm" data-id="${p.id}">Beli</button>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
        <div class="pt-2 text-center">
          <a href="#webapp" class="inline-block text-xs font-semibold text-terracotta-400 hover:text-amber-300 underline">
            + Buka WebApp untuk Semua 12 Produk →
          </a>
        </div>
      `;
      appendBotMessage(html);
    } else if (clean === 'bestseller' || clean === '/bestseller') {
      appendUserMessage('⭐ Best Seller');
      await showBotTyping(550);
      const bestSellers = store
        .getActiveProducts()
        .filter((p) => p.badge === 'Best Seller' || p.rating >= 4.9)
        .slice(0, 4);
      const html = `
        <div class="font-bold text-amber-300">⭐ Produk Paling Laris (Best Seller):</div>
        <div class="space-y-1.5 mt-2">
          ${bestSellers
            .map(
              (p) => `
            <div class="bg-[#1C2530] p-2.5 rounded-xl border border-stone-700/40 flex items-center justify-between gap-2">
              <div>
                <span class="inline-block text-[10px] text-terracotta-300 font-mono uppercase mb-0.5">${p.badge || 'Best Seller'}</span>
                <div class="font-bold text-xs text-white">${escapeHtml(p.name)}</div>
                <div class="text-[11px] font-mono text-amber-300 font-semibold">${formatRupiah(p.price)}</div>
              </div>
              <button type="button" class="btn-tg-buy px-3 py-1.5 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 font-bold text-xs text-white shadow-sm" data-id="${p.id}">Beli</button>
            </div>
          `,
            )
            .join('')}
        </div>
      `;
      appendBotMessage(html);
    } else if (clean === 'pesanan' || clean === '/pesanan') {
      appendUserMessage('📋 Pesanan Saya');
      await showBotTyping(550);
      const orders = store.getOrders().slice(0, 3);
      const html = `
        <div class="font-bold text-amber-300">📋 Riwayat Pesanan Terbaru:</div>
        <div class="space-y-2 mt-2">
          ${orders
            .map(
              (o) => `
            <div class="bg-[#1C2530] p-2.5 rounded-xl border border-stone-700/40 text-xs">
              <div class="flex justify-between items-center mb-1">
                <span class="font-mono font-bold text-sky-400">${o.id}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  o.fulfillmentStatus === 'FULFILLED'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : 'bg-amber-900/60 text-amber-300'
                }">${o.fulfillmentStatus}</span>
              </div>
              <div class="text-white font-medium">${escapeHtml(o.product.name)}</div>
              <div class="flex justify-between items-center mt-1 text-stone-400 text-[11px]">
                <span>${formatRupiah(o.total)}</span>
                <button type="button" class="btn-tg-order-detail text-terracotta-400 hover:text-amber-300 font-semibold underline" data-id="${o.id}">Lihat Akses</button>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      `;
      appendBotMessage(html);
    } else if (clean === 'voucher' || clean === '/voucher') {
      appendUserMessage('🏷️ Voucher');
      await showBotTyping(500);
      const html = `
        <div class="font-bold text-amber-300">🏷️ Voucher Promo Spesial:</div>
        <div class="bg-[#1C2530] p-3 rounded-xl border border-amber-500/40 mt-1">
          <div class="flex items-center justify-between">
            <span class="font-mono text-base font-black text-amber-300 tracking-wider">BINTANG10</span>
            <span class="text-xs font-bold text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded">Diskon 10%</span>
          </div>
          <p class="text-xs text-stone-300 mt-1">Gunakan kode ini saat checkout di WebApp untuk mendapatkan potongan 10%.</p>
        </div>
      `;
      appendBotMessage(html);
    } else if (clean === 'akun' || clean === '/akun') {
      appendUserMessage('👤 Akun');
      await showBotTyping(500);
      const customer = store.getCustomers()[0] || {
        name: 'Demo Customer',
        telegram: '@demo_customer',
        ordersCount: 12,
        totalSpending: 245000,
      };
      const html = `
        <div class="font-bold text-amber-300">👤 Data Akun Pelanggan:</div>
        <div class="bg-[#1C2530] p-3 rounded-xl border border-stone-700/40 text-xs space-y-1.5 mt-1">
          <div><span class="text-stone-400">Nama:</span> <span class="font-semibold text-white">${customer.name}</span></div>
          <div><span class="text-stone-400">Telegram:</span> <span class="font-mono text-sky-400">${customer.telegram}</span></div>
          <div><span class="text-stone-400">Total Transaksi:</span> <span class="font-bold text-white">${customer.ordersCount} pesanan</span></div>
          <div><span class="text-stone-400">Total Belanja:</span> <span class="font-bold text-emerald-400 font-mono">${formatRupiah(customer.totalSpending)}</span></div>
        </div>
      `;
      appendBotMessage(html);
    } else if (clean === 'bantuan' || clean === '/bantuan' || clean === '/help') {
      appendUserMessage('💬 Bantuan');
      await showBotTyping(500);
      const html = `
        <div class="font-bold text-amber-300">💬 Pusat Bantuan Bintang Store:</div>
        <div class="text-xs text-stone-300 space-y-2 mt-1">
          <p>⚡ <b>Pengiriman:</b> Semua produk digital kami terkirim otomatis detik pembayaran terkonfirmasi.</p>
          <p>💳 <b>Pembayaran:</b> Support QRIS (Semua bank & e-wallet) serta Transfer Bank.</p>
          <p>📞 <b>Kendala Akun?</b> Hubungi admin di <span class="text-sky-400 font-mono">@bintang_support</span>.</p>
        </div>
      `;
      appendBotMessage(html);
    } else {
      appendUserMessage(cmd);
      await showBotTyping(500);
      appendBotMessage(`
        <div class="text-stone-300 text-xs">
          Perintah tidak dikenali. Silakan pilih tombol menu di bawah atau ketik <b>Produk</b>, <b>Best Seller</b>, <b>Pesanan</b>, <b>Voucher</b>, atau <b>Bantuan</b>.
        </div>
      `);
    }
  };

  const attachMessageEvents = (container) => {
    // Detail button
    container.querySelectorAll('.btn-tg-detail').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const prod = store.getProduct(id);
        if (prod) {
          openProductDetailModal(prod);
        }
      });
    });

    // Buy button
    container.querySelectorAll('.btn-tg-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const prod = store.getProduct(id);
        if (prod) {
          const newOrder = store.createOrder({
            singleProduct: prod,
            paymentMethod: 'QRIS',
          });
          showPaymentSimulation({ order: newOrder });
        }
      });
    });

    // Order detail button
    container.querySelectorAll('.btn-tg-order-detail').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const order = store.getOrder(id);
        if (order) {
          openOrderDetailModal(order);
        }
      });
    });
  };

  menuButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      handleCommand(cmd);
    });
  });

  if (inputForm && textInput) {
    inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = textInput.value;
      if (val.trim()) {
        textInput.value = '';
        handleCommand(val);
      }
    });
  }
}

function openProductDetailModal(product) {
  const content = `
    <div class="space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-[11px] font-semibold uppercase text-stone-400">${product.category} · ${product.type}</span>
          <h3 class="font-heading font-bold text-lg text-stone-900">${escapeHtml(product.name)}</h3>
        </div>
        <div class="text-right">
          <div class="font-heading font-extrabold text-base text-terracotta-600">${formatRupiah(product.price)}</div>
          <span class="text-[11px] text-emerald-600 font-medium">Stok: ${product.stock}</span>
        </div>
      </div>
      <p class="text-xs text-stone-600 leading-relaxed">${escapeHtml(product.description)}</p>
      <div class="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1.5 text-stone-600">
        <div class="flex items-center gap-1.5 text-emerald-700 font-medium">✓ Pengiriman otomatis</div>
        <div class="flex items-center gap-1.5 text-emerald-700 font-medium">✓ Diproses setelah pembayaran</div>
        <div class="flex items-center gap-1.5 text-emerald-700 font-medium">✓ Produk digital resmi</div>
      </div>
      <button id="btn-modal-instant-buy" class="w-full py-3 rounded-xl font-heading font-bold text-xs bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-md transition-all">
        Beli Sekarang (${formatRupiah(product.price)})
      </button>
    </div>
  `;

  openModal({
    title: 'Detail Produk',
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      const btn = modalEl.querySelector('#btn-modal-instant-buy');
      if (btn) {
        btn.addEventListener('click', () => {
          const newOrder = store.createOrder({
            singleProduct: product,
            paymentMethod: 'QRIS',
          });
          showPaymentSimulation({ order: newOrder });
        });
      }
    },
  });
}

function openOrderDetailModal(order) {
  const content = `
    <div class="space-y-4 text-xs">
      <div class="bg-stone-50 p-3 rounded-xl border border-stone-200 flex justify-between items-center">
        <div>
          <span class="text-[10px] text-stone-400 block font-mono">ORDER ID</span>
          <span class="font-mono font-bold text-sm text-stone-900">${order.id}</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">${order.fulfillmentStatus}</span>
      </div>
      <div>
        <div class="font-bold text-stone-900 text-sm mb-1">${escapeHtml(order.product.name)}</div>
        <div class="text-stone-500">Total: <span class="font-mono font-bold text-stone-800">${formatRupiah(order.total)}</span> · ${order.paymentMethod}</div>
      </div>
      <div class="bg-stone-900 text-white p-3 rounded-xl font-mono text-[11px] space-y-1.5">
        <div class="text-terracotta-400 font-bold uppercase">Data Akses / Kredensial:</div>
        ${order.fulfillmentData.code ? `<div>Kode: <b class="text-amber-300">${order.fulfillmentData.code}</b></div>` : ''}
        ${order.fulfillmentData.email ? `<div>Email: <b class="text-amber-200">${order.fulfillmentData.email}</b></div>` : ''}
        ${order.fulfillmentData.password ? `<div>Pass: <b class="text-amber-200">${order.fulfillmentData.password}</b></div>` : ''}
        ${order.fulfillmentData.link ? `<div>Link: <a href="${order.fulfillmentData.link}" target="_blank" class="text-sky-300 underline">${order.fulfillmentData.link}</a></div>` : ''}
        ${order.fulfillmentData.licenseKey ? `<div>Lisensi: <b class="text-amber-300">${order.fulfillmentData.licenseKey}</b></div>` : ''}
      </div>
    </div>
  `;

  openModal({
    title: 'Detail Pesanan',
    content: content,
    maxWidth: 'max-w-md',
  });
}
