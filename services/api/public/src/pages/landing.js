// Bintang Tech Studio — High-End Engineering Design System
// Strictly modeled after Linear (#0a0a0c, #121316, #22232a), Resend (#0f0f0f, #222222), and Raycast (#121215, #27272a)

import { store } from '../state/store.js';
import { formatRupiah } from '../utils/currency.js';
import { escapeHtml } from '../utils/helpers.js';
import { openAuthModal } from '../components/auth-modal.js';

let activeCategoryFilter = 'all';
let searchQuery = '';
let billingCycle = 'monthly'; // 'monthly' | 'yearly'
let selectedAddons = new Set();

const TEMPLATES_CATALOG = [
  {
    id: 'tpl_streaming_vault',
    name: 'Streaming & Accounts',
    category: 'streaming',
    badge: 'STARTER',
    iconText: 'SP',
    description: 'Instant account delivery engine for Spotify, Netflix, YouTube Premium with credentials vault.',
    features: ['36 Preloaded SKUs', 'Tipzy QRIS Integration', 'Telegram & WA Dispatch', 'Account Pool Manager'],
    author: 'Bintang Studio Team',
    tier: 'starter',
  },
  {
    id: 'tpl_gaming_vault',
    name: 'Game Top-Up & Vouchers',
    category: 'game',
    badge: 'POPULAR',
    iconText: 'ML',
    description: 'Automatic redeem voucher code dispatcher for MLBB, Free Fire, and gaming gift cards.',
    features: ['Instant Code Release', 'Server ID Parsing', 'Live Balance Inquiry', 'Zero-touch Delivery'],
    author: 'Bintang Gaming Lab',
    tier: 'pro',
  },
  {
    id: 'tpl_software_vault',
    name: 'Software License Vault',
    category: 'software',
    badge: 'ENTERPRISE',
    iconText: 'OS',
    description: 'Secure digital serial license key single-use pool for Windows 11, Office, and productivity tools.',
    features: ['Single-use Key Isolation', 'Activation Instructions', 'Automated Verification', 'License Key Warranty'],
    author: 'Bintang Infra Core',
    tier: 'pro',
  },
  {
    id: 'tpl_custom_bot',
    name: 'Bespoke Commerce Engine',
    category: 'custom',
    badge: 'CUSTOM',
    iconText: 'CX',
    description: 'Custom multi-tenant bot architecture with tailored workflows, custom domain, and dedicated SLA.',
    features: ['Tailored Dialog Tree', 'Custom Hostname (.com/.id)', 'Multi-Agent Support Handover', 'Dedicated Database Pool'],
    author: 'Bintang Solutions',
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
    <div class="view-container bg-[#0a0a0c] text-[#f7f8f8] flex flex-col justify-between selection:bg-[#5e6ad2] selection:text-white relative overflow-hidden font-sans">
      
      <!-- Linear Glow Effect (Pure from LINEAR.txt) -->
      <div class="glow-effect absolute top-0 left-0 right-0 h-[600px] pointer-events-none -z-0"></div>
      
      <!-- Linear Grid Pattern -->
      <div class="grid-pattern absolute inset-0 pointer-events-none opacity-40 -z-0"></div>

      <!-- NAVBAR (Exact match to LINEAR.txt header) -->
      <header class="sticky top-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-[#22232a]">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center space-x-8">
            <a href="#" class="flex items-center space-x-2.5 text-white font-semibold text-lg tracking-tight">
              <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              <span class="font-bold tracking-normal">Bintang Tech</span>
            </a>
            
            <nav class="hidden md:flex items-center space-x-6 text-sm text-[#8a8f98] font-medium">
              <a href="#workflow" class="hover:text-white transition-colors">Sistem</a>
              <a href="#templates" class="hover:text-white transition-colors">Templates</a>
              <a href="#pricing" class="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" class="hover:text-white transition-colors">Docs & FAQ</a>
            </nav>
          </div>

          <div class="flex items-center space-x-4">
            <button id="btn-hero-login" type="button" class="text-sm text-[#8a8f98] hover:text-white transition-colors font-medium">
              Log in
            </button>
            <button id="btn-hero-register" type="button" class="bg-white hover:bg-gray-100 text-black text-sm font-medium px-4 py-2 rounded-full transition-all shadow-sm">
              Mulai Sewa Bot
            </button>
          </div>
        </div>
      </header>

      <!-- HERO SECTION (Exact structure from LINEAR.txt lines 105-135) -->
      <section class="relative pt-24 pb-20 overflow-hidden">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-4xl mx-auto mb-14">
            <div class="inline-flex items-center space-x-2 bg-[#16181d] border border-[#2b2d36] rounded-full px-3.5 py-1 text-xs text-[#8a8f98] mb-6 shadow-sm">
              <span class="w-2 h-2 rounded-full bg-[#5e6ad2] animate-pulse"></span>
              <span>Engine WhatsApp Multi-Device & Telegram Live Telah Beroperasi</span>
              <a href="#templates" class="text-white hover:underline flex items-center space-x-1 ml-1"><span>Eksplor</span> <i class="fas fa-arrow-right text-[10px]"></i></a>
            </div>
            
            <h1 class="text-5xl sm:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08]">
              The product development & sales system for digital sellers
            </h1>

            <p class="text-base sm:text-lg text-[#8a8f98] max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
              Otomasi penuh jualan produk digital. Sewa bot WhatsApp & Telegram tokomu sendiri—pembeli bayar via QRIS otomatis, akun dan lisensi terkirim instan tanpa intervensi manual.
            </p>

            <div class="flex items-center justify-center space-x-4">
              <button id="btn-cta-start" type="button" class="bg-white hover:bg-gray-100 text-black text-sm font-medium px-6 py-3 rounded-full transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]">
                Sewa Bot Sekarang
              </button>
              <a href="#pricing" class="bg-[#1c1c1c] hover:bg-[#262626] text-white text-sm font-medium px-6 py-3 rounded-full transition border border-[#2a2a2a]">
                Lihat Paket Harga
              </a>
            </div>
          </div>

          <!-- APP UI PREVIEW (Exact match to LINEAR.txt lines 120-210) -->
          <div class="relative max-w-6xl mx-auto rounded-xl border border-[#22232a] bg-[#121316] shadow-2xl overflow-hidden">
            <!-- Mac Window Header -->
            <div class="h-10 bg-[#16181d] border-b border-[#22232a] flex items-center justify-between px-4">
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
              </div>
              <div class="flex items-center space-x-2 text-xs text-[#8a8f98]">
                <span class="font-medium text-white">Bintang Tech Studio</span>
                <span>/</span>
                <span>BTS-8892 Live Multi-Channel Engine</span>
              </div>
              <div class="text-xs text-[#8a8f98] font-mono">100% Autopilot</div>
            </div>

            <!-- App Layout -->
            <div class="grid grid-cols-12 min-h-[460px] text-xs">
              <!-- Sidebar -->
              <div class="col-span-12 md:col-span-3 border-r border-[#22232a] bg-[#0e0f12] p-4 text-[#8a8f98]">
                <div class="flex items-center justify-between mb-6 px-2">
                  <div class="flex items-center space-x-2 text-white font-medium">
                    <div class="w-5 h-5 rounded bg-[#5e6ad2] flex items-center justify-center text-white text-[10px]">B</div>
                    <span>Seller Studio</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-sliders-h"></i>
                  </div>
                </div>

                <div class="space-y-1 mb-6">
                  <div class="flex items-center space-x-3 px-2 py-1.5 rounded bg-[#1c1e24] text-white">
                    <i class="fas fa-bolt w-4 text-[#5e6ad2]"></i><span>Live Engine</span>
                  </div>
                  <div class="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-[#1c1e24] text-gray-300">
                    <i class="fas fa-inbox w-4"></i><span>Orders</span> <span class="ml-auto bg-[#22232a] px-1.5 py-0.2 rounded text-[10px]">128</span>
                  </div>
                  <div class="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-[#1c1e24] text-gray-300">
                    <i class="fas fa-check-circle w-4 text-emerald-400"></i><span>Fulfillment</span>
                  </div>
                </div>

                <div class="text-[10px] font-semibold text-[#666970] uppercase tracking-wider px-2 mb-2">Connected Channels</div>
                <div class="space-y-1.5 mb-6">
                  <div class="flex items-center justify-between p-2 rounded bg-[#14151b] border border-[#22232a]">
                    <div class="flex items-center space-x-2 text-gray-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>WhatsApp Bot</span>
                    </div>
                    <span class="font-mono text-[10px] text-emerald-400">PAIRED</span>
                  </div>
                  <div class="flex items-center justify-between p-2 rounded bg-[#14151b] border border-[#22232a]">
                    <div class="flex items-center space-x-2 text-gray-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      <span>Telegram Bot</span>
                    </div>
                    <span class="font-mono text-[10px] text-blue-400">ONLINE</span>
                  </div>
                </div>

                <div class="text-[10px] font-semibold text-[#666970] uppercase tracking-wider px-2 mb-2">Payment Bridge</div>
                <div class="p-2 rounded bg-[#14151b] border border-[#22232a] text-[#8a8f98]">
                  <div class="text-white font-medium">Tipzy QRIS Gateway</div>
                  <div class="text-[10px] text-[#666970] mt-0.5">Webhook HMAC Verified</div>
                </div>
              </div>

              <!-- Main Detail Area -->
              <div class="col-span-12 md:col-span-9 p-6 bg-[#121316] flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-4 border-b border-[#22232a] pb-4">
                    <div class="flex items-center space-x-3">
                      <span class="text-amber-400 font-mono font-medium">ORD-8921</span>
                      <span class="text-white font-semibold text-sm">Spotify Premium 1 Bulan</span>
                      <span class="bg-[#22232a] text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono">PAID & FULFILLED</span>
                    </div>
                    <div class="flex items-center space-x-3 text-[#8a8f98]">
                      <span class="text-xs font-mono">&lt; 1.2s Delivery</span>
                    </div>
                  </div>

                  <div class="space-y-3 mb-6">
                    <div class="p-4 rounded-xl bg-[#0e0f12] border border-[#22232a] space-y-2">
                      <div class="text-[#8a8f98] text-[11px] uppercase font-mono tracking-wider">Automated Delivery Payload</div>
                      <div class="font-mono text-xs text-gray-200 bg-[#0a0a0c] p-3 rounded border border-[#1d1f27]">
                        📧 Email: bintang.spot.wa99@gmail.com<br>
                        🔑 Pass: SPOT-PREM-PASS-2026<br>
                        📝 Catatan: Login langsung di aplikasi Spotify resmi.
                      </div>
                    </div>

                    <div class="grid grid-cols-3 gap-3">
                      <div class="p-3 rounded-lg bg-[#0e0f12] border border-[#22232a]">
                        <span class="text-[#666970] block text-[10px] uppercase font-mono">Channel Source</span>
                        <span class="text-white font-medium text-xs mt-0.5 block">WhatsApp (+62 857-9752-0135)</span>
                      </div>
                      <div class="p-3 rounded-lg bg-[#0e0f12] border border-[#22232a]">
                        <span class="text-[#666970] block text-[10px] uppercase font-mono">Settlement Method</span>
                        <span class="text-white font-medium text-xs mt-0.5 block">QRIS Real-Time (Rp 19.000)</span>
                      </div>
                      <div class="p-3 rounded-lg bg-[#0e0f12] border border-[#22232a]">
                        <span class="text-[#666970] block text-[10px] uppercase font-mono">Stock Remaining</span>
                        <span class="text-white font-medium text-xs mt-0.5 block">24 Units Available</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="border-t border-[#22232a] pt-4 flex items-center justify-between text-[#8a8f98]">
                  <span>System status: <span class="text-emerald-400">All systems operational</span></span>
                  <a href="#admin" class="text-white hover:underline flex items-center space-x-1">
                    <span>Buka Seller Dashboard</span>
                    <i class="fas fa-arrow-right text-[10px]"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SYSTEM WORKFLOW (Voiceflow Structure) -->
      <section id="workflow" class="py-24 border-t border-[#22232a] bg-[#0c0d10]">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Bagaimana Sistem Jualan Berjalan
            </h2>
            <p class="text-[#8a8f98] text-base sm:text-lg">
              Tiga langkah dari pendaftaran sampai tokomu berjalan otomatis penuh.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-[#121316] border border-[#22232a] rounded-2xl p-6 flex flex-col justify-between card-hover">
              <div>
                <div class="w-10 h-10 rounded-xl bg-[#1c1e24] border border-[#2b2d36] text-white font-mono font-bold flex items-center justify-center mb-6 text-sm">
                  01
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">Pilih Template & Input Produk</h3>
                <p class="text-sm text-[#8a8f98] leading-relaxed">
                  Pilih template toko sesuai spesialisasi produkmu. Masukkan daftar produk dan stok akun, lisensi, atau kode voucher ke database via dashboard.
                </p>
              </div>
            </div>

            <div class="bg-[#121316] border border-[#22232a] rounded-2xl p-6 flex flex-col justify-between card-hover">
              <div>
                <div class="w-10 h-10 rounded-xl bg-[#1c1e24] border border-[#2b2d36] text-white font-mono font-bold flex items-center justify-center mb-6 text-sm">
                  02
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">Tautkan WhatsApp & Telegram</h3>
                <p class="text-sm text-[#8a8f98] leading-relaxed">
                  Cukup scan QR Code WhatsApp dari HP kamu atau masukkan token bot Telegram bisnismu. Engine multi-device langsung aktif mengambil alih interaksi chat.
                </p>
              </div>
            </div>

            <div class="bg-[#121316] border border-[#22232a] rounded-2xl p-6 flex flex-col justify-between card-hover">
              <div>
                <div class="w-10 h-10 rounded-xl bg-[#1c1e24] border border-[#2b2d36] text-white font-mono font-bold flex items-center justify-center mb-6 text-sm">
                  03
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">Cuan Masuk, Kredensial Terkirim</h3>
                <p class="text-sm text-[#8a8f98] leading-relaxed">
                  Pembeli checkout via QRIS. Begitu mutasi terkonfirmasi oleh gateway Tipzy, akun/lisensi langsung dikirim ke chat pembeli seketika.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TEMPLATES STORE (Exact styling from RAYCAST.txt lines 135-200) -->
      <section id="templates" class="py-24 border-t border-[#22232a] bg-[#050507]">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-2xl mx-auto mb-10">
            <h2 class="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">Store</h2>
            <p class="text-zinc-400 text-base sm:text-lg mb-8 font-normal">
              Browse and clone pre-built digital commerce templates for your bots and storefronts.
            </p>

            <!-- Search Bar from Raycast -->
            <div class="glass-input rounded-2xl p-1.5 flex items-center shadow-2xl transition-all max-w-2xl mx-auto mb-8">
              <span class="pl-3.5 pr-2 text-zinc-400"><i class="fa-solid fa-magnifying-glass"></i></span>
              <input type="text" id="tpl-search-input" placeholder="Search templates..." class="w-full bg-transparent border-none text-white placeholder-zinc-500 focus:outline-none text-sm py-2">
              <div class="flex items-center space-x-1 pr-2 text-xs text-zinc-400 font-mono">
                <kbd class="bg-zinc-800/80 border border-zinc-700/60 px-2 py-1 rounded-md text-zinc-300">⌘</kbd>
                <kbd class="bg-zinc-800/80 border border-zinc-700/60 px-2 py-1 rounded-md text-zinc-300">K</kbd>
              </div>
            </div>

            <!-- Filter Pills from Raycast -->
            <div class="flex flex-wrap items-center justify-center gap-2 mb-12">
              ${[
                { id: 'all', label: 'All Templates' },
                { id: 'streaming', label: 'Streaming' },
                { id: 'game', label: 'Gaming Vouchers' },
                { id: 'software', label: 'Software License' },
                { id: 'custom', label: 'Bespoke' },
              ]
                .map(
                  (c) => `
                <button type="button" 
                        class="btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          activeCategoryFilter === c.id
                            ? 'bg-zinc-200 text-black font-semibold'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }"
                        data-cat="${c.id}">
                  ${c.label}
                </button>
              `,
                )
                .join('')}
            </div>
          </div>

          <!-- Cards Grid (Exact Raycast Card structure) -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="tpl-cards-grid">
            ${renderTemplateCards()}
          </div>
        </div>
      </section>

      <!-- PRICING SECTION (Exact match to resend pricing.txt lines 70-200) -->
      <section id="pricing" class="py-24 border-t border-[#1f1f1f] bg-[#0a0a0a]">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">Pricing</h2>
            <p class="text-[#888] text-base sm:text-lg mb-8">Start simple and scale as you grow. Sewa bulanan tetap tanpa potongan per transaksi.</p>
            
            <!-- Resend Pricing Switcher -->
            <div class="inline-flex p-1 bg-[#141414] border border-[#262626] rounded-full text-xs sm:text-sm font-medium mb-10">
              <button id="btn-billing-monthly" type="button" class="px-5 py-1.5 rounded-full transition ${
                billingCycle === 'monthly' ? 'bg-[#262626] text-white shadow' : 'text-[#888] hover:text-white'
              }">
                Sewa Bulanan
              </button>
              <button id="btn-billing-yearly" type="button" class="px-5 py-1.5 rounded-full transition ${
                billingCycle === 'yearly' ? 'bg-[#262626] text-white shadow' : 'text-[#888] hover:text-white'
              }">
                Tahunan (Hemat 20%)
              </button>
            </div>
          </div>

          <!-- 3 Pricing Cards (Exact Resend Card HTML Structure) -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            
            <!-- Card 1: Starter -->
            <div class="bg-[#0f0f0f] border border-[#222] rounded-2xl p-6 flex flex-col justify-between hover:border-[#333] transition relative">
              <div>
                <h3 class="text-white font-semibold text-lg mb-2">Starter</h3>
                <div class="flex items-baseline mb-4">
                  <span class="text-4xl font-bold tracking-tight text-white" id="price-starter">
                    ${billingCycle === 'monthly' ? 'Rp 49.000' : 'Rp 39.000'}
                  </span>
                  <span class="text-[#888] ml-1 text-sm">/ mo</span>
                </div>
                <div class="border-t border-[#222] pt-4 mb-6">
                  <div class="text-white font-medium text-sm">Template Mudah & Praktis</div>
                  <div class="text-[#666] text-xs mt-0.5">Setup instan tanpa repot</div>
                </div>
                <ul class="space-y-3 text-sm text-[#bbb] mb-8">
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> 1 Bot Telegram Toko Resmi</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Web Store Digital Minimal</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Maksimal 15 Produk Digital</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Tipzy QRIS Gateway Otomatis</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Auto-Fulfillment Akun/Voucher</li>
                  <li class="flex items-center gap-3 text-[#555]"><i class="fa-regular fa-circle-xmark text-xs"></i> WhatsApp Multi-Device</li>
                </ul>
              </div>
              <button type="button" class="btn-select-plan w-full py-2.5 rounded-full bg-[#1c1c1c] hover:bg-[#262626] text-white text-sm font-medium text-center transition border border-[#2a2a2a]" data-plan="starter">
                Pilih Starter
              </button>
            </div>

            <!-- Card 2: Pro (Featured) -->
            <div class="bg-[#0f0f0f] border border-[#333] ring-1 ring-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-[#444] transition relative shadow-2xl">
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-white text-black font-mono text-[10px] font-bold tracking-wider uppercase">
                POPULAR
              </div>
              <div>
                <h3 class="text-white font-semibold text-lg mb-2">Pro Dual Bot</h3>
                <div class="flex items-baseline mb-4">
                  <span class="text-4xl font-bold tracking-tight text-white" id="price-pro">
                    ${billingCycle === 'monthly' ? 'Rp 99.000' : 'Rp 79.000'}
                  </span>
                  <span class="text-[#888] ml-1 text-sm">/ mo</span>
                </div>
                <div class="border-t border-[#222] pt-4 mb-6">
                  <div class="text-white font-medium text-sm">WhatsApp + Telegram Sekaligus</div>
                  <div class="text-[#666] text-xs mt-0.5">Multi-Device QR Pairing Live</div>
                </div>
                <ul class="space-y-3 text-sm text-[#bbb] mb-8">
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> <b>WhatsApp Bot Multi-Device Live</b></li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> <b>Telegram Bot Toko 24 Jam</b></li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> <b>Smart Human Takeover (Mute saat CS)</b></li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Unlimited Produk & Kategori</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Seller Dashboard Linear-Style</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Notifikasi Penjualan ke Telegram</li>
                </ul>
              </div>
              <button type="button" class="btn-select-plan w-full py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black text-sm font-medium text-center transition shadow-sm" data-plan="pro">
                Sewa Paket Pro
              </button>
            </div>

            <!-- Card 3: Enterprise -->
            <div class="bg-[#0f0f0f] border border-[#222] rounded-2xl p-6 flex flex-col justify-between hover:border-[#333] transition relative">
              <div>
                <h3 class="text-white font-semibold text-lg mb-2">Enterprise</h3>
                <div class="flex items-baseline mb-4">
                  <span class="text-4xl font-bold tracking-tight text-white" id="price-enterprise">
                    ${billingCycle === 'monthly' ? 'Rp 249.000' : 'Rp 199.000'}
                  </span>
                  <span class="text-[#888] ml-1 text-sm">/ mo</span>
                </div>
                <div class="border-t border-[#222] pt-4 mb-6">
                  <div class="text-white font-medium text-sm">Full Custom & Berat</div>
                  <div class="text-[#666] text-xs mt-0.5">Dedicated infrastructure</div>
                </div>
                <ul class="space-y-3 text-sm text-[#bbb] mb-8">
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Semua Fitur Paket Pro</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Custom Domain (.com / .id)</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Multi-Admin Telegram (Tim CS)</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> White-label (Hapus Watermark)</li>
                  <li class="flex items-center gap-3"><i class="fa-regular fa-circle-check text-white text-xs"></i> Dedicated Server SLA 99.9%</li>
                </ul>
              </div>
              <button type="button" class="btn-select-plan w-full py-2.5 rounded-full bg-[#1c1c1c] hover:bg-[#262626] text-white text-sm font-medium text-center transition border border-[#2a2a2a]" data-plan="enterprise">
                Konsultasi Custom
              </button>
            </div>
          </div>

          <!-- RESEND ADD-ONS SECTION -->
          <div class="max-w-3xl mx-auto bg-[#0f0f0f] border border-[#222] rounded-2xl p-6 sm:p-8">
            <h3 class="text-white font-semibold text-lg mb-2">Add-ons</h3>
            <p class="text-[#888] text-sm mb-6">Tambahkan kapasitas nomor atau modul khusus untuk tokomu.</p>

            <div class="space-y-3" id="addons-checklist">
              <label class="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#222] hover:border-[#333] transition cursor-pointer">
                <div class="flex items-center space-x-3">
                  <input type="checkbox" class="chk-addon w-4 h-4 rounded bg-[#1c1c1c] border-[#333] text-white focus:ring-0" data-id="extra_wa" data-price="30000">
                  <div>
                    <div class="text-white text-sm font-medium">Slot Nomor WhatsApp Cadangan</div>
                    <div class="text-[#666] text-xs">Hubungkan nomor WhatsApp kedua untuk rotasi CS</div>
                  </div>
                </div>
                <span class="font-mono text-xs text-white">+Rp 30.000 / mo</span>
              </label>

              <label class="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#222] hover:border-[#333] transition cursor-pointer">
                <div class="flex items-center space-x-3">
                  <input type="checkbox" class="chk-addon w-4 h-4 rounded bg-[#1c1c1c] border-[#333] text-white focus:ring-0" data-id="custom_domain" data-price="25000">
                  <div>
                    <div class="text-white text-sm font-medium">Custom Domain (.web.id / .com)</div>
                    <div class="text-[#666] text-xs">Gunakan alamat website toko milikmu sendiri</div>
                  </div>
                </div>
                <span class="font-mono text-xs text-white">+Rp 25.000 / mo</span>
              </label>

              <label class="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#222] hover:border-[#333] transition cursor-pointer">
                <div class="flex items-center space-x-3">
                  <input type="checkbox" class="chk-addon w-4 h-4 rounded bg-[#1c1c1c] border-[#333] text-white focus:ring-0" data-id="whitelabel" data-price="35000">
                  <div>
                    <div class="text-white text-sm font-medium">White-Label Penuh</div>
                    <div class="text-[#666] text-xs">Hapus branding Bintang Tech di seluruh struk & chat</div>
                  </div>
                </div>
                <span class="font-mono text-xs text-white">+Rp 35.000 / mo</span>
              </label>
            </div>

            <div class="mt-8 pt-6 border-t border-[#222] flex items-center justify-between">
              <div>
                <span class="text-xs text-[#888] block">Estimasi Total</span>
                <span class="text-xl font-bold text-white font-mono" id="lbl-total-estimate">Rp 99.000 / mo</span>
              </div>
              <button id="btn-addons-checkout" type="button" class="bg-white hover:bg-gray-100 text-black text-sm font-medium px-5 py-2.5 rounded-full transition shadow-sm">
                Lanjut ke Registrasi
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ SECTION -->
      <section id="faq" class="py-24 border-t border-[#1f1f1f] bg-[#0c0d10]">
        <div class="max-w-4xl mx-auto px-6">
          <div class="text-center mb-16">
            <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">Frequently Asked Questions</h2>
            <p class="text-[#8a8f98] text-base">Pertanyaan umum seputar operasional bot Bintang Tech.</p>
          </div>

          <div class="space-y-4">
            <div class="p-6 rounded-2xl bg-[#121316] border border-[#22232a] space-y-2">
              <h4 class="font-semibold text-base text-white">Apakah saya harus bisa coding?</h4>
              <p class="text-sm text-[#8a8f98] leading-relaxed">
                Sama sekali tidak. Kamu cukup login ke dashboard seller atau lewat bot Telegram Admin untuk memasukkan nama produk, harga, dan stok akun/voucher kamu.
              </p>
            </div>

            <div class="p-6 rounded-2xl bg-[#121316] border border-[#22232a] space-y-2">
              <h4 class="font-semibold text-base text-white">Ke mana uang hasil penjualan masuk?</h4>
              <p class="text-sm text-[#8a8f98] leading-relaxed">
                Uang masuk langsung ke rekening bank atau e-wallet kamu sendiri melalui gateway QRIS resmi (Tipzy). Bintang Tech tidak memotong bagi hasil penjualanmu.
              </p>
            </div>

            <div class="p-6 rounded-2xl bg-[#121316] border border-[#22232a] space-y-2">
              <h4 class="font-semibold text-base text-white">Bagaimana jika ada pembeli yang butuh bantuan CS?</h4>
              <p class="text-sm text-[#8a8f98] leading-relaxed">
                Bot dilengkapi fitur <b>Smart Human Takeover</b>. Saat pembeli mengetik "BANTUAN" atau "CS", bot Telegram admin akan berbunyi dan memberikan link langsung ke chat pembeli di WhatsApp. Bot otomatis di-mute selama 15 menit agar kamu bisa membalas manual dengan bebas.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER (Exact from LINEAR.txt / RESEND.txt) -->
      <footer class="border-t border-[#1f1f1f] bg-[#050507] py-12">
        <div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-[#8a8f98]">
          <div class="flex items-center space-x-3">
            <span class="text-white font-semibold">Bintang Tech</span>
            <span>·</span>
            <span>The product development system for digital commerce</span>
          </div>
          <div class="flex items-center space-x-6">
            <a href="#admin" class="hover:text-white transition-colors">Seller Dashboard</a>
            <a href="#webapp" class="hover:text-white transition-colors">Web Store</a>
            <span class="text-[#555]">© 2026 Bintang Tech Studio</span>
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
      t.description.toLowerCase().includes(searchQuery);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    return `
      <div class="col-span-full p-12 text-center rounded-2xl bg-[#121215] border border-zinc-800/80">
        <p class="text-sm text-zinc-400">Tidak ada template yang cocok.</p>
        <button id="btn-reset-filter" class="mt-3 text-xs text-white font-medium hover:underline">Reset Filter</button>
      </div>
    `;
  }

  // Exact Raycast Card Structure from RAYCAST.txt lines 167-200
  return filtered
    .map(
      (t) => `
    <div class="bg-[#121215] border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between card-hover relative group">
      <div>
        <div class="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
          <span class="font-mono text-sm text-zinc-200 font-bold">${t.iconText}</span>
        </div>
        <div class="flex items-center justify-between mb-1.5">
          <h4 class="text-lg font-semibold text-white">${escapeHtml(t.name)}</h4>
          <span class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">${t.badge}</span>
        </div>
        <p class="text-zinc-400 text-sm leading-relaxed mb-6">${escapeHtml(t.description)}</p>
      </div>

      <div>
        <div class="flex items-center space-x-2.5 mb-5">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="text-xs text-zinc-300 font-medium">${t.author}</span>
        </div>
        <button type="button" class="btn-choose-template w-full bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 border border-zinc-700/60 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-sm" data-id="${t.id}" data-tier="${t.tier}">
          Pilih Template
        </button>
      </div>
    </div>
  `,
    )
    .join('');
}

export function initLandingEvents() {
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
      btnMonthly.className = 'px-5 py-1.5 rounded-full transition bg-[#262626] text-white shadow';
      btnYearly.className = 'px-5 py-1.5 rounded-full transition text-[#888] hover:text-white';
      updatePricingDisplay();
    });

    btnYearly.addEventListener('click', () => {
      billingCycle = 'yearly';
      btnYearly.className = 'px-5 py-1.5 rounded-full transition bg-[#262626] text-white shadow';
      btnMonthly.className = 'px-5 py-1.5 rounded-full transition text-[#888] hover:text-white';
      updatePricingDisplay();
    });
  }

  const updateAddonTotal = () => {
    let basePrice = billingCycle === 'monthly' ? 99000 : 79000;
    selectedAddons.forEach((cost) => {
      basePrice += cost;
    });
    const lblEstimate = document.getElementById('lbl-total-estimate');
    if (lblEstimate) {
      lblEstimate.textContent = `${formatRupiah(basePrice)} / mo`;
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
        b.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800/50';
      });
      btn.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-200 text-black font-semibold';
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
          b.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-200 text-black font-semibold';
        } else {
          b.className = 'btn-tpl-filter px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800/50';
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

