// Bintang Tech Studio — Pure Linear Experience
// Replicated from C:\BOT_WEB\Patokan contoh animasi home bintang.txt
// Complete with Staggered Blur-In, Mega-Menu Dropdowns, Interactive View Switching & Linear App Mockup

import { store } from '../state/store.js';
import { formatRupiah } from '../utils/currency.js';
import { escapeHtml } from '../utils/helpers.js';
import { openAuthModal } from '../components/auth-modal.js';

let activeLandingTab = 'home'; // 'home' | 'features' | 'customers' | 'pricing' | 'contact'
let activeFeatureChannel = 'miniapp'; // 'miniapp' | 'telegram_bot' | 'telegram_admin' | 'whatsapp'
let customerFilter = 'Featured';
let billingYearly = true;

const LINEAR_LOGO_SVG = `<svg class="w-[18px] h-[18px]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 0C22.3858 0 0 22.3858 0 50C0 53.658 0.392822 57.2244 1.1391 60.6591L39.3409 98.8609C42.7756 99.6072 46.342 100 50 100C77.6142 100 100 77.6142 100 50C100 22.3858 77.6142 0 50 0ZM5.36212 73.1167C8.11346 78.4193 11.7973 83.1539 16.2121 87.1194L12.8806 83.7879C16.8461 88.2027 21.5807 91.8865 26.8833 94.6379L5.36212 73.1167ZM3.1066 66.8548L33.1452 96.8934C30.4071 95.9082 27.7819 94.6776 25.2927 93.2249L6.77508 74.7073C5.32239 72.2181 4.0918 69.5929 3.1066 66.8548ZM0.320892 55.7024C0.108276 53.8339 0 51.9298 0 50C0 47.4194 0.195557 44.8837 0.572754 42.4075L57.5925 99.4272C55.1163 99.8044 52.5806 100 50 100C48.0702 100 46.1661 99.8917 44.2976 99.6791L0.320892 55.7024ZM2.50153 33.7603C3.58813 30.5831 5.00879 27.5629 6.72302 24.7393L75.2607 93.277C72.4371 94.9912 69.4169 96.4119 66.2397 97.4985L2.50153 33.7603ZM11.7209 17.8551C14.1837 14.9225 16.9685 12.2756 20.022 9.96729L90.0327 79.978C87.7244 83.0315 85.0775 85.8163 82.1449 88.2791L11.7209 17.8551Z" fill="currentColor"/>
</svg>`;

const CUSTOMER_STORIES = [
  {
    id: 'story_ramp',
    category: 'streaming',
    tag: 'STREAMING MERCHANT',
    title: "The coding agent behind 75% of Ramp's merged PRs",
    subtitle:
      'Toko digital streaming mengotomasi 100% verifikasi mutasi QRIS dan serah-terima akun privat tanpa jeda.',
    metric: '1.1s',
    metricLabel: 'Average delivery latency',
    ctaText: 'Read story →',
    badge: 'POPULAR',
    logoSvg: `<svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>`,
  },
  {
    id: 'story_openai',
    category: 'gaming',
    tag: 'GAMING VOUCHERS',
    title: 'Why Top-Up stores chose Bintang Tech and scaled to 3,000+ buyers',
    subtitle:
      'Pengiriman serial voucher MLBB & Free Fire otomatis dengan validasi User ID & Server ID secara real-time.',
    metric: '99.9%',
    metricLabel: 'Settlement reliability',
    ctaText: 'Read story →',
    badge: 'ENTERPRISE',
    logoSvg: `<svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  },
  {
    id: 'story_coinbase',
    category: 'software',
    tag: 'SOFTWARE LICENSES',
    title: 'Zero-touch digital delivery for retail software licenses and cloud keys',
    subtitle:
      'Sistem single-use pool mengisolasi serial key Windows 11 & Office agar tidak tumpang tindih antar pembeli.',
    metric: '0',
    metricLabel: 'Manual chat required',
    ctaText: 'Read story →',
    badge: 'AUTOMATED',
    logoSvg: `<svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/></svg>`,
  },
];

export function renderLandingPage() {
  const hash = window.location.hash || '';
  if (hash.includes('features') || hash.includes('channels') || hash.includes('bot')) {
    activeLandingTab = 'features';
  } else if (hash.includes('customers')) {
    activeLandingTab = 'customers';
  } else if (hash.includes('pricing')) {
    activeLandingTab = 'pricing';
  } else if (hash.includes('contact')) {
    activeLandingTab = 'contact';
  } else if (hash === '#landing' || hash === '' || hash === '#') {
    activeLandingTab = 'home';
  }

  return `
    <div class="min-h-screen bg-[#08090A] text-[#F7F8F8] font-sans antialiased selection:bg-[#5E6AD2]/30 overflow-x-hidden relative">
      
      <!-- Linear Header Glow Effect -->
      <div class="glow-effect absolute top-0 left-0 right-0 h-[650px] pointer-events-none -z-0"></div>
      
      <!-- Linear 40px Grid Pattern -->
      <div class="grid-pattern absolute inset-0 pointer-events-none opacity-40 -z-0"></div>

      <!-- --- STICKY NAVBAR (Pure Linear Experience adapted for Bintang Tech) --- -->
      <header
        id="linear-navbar"
        class="sticky top-0 z-50 h-[56px] bg-[#08090A]/80 backdrop-blur-md border-b border-white/[0.06] transition-colors"
      >
        <div class="max-w-[1120px] h-full mx-auto px-6 flex items-center justify-between relative">
          <!-- Logo & Brand -->
          <button
            id="nav-brand"
            type="button"
            class="flex items-center gap-2.5 text-[#F7F8F8] hover:opacity-90 transition-opacity"
          >
            <div class="w-4 h-4 rounded-full bg-gradient-to-tr from-[#5E6AD2] to-indigo-400 flex items-center justify-center shadow-sm">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
            <span class="font-semibold text-[14px] tracking-[-0.02em]">Bintang Tech</span>
          </button>

          <!-- Nav Items & Actions -->
          <div class="flex items-center gap-1">
            <nav class="flex items-center gap-1 mr-3">
              <!-- Dropdown Trigger: Product -->
              <div id="nav-dropdown-product-wrap" class="relative">
                <button
                  id="btn-nav-product"
                  type="button"
                  class="px-3 py-1.5 rounded-md text-[13px] transition-colors text-[#8A8F98] hover:text-[#F7F8F8]"
                >
                  Product
                </button>
              </div>

              <!-- Dropdown Trigger: Resources -->
              <div id="nav-dropdown-resources-wrap" class="relative">
                <button
                  id="btn-nav-resources"
                  type="button"
                  class="px-3 py-1.5 rounded-md text-[13px] transition-colors text-[#8A8F98] hover:text-[#F7F8F8]"
                >
                  Resources
                </button>
              </div>

              <button
                id="btn-nav-features"
                type="button"
                class="btn-nav-link px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  activeLandingTab === 'features'
                    ? 'text-[#F7F8F8] bg-white/[0.06]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }"
                data-tab="features"
              >
                Features
              </button>

              <button
                id="btn-nav-customers"
                type="button"
                class="btn-nav-link px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  activeLandingTab === 'customers'
                    ? 'text-[#F7F8F8] bg-white/[0.06]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }"
                data-tab="customers"
              >
                Customers
              </button>

              <button
                id="btn-nav-pricing"
                type="button"
                class="btn-nav-link px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  activeLandingTab === 'pricing'
                    ? 'text-[#F7F8F8] bg-white/[0.06]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }"
                data-tab="pricing"
              >
                Pricing
              </button>

              <a
                href="#admin"
                class="px-3 py-1.5 rounded-md text-[13px] transition-colors text-[#8A8F98] hover:text-[#F7F8F8]"
              >
                Workspace
              </a>

              <button
                id="btn-nav-contact"
                type="button"
                class="btn-nav-link px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  activeLandingTab === 'contact'
                    ? 'text-[#F7F8F8] bg-white/[0.06]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }"
                data-tab="contact"
              >
                Contact
              </button>
            </nav>

            <div class="h-3.5 w-[1px] bg-white/[0.1] mx-2"></div>

            <div class="flex items-center gap-2 pl-1">
              <button
                id="btn-top-login"
                type="button"
                class="px-2.5 py-1.5 text-[13px] text-[#8A8F98] hover:text-[#F7F8F8] transition-colors"
              >
                Log in
              </button>
              <button
                id="btn-top-signup"
                type="button"
                class="px-3 py-1 bg-[#F7F8F8] hover:bg-white text-[#08090A] font-medium text-[13px] rounded-md transition-colors shadow-sm"
              >
                Sign up
              </button>
            </div>
          </div>

          <!-- MEGA MENU DROPDOWN: PRODUCT (from Patokan lines 280-366) -->
          <div
            id="mega-dropdown-product"
            class="dropdown-menu-enter absolute top-[52px] right-[120px] bg-[#0F1012]/95 backdrop-blur-2xl border border-white/[0.09] rounded-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] overflow-hidden w-[680px] z-50"
          >
            <div>
              <div class="grid grid-cols-12">
                <!-- Left 2 Columns -->
                <div class="col-span-8 p-6 grid grid-cols-2 gap-x-6 gap-y-6">
                  <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="features">
                    <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                      Intake & Channels
                    </div>
                    <p class="text-[12.5px] leading-[1.45] text-[#8A8F98] group-hover:text-[#B4B8C0] transition-colors">
                      Bring customer requests in from WhatsApp Multi-Device and Telegram Bot
                    </p>
                  </div>

                  <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="features">
                    <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                      AI and automations
                    </div>
                    <p class="text-[12.5px] leading-[1.45] text-[#8A8F98] group-hover:text-[#B4B8C0] transition-colors">
                      Agents that follow order from buyer conversation to QRIS settlement
                    </p>
                  </div>

                  <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="features">
                    <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                      Plan and monitor
                    </div>
                    <p class="text-[12.5px] leading-[1.45] text-[#8A8F98] group-hover:text-[#B4B8C0] transition-colors">
                      Set digital product inventory and follow stock levels in real-time
                    </p>
                  </div>

                  <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="features">
                    <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                      Zero-click fulfillment
                    </div>
                    <p class="text-[12.5px] leading-[1.45] text-[#8A8F98] group-hover:text-[#B4B8C0] transition-colors">
                      Deliver streaming accounts, licenses, and voucher codes instantly
                    </p>
                  </div>
                </div>

                <!-- Right Column -->
                <div class="col-span-4 bg-[#0B0C0E]/70 border-l border-white/[0.06] p-6 flex flex-col justify-between space-y-3.5">
                  <div class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer btn-goto-tab" data-tab="features">
                    Integration directory
                  </div>
                  <div class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer btn-goto-tab" data-tab="features">
                    Tipzy QRIS Settlement
                  </div>
                  <div class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer btn-goto-tab" data-tab="features">
                    Smart Human Takeover
                  </div>
                  <div class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer btn-goto-tab" data-tab="contact">
                    System Security
                  </div>
                </div>
              </div>

              <!-- Bottom Banner -->
              <div class="px-6 py-3 bg-[#0A0B0D] border-t border-white/[0.06] flex items-center justify-between text-[12.5px]">
                <div>
                  <span class="text-[#F7F8F8] font-medium mr-1.5">New:</span>
                  <span class="text-[#8A8F98]">15-minute Smart Human Takeover for CS</span>
                </div>
                <button class="text-[#8A8F98] hover:text-[#F7F8F8] flex items-center gap-1 transition-colors btn-goto-tab" data-tab="features">
                  Learn more <span class="text-[11px]">→</span>
                </button>
              </div>
            </div>
          </div>

          <!-- MEGA MENU DROPDOWN: RESOURCES (from Patokan lines 368-422) -->
          <div
            id="mega-dropdown-resources"
            class="dropdown-menu-enter absolute top-[52px] right-[120px] bg-[#0F1012]/95 backdrop-blur-2xl border border-white/[0.09] rounded-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] overflow-hidden w-[640px] z-50"
          >
            <div class="grid grid-cols-12">
              <div class="col-span-8 p-6 grid grid-cols-2 gap-x-6 gap-y-6">
                <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="customers">
                  <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                    About
                  </div>
                  <p class="text-[12.5px] leading-[1.45] text-[#8A8F98]">
                    Meet the vision behind Bintang Tech Studio
                  </p>
                </div>

                <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="contact">
                  <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                    Docs & Guides
                  </div>
                  <p class="text-[12.5px] leading-[1.45] text-[#8A8F98]">
                    Learn how to pair WhatsApp & Telegram bots
                  </p>
                </div>

                <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="pricing">
                  <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                    Templates
                  </div>
                  <p class="text-[12.5px] leading-[1.45] text-[#8A8F98]">
                    Clone pre-built digital storefronts
                  </p>
                </div>

                <div class="group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/[0.04] transition-colors btn-goto-tab" data-tab="contact">
                  <div class="text-[13px] font-medium text-[#F7F8F8] mb-1">
                    Developers
                  </div>
                  <p class="text-[12.5px] leading-[1.45] text-[#8A8F98]">
                    Webhooks, Tipzy API, and Supabase RLS
                  </p>
                </div>
              </div>

              <div class="col-span-4 bg-[#0B0C0E]/70 border-l border-white/[0.06] p-6 flex flex-col justify-between space-y-3.5">
                <a href="#webapp" class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer">
                  Customer WebApp
                </a>
                <a href="#admin" class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer">
                  Seller Dashboard
                </a>
                <a href="https://t.me/BintangDigitalDemoBot" target="_blank" class="text-[13px] font-medium text-[#F7F8F8] hover:text-white cursor-pointer">
                  Telegram Bot Demo
                </a>
                <div class="text-[13px] font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer">
                  🟢 System Status
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- --- DYNAMIC TAB VIEW TARGET --- -->
      <main id="linear-tab-content">
        ${renderTabContent()}
      </main>

    </div>
  `;
}

function renderTabContent() {
  switch (activeLandingTab) {
    case 'features':
      return renderFeaturesView();
    case 'customers':
      return renderCustomersView();
    case 'pricing':
      return renderPricingView();
    case 'contact':
      return renderContactView();
    default:
      return renderHomeView();
  }
}

// ==================== FEATURES / CHANNELS SHOWCASE VIEW ====================
function renderFeaturesView() {
  const channels = [
    { id: 'miniapp', label: 'Telegram Mini App (Store)' },
    { id: 'telegram_bot', label: 'Telegram Bot Toko' },
    { id: 'telegram_admin', label: 'Telegram Admin Assistant' },
    { id: 'whatsapp', label: 'WhatsApp Multi-Device' },
  ];

  return `
    <section class="max-w-[1120px] mx-auto px-6 pt-16 pb-24">
      <div class="max-w-3xl mx-auto text-center mb-10">
        <h1 class="text-[44px] sm:text-[50px] font-medium tracking-[-0.03em] text-[#F7F8F8] mb-4 leading-tight">
          Omnichannel Autonomous Channels
        </h1>
        <p class="text-[#8A8F98] text-[15px] sm:text-[16px] max-w-2xl mx-auto leading-relaxed">
          Simulasi interaktif channel transaksi toko digital. Pilih channel di bawah untuk melihat bagaimana pembeli dan admin berinteraksi secara otomatis.
        </p>

        <!-- Channel Filter Tabs -->
        <div class="flex flex-wrap items-center justify-center gap-2 mt-8">
          ${channels
            .map(
              (ch) => `
            <button
              type="button"
              class="btn-channel-select px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
                activeFeatureChannel === ch.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-[#101114] text-[#8A8F98] hover:text-white border border-white/[0.08]'
              }"
              data-channel="${ch.id}"
            >
              ${ch.label}
            </button>
          `,
            )
            .join('')}
        </div>
      </div>

      <!-- Active Channel View -->
      <div class="max-w-4xl mx-auto bg-[#101114] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        ${renderActiveChannelContent()}
      </div>

      <!-- 3 Key Features Bento Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-8">
        <div class="p-6 rounded-xl bg-[#0D0E10] border border-white/[0.08] space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white text-xs font-mono font-bold">
            ⚡
          </div>
          <h3 class="font-medium text-sm text-white">Zero-Click Fulfillment</h3>
          <p class="text-xs text-[#8A8F98] leading-relaxed">
            Kredensial akun, kode voucher, dan lisensi software langsung terkirim dalam &lt; 1.1 detik setelah pembayaran QRIS diverifikasi.
          </p>
        </div>

        <div class="p-6 rounded-xl bg-[#0D0E10] border border-white/[0.08] space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white text-xs font-mono font-bold">
            🛡️
          </div>
          <h3 class="font-medium text-sm text-white">Smart Human Takeover</h3>
          <p class="text-xs text-[#8A8F98] leading-relaxed">
            Saat pembeli minta bantuan CS, bot otomatis di-mute 15 menit dan sistem langsung mengirimkan link direct chat ke Telegram admin.
          </p>
        </div>

        <div class="p-6 rounded-xl bg-[#0D0E10] border border-white/[0.08] space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white text-xs font-mono font-bold">
            📊
          </div>
          <h3 class="font-medium text-sm text-white">Real-Time Stock Pool</h3>
          <p class="text-xs text-[#8A8F98] leading-relaxed">
            Stok 36 produk terpusat dan sinkron secara real-time. Tidak ada risiko double-order atau over-selling antar channel.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderActiveChannelContent() {
  switch (activeFeatureChannel) {
    case 'telegram_bot':
      return `
        <div class="space-y-6">
          <div class="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h2 class="text-white font-medium text-base">Telegram Store Bot (@BintangDigitalDemoBot)</h2>
              <p class="text-xs text-[#8A8F98]">Bot toko resmi 24 jam dengan tombol inline katalog dan auto-fulfillment.</p>
            </div>
            <a href="https://t.me/BintangDigitalDemoBot" target="_blank" class="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition flex items-center gap-1.5">
              <span>Buka Bot Asli</span>
              <span>↗</span>
            </a>
          </div>

          <!-- Chat Simulator -->
          <div class="max-w-lg mx-auto bg-[#0C0D0F] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <div class="p-3.5 rounded-xl bg-[#16181D] border border-white/[0.06] text-xs space-y-2">
              <div class="font-medium text-[#A5B4FC]">🤖 Bintang Store Bot</div>
              <p class="text-gray-300">Selamat datang di Bintang Store! Toko produk digital otomatis 24 jam dengan garansi penuh.</p>
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button type="button" class="btn-channel-select p-2 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-[11px] font-mono text-center" data-channel="miniapp">
                  🛍️ Buka WebApp Toko
                </button>
                <button type="button" class="p-2 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-[11px] font-mono text-center">
                  📦 Cek Status Pesanan
                </button>
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-[#16181D] border border-white/[0.06] text-xs space-y-1.5 font-mono text-gray-300">
              <span class="text-[#8A8F98] text-[10px] block uppercase tracking-wider font-sans">Contoh Pesan Instan Pembeli</span>
              <div>Pembeli: "Mau beli Spotify 1 Bulan"</div>
              <div class="text-emerald-400">Bot: "Invoice QRIS Rp 19.000 dibuat. Menunggu pembayaran..."</div>
              <div class="text-[#A5B4FC]">Bot: "Pembayaran terkonfirmasi! Kredensial akun dikirimkan."</div>
            </div>
          </div>
        </div>
      `;

    case 'telegram_admin':
      return `
        <div class="space-y-6">
          <div class="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h2 class="text-white font-medium text-base">Telegram Admin Assistant</h2>
              <p class="text-xs text-[#8A8F98]">Asisten kontrol toko via command Telegram untuk cek stok, sales, dan pesanan.</p>
            </div>
            <a href="#telegram-admin" class="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition flex items-center gap-1.5">
              <span>Buka Full Simulator</span>
              <span>↗</span>
            </a>
          </div>

          <div class="max-w-lg mx-auto bg-[#0C0D0F] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <div class="p-3.5 rounded-xl bg-[#16181D] border border-white/[0.06] text-xs space-y-2">
              <div class="font-medium text-purple-300">⚡ Store Admin Bot</div>
              <p class="text-gray-300">Gunakan perintah berikut untuk memantau tokomu kapan saja:</p>
              <div class="space-y-1 font-mono text-[11px] text-[#A5B4FC]">
                <div><b class="text-amber-300">/stok</b> — Cek stok live seluruh produk</div>
                <div><b class="text-amber-300">/sales</b> — Ringkasan omset & pesanan hari ini</div>
                <div><b class="text-amber-300">/order BS-10231</b> — Detail mutasi dan kredensial</div>
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-[#16181D] border border-white/[0.06] text-xs font-mono text-gray-300 space-y-1">
              <span class="text-[#8A8F98] text-[10px] block uppercase tracking-wider font-sans">Live Query Result</span>
              <div>/stok</div>
              <div class="text-emerald-400">✓ Semua stok aman: 36 produk aktif, total 180 unit tersedia.</div>
            </div>
          </div>
        </div>
      `;

    case 'whatsapp':
      return `
        <div class="space-y-6">
          <div class="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h2 class="text-white font-medium text-base">WhatsApp Multi-Device Bot (+62 857-9752-0135)</h2>
              <p class="text-xs text-[#8A8F98]">Engine Baileys tanpa browser, auto-decrement stok, dan 15-menit smart muting untuk CS.</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              CONNECTED
            </span>
          </div>

          <div class="max-w-lg mx-auto bg-[#0C0D0F] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <div class="p-3.5 rounded-xl bg-[#16181D] border border-white/[0.06] text-xs space-y-2">
              <div class="font-medium text-emerald-400">📱 WhatsApp Business Engine</div>
              <p class="text-gray-300">Pelanggan cukup chat WhatsApp toko untuk melihat menu produk, menerima QRIS otomatis, dan mendapatkan akun tanpa campur tangan admin.</p>
            </div>

            <div class="p-3.5 rounded-xl bg-[#16181D] border border-white/[0.06] text-xs font-mono text-gray-300 space-y-2">
              <div class="text-[#8A8F98] text-[10px] uppercase tracking-wider font-sans">Simulasi Chat Pembeli</div>
              <div>💬 Pembeli: "Menu"</div>
              <div class="p-2.5 rounded bg-[#0C0D0F] border border-white/[0.06] text-[11px] leading-relaxed">
                🤖 Bot: Halo! Selamat datang di Bintang Store.<br>
                Ketik nomor pilihan:<br>
                [1] Katalog Produk<br>
                [2] Cara Pembayaran<br>
                [3] Bantuan CS
              </div>
              <div class="text-xs text-[#8A8F98]">Saat pembeli ketik [3], bot Telegram admin berbunyi dan bot otomatis di-mute 15 menit agar obrolan CS kamu tidak ditimpa bot.</div>
            </div>
          </div>
        </div>
      `;

    default: // 'miniapp'
      return `
        <div class="space-y-6">
          <div class="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h2 class="text-white font-medium text-base">Telegram Mini App (Customer WebApp)</h2>
              <p class="text-xs text-[#8A8F98]">Toko digital modern yang dibuka langsung di dalam Telegram tanpa instalasi aplikasi luar.</p>
            </div>
            <a href="#webapp" class="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition flex items-center gap-1.5">
              <span>Buka Layar Penuh</span>
              <span>↗</span>
            </a>
          </div>

          <!-- Smartphone Telegram Frame Container -->
          <div class="max-w-md mx-auto rounded-3xl border border-white/[0.12] bg-[#08090A] shadow-2xl overflow-hidden">
            <!-- Telegram App Window Header -->
            <div class="bg-[#17212B] px-4 py-3 border-b border-white/[0.06] flex items-center justify-between text-xs text-white select-none">
              <div class="flex items-center gap-2">
                <span class="text-[#8A8F98] text-sm">‹</span>
                <span class="font-medium text-white">Bintang Store</span>
                <span class="text-[10px] text-[#8A8F98]">bot</span>
              </div>
              <div class="flex items-center gap-3 text-[#8A8F98]">
                <span>•••</span>
                <span class="text-sm">✕</span>
              </div>
            </div>

            <!-- Live WebApp Iframe Embedded -->
            <div class="h-[520px] w-full overflow-hidden bg-[#08090A]">
              <iframe src="/#webapp" class="w-full h-full border-none" title="Telegram Mini App Storefront"></iframe>
            </div>
          </div>
        </div>
      `;
  }
}

// ==================== 1. HOME VIEW (from Patokan lines 433-573) ====================
function renderHomeView() {
  const headlineWords = ['The', 'automated', 'commerce', 'system', 'for', 'digital', 'products'];

  return `
    <section class="max-w-[1120px] mx-auto px-6 pt-[128px] pb-24">
      <!-- Staggered Blur-In Heading (Pure from Patokan lines 442-470) -->
      <div class="max-w-[780px] mb-6">
        <h1 class="text-[54px] sm:text-[60px] font-medium leading-[1.06] tracking-[-0.032em] text-[#F7F8F8]">
          ${headlineWords
            .map(
              (word, idx) => `
            <span
              class="inline-block mr-[0.26em] opacity-0 animate-blur-in"
              style="animation-delay: ${idx * 65}ms;"
            >
              ${word}
            </span>
          `,
            )
            .join('')}
        </h1>
      </div>

      <!-- Subheading Row + New Dual Bot Pill (Pure from Patokan lines 472-499) -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-14">
        <p class="text-[16px] leading-[1.5] text-[#8A8F98] max-w-[440px]">
          Purpose-built for automated digital commerce.
          <br />
          Designed for 24-hour WhatsApp & Telegram sales.
        </p>

        <button
          type="button"
          class="btn-goto-tab inline-flex items-center gap-2 text-[13px] group self-start sm:self-end"
          data-tab="pricing"
        >
          <span class="px-1.5 py-0.5 rounded bg-white/[0.08] text-[#F7F8F8] font-medium text-[11px]">
            New
          </span>
          <span class="text-[#D0D6E0] group-hover:text-white transition-colors">
            Dual Bot 2.0
          </span>
          <span class="text-[#8A8F98] group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </button>
      </div>

      <!-- App Interface Mockup Preview at Bottom of Hero (Pure from Patokan lines 501-572) -->
      <div class="w-full rounded-t-xl bg-[#101114] border border-white/[0.08] shadow-[0_-20px_60px_-15px_rgba(255,255,255,0.03)] overflow-hidden">
        <div class="grid grid-cols-12 min-h-[290px]">
          <!-- Sidebar -->
          <div class="col-span-12 sm:col-span-3 border-r border-white/[0.06] p-3.5 bg-[#0C0D0F]">
            <div class="flex items-center justify-between mb-4 px-1.5">
              <div class="flex items-center gap-2">
                <div class="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[#5E6AD2] to-indigo-400 flex items-center justify-center">
                  <span class="w-1 h-1 rounded-full bg-white"></span>
                </div>
                <span class="text-[13px] font-medium text-[#F7F8F8]">
                  Bintang Tech
                </span>
                <span class="text-[10px] text-[#8A8F98]">⌄</span>
              </div>
              <div class="flex items-center gap-2 text-[#8A8F98]">
                <i class="fas fa-search text-xs cursor-pointer hover:text-white"></i>
                <div class="w-5 h-5 rounded bg-white/[0.06] flex items-center justify-center text-white text-xs cursor-pointer">
                  ✎
                </div>
              </div>
            </div>

            <div class="space-y-1 text-[12.5px]">
              <div class="flex items-center gap-2.5 px-2 py-1.5 rounded text-[#8A8F98] hover:bg-white/[0.04] cursor-pointer">
                <span class="text-[#5E6AD2]">((•))</span>
                <span>Live Engine</span>
              </div>
              <div class="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.05] text-[#F7F8F8]">
                <div class="flex items-center gap-2.5">
                  <i class="fas fa-inbox text-[#8A8F98] text-xs"></i>
                  <span>Orders</span>
                </div>
                <span class="text-[11px] text-[#8A8F98]">3</span>
              </div>
              <div class="flex items-center gap-2.5 px-2 py-1.5 rounded text-[#8A8F98] hover:bg-white/[0.04] cursor-pointer">
                <i class="fas fa-cube text-[#8A8F98] text-xs"></i>
                <span>Products</span>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-white/[0.06] px-2 text-[11px] text-[#64748b] space-y-1">
              <div class="flex items-center justify-between text-emerald-400">
                <span>WA Daemon</span>
                <span class="font-mono text-[9px]">PAIRED</span>
              </div>
              <div class="flex items-center justify-between text-blue-400">
                <span>Telegram Bot</span>
                <span class="font-mono text-[9px]">ACTIVE</span>
              </div>
            </div>
          </div>

          <!-- Main Issue View -->
          <div class="col-span-12 sm:col-span-9 bg-[#101114] flex flex-col justify-between">
            <div>
              <div class="h-11 border-b border-white/[0.06] px-5 flex items-center justify-between text-[12px]">
                <div class="flex items-center gap-2.5">
                  <span class="w-4 h-4 rounded bg-[#F2994A]/20 text-[#F2994A] flex items-center justify-center text-[10px]">
                    ⚡
                  </span>
                  <span class="font-mono text-[#8A8F98]">BTS-8852</span>
                  <span class="text-[#F7F8F8] font-medium">
                    Automated Delivery: Spotify Premium 30 Days
                  </span>
                  <i class="fas fa-star text-[#F2C94C] text-xs ml-1"></i>
                  <i class="fas fa-ellipsis-h text-[#8A8F98] text-xs ml-1 cursor-pointer"></i>
                </div>
                <div class="flex items-center gap-3 text-[#8A8F98]">
                  <span class="font-mono text-[11px]">1 / 11</span>
                </div>
              </div>

              <!-- Issue Content Payload -->
              <div class="p-6 space-y-4">
                <div class="p-3.5 rounded-lg bg-[#0c0d0f] border border-white/[0.06] text-xs font-mono text-gray-300">
                  <span class="text-[#8A8F98] block text-[10px] uppercase tracking-wider mb-1 font-sans">Automated Delivery Payload</span>
                  📧 Email: bintang.spot.wa99@gmail.com<br>
                  🔑 Pass: SPOT-PREM-PASS-2026<br>
                  📝 Catatan: Login langsung di aplikasi Spotify resmi. Garansi aktif 30 hari.
                </div>

                <div class="grid grid-cols-3 gap-3 text-xs">
                  <div class="p-2.5 rounded bg-[#0c0d0f] border border-white/[0.06]">
                    <span class="text-[#64748b] block text-[10px]">INCOMING JID</span>
                    <span class="text-[#F7F8F8] font-mono">+62 857-9752-0135</span>
                  </div>
                  <div class="p-2.5 rounded bg-[#0c0d0f] border border-white/[0.06]">
                    <span class="text-[#64748b] block text-[10px]">SETTLEMENT</span>
                    <span class="text-[#F7F8F8] font-mono">Rp 19.000 QRIS</span>
                  </div>
                  <div class="p-2.5 rounded bg-[#0c0d0f] border border-white/[0.06]">
                    <span class="text-[#64748b] block text-[10px]">STOCK POOL</span>
                    <span class="text-emerald-400 font-mono">24 On-Hand</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="h-10 border-t border-white/[0.06] px-5 flex items-center justify-between text-[11px] text-[#8A8F98]">
              <span>Latency: <span class="text-emerald-400 font-mono">&lt; 1.1s</span> Zero-Click Fulfillment</span>
              <a href="#admin" class="text-[#F7F8F8] hover:underline flex items-center gap-1">
                <span>Open Workspace</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ==================== 2. CUSTOMERS VIEW (from Patokan lines 576-650) ====================
function renderCustomersView() {
  const tabs = [
    'Featured',
    'SaaS',
    'AI',
    'Fintech',
    'Consumer',
    'Hardware',
    'Health',
    'Enterprise',
  ];

  return `
    <section class="max-w-[1120px] mx-auto px-6 pt-16 pb-24">
      <h1 class="text-[48px] font-medium tracking-[-0.028em] text-[#F7F8F8] mb-5">
        Customers
      </h1>

      <!-- Category Filter Tabs (from Patokan lines 590-612) -->
      <div class="flex items-center gap-5 text-[14px] mb-12 border-b border-white/[0.06] pb-4 overflow-x-auto scrollbar-none">
        ${tabs
          .map(
            (tab) => `
          <button
            type="button"
            class="btn-customer-filter whitespace-nowrap transition-colors ${
              customerFilter === tab
                ? 'text-[#F7F8F8] font-medium'
                : 'text-[#8A8F98] hover:text-[#F7F8F8]'
            }"
            data-tab="${tab}"
          >
            ${tab}
          </button>
        `,
          )
          .join('')}
      </div>

      <!-- 3 Customer Cards (from Patokan lines 615-680) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Card 1: Ramp -->
        <div class="group cursor-pointer">
          <div class="aspect-[16/10] rounded-xl bg-[#0D0E10] border border-white/[0.08] mb-4 flex items-center justify-center relative overflow-hidden group-hover:border-white/[0.16] transition-colors">
            <div class="flex items-center gap-1.5 text-[28px] font-semibold tracking-tight text-white">
              <span>ramp</span>
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                <path d="M4 18L18 4M18 4H9M18 4V13" stroke="currentColor" stroke-width="2.5" />
              </svg>
            </div>
          </div>
          <h3 class="text-[16px] font-medium text-[#F7F8F8] leading-[1.4] mb-3 pr-4">
            The coding agent behind 75% of Ramp's merged PRs
          </h3>
          <div class="text-[13px] text-[#8A8F98] group-hover:text-[#F7F8F8] flex items-center gap-1 transition-colors">
            Watch video <span>→</span>
          </div>
        </div>

        <!-- Card 2: OpenAI -->
        <div class="group cursor-pointer">
          <div class="aspect-[16/10] rounded-xl bg-[#111318] border border-white/[0.08] mb-4 flex items-center justify-center relative overflow-hidden group-hover:border-white/[0.16] transition-colors">
            <div
              class="w-[84%] h-[78%] rounded-lg flex items-center justify-center relative overflow-hidden"
              style="background: linear-gradient(135deg, #6B8AFD 0%, #3E54AC 45%, #8CA6DB 100%);"
            >
              <div
                class="absolute inset-0 opacity-35"
                style="background-image: radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px); background-size: 8px 8px;"
              ></div>
              <span class="text-white text-2xl font-bold tracking-tight relative z-10">OpenAI</span>
            </div>
          </div>
          <h3 class="text-[16px] font-medium text-[#F7F8F8] leading-[1.4] mb-3 pr-4">
            Why OpenAI chose Linear and scaled to 3,000 users
          </h3>
          <div class="text-[13px] text-[#8A8F98] group-hover:text-[#F7F8F8] flex items-center gap-1 transition-colors">
            Read story <span>→</span>
          </div>
        </div>

        <!-- Card 3: Coinbase -->
        <div class="group cursor-pointer">
          <div class="aspect-[16/10] rounded-xl bg-[#0D0E10] border border-white/[0.08] mb-4 flex items-center justify-center relative overflow-hidden group-hover:border-white/[0.16] transition-colors">
            <div class="text-[26px] font-semibold tracking-tight text-[#0052FF]">
              coinbase
            </div>
          </div>
          <h3 class="text-[16px] font-medium text-[#F7F8F8] leading-[1.4] mb-3 pr-4">
            Coinbase's bet on agent-first development
          </h3>
          <div class="text-[13px] text-[#8A8F98] group-hover:text-[#F7F8F8] flex items-center gap-1 transition-colors">
            Watch video <span>→</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ==================== 3. PRICING VIEW ====================
function renderPricingView() {
  return `
    <section class="max-w-[1120px] mx-auto px-6 pt-16 pb-24">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h1 class="text-[48px] font-medium tracking-[-0.028em] text-[#F7F8F8] mb-4">Pricing</h1>
        <p class="text-[#8A8F98] text-[16px] mb-8">Start simple and scale as you grow. Sewa bulanan tanpa komisi penjualan.</p>
        
        <!-- Toggle -->
        <div class="inline-flex p-1 bg-[#141414] border border-white/[0.08] rounded-full text-[13px] font-medium mb-10">
          <button id="btn-price-monthly" type="button" class="px-5 py-1.5 rounded-full transition ${
            !billingYearly ? 'bg-[#262626] text-white shadow' : 'text-[#8A8F98] hover:text-white'
          }">
            Sewa Bulanan
          </button>
          <button id="btn-price-yearly" type="button" class="px-5 py-1.5 rounded-full transition ${
            billingYearly ? 'bg-[#262626] text-white shadow' : 'text-[#8A8F98] hover:text-white'
          }">
            Tahunan (Hemat 20%)
          </button>
        </div>
      </div>

      <!-- Pricing Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <!-- Starter -->
        <div class="bg-[#0D0E10] border border-white/[0.08] rounded-2xl p-7 flex flex-col justify-between hover:border-white/[0.16] transition relative">
          <div>
            <h3 class="text-white font-medium text-lg mb-2">Starter</h3>
            <div class="flex items-baseline mb-4">
              <span class="text-4xl font-bold tracking-tight text-white">
                ${billingYearly ? 'Rp 39.000' : 'Rp 49.000'}
              </span>
              <span class="text-[#8A8F98] ml-1.5 text-xs font-mono">/ mo</span>
            </div>
            <div class="border-t border-white/[0.06] pt-4 mb-6 text-xs text-[#8A8F98]">
              Template mudah & praktis untuk seller awal
            </div>
            <ul class="space-y-3 text-xs text-[#bbb] mb-8">
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> 1 Bot Telegram Toko Resmi</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Web Store Digital Minimal</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Maksimal 15 Produk Digital</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Tipzy QRIS Gateway Otomatis</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Auto-Fulfillment Akun/Voucher</li>
            </ul>
          </div>
          <button type="button" class="btn-signup-trigger w-full py-2.5 rounded-full bg-[#1c1c1c] hover:bg-[#262626] text-white text-xs font-medium border border-white/[0.08] transition">
            Pilih Starter
          </button>
        </div>

        <!-- Pro -->
        <div class="bg-[#101114] border border-white/[0.18] rounded-2xl p-7 flex flex-col justify-between hover:border-white/[0.3] transition relative shadow-2xl">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-white text-black font-mono text-[10px] font-bold tracking-wider uppercase">
            POPULAR
          </div>
          <div>
            <h3 class="text-white font-medium text-lg mb-2">Pro Dual Bot</h3>
            <div class="flex items-baseline mb-4">
              <span class="text-4xl font-bold tracking-tight text-white">
                ${billingYearly ? 'Rp 79.000' : 'Rp 99.000'}
              </span>
              <span class="text-[#8A8F98] ml-1.5 text-xs font-mono">/ mo</span>
            </div>
            <div class="border-t border-white/[0.06] pt-4 mb-6 text-xs text-[#8A8F98]">
              WhatsApp Multi-Device + Telegram Sekaligus
            </div>
            <ul class="space-y-3 text-xs text-white mb-8">
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> <b>WhatsApp Bot Multi-Device Live</b></li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> <b>Telegram Bot Toko 24 Jam</b></li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> <b>Smart Human Takeover (Mute saat CS)</b></li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Unlimited Produk & Kategori</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Seller Workspace Linear-Style</li>
            </ul>
          </div>
          <button type="button" class="btn-signup-trigger w-full py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition">
            Sewa Paket Pro
          </button>
        </div>

        <!-- Enterprise -->
        <div class="bg-[#0D0E10] border border-white/[0.08] rounded-2xl p-7 flex flex-col justify-between hover:border-white/[0.16] transition relative">
          <div>
            <h3 class="text-white font-medium text-lg mb-2">Enterprise</h3>
            <div class="flex items-baseline mb-4">
              <span class="text-4xl font-bold tracking-tight text-white">
                ${billingYearly ? 'Rp 199.000' : 'Rp 249.000'}
              </span>
              <span class="text-[#8A8F98] ml-1.5 text-xs font-mono">/ mo</span>
            </div>
            <div class="border-t border-white/[0.06] pt-4 mb-6 text-xs text-[#8A8F98]">
              Dedicated server & custom domain
            </div>
            <ul class="space-y-3 text-xs text-[#bbb] mb-8">
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Semua Fitur Paket Pro</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Custom Domain (.com / .id)</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Multi-Admin Telegram (Tim CS)</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> White-label (Hapus Watermark)</li>
              <li class="flex items-center gap-2.5"><i class="fa-regular fa-circle-check text-white text-xs"></i> Dedicated Server SLA 99.9%</li>
            </ul>
          </div>
          <button type="button" class="btn-signup-trigger w-full py-2.5 rounded-full bg-[#1c1c1c] hover:bg-[#262626] text-white text-xs font-medium border border-white/[0.08] transition">
            Konsultasi Custom
          </button>
        </div>
      </div>
    </section>
  `;
}

// ==================== 4. CONTACT & SITEMAP VIEW ====================
function renderContactView() {
  return `
    <section class="max-w-[1120px] mx-auto px-6 pt-16 pb-24">
      <h1 class="text-[48px] font-medium tracking-[-0.028em] text-[#F7F8F8] mb-4">Contact & Support</h1>
      <p class="text-[#8A8F98] text-[16px] mb-12">Hubungi tim engineer dan support kami untuk kebutuhan integrasi bisnismu.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
        <div class="p-6 rounded-2xl bg-[#0D0E10] border border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 class="text-white font-medium text-base mb-1">Telegram Community & CS</h3>
            <p class="text-xs text-[#8A8F98]">Tanya jawab teknis langsung dengan tim engineer Bintang Tech.</p>
          </div>
          <a href="https://t.me/BintangDigitalDemoBot" target="_blank" class="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white transition">
            Join Telegram ↗
          </a>
        </div>

        <div class="p-6 rounded-2xl bg-[#0D0E10] border border-white/[0.08] flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-white font-medium text-base mb-1">System Status</h3>
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <p class="text-xs text-[#8A8F98]">Semua gateway Tipzy, daemon WhatsApp, dan Supabase aktif normal.</p>
          </div>
          <span class="text-xs font-mono text-emerald-400">OPERATIONAL</span>
        </div>
      </div>

      <!-- SITEMAP FOOTER -->
      <div class="border-t border-white/[0.06] pt-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs text-[#8A8F98]">
        <div>
          <div class="text-white font-medium mb-3">Product</div>
          <ul class="space-y-2">
            <li><a href="#admin" class="hover:text-white transition">Seller Workspace</a></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="home">WhatsApp Daemon</span></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="home">Telegram Bot</span></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="pricing">Pricing Plans</span></li>
          </ul>
        </div>
        <div>
          <div class="text-white font-medium mb-3">Company</div>
          <ul class="space-y-2">
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="customers">About Us</span></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="customers">Customers</span></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="contact">Careers</span></li>
          </ul>
        </div>
        <div>
          <div class="text-white font-medium mb-3">Resources</div>
          <ul class="space-y-2">
            <li><a href="#webapp" class="hover:text-white transition">Customer WebStore</a></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="contact">Documentation</span></li>
            <li><span class="hover:text-white cursor-pointer btn-goto-tab" data-tab="contact">API Status</span></li>
          </ul>
        </div>
        <div>
          <div class="text-white font-medium mb-3">Connect</div>
          <ul class="space-y-2">
            <li><a href="https://t.me/BintangDigitalDemoBot" target="_blank" class="hover:text-white transition">Telegram</a></li>
            <li><a href="https://wa.me/6285797520135" target="_blank" class="hover:text-white transition">WhatsApp</a></li>
            <li><a href="#faq" class="hover:text-white transition">GitHub</a></li>
          </ul>
        </div>
      </div>

      <div class="mt-12 pt-6 border-t border-white/[0.04] text-[11px] text-[#64748b] flex justify-between items-center">
        <span>© 2026 Bintang Tech Studio. The automated sales system for digital sellers.</span>
        <span>Made with precision in Indonesia</span>
      </div>
    </section>
  `;
}

export function initLandingEvents() {
  const refreshTab = () => {
    const mainContainer = document.getElementById('linear-tab-content');
    if (mainContainer) {
      mainContainer.innerHTML = renderTabContent();
      attachViewEvents();
    }
    // Update active highlight on navbar links
    document.querySelectorAll('.btn-nav-link').forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (tab === activeLandingTab) {
        btn.className =
          'btn-nav-link px-3 py-1.5 rounded-md text-[13px] transition-colors text-[#F7F8F8] bg-white/[0.06]';
      } else {
        btn.className =
          'btn-nav-link px-3 py-1.5 rounded-md text-[13px] transition-colors text-[#8A8F98] hover:text-[#F7F8F8]';
      }
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Nav brand click -> home
  const brandBtn = document.getElementById('nav-brand');
  if (brandBtn) {
    brandBtn.addEventListener('click', () => {
      activeLandingTab = 'home';
      refreshTab();
    });
  }

  // Top Nav Buttons
  document.querySelectorAll('.btn-nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        activeLandingTab = targetTab;
        closeAllDropdowns();
        refreshTab();
      }
    });
  });

  // Dropdowns (Product & Resources)
  const productWrap = document.getElementById('nav-dropdown-product-wrap');
  const productMenu = document.getElementById('mega-dropdown-product');
  const resourcesWrap = document.getElementById('nav-dropdown-resources-wrap');
  const resourcesMenu = document.getElementById('mega-dropdown-resources');
  const navHeader = document.getElementById('linear-navbar');

  const closeAllDropdowns = () => {
    productMenu?.classList.remove('active');
    resourcesMenu?.classList.remove('active');
  };

  if (productWrap && productMenu) {
    productWrap.addEventListener('mouseenter', () => {
      resourcesMenu?.classList.remove('active');
      productMenu.classList.add('active');
    });
  }

  if (resourcesWrap && resourcesMenu) {
    resourcesWrap.addEventListener('mouseenter', () => {
      productMenu?.classList.remove('active');
      resourcesMenu.classList.add('active');
    });
  }

  if (navHeader) {
    navHeader.addEventListener('mouseleave', () => {
      closeAllDropdowns();
    });
  }

  // Auth Triggers
  const topLogin = document.getElementById('btn-top-login');
  if (topLogin) {
    topLogin.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'login' });
    });
  }

  const topSignup = document.getElementById('btn-top-signup');
  if (topSignup) {
    topSignup.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'signup' });
    });
  }

  attachViewEvents();
}

function attachViewEvents() {
  // Tab shortcuts inside dropdowns & buttons
  document.querySelectorAll('.btn-goto-tab').forEach((el) => {
    el.addEventListener('click', () => {
      const targetTab = el.getAttribute('data-tab');
      if (targetTab) {
        activeLandingTab = targetTab;
        const mainContainer = document.getElementById('linear-tab-content');
        if (mainContainer) {
          mainContainer.innerHTML = renderTabContent();
          attachViewEvents();
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
  });

  // Customer filters
  document.querySelectorAll('.btn-customer-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      customerFilter = btn.getAttribute('data-tab') || 'Featured';
      document.querySelectorAll('.btn-customer-filter').forEach((b) => {
        b.className =
          'btn-customer-filter whitespace-nowrap transition-colors text-[#8A8F98] hover:text-[#F7F8F8]';
      });
      btn.className =
        'btn-customer-filter whitespace-nowrap transition-colors text-[#F7F8F8] font-medium';
    });
  });

  // Feature channel filters
  document.querySelectorAll('.btn-channel-select').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ch = btn.getAttribute('data-channel');
      if (ch) {
        activeFeatureChannel = ch;
        const mainContainer = document.getElementById('linear-tab-content');
        if (mainContainer) {
          mainContainer.innerHTML = renderTabContent();
          attachViewEvents();
        }
      }
    });
  });

  // Pricing toggles
  const btnMonthly = document.getElementById('btn-price-monthly');
  const btnYearly = document.getElementById('btn-price-yearly');
  if (btnMonthly && btnYearly) {
    btnMonthly.addEventListener('click', () => {
      billingYearly = false;
      const mainContainer = document.getElementById('linear-tab-content');
      if (mainContainer) {
        mainContainer.innerHTML = renderTabContent();
        attachViewEvents();
      }
    });

    btnYearly.addEventListener('click', () => {
      billingYearly = true;
      const mainContainer = document.getElementById('linear-tab-content');
      if (mainContainer) {
        mainContainer.innerHTML = renderTabContent();
        attachViewEvents();
      }
    });
  }

  // Sign up buttons inside cards
  document.querySelectorAll('.btn-signup-trigger, #btn-cta-start').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'signup' });
    });
  });
}
