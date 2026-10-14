// Bintang Tech Studio — Template 01: DIGITAL MINIMAL
// Portfolio Landing Page

import { store } from '../state/store.js';
import { formatRupiah } from '../utils/currency.js';
import { escapeHtml, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';

export function renderLandingPage() {
  const products = store.getActiveProducts();
  const settings = store.getSettings();
  const orders = store.getOrders();
  const totalSales = orders.reduce(
    (sum, o) => sum + (o.paymentStatus === 'PAID' ? o.total : 0),
    2450000,
  );

  return `
    <div class="view-container bg-[#0B0D11] text-stone-100 flex flex-col justify-between selection:bg-terracotta-500 selection:text-white relative overflow-hidden">
      
      <!-- Subtle Ambient Background Watermark -->
      <div class="absolute -right-16 top-8 w-96 h-96 opacity-[0.03] pointer-events-none select-none">
        ${BRAND_LOGO_SVG}
      </div>

      <!-- HERO SECTION -->
      <section class="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 w-full relative z-10">
        <!-- Studio Label Pill with Official Logo -->
        <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-800/80 border border-stone-700/80 text-amber-300 mb-6 shadow-sm">
          <span class="w-4 h-4">${BRAND_LOGO_SVG}</span>
          <span>BINTANG TECH STUDIO · PORTFOLIO PROTOTYPE</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <!-- Left Column: Title & Proposition -->
          <div class="lg:col-span-7 space-y-6">
            <div class="space-y-2">
              <div class="flex items-center gap-2.5">
                <span class="w-6 h-6 inline-block">${BRAND_LOGO_SVG}</span>
                <span class="font-mono text-xs uppercase tracking-widest text-terracotta-400 font-semibold block">
                  Template 01 — Standard / Starter Candidate
                </span>
              </div>
              <h1 class="font-heading font-black text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.1]">
                DIGITAL <span class="text-transparent bg-clip-text bg-gradient-to-r from-terracotta-400 to-amber-300">MINIMAL</span>
              </h1>
            </div>

            <p class="text-lg sm:text-xl text-stone-300 font-normal leading-relaxed max-w-xl">
              "${escapeHtml(settings.tagline)}"
            </p>

            <p class="text-sm text-stone-400 leading-relaxed max-w-xl">
              Template digital store yang sederhana, premium, modern, dan cepat untuk seller produk digital. Mengubah proses jualan manual (chat WhatsApp & cek mutasi manual) menjadi <span class="text-stone-200 font-medium">sistem checkout dan auto-fulfillment otomatis</span>.
            </p>

            <!-- Quick Action Buttons -->
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <a href="#telegram" class="px-5 py-3 rounded-xl font-heading font-bold text-sm bg-gradient-to-r from-terracotta-500 to-terracotta-600 hover:from-terracotta-600 hover:to-terracotta-700 text-white shadow-lg shadow-terracotta-900/40 hover:shadow-terracotta-900/60 transition-all flex items-center gap-2">
                <span>🤖</span>
                <span>Lihat Demo Telegram</span>
              </a>
              <a href="#webapp" class="px-5 py-3 rounded-xl font-heading font-bold text-sm bg-stone-800 hover:bg-stone-700 text-white border border-stone-700 transition-all flex items-center gap-2">
                <span>📱</span>
                <span>Buka WebApp Customer</span>
              </a>
              <a href="#admin" class="px-5 py-3 rounded-xl font-heading font-bold text-sm bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/80 transition-all flex items-center gap-2">
                <span>📊</span>
                <span>Lihat Dashboard Admin</span>
              </a>
            </div>

            <!-- Trust / Feature micro badges -->
            <div class="pt-4 flex flex-wrap items-center gap-4 text-xs text-stone-400 font-mono">
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400">✓</span>
                <span>Auto-Fulfillment Siap</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400">✓</span>
                <span>QRIS & E-Wallet Sim</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-emerald-400">✓</span>
                <span>12 Dummy Products</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Interactive Prototype Switchboard Cards -->
          <div class="lg:col-span-5 space-y-3">
            <div class="text-xs font-mono uppercase tracking-wider text-stone-400 px-1">
              4 Pengalaman yang Saling Terhubung:
            </div>

            <!-- Card 1: Telegram Bot -->
            <a href="#telegram" class="group block p-4 rounded-2xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/70 hover:border-terracotta-500/60 transition-all duration-200">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-lg border border-blue-500/20 group-hover:scale-105 transition-transform">
                    🤖
                  </div>
                  <div>
                    <h3 class="font-heading font-bold text-sm text-white group-hover:text-terracotta-400 transition-colors">
                      1. Telegram Bot Simulation
                    </h3>
                    <p class="text-xs text-stone-400 mt-0.5">
                      Chat bot interaktif, tombol menu, katalog produk & instant checkout.
                    </p>
                  </div>
                </div>
                <span class="text-stone-500 group-hover:text-white transition-colors text-sm">→</span>
              </div>
            </a>

            <!-- Card 2: Customer WebApp -->
            <a href="#webapp" class="group block p-4 rounded-2xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/70 hover:border-terracotta-500/60 transition-all duration-200">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg border border-amber-500/20 group-hover:scale-105 transition-transform">
                    📱
                  </div>
                  <div>
                    <h3 class="font-heading font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                      2. Customer WebApp
                    </h3>
                    <p class="text-xs text-stone-400 mt-0.5">
                      Katalog bersih, keranjang, voucher <code class="text-amber-300 font-mono">BINTANG10</code>, QRIS & auto-fulfillment.
                    </p>
                  </div>
                </div>
                <span class="text-stone-500 group-hover:text-white transition-colors text-sm">→</span>
              </div>
            </a>

            <!-- Card 3: Admin Dashboard -->
            <a href="#admin" class="group block p-4 rounded-2xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/70 hover:border-terracotta-500/60 transition-all duration-200">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg border border-emerald-500/20 group-hover:scale-105 transition-transform">
                    📊
                  </div>
                  <div>
                    <h3 class="font-heading font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                      3. Admin Dashboard
                    </h3>
                    <p class="text-xs text-stone-400 mt-0.5">
                      Kelola 12 produk, edit stok/harga, pantau inventori, order & customer.
                    </p>
                  </div>
                </div>
                <span class="text-stone-500 group-hover:text-white transition-colors text-sm">→</span>
              </div>
            </a>

            <!-- Card 4: Telegram Admin Simulation -->
            <a href="#telegram-admin" class="group block p-4 rounded-2xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/70 hover:border-terracotta-500/60 transition-all duration-200">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-lg border border-purple-500/20 group-hover:scale-105 transition-transform">
                    ⚡
                  </div>
                  <div>
                    <h3 class="font-heading font-bold text-sm text-white group-hover:text-purple-400 transition-colors">
                      4. Telegram Admin Simulation
                    </h3>
                    <p class="text-xs text-stone-400 mt-0.5">
                      Kontrol jualan langsung via Telegram dengan perintah <code class="text-stone-300 font-mono">/stok</code>, <code class="text-stone-300 font-mono">/sales</code>, <code class="text-stone-300 font-mono">/order</code>.
                    </p>
                  </div>
                </div>
                <span class="text-stone-500 group-hover:text-white transition-colors text-sm">→</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      <!-- LIVE METRICS BAR -->
      <section class="border-y border-stone-800 bg-stone-950/60 py-6">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center sm:text-left">
          <div>
            <div class="text-[11px] font-mono text-stone-400 uppercase">Total Produk Aktif</div>
            <div class="font-heading font-bold text-2xl text-white mt-1">${products.length} Item</div>
            <div class="text-xs text-stone-500 mt-0.5">Streaming, AI, Game, Tools</div>
          </div>
          <div>
            <div class="text-[11px] font-mono text-stone-400 uppercase">Simulasi Omset</div>
            <div class="font-heading font-bold text-2xl text-emerald-400 mt-1">${formatRupiah(totalSales)}</div>
            <div class="text-xs text-stone-500 mt-0.5">128 Transaksi Sukses</div>
          </div>
          <div>
            <div class="text-[11px] font-mono text-stone-400 uppercase">Kecepatan Fulfillment</div>
            <div class="font-heading font-bold text-2xl text-amber-400 mt-1">&lt; 2 Detik</div>
            <div class="text-xs text-stone-500 mt-0.5">Otomatisasi Kredensial</div>
          </div>
          <div>
            <div class="text-[11px] font-mono text-stone-400 uppercase">Tipe Pengiriman</div>
            <div class="font-heading font-bold text-2xl text-terracotta-400 mt-1">4 Format</div>
            <div class="text-xs text-stone-500 mt-0.5">Akun, Kode, Link, Lisensi</div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
        <div class="flex items-center gap-2">
          <span class="w-4 h-4">${BRAND_LOGO_SVG}</span>
          <span class="font-medium text-stone-300">Bintang Tech Studio</span> · Portfolio Interactive Prototype
        </div>
        <div class="flex items-center gap-4 text-stone-400">
          <span>Prototype Mode (Dummy Data)</span>
          <span>·</span>
          <span>Version 1.0.0</span>
        </div>
      </footer>
    </div>
  `;
}
