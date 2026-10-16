// Bintang Tech Studio — Unified Landing Page
// Blended from Voiceflow (Storytelling), Resend (Pricing & Add-ons), Raycast (Template Showroom), & Linear (Obsidian Workspace)

import { store } from '../state/store.js';
import { formatRupiah } from '../utils/currency.js';
import { escapeHtml, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';
import { openAuthModal } from '../components/auth-modal.js';

let activeCategoryFilter = 'all';
let searchQuery = '';
let billingCycle = 'monthly'; // 'monthly' | 'yearly'
let selectedAddons = new Set();

const TEMPLATES_CATALOG = [
  {
    id: 'tpl_digital_minimal',
    name: 'Digital Minimal (Starter)',
    category: 'streaming',
    badge: 'PALING POPULER',
    monogram: 'DM',
    color: 'from-amber-500 to-terracotta-500',
    description: 'Template storefront digital bersih, cepat, dan terfokus untuk akun streaming & AI.',
    features: ['36 Produk Siap Jual', 'Integrasi Tipzy QRIS', 'Bot Telegram Terkoneksi', 'Dashboard Ringan'],
    idealFor: 'Seller Spotify, Netflix, YouTube, ChatGPT',
    tier: 'starter',
  },
  {
    id: 'tpl_gamer_haven',
    name: 'Gamer Haven Top-Up',
    category: 'game',
    badge: 'HIGH CONVERSION',
    monogram: 'GH',
    color: 'from-purple-500 to-indigo-500',
    description: 'Layout dinamis dengan input User ID + Zone ID otomatis untuk voucher game instan.',
    features: ['Validasi ID Server Game', 'Voucher Moonton & Garena', 'Bot WhatsApp Cek Saldo', 'Kirim Kode Instan'],
    idealFor: 'Seller Diamond MLBB, Free Fire, Valorant Points',
    tier: 'pro',
  },
  {
    id: 'tpl_license_vault',
    name: 'Software License Vault',
    category: 'software',
    badge: 'ENTERPRISE',
    monogram: 'LV',
    color: 'from-emerald-500 to-teal-500',
    description: 'Sistem distribusi serial key aktivasi OS dan software dengan serial pool terisolasi.',
    features: ['Single-Use Serial Pool', 'Instruksi Aktivasi Otomatis', 'WhatsApp & TG Bot Dispatch', 'Garansi Serial Key'],
    idealFor: 'Seller Windows 11, Office 365, Antivirus, Canva Pro',
    tier: 'pro',
  },
  {
    id: 'tpl_custom_agency',
    name: 'Full Custom Commerce Bot',
    category: 'custom',
    badge: 'BESPOKE / TAILORED',
    monogram: 'FC',
    color: 'from-rose-500 to-orange-500',
    description: 'Arsitektur bot khusus sesuai alur bisnismu dengan integrasi multi-gateway & CRM.',
    features: ['Workflow Bot Fleksibel', 'Custom Domain Penuh', 'Multi-Admin CS Telegram', 'Dedicated SLA Server'],
    idealFor: 'Agensi, Distributor Besar, & Toko Digital Custom',
    tier: 'enterprise',
  },
];

export function renderLandingPage() {
  const products = store.getActiveProducts();
  const settings = store.getSettings();
  const orders = store.getOrders();
  const totalSales = orders.reduce(
    (sum, o) => sum + (o.paymentStatus === 'PAID' ? o.total : 0),
    2450000,
  );

  return `
    <div class="view-container bg-[#08090b] text-[#f8fafc] flex flex-col justify-between selection:bg-terracotta-500 selection:text-white relative overflow-hidden font-sans">
      
      <!-- Top Radial Ambient Glow (Linear x Raycast) -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-terracotta-500/15 via-orange-500/5 to-transparent blur-[120px] pointer-events-none -z-0"></div>
      
      <!-- Subtle Grid Pattern Background -->
      <div class="absolute inset-0 grid-pattern-subtle opacity-30 pointer-events-none -z-0"></div>

      <!-- NAVBAR / HEADER -->
      <header class="sticky top-10 z-40 bg-[#08090b]/80 backdrop-blur-md border-b border-[#22242c]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-terracotta-500 to-orange-600 p-1 flex items-center justify-center shadow-lg shadow-terracotta-500/20">
              ${BRAND_LOGO_SVG}
            </span>
            <div>
              <span class="font-heading font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                Bintang Tech
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-terracotta-500/10 text-terracotta-400 border border-terracotta-500/20">Studio</span>
              </span>
            </div>
          </div>

          <!-- Quick Navigation Links -->
          <nav class="hidden md:flex items-center gap-7 text-sm text-[#94a3b8] font-medium">
            <a href="#fitur" class="hover:text-white transition-colors">Fitur Bot</a>
            <a href="#templates-showcase" class="hover:text-white transition-colors">Pilihan Template</a>
            <a href="#pricing" class="hover:text-white transition-colors">Harga Sewa</a>
            <a href="#faq" class="hover:text-white transition-colors">FAQ</a>
          </nav>

          <!-- Auth / Action Buttons -->
          <div class="flex items-center gap-3">
            <button id="btn-hero-login" type="button" class="text-xs sm:text-sm font-medium text-[#94a3b8] hover:text-white transition-colors px-2 py-1.5">
              Masuk
            </button>
            <button id="btn-hero-register" type="button" class="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-white hover:bg-stone-200 text-stone-950 transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]">
              Mulai Sewa Bot
            </button>
          </div>
        </div>
      </header>

      <!-- HERO SECTION (Voiceflow x Linear) -->
      <section class="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 w-full relative z-10 text-center">
        <!-- Floating Announcement Pill -->
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#14161d] border border-[#262a36] text-[#94a3b8] mb-8 hover:border-[#383d4e] transition-colors shadow-inner">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Engine WhatsApp Multi-Device & Telegram Live Telah Aktif</span>
          <span class="text-terracotta-400 font-bold ml-1">Baru →</span>
        </div>

        <h1 class="font-heading font-black text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.08] max-w-4xl mx-auto mb-6">
          Jualan Produk Digital Otomatis. <br class="hidden sm:inline" />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-terracotta-400 via-orange-400 to-amber-300">
            Dari Chat ke Cuan Tanpa Ribet.
          </span>
        </h1>

        <p class="text-base sm:text-lg text-[#94a3b8] max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Ubah jualan manual kamu jadi autopilot 24 jam. Sewa bot WhatsApp & Telegram tokomu sendiri—pembeli bayar via QRIS otomatis, akun dan voucher langsung terkirim detik itu juga.
        </p>

        <!-- CTA Action Group -->
        <div class="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button id="btn-cta-start" type="button" class="px-7 py-3.5 rounded-full font-heading font-bold text-sm bg-gradient-to-r from-terracotta-500 to-orange-500 hover:from-terracotta-600 hover:to-orange-600 text-white shadow-lg shadow-terracotta-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2">
            <span>🚀</span>
            <span>Sewa Bot Sekarang</span>
          </button>
          <a href="#templates-showcase" class="px-6 py-3.5 rounded-full font-heading font-semibold text-sm bg-[#121419] hover:bg-[#181b22] text-white border border-[#252932] transition-all hover:border-[#3a4050]">
            Pilih Template Bot
          </a>
          <a href="#admin" class="px-6 py-3.5 rounded-full font-heading font-semibold text-sm bg-[#121419]/70 hover:bg-[#181b22] text-[#94a3b8] hover:text-white border border-[#252932] transition-all">
            Lihat Demo Dashboard
          </a>
        </div>

        <!-- LINEAR-STYLE INTERACTIVE WINDOW MOCKUP -->
        <div class="relative max-w-5xl mx-auto rounded-2xl border border-[#252932] bg-[#101217] shadow-2xl overflow-hidden text-left">
          <!-- Window Header (Mac Controls) -->
          <div class="h-10 bg-[#14161d] border-b border-[#252932] flex items-center justify-between px-4">
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-[#ff5f56]/90"></div>
              <div class="w-3 h-3 rounded-full bg-[#ffbd2e]/90"></div>
              <div class="w-3 h-3 rounded-full bg-[#27c93f]/90"></div>
            </div>
            <div class="flex items-center space-x-2 text-xs text-[#94a3b8] font-mono">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span class="text-white font-medium">Bintang Tech Engine Live</span>
              <span>/</span>
              <span class="text-[#64748b]">ORD-WA-8921 FULFILLED</span>
            </div>
            <div class="text-[11px] font-mono text-terracotta-400 font-bold">100% Autopilot</div>
          </div>

          <!-- Window Inner Layout -->
          <div class="grid grid-cols-1 md:grid-cols-12 min-h-[380px] text-xs">
            <!-- Left: Bot Status & Channels -->
            <div class="md:col-span-4 border-r border-[#22242c] bg-[#0c0d11] p-5 space-y-4">
              <div class="text-[10px] font-mono uppercase tracking-wider text-[#64748b] font-bold">Status Engine Toko</div>
              
              <!-- Channel 1: WhatsApp -->
              <div class="p-3 rounded-xl bg-[#14161d] border border-emerald-500/20 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white flex items-center gap-1.5">
                    <span class="text-emerald-400 text-sm">💬</span> WhatsApp Bot Live
                  </span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold">CONNECTED</span>
                </div>
                <p class="text-[11px] text-[#94a3b8]">JID: +62 857-9752-0135 (Multi-device)</p>
              </div>

              <!-- Channel 2: Telegram -->
              <div class="p-3 rounded-xl bg-[#14161d] border border-blue-500/20 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white flex items-center gap-1.5">
                    <span class="text-blue-400 text-sm">🤖</span> Telegram Bot Store
                  </span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-bold">ACTIVE</span>
                </div>
                <p class="text-[11px] text-[#94a3b8]">@BintangDigitalDemoBot (Online 24/7)</p>
              </div>

              <!-- Quick Gateway Info -->
              <div class="p-3 rounded-xl bg-[#14161d] border border-[#22242c] space-y-1">
                <span class="text-[10px] text-[#64748b] uppercase font-mono">Payment Gateway</span>
                <div class="text-xs font-semibold text-white">Tipzy QRIS Real-Time Settlement</div>
                <div class="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Webhook HMAC SHA-256 Aktif
                </div>
              </div>
            </div>

            <!-- Right: Real-time Live Order Processing Feed -->
            <div class="md:col-span-8 p-5 space-y-4 bg-[#101217]">
              <div class="flex items-center justify-between">
                <div class="text-[10px] font-mono uppercase tracking-wider text-[#64748b] font-bold">Live Order & Auto-Fulfillment Feed</div>
                <span class="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Real-time
                </span>
              </div>

              <div class="space-y-2.5">
                <!-- Feed Item 1: Spotify -->
                <div class="p-3 rounded-xl bg-[#151821] border border-[#252932] flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">SP</span>
                    <div>
                      <div class="font-semibold text-white text-xs">Spotify Premium 1 Bulan (Private)</div>
                      <div class="text-[10px] text-[#94a3b8]">WhatsApp +62812****8821 · Rp 19.000</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FULFILLED</span>
                    <div class="text-[9px] text-[#64748b] font-mono mt-0.5">&lt; 1.2s via Tipzy</div>
                  </div>
                </div>

                <!-- Feed Item 2: Canva Pro -->
                <div class="p-3 rounded-xl bg-[#151821] border border-[#252932] flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">CV</span>
                    <div>
                      <div class="font-semibold text-white text-xs">Canva Pro 1 Tahun (Invite Edu)</div>
                      <div class="text-[10px] text-[#94a3b8]">Telegram @buyer_digital · Rp 15.000</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FULFILLED</span>
                    <div class="text-[9px] text-[#64748b] font-mono mt-0.5">&lt; 0.9s via Tipzy</div>
                  </div>
                </div>

                <!-- Feed Item 3: Windows 11 Key -->
                <div class="p-3 rounded-xl bg-[#151821] border border-[#252932] flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">W11</span>
                    <div>
                      <div class="font-semibold text-white text-xs">Windows 11 Pro Retail License</div>
                      <div class="text-[10px] text-[#94a3b8]">Web Store · Rp 35.000</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FULFILLED</span>
                    <div class="text-[9px] text-[#64748b] font-mono mt-0.5">Serial Key Delivered</div>
                  </div>
                </div>
              </div>

              <!-- Live Stat Footnote -->
              <div class="p-2.5 rounded-lg bg-[#0c0d11] border border-[#22242c] flex items-center justify-between text-[11px] text-[#94a3b8]">
                <span>⚡ Rata-rata waktu pengiriman kredensial: <b class="text-white">1.1 detik</b></span>
                <span class="text-emerald-400 font-mono">0 Chat Manual</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3-STEP WORKFLOW (Voiceflow Structure) -->
      <section id="fitur" class="py-20 border-t border-[#1c1f26] bg-[#0a0b0f] relative z-10">
        <div class="max-w-6xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="font-heading font-extrabold text-2xl sm:text-4xl text-white tracking-tight mb-4">
              Cara Kerja Sistem Jualan Otomatis
            </h2>
            <p class="text-sm sm:text-base text-[#94a3b8]">
              Cukup 3 langkah mudah untuk punya bot WhatsApp & Telegram yang melayani pembeli tanpa henti.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Step 1 -->
            <div class="p-6 rounded-2xl bg-[#121419] border border-[#22242c] relative card-hover-raycast">
              <div class="w-10 h-10 rounded-xl bg-terracotta-500/10 text-terracotta-400 font-mono font-bold text-lg flex items-center justify-center mb-4 border border-terracotta-500/20">
                1
              </div>
              <h3 class="font-heading font-bold text-lg text-white mb-2">Pilih Paket & Template</h3>
              <p class="text-xs text-[#94a3b8] leading-relaxed">
                Tentukan template toko yang cocok (Akun Streaming, Voucher Game, atau Software). Masukkan daftar produk dan stok akun/lisensi melalui Dashboard Web atau Telegram Admin.
              </p>
            </div>

            <!-- Step 2 -->
            <div class="p-6 rounded-2xl bg-[#121419] border border-[#22242c] relative card-hover-raycast">
              <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 font-mono font-bold text-lg flex items-center justify-center mb-4 border border-emerald-500/20">
                2
              </div>
              <h3 class="font-heading font-bold text-lg text-white mb-2">Tautkan Bot WhatsApp & Telegram</h3>
              <p class="text-xs text-[#94a3b8] leading-relaxed">
                Cukup scan QR Code WhatsApp dari HP kamu atau pasang token bot Telegram bisnismu. Engine kami langsung mengambil alih chat interaktif secara multi-device.
              </p>
            </div>

            <!-- Step 3 -->
            <div class="p-6 rounded-2xl bg-[#121419] border border-[#22242c] relative card-hover-raycast">
              <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 font-mono font-bold text-lg flex items-center justify-center mb-4 border border-blue-500/20">
                3
              </div>
              <h3 class="font-heading font-bold text-lg text-white mb-2">Terima Cuan Autopilot 24 Jam</h3>
              <p class="text-xs text-[#94a3b8] leading-relaxed">
                Pembeli chat bot, pilih produk, bayar QRIS. Dalam 1 detik setelah mutasi masuk, bot otomatis mengirim email/password akun ke pembeli, dan notifikasi uang masuk diteruskan ke Telegrammu!
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- RAYCAST-STYLE TEMPLATES SHOWROOM -->
      <section id="templates-showcase" class="py-20 border-t border-[#1c1f26] bg-[#08090b] relative z-10">
        <div class="max-w-6xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-2xl mx-auto mb-10">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-terracotta-500/10 text-terracotta-400 border border-terracotta-500/20 mb-3">
              Koleksi Template Bintang Tech
            </div>
            <h2 class="font-heading font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-3">
              Pilihan Template Siap Pakai
            </h2>
            <p class="text-xs sm:text-sm text-[#94a3b8]">
              Pilih template yang sesuai dengan jenis produk digital yang kamu jual.
            </p>
          </div>

          <!-- Raycast ⌘K Interactive Search Bar -->
          <div class="max-w-xl mx-auto mb-8">
            <div class="glass-input-raycast rounded-2xl p-2 flex items-center shadow-xl">
              <span class="pl-3.5 pr-2 text-[#94a3b8]">${ICONS.search || '🔍'}</span>
              <input type="text" id="tpl-search-input" placeholder="Cari template toko (Spotify, Game, Lisensi, Custom)..." class="w-full bg-transparent border-none text-white placeholder-[#64748b] focus:outline-none text-xs sm:text-sm py-1">
              <div class="flex items-center space-x-1 pr-2 text-xs text-[#64748b] font-mono">
                <kbd class="bg-[#181a22] border border-[#2b2f3d] px-2 py-0.5 rounded text-[10px] text-[#94a3b8]">⌘</kbd>
                <kbd class="bg-[#181a22] border border-[#2b2f3d] px-2 py-0.5 rounded text-[10px] text-[#94a3b8]">K</kbd>
              </div>
            </div>
          </div>

          <!-- Category Filter Pills -->
          <div class="flex flex-wrap items-center justify-center gap-2 mb-10" id="tpl-filter-container">
            ${[
              { id: 'all', label: 'Semua Template' },
              { id: 'streaming', label: 'Streaming & Musik' },
              { id: 'game', label: 'Voucher Game' },
              { id: 'software', label: 'Software & Lisensi' },
              { id: 'custom', label: 'Custom Enterprise' },
            ]
              .map(
                (c) => `
              <button type="button" 
                      class="btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeCategoryFilter === c.id
                          ? 'bg-white text-stone-950 font-bold shadow-sm'
                          : 'bg-[#14161d] text-[#94a3b8] hover:text-white border border-[#22242c]'
                      }"
                      data-cat="${c.id}">
                ${c.label}
              </button>
            `,
              )
              .join('')}
          </div>

          <!-- Template Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="tpl-cards-grid">
            ${renderTemplateCards()}
          </div>
        </div>
      </section>

      <!-- RESEND-STYLE DYNAMIC PRICING SECTION -->
      <section id="pricing" class="py-24 border-t border-[#1c1f26] bg-[#0a0b0f] relative z-10">
        <div class="max-w-6xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-3xl mx-auto mb-14">
            <h2 class="font-heading font-extrabold text-3xl sm:text-5xl text-white tracking-tight mb-4">
              Harga Sewa Bot yang Masuk Akal
            </h2>
            <p class="text-sm sm:text-base text-[#94a3b8] mb-8">
              Mulai otomatisasi jualanmu dengan biaya sewa bulanan murah. Tanpa bagi hasil penjualan.
            </p>

            <!-- Billing Toggle Switcher -->
            <div class="inline-flex p-1 bg-[#121419] border border-[#22242c] rounded-full text-xs font-medium">
              <button id="btn-billing-monthly" type="button" class="px-5 py-2 rounded-full transition-all ${
                billingCycle === 'monthly' ? 'bg-[#22242c] text-white shadow' : 'text-[#94a3b8] hover:text-white'
              }">
                Sewa Bulanan
              </button>
              <button id="btn-billing-yearly" type="button" class="px-5 py-2 rounded-full transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly' ? 'bg-terracotta-500 text-white shadow font-semibold' : 'text-[#94a3b8] hover:text-white'
              }">
                <span>Tahunan</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-white text-stone-950 font-bold font-mono">HEMAT 20%</span>
              </button>
            </div>
          </div>

          <!-- Pricing Tier Cards (3 Tiers from User Plan) -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            
            <!-- Tier 1: Starter (Template Mudah) -->
            <div class="bg-[#101217] border border-[#22242c] rounded-2xl p-7 flex flex-col justify-between card-hover-raycast relative">
              <div>
                <span class="text-xs font-mono font-bold uppercase text-[#94a3b8]">Paket Starter</span>
                <h3 class="text-white font-heading font-extrabold text-xl mt-1 mb-2">Template Mudah</h3>
                <p class="text-xs text-[#94a3b8] mb-6">Cocok untuk seller pemula yang ingin coba jualan digital otomatis tanpa repot.</p>
                
                <div class="flex items-baseline mb-6 border-b border-[#22242c] pb-6">
                  <span class="text-3xl sm:text-4xl font-heading font-black text-white" id="price-starter">
                    ${billingCycle === 'monthly' ? 'Rp 49.000' : 'Rp 39.000'}
                  </span>
                  <span class="text-[#64748b] ml-1.5 text-xs font-mono">/ bulan</span>
                </div>

                <ul class="space-y-3 text-xs text-[#cbd5e1] mb-8">
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> 1 Bot Telegram Toko Resmi
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Web Store Digital Minimal
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Maksimal 15 Produk Digital
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Gateway Tipzy QRIS Otomatis
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Auto-Fulfillment Akun/Voucher
                  </li>
                  <li class="flex items-center gap-2.5 text-[#64748b]">
                    <span>✕</span> WhatsApp Bot Multi-Device
                  </li>
                </ul>
              </div>

              <button type="button" class="btn-select-plan w-full py-2.5 rounded-xl bg-[#1c1f28] hover:bg-[#252936] text-white text-xs font-semibold text-center border border-[#2b2f3d] transition-all" data-plan="starter">
                Pilih Starter
              </button>
            </div>

            <!-- Tier 2: Pro (Template Sedang/Populer) - FEATURED -->
            <div class="bg-gradient-to-b from-[#171a22] to-[#101217] border-2 border-terracotta-500/80 rounded-2xl p-7 flex flex-col justify-between card-hover-raycast relative shadow-xl shadow-terracotta-500/10">
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-terracotta-500 to-orange-500 text-white font-mono text-[10px] font-bold tracking-wider uppercase shadow-md">
                ⭐ PALING BANYAK DISEWA
              </div>

              <div>
                <span class="text-xs font-mono font-bold uppercase text-terracotta-400">Paket Pro</span>
                <h3 class="text-white font-heading font-extrabold text-xl mt-1 mb-2">WhatsApp & TG Dual Bot</h3>
                <p class="text-xs text-[#94a3b8] mb-6">Pilihan paling lengkap untuk seller yang ingin melayani pembeli di WhatsApp & Telegram sekaligus.</p>
                
                <div class="flex items-baseline mb-6 border-b border-[#252934] pb-6">
                  <span class="text-3xl sm:text-4xl font-heading font-black text-white" id="price-pro">
                    ${billingCycle === 'monthly' ? 'Rp 99.000' : 'Rp 79.000'}
                  </span>
                  <span class="text-[#64748b] ml-1.5 text-xs font-mono">/ bulan</span>
                </div>

                <ul class="space-y-3 text-xs text-white mb-8">
                  <li class="flex items-center gap-2.5">
                    <span class="text-terracotta-400 font-bold">✓</span> <b>Bot WhatsApp Multi-Device (QR Pairing)</b>
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-terracotta-400 font-bold">✓</span> <b>Bot Telegram Toko 24 Jam</b>
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-terracotta-400 font-bold">✓</span> <b>Smart Human Takeover (Mute 15 Menit saat CS)</b>
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-terracotta-400 font-bold">✓</span> Unlimited Produk & Kategori
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-terracotta-400 font-bold">✓</span> Dashboard Seller Linear-Style Lengkap
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-terracotta-400 font-bold">✓</span> Notifikasi Pembayaran Instan ke Telegram
                  </li>
                </ul>
              </div>

              <button type="button" class="btn-select-plan w-full py-3 rounded-xl bg-gradient-to-r from-terracotta-500 to-orange-500 hover:from-terracotta-600 hover:to-orange-600 text-white text-xs font-bold text-center shadow-lg shadow-terracotta-500/25 transition-all" data-plan="pro">
                Sewa Paket Pro
              </button>
            </div>

            <!-- Tier 3: Enterprise (Full Custom & Berat) -->
            <div class="bg-[#101217] border border-[#22242c] rounded-2xl p-7 flex flex-col justify-between card-hover-raycast relative">
              <div>
                <span class="text-xs font-mono font-bold uppercase text-[#94a3b8]">Paket Custom</span>
                <h3 class="text-white font-heading font-extrabold text-xl mt-1 mb-2">Full Custom Enterprise</h3>
                <p class="text-xs text-[#94a3b8] mb-6">Untuk toko skala besar yang butuh alur khusus, multi-nomor, atau domain sendiri.</p>
                
                <div class="flex items-baseline mb-6 border-b border-[#22242c] pb-6">
                  <span class="text-3xl sm:text-4xl font-heading font-black text-white" id="price-enterprise">
                    ${billingCycle === 'monthly' ? 'Rp 249.000' : 'Rp 199.000'}
                  </span>
                  <span class="text-[#64748b] ml-1.5 text-xs font-mono">/ bulan</span>
                </div>

                <ul class="space-y-3 text-xs text-[#cbd5e1] mb-8">
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Semua Fitur Paket Pro
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Custom Domain Toko Sendiri (.com / .id)
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Multi-Admin Telegram (Tim CS Terhubung)
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> White-label Penuh (Hapus Branding)
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Integrasi API & Database Sendiri
                  </li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400 font-bold">✓</span> Dedicated Server SLA 99.9%
                  </li>
                </ul>
              </div>

              <button type="button" class="btn-select-plan w-full py-2.5 rounded-xl bg-[#1c1f28] hover:bg-[#252936] text-white text-xs font-semibold text-center border border-[#2b2f3d] transition-all" data-plan="enterprise">
                Hubungi Konsultasi
              </button>
            </div>
          </div>

          <!-- RESEND-STYLE ADD-ONS CALCULATOR -->
          <div class="max-w-3xl mx-auto bg-[#121419] border border-[#22242c] rounded-2xl p-6 sm:p-8">
            <h3 class="font-heading font-bold text-lg text-white mb-2 flex items-center gap-2">
              <span>🧩</span> Add-on Tambahan Sesuai Kebutuhanmu
            </h3>
            <p class="text-xs text-[#94a3b8] mb-6">Pilih modul tambahan untuk disematkan ke bot tokomu.</p>

            <div class="space-y-3" id="addons-checklist">
              <label class="flex items-center justify-between p-3.5 rounded-xl bg-[#161821] border border-[#252834] hover:border-[#383d4e] transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                  <input type="checkbox" class="chk-addon accent-terracotta-500 w-4 h-4 rounded" data-id="extra_wa" data-price="30000">
                  <div>
                    <div class="font-bold text-xs text-white">Tambah Slot WhatsApp Kedua</div>
                    <div class="text-[11px] text-[#94a3b8]">Hubungkan 2 nomor WhatsApp sekaligus untuk cadangan / rotasi CS</div>
                  </div>
                </div>
                <span class="font-mono text-xs font-semibold text-terracotta-400">+Rp 30.000/bln</span>
              </label>

              <label class="flex items-center justify-between p-3.5 rounded-xl bg-[#161821] border border-[#252834] hover:border-[#383d4e] transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                  <input type="checkbox" class="chk-addon accent-terracotta-500 w-4 h-4 rounded" data-id="custom_domain" data-price="25000">
                  <div>
                    <div class="font-bold text-xs text-white">Custom Domain Pribadi (.web.id / .com)</div>
                    <div class="text-[11px] text-[#94a3b8]">Gunakan alamat web tokomu sendiri tanpa embel-embel Bintang Tech</div>
                  </div>
                </div>
                <span class="font-mono text-xs font-semibold text-terracotta-400">+Rp 25.000/bln</span>
              </label>

              <label class="flex items-center justify-between p-3.5 rounded-xl bg-[#161821] border border-[#252834] hover:border-[#383d4e] transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                  <input type="checkbox" class="chk-addon accent-terracotta-500 w-4 h-4 rounded" data-id="whitelabel" data-price="35000">
                  <div>
                    <div class="font-bold text-xs text-white">White-Label Branding Penuh</div>
                    <div class="text-[11px] text-[#94a3b8]">Hapus teks "Powered by Bintang Tech" di struk QRIS dan chat bot</div>
                  </div>
                </div>
                <span class="font-mono text-xs font-semibold text-terracotta-400">+Rp 35.000/bln</span>
              </label>
            </div>

            <!-- Dynamic Total Simulation Output -->
            <div class="mt-6 pt-5 border-t border-[#22242c] flex items-center justify-between">
              <div>
                <span class="text-[10px] uppercase font-mono text-[#64748b]">Estimasi Total Sewa</span>
                <div class="text-lg font-bold font-heading text-white" id="lbl-total-estimate">Rp 99.000 / bln</div>
              </div>
              <button id="btn-addons-checkout" type="button" class="px-5 py-2.5 rounded-full text-xs font-bold bg-white hover:bg-stone-200 text-stone-950 transition-all">
                Daftar & Konfigurasi Bot
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ SECTION (Voiceflow style) -->
      <section id="faq" class="py-20 border-t border-[#1c1f26] bg-[#08090b] relative z-10">
        <div class="max-w-4xl mx-auto px-4 sm:px-6">
          <div class="text-center mb-12">
            <h2 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight mb-2">
              Pertanyaan yang Sering Diajukan
            </h2>
            <p class="text-xs sm:text-sm text-[#94a3b8]">Semua yang perlu kamu ketahui tentang sewa bot Bintang Tech.</p>
          </div>

          <div class="space-y-4">
            <div class="p-5 rounded-2xl bg-[#121419] border border-[#22242c] space-y-2">
              <h4 class="font-bold text-sm text-white">Apakah saya harus bisa coding untuk pakai bot ini?</h4>
              <p class="text-xs text-[#94a3b8] leading-relaxed">
                Sama sekali tidak! Semua sudah disiapkan siap pakai. Kamu tinggal login ke dashboard website atau buka bot Telegram Admin untuk memasukkan nama produk, harga, dan stok akun/voucher kamu.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-[#121419] border border-[#22242c] space-y-2">
              <h4 class="font-bold text-sm text-white">Ke mana uang hasil penjualan pembeli masuk?</h4>
              <p class="text-xs text-[#94a3b8] leading-relaxed">
                Uang masuk langsung ke rekening bank atau e-wallet kamu sendiri melalui payment gateway resmi QRIS (Tipzy). Sistem Bintang Tech hanya memproses validasi transaksi dan pengiriman otomatis tanpa memotong saldo hasil penjualanmu.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-[#121419] border border-[#22242c] space-y-2">
              <h4 class="font-bold text-sm text-white">Bagaimana jika ada pembeli yang komplain atau butuh CS?</h4>
              <p class="text-xs text-[#94a3b8] leading-relaxed">
                Bot kami dilengkapi fitur <b>Smart Human Takeover</b>. Begitu pembeli mengetik "BANTUAN" atau "CS", bot Telegram kamu akan langsung membunyikan alert disertai link langsung ke chat pembeli di WhatsApp. Bot otomatis diam selama 15 menit agar kamu bisa membalas chat pembeli dengan leluasa.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="border-t border-[#1c1f26] bg-[#060709] py-8 relative z-10">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748b]">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 flex items-center justify-center">${BRAND_LOGO_SVG}</span>
            <span class="font-bold text-[#f8fafc]">Bintang Tech Studio</span> · Platform Bot Commerce Multi-Tenant
          </div>
          <div class="flex items-center gap-4">
            <a href="#admin" class="hover:text-white transition-colors">Admin Seller</a>
            <span>·</span>
            <a href="#webapp" class="hover:text-white transition-colors">Web Store Demo</a>
            <span>·</span>
            <span>Made with precision in Indonesia</span>
          </div>
        </div>
      </footer>
    </div>
  `;
}

function renderTemplateCards() {
  const filtered = TEMPLATES_CATALOG.filter((t) => {
    const matchCat = activeCategoryFilter === 'all' || t.category === activeCategoryFilter;
    const matchSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery) ||
      t.description.toLowerCase().includes(searchQuery) ||
      t.idealFor.toLowerCase().includes(searchQuery);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    return `
      <div class="col-span-2 p-10 text-center rounded-2xl bg-[#121419] border border-[#22242c]">
        <p class="text-sm text-[#94a3b8]">Tidak ada template yang cocok dengan pencarianmu.</p>
        <button id="btn-reset-filter" class="mt-3 text-xs text-terracotta-400 font-bold hover:underline">Reset Filter</button>
      </div>
    `;
  }

  return filtered
    .map(
      (t) => `
    <div class="p-6 rounded-2xl bg-[#101217] border border-[#22242c] hover:border-[#383d4e] transition-all card-hover-raycast flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} text-white font-mono font-bold text-base flex items-center justify-center shadow-md">
            ${t.monogram}
          </div>
          <span class="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#181a22] text-terracotta-400 border border-terracotta-500/20">
            ${t.badge}
          </span>
        </div>

        <h3 class="font-heading font-bold text-lg text-white mb-1.5">${escapeHtml(t.name)}</h3>
        <p class="text-xs text-[#94a3b8] leading-relaxed mb-4">${escapeHtml(t.description)}</p>

        <div class="p-3 rounded-xl bg-[#0c0d11] border border-[#1c1f26] mb-5 space-y-1.5">
          <span class="text-[10px] uppercase font-mono text-[#64748b] block font-bold">Fitur Utama:</span>
          ${t.features
            .map(
              (f) => `
            <div class="text-[11px] text-[#cbd5e1] flex items-center gap-1.5">
              <span class="text-emerald-400 text-xs">✓</span>
              <span>${f}</span>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>

      <div class="pt-4 border-t border-[#1c1f26] flex items-center justify-between">
        <div>
          <span class="text-[10px] text-[#64748b] block font-mono">Cocok untuk:</span>
          <span class="text-xs text-white font-medium">${t.idealFor}</span>
        </div>
        <button type="button" class="btn-choose-template px-4 py-2 rounded-xl bg-[#1c1f28] hover:bg-terracotta-500 hover:text-white text-xs font-bold text-[#94a3b8] transition-all" data-id="${t.id}" data-tier="${t.tier}">
          Pilih Template →
        </button>
      </div>
    </div>
  `,
    )
    .join('');
}

export function initLandingEvents() {
  // Login / Register Triggers
  const btnLogin = document.getElementById('btn-hero-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'login' });
    });
  }

  const btnRegister = document.getElementById('btn-hero-register');
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'signup' });
    });
  }

  const btnCtaStart = document.getElementById('btn-cta-start');
  if (btnCtaStart) {
    btnCtaStart.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'signup' });
    });
  }

  const btnAddonsCheckout = document.getElementById('btn-addons-checkout');
  if (btnAddonsCheckout) {
    btnAddonsCheckout.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'signup' });
    });
  }

  // Monthly vs Yearly Billing Switcher
  const btnMonthly = document.getElementById('btn-billing-monthly');
  const btnYearly = document.getElementById('btn-billing-yearly');
  const lblStarter = document.getElementById('price-starter');
  const lblPro = document.getElementById('price-pro');
  const lblEnterprise = document.getElementById('price-enterprise');

  const updatePricingDisplay = () => {
    if (lblStarter) lblStarter.textContent = billingCycle === 'monthly' ? 'Rp 49.000' : 'Rp 39.000';
    if (lblPro) lblPro.textContent = billingCycle === 'monthly' ? 'Rp 99.000' : 'Rp 79.000';
    if (lblEnterprise) lblEnterprise.textContent = billingCycle === 'monthly' ? 'Rp 249.000' : 'Rp 199.000';
    updateAddonTotal();
  };

  if (btnMonthly && btnYearly) {
    btnMonthly.addEventListener('click', () => {
      billingCycle = 'monthly';
      btnMonthly.className = 'px-5 py-2 rounded-full transition-all bg-[#22242c] text-white shadow';
      btnYearly.className = 'px-5 py-2 rounded-full transition-all flex items-center gap-1.5 text-[#94a3b8] hover:text-white';
      updatePricingDisplay();
    });

    btnYearly.addEventListener('click', () => {
      billingCycle = 'yearly';
      btnYearly.className = 'px-5 py-2 rounded-full transition-all flex items-center gap-1.5 bg-terracotta-500 text-white shadow font-semibold';
      btnMonthly.className = 'px-5 py-2 rounded-full transition-all text-[#94a3b8] hover:text-white';
      updatePricingDisplay();
    });
  }

  // Addons Calculator
  const updateAddonTotal = () => {
    let basePrice = billingCycle === 'monthly' ? 99000 : 79000; // default to Pro
    selectedAddons.forEach((cost) => {
      basePrice += cost;
    });
    const lblEstimate = document.getElementById('lbl-total-estimate');
    if (lblEstimate) {
      lblEstimate.textContent = `${formatRupiah(basePrice)} / bln`;
    }
  };

  document.querySelectorAll('.chk-addon').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const target = e.target;
      const price = parseInt(target.getAttribute('data-price') || '0', 10);
      if (target.checked) {
        selectedAddons.add(price);
      } else {
        selectedAddons.delete(price);
      }
      updateAddonTotal();
    });
  });

  // Template Search and Filters
  const searchInput = document.getElementById('tpl-search-input');
  const cardsGrid = document.getElementById('tpl-cards-grid');

  const refreshCards = () => {
    if (cardsGrid) {
      cardsGrid.innerHTML = renderTemplateCards();
      attachTemplateCardEvents();
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').trim().toLowerCase();
      refreshCards();
    });
  }

  // Keyboard shortcut: Cmd+K / Ctrl+K focus search
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  document.querySelectorAll('.btn-tpl-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategoryFilter = btn.getAttribute('data-cat') || 'all';
      document.querySelectorAll('.btn-tpl-filter').forEach((b) => {
        b.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#14161d] text-[#94a3b8] hover:text-white border border-[#22242c]';
      });
      btn.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-white text-stone-950 font-bold shadow-sm';
      refreshCards();
    });
  });

  attachTemplateCardEvents();
}

function attachTemplateCardEvents() {
  document.querySelectorAll('.btn-choose-template, .btn-select-plan').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'signup' });
    });
  });

  const btnReset = document.getElementById('btn-reset-filter');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      activeCategoryFilter = 'all';
      searchQuery = '';
      const searchInput = document.getElementById('tpl-search-input');
      if (searchInput) searchInput.value = '';
      document.querySelectorAll('.btn-tpl-filter').forEach((b) => {
        const cat = b.getAttribute('data-cat');
        if (cat === 'all') {
          b.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-white text-stone-950 font-bold shadow-sm';
        } else {
          b.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#14161d] text-[#94a3b8] hover:text-white border border-[#22242c]';
        }
      });
      const cardsGrid = document.getElementById('tpl-cards-grid');
      if (cardsGrid) {
        cardsGrid.innerHTML = renderTemplateCards();
        attachTemplateCardEvents();
      }
    });
  }
}

