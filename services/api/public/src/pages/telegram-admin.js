// Bintang Tech Studio — Template 01: DIGITAL MINIMAL
// Telegram Admin Simulation Page (Branded & Polished)

import { store } from '../state/store.js';
import { formatRupiah } from '../utils/currency.js';
import { escapeHtml, sleep, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';

export function renderTelegramAdminPage() {
  return `
    <div class="view-container bg-[#090B0E] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-900/60 via-[#0B0D11] to-[#07090C] min-h-[calc(100vh-40px)] flex flex-col items-center justify-center p-2 sm:p-6 select-none">
      
      <!-- Desktop Framing Header -->
      <div class="hidden sm:flex items-center justify-between max-w-md w-full mb-3 px-2 text-[11px] font-mono text-stone-400">
        <div class="flex items-center gap-2">
          <span class="w-4 h-4">${BRAND_LOGO_SVG}</span>
          <span class="tracking-wider uppercase font-semibold text-stone-300">Telegram Admin Control</span>
        </div>
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-purple-300">
          <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
          Admin Standby
        </span>
      </div>

      <!-- Telegram Phone Container -->
      <div class="telegram-frame flex flex-col w-full h-[750px] max-w-md bg-[#0E1621] rounded-3xl border border-stone-800/90 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        
        <!-- TELEGRAM ADMIN HEADER -->
        <header class="bg-[#17212B] px-4 py-3 border-b border-stone-800/80 flex items-center justify-between shrink-0 select-none z-20">
          <div class="flex items-center gap-3">
            <a href="#admin" class="text-stone-400 hover:text-white p-1 -ml-1 transition-colors" title="Kembali ke Admin Dashboard">
              ${ICONS.chevronLeft}
            </a>
            <!-- Bot Avatar with Official Logo -->
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-stone-900 border border-stone-700/80 p-1 flex items-center justify-center shadow-inner overflow-hidden">
                ${BRAND_LOGO_SVG}
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-purple-500 rounded-full ring-2 ring-[#17212B]"></span>
            </div>
            <!-- Title & Status -->
            <div>
              <div class="flex items-center gap-1.5 leading-tight">
                <span class="font-bold text-white text-sm">Bintang Store Admin Bot</span>
                <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-900/60 text-purple-300">ADMIN</span>
              </div>
              <div id="tg-admin-substatus" class="text-xs text-stone-400">bot asisten toko · standby</div>
            </div>
          </div>

          <a href="#admin" class="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 hover:text-white text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1">
            <span>Dashboard</span>
            ${ICONS.externalLink}
          </a>
        </header>

        <!-- CHAT MESSAGE SCROLL AREA WITH LARGE WATERMARK -->
        <div id="tg-admin-chat-box" class="telegram-chat-area flex-1 overflow-y-auto p-4 space-y-4 relative">
          <!-- LARGE BRAND WATERMARK -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
            <div class="w-72 h-72 opacity-[0.045] transform scale-125">
              ${BRAND_LOGO_SVG}
            </div>
          </div>

          <!-- Messages in relative z-10 for sharpness -->
          <div class="relative z-10 space-y-4">
            <!-- Welcome Message from Bot -->
            <div class="tg-bubble-bot space-y-2">
              <div class="flex items-center gap-1.5">
                <span class="w-4 h-4">${BRAND_LOGO_SVG}</span>
                <span class="font-bold text-purple-300 text-sm">Halo Admin Toko 👋</span>
              </div>
              <div class="text-stone-200 text-xs leading-relaxed">
                Selamat datang di asisten manajemen toko Bintang Store.
                Ketik atau klik perintah di bawah untuk memantau toko langsung dari Telegram:
              </div>
              <div class="bg-[#242F3D] p-2.5 rounded-xl border border-stone-700/60 font-mono text-[11px] text-stone-300 space-y-1">
                <div><b class="text-amber-300">/stok</b> — Cek stok live seluruh produk</div>
                <div><b class="text-amber-300">/order &lt;ID&gt;</b> — Cek status order & fulfillment</div>
                <div><b class="text-amber-300">/sales</b> — Ringkasan omset & pesanan hari ini</div>
              </div>
              <div class="text-[10px] text-stone-500 text-right font-mono">10:00 · admin bot</div>
            </div>

            <!-- Dynamic Chat Bubbles -->
            <div id="tg-admin-dynamic-messages" class="space-y-4"></div>

            <!-- Typing Indicator -->
            <div id="tg-admin-typing" class="hidden tg-bubble-bot py-2 px-3 w-20">
              <div class="typing-dots flex gap-1">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- COMMAND CHIPS & INPUT FORM -->
        <div class="bg-[#17212B] p-2.5 border-t border-stone-800/80 shrink-0">
          <!-- Quick Command Chips -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
            <button type="button" class="btn-admin-cmd tg-btn-keyboard font-mono text-xs whitespace-nowrap" data-cmd="/stok">
              /stok
            </button>
            <button type="button" class="btn-admin-cmd tg-btn-keyboard font-mono text-xs whitespace-nowrap" data-cmd="/sales">
              /sales
            </button>
            <button type="button" class="btn-admin-cmd tg-btn-keyboard font-mono text-xs whitespace-nowrap" data-cmd="/order BS-10231">
              /order BS-10231
            </button>
            <button type="button" class="btn-admin-cmd tg-btn-keyboard font-mono text-xs whitespace-nowrap" data-cmd="/order BS-10228">
              /order BS-10228
            </button>
            <button type="button" class="btn-admin-cmd tg-btn-keyboard font-mono text-xs whitespace-nowrap" data-cmd="/help">
              /help
            </button>
          </div>

          <!-- Text Input -->
          <form id="tg-admin-input-form" class="flex items-center gap-2">
            <input id="tg-admin-text-input"
                   type="text"
                   placeholder="Ketik command (/stok, /sales, /order BS-10231)..."
                   class="flex-1 bg-[#242F3D] text-white text-xs px-3.5 py-2.5 rounded-xl border border-stone-700/60 focus:outline-none focus:border-purple-500 placeholder-stone-500 font-mono">
            <button type="submit"
                    class="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                    title="Kirim Perintah">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  `;
}

export function initTelegramAdminEvents() {
  const chatBox = document.getElementById('tg-admin-chat-box');
  const dynamicMessages = document.getElementById('tg-admin-dynamic-messages');
  const typingIndicator = document.getElementById('tg-admin-typing');
  const substatus = document.getElementById('tg-admin-substatus');
  const inputForm = document.getElementById('tg-admin-input-form');
  const textInput = document.getElementById('tg-admin-text-input');
  const cmdButtons = document.querySelectorAll('.btn-admin-cmd');

  if (!chatBox || !dynamicMessages) return;

  const scrollToBottom = () => {
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  const showBotTyping = async (duration = 500) => {
    if (typingIndicator) typingIndicator.classList.remove('hidden');
    if (substatus) substatus.textContent = 'memproses perintah...';
    scrollToBottom();
    await sleep(duration);
    if (typingIndicator) typingIndicator.classList.add('hidden');
    if (substatus) substatus.textContent = 'bot asisten toko · standby';
  };

  const appendUserMessage = (text) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'tg-bubble-user font-mono text-xs';
    bubble.innerHTML = `
      <div>${escapeHtml(text)}</div>
      <div class="text-[10px] text-sky-200 text-right mt-0.5">${time} ✓✓</div>
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
      <div class="text-[10px] text-stone-500 text-right font-mono mt-1">${time} · admin bot</div>
    `;
    dynamicMessages.appendChild(bubble);
    scrollToBottom();
  };

  const handleAdminCommand = async (rawCmd) => {
    const cmd = rawCmd.trim();
    appendUserMessage(cmd);
    await showBotTyping(600);

    const lower = cmd.toLowerCase();

    if (lower === '/stok' || lower === 'stok') {
      const products = store.getProducts();
      const html = `
        <div class="font-bold text-amber-300 font-mono text-xs">📦 LAPORAN STOK REAL-TIME:</div>
        <div class="bg-[#242F3D] p-3 rounded-xl border border-stone-700/60 font-mono text-xs space-y-1.5 mt-1">
          ${products
            .map(
              (p) => `
            <div class="flex justify-between items-center py-0.5 border-b border-stone-700/40 last:border-none">
              <span class="text-stone-200 font-medium">${escapeHtml(p.name)}:</span>
              <span class="font-bold ${p.stock <= 5 ? 'text-amber-400' : 'text-emerald-400'}">Stock: ${p.stock}</span>
            </div>
          `,
            )
            .join('')}
        </div>
        <div class="text-[11px] text-stone-400">Total ${products.length} produk terdaftar dalam katalog.</div>
      `;
      appendBotMessage(html);
    } else if (lower.startsWith('/order') || lower.startsWith('order')) {
      const parts = cmd.split(' ');
      const rawId = parts[1] || 'BS-10231';
      const normalizedId = rawId.startsWith('#') ? rawId : `#${rawId}`;
      const order = store.getOrder(normalizedId) || store.getOrders()[0];

      if (order) {
        const html = `
          <div class="font-bold text-purple-300 font-mono text-xs">📑 DETAIL ORDER:</div>
          <div class="bg-[#242F3D] p-3 rounded-xl border border-stone-700/60 font-mono text-xs space-y-1.5 mt-1">
            <div>Order <b class="text-white">${order.id}</b></div>
            <div>Status: <span class="text-emerald-400 font-bold">${order.paymentStatus}</span></div>
            <div>Fulfillment: <span class="text-emerald-300 font-bold">${order.fulfillmentStatus}</span></div>
            <div>Customer: <span class="text-stone-300">${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.telegram)})</span></div>
            <div>Produk: <span class="text-stone-300">${escapeHtml(order.product.name)}</span></div>
            <div>Total: <span class="text-amber-300 font-bold">${formatRupiah(order.total)}</span></div>
          </div>
        `;
        appendBotMessage(html);
      } else {
        appendBotMessage(`
          <div class="text-red-400 text-xs font-mono">
            Order ${escapeHtml(normalizedId)} tidak ditemukan.
          </div>
        `);
      }
    } else if (lower === '/sales' || lower === 'sales') {
      const orders = store.getOrders();
      const todayTotal = orders.reduce(
        (sum, o) => sum + (o.paymentStatus === 'PAID' ? o.total : 0),
        450000,
      );
      const html = `
        <div class="font-bold text-emerald-400 font-mono text-xs">💰 LAPORAN PENJUALAN TOKO:</div>
        <div class="bg-[#242F3D] p-3 rounded-xl border border-stone-700/60 font-mono text-xs space-y-2 mt-1">
          <div><b class="text-white">Today:</b></div>
          <div class="pl-2 space-y-1">
            <div>Orders: <b class="text-sky-300">${orders.length > 5 ? orders.length : 12}</b> transaksi</div>
            <div>Sales: <b class="text-emerald-400 font-bold">${formatRupiah(todayTotal)}</b></div>
          </div>
          <div class="pt-1 border-t border-stone-700/50 text-[11px] text-stone-400">
            Fulfillment rate: <b class="text-white">100% Instant Delivery</b>
          </div>
        </div>
      `;
      appendBotMessage(html);
    } else if (lower === '/help' || lower === 'help') {
      const html = `
        <div class="font-bold text-purple-300 font-mono text-xs">ℹ️ DAFTAR PERINTAH ADMIN:</div>
        <div class="bg-[#242F3D] p-3 rounded-xl border border-stone-700/60 font-mono text-xs space-y-1.5 mt-1">
          <div><b class="text-amber-300">/stok</b> — Lihat stok semua produk saat ini</div>
          <div><b class="text-amber-300">/order BS-10231</b> — Cek detail spesifik transaksi</div>
          <div><b class="text-amber-300">/sales</b> — Cek omset dan volume pesanan hari ini</div>
          <div><b class="text-amber-300">/help</b> — Menampilkan bantuan ini</div>
        </div>
      `;
      appendBotMessage(html);
    } else {
      appendBotMessage(`
        <div class="text-stone-300 text-xs font-mono">
          Perintah <span class="text-amber-300">${escapeHtml(cmd)}</span> tidak dikenali.<br>
          Ketik <b>/help</b> untuk melihat perintah admin yang valid.
        </div>
      `);
    }
  };

  cmdButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      handleAdminCommand(cmd);
    });
  });

  if (inputForm && textInput) {
    inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = textInput.value;
      if (val.trim()) {
        textInput.value = '';
        handleAdminCommand(val);
      }
    });
  }
}
