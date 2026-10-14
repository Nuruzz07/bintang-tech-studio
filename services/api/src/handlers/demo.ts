/**
 * Bintang Tech Studio : Master Ecosystem Interactive Demo Handlers
 * Baseline : Milestone M15 Hardening and Ecosystem Demo
 *
 * Implements 7 coherent ecosystem views and API endpoints:
 * 1. Platform Landing Page (/demo or /)
 * 2. Customer Telegram Mini App (/demo/store)
 * 3. Telegram Seller Bot Simulator (/demo/telegram-seller)
 * 4. Seller Dashboard (/demo/seller)
 * 5. Customer WhatsApp Bot Simulator (/demo/whatsapp)
 * 6. Customer Web Store Add-on (/demo/web-store)
 * 7. Platform Owner Console (/demo/owner)
 *
 * Enforces:
 * - Real logo identity from logo.svg
 * - Official palette: Deep Obsidian (#171411), Warm Ivory (#FAF7F2), Terracotta (#C2410C), Gold (#D97706)
 * - Zero unicode em-dashes (R-02 compliant)
 * - Shared authoritative demo state
 * - Honest simulation disclosures
 */

import { ParsedRequest } from '../router.js';
import { demoState, DemoOrder, escapeHtml } from '../demo/state.js';
import { BadRequestError } from '../errors.js';

export const OFFICIAL_LOGO_SVG = `
<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
  <line x1="8" y1="60" x2="112" y2="60" stroke="#E7E5E4" stroke-width="2" stroke-linecap="round"/>
  <line x1="30" y1="60" x2="90" y2="60" stroke="#E8A359" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M28 50 L60 14 L92 50" stroke="#1C1917" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M28 70 L60 106 L92 70" stroke="#9C532B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <polygon points="60,36 78,60 60,84 42,60" fill="#1C1917"/>
  <path d="M60 42 C60 54 52 60 46 60 C52 60 60 66 60 78 C60 66 68 60 74 60 C68 60 60 54 60 42 Z" fill="#E8A359"/>
  <circle cx="60" cy="60" r="2" fill="#FAF8F5"/>
</svg>
`;

export function renderDemoNavbar(activeView: string): string {
  const links = [
    { id: 'landing', label: '🌐 Landing Page', href: '/demo' },
    { id: 'store', label: '📱 Telegram Mini App', href: '/demo/store' },
    { id: 'telegram-seller', label: '🤖 Seller Bot', href: '/demo/telegram-seller' },
    { id: 'seller', label: '📊 Seller Dashboard', href: '/demo/seller' },
    { id: 'whatsapp', label: '💬 WhatsApp Bot', href: '/demo/whatsapp' },
    { id: 'web-store', label: '💻 Web Store', href: '/demo/web-store' },
    { id: 'owner', label: '🏢 Owner Console', href: '/demo/owner' },
    { id: 'portfolio', label: '📁 Portofolio & Proyek', href: '/demo/portfolio' },
  ];

  return `
    <nav class="sticky top-0 z-50 bg-[#171411]/95 backdrop-blur-md border-b border-stone-800 text-stone-200 text-xs px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md">
      <div class="flex items-center gap-2">
        <a href="/demo" class="flex items-center gap-2 hover:opacity-90 transition">
          <span class="w-6 h-6 p-0.5 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center">
            ${OFFICIAL_LOGO_SVG}
          </span>
          <span class="font-bold text-white tracking-wide">Bintang Tech Studio</span>
        </a>
        <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
          Ecosystem Demo
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-1">
        ${links
          .map((l) => {
            const isActive = l.id === activeView;
            return `
            <a href="${l.href}" class="px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              isActive
                ? 'bg-[#C2410C] text-white shadow-sm font-semibold'
                : 'hover:bg-stone-800 text-stone-300'
            }">
              ${l.label}
            </a>
          `;
          })
          .join('')}
      </div>

      <div class="flex items-center gap-2">
        <!-- VIEWPORT SWITCHER -->
        <div class="hidden sm:flex items-center bg-stone-900 rounded-lg p-0.5 border border-stone-800 text-[10px]">
          <button id="btn-vp-desktop" onclick="setViewportMode('desktop')" title="Tampilan Desktop (100%)" class="viewport-btn px-2 py-0.5 rounded font-medium bg-[#C2410C] text-white transition">
            🖥️ Full
          </button>
          <button id="btn-vp-tablet" onclick="setViewportMode('tablet')" title="Frame Tablet (768px)" class="viewport-btn px-2 py-0.5 rounded font-medium text-stone-400 hover:text-white transition">
            📟 Tablet
          </button>
          <button id="btn-vp-mobile" onclick="setViewportMode('mobile')" title="Frame Ponsel (390px)" class="viewport-btn px-2 py-0.5 rounded font-medium text-stone-400 hover:text-white transition">
            📱 Mobile
          </button>
        </div>

        <button id="btn-reset-demo" onclick="resetDemoData()" title="Reset data demo ke kondisi awal" class="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-medium border border-stone-700 transition">
          🔄 Reset Demo
        </button>
      </div>
    </nav>
  `;
}

export function renderPageShell(title: string, activeView: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} : Bintang Tech Studio Demo</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #171411;
      color: #FAF7F2;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #1c1917;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #44403c;
      border-radius: 3px;
    }
  </style>
  <script>
    async function resetDemoData() {
      if (confirm('Reset seluruh data demo ke kondisi default?')) {
        try {
          const res = await fetch('/api/v1/demo/reset', { method: 'POST' });
          if (res.ok) {
            window.location.reload();
          }
        } catch (e) {
          alert('Gagal me-reset data: ' + e.message);
        }
      }
    }

    function setViewportMode(mode) {
      const wrapper = document.getElementById('viewport-wrapper');
      if (!wrapper) return;
      const btns = document.querySelectorAll('.viewport-btn');
      btns.forEach(b => {
        b.classList.remove('bg-[#C2410C]', 'text-white');
        b.classList.add('text-stone-400');
      });

      if (mode === 'mobile') {
        wrapper.className = 'w-full max-w-[410px] mx-auto transition-all duration-300 py-4 px-2 border-x-4 border-stone-800 rounded-3xl shadow-2xl my-4 bg-[#0C0A09] min-h-[800px]';
        document.getElementById('btn-vp-mobile')?.classList.add('bg-[#C2410C]', 'text-white');
        document.getElementById('btn-vp-mobile')?.classList.remove('text-stone-400');
      } else if (mode === 'tablet') {
        wrapper.className = 'w-full max-w-[768px] mx-auto transition-all duration-300 py-4 px-2 border-x-4 border-stone-800 rounded-2xl shadow-xl my-4 min-h-[800px]';
        document.getElementById('btn-vp-tablet')?.classList.add('bg-[#C2410C]', 'text-white');
        document.getElementById('btn-vp-tablet')?.classList.remove('text-stone-400');
      } else {
        wrapper.className = 'w-full transition-all duration-300';
        document.getElementById('btn-vp-desktop')?.classList.add('bg-[#C2410C]', 'text-white');
        document.getElementById('btn-vp-desktop')?.classList.remove('text-stone-400');
      }
      try { localStorage.setItem('demo_vp_mode', mode); } catch (_) {}
    }

    document.addEventListener('DOMContentLoaded', () => {
      try {
        const saved = localStorage.getItem('demo_vp_mode');
        if (saved && saved !== 'desktop') {
          setViewportMode(saved);
        }
      } catch (_) {}
    });
  </script>
</head>
<body class="min-h-screen flex flex-col bg-[#171411] text-[#FAF7F2]">
  ${renderDemoNavbar(activeView)}
  <main class="flex-1 w-full">
    <div id="viewport-wrapper" class="w-full transition-all duration-300">
      ${content}
    </div>
  </main>
</body>
</html>`;
}

// -------------------------------------------------------------
// 1. PLATFORM LANDING PAGE
// -------------------------------------------------------------
export function handleRenderLandingPage(): string {
  const content = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <!-- HERO SECTION -->
      <section class="text-center py-12 md:py-16">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-6">
          <span>🚀 Platform Rental Sistem Penjualan Otomatis</span>
        </div>
        <h1 class="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto">
          Ubah jualan digital manual menjadi lebih otomatis.
        </h1>
        <p class="text-base sm:text-lg text-stone-300 max-w-2xl mx-auto mb-8 leading-relaxed">
          Kelola produk, pesanan, dan operasional jualan melalui bot Telegram dan dashboard seller. Perluas ke WhatsApp dan website sesuai kebutuhan bisnismu.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-3">
          <a href="/demo/store" class="px-6 py-3 rounded-xl bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-sm shadow-lg shadow-orange-950/40 transition">
            🛍️ Coba Toko Pembeli (Mini App)
          </a>
          <a href="/demo/seller" class="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-sm border border-stone-700 transition">
            📊 Masuk ke Seller Dashboard
          </a>
          <a href="/demo/telegram-seller" class="px-6 py-3 rounded-xl bg-sky-900/40 hover:bg-sky-900/60 text-sky-200 font-semibold text-sm border border-sky-800/60 transition">
            🤖 Cek Bot Telegram Seller
          </a>
        </div>
      </section>

      <!-- ECOSYSTEM ARCHITECTURE DIAGRAM -->
      <section class="my-12 p-6 sm:p-8 rounded-2xl bg-[#1C1917] border border-stone-800">
        <div class="text-center max-w-2xl mx-auto mb-8">
          <h2 class="text-xl sm:text-2xl font-bold text-white mb-2">Model Hubungan Bisnis Platform</h2>
          <p class="text-xs sm:text-sm text-stone-400">
            Bukan sekadar pembuat website statis : Bintang Tech Studio menyewakan ekosistem mesin dagang otomatis multi-channel.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch text-center">
          <!-- TIER 1: PLATFORM OWNER -->
          <div class="p-5 rounded-xl bg-stone-900/80 border border-amber-900/40 flex flex-col justify-between">
            <div>
              <div class="w-10 h-10 mx-auto rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg mb-3">
                🏢
              </div>
              <h3 class="font-bold text-sm text-white mb-1">Platform Owner</h3>
              <p class="text-[11px] text-amber-300 font-medium mb-3">Bintang Tech Studio</p>
              <p class="text-xs text-stone-400 leading-relaxed mb-4">
                Mengelola lisensi, server, penagihan langganan, add-on, dan pengawasan multi-tenant melalui Owner Console.
              </p>
            </div>
            <a href="/demo/owner" class="text-xs text-amber-400 hover:text-amber-300 font-semibold underline">
              Buka Owner Console &rarr;
            </a>
          </div>

          <!-- TIER 2: SELLER / TENANT -->
          <div class="p-5 rounded-xl bg-stone-900/80 border border-[#C2410C]/40 flex flex-col justify-between shadow-lg shadow-orange-950/20">
            <div>
              <div class="w-10 h-10 mx-auto rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center font-bold text-lg mb-3">
                👤
              </div>
              <h3 class="font-bold text-sm text-white mb-1">Seller / Merchant</h3>
              <p class="text-[11px] text-orange-300 font-medium mb-3">Penyewa Sistem Toko</p>
              <p class="text-xs text-stone-400 leading-relaxed mb-4">
                Menyewa platform untuk menjalankan toko otomatis. Mengelola stok & pesanan lewat Dashboard & Bot Seller.
              </p>
            </div>
            <div class="flex justify-center gap-2">
              <a href="/demo/seller" class="text-xs text-orange-400 hover:text-orange-300 font-semibold underline">
                Dashboard &rarr;
              </a>
              <span class="text-stone-600">|</span>
              <a href="/demo/telegram-seller" class="text-xs text-sky-400 hover:text-sky-300 font-semibold underline">
                Bot Seller &rarr;
              </a>
            </div>
          </div>

          <!-- TIER 3: CUSTOMER -->
          <div class="p-5 rounded-xl bg-stone-900/80 border border-emerald-900/40 flex flex-col justify-between">
            <div>
              <div class="w-10 h-10 mx-auto rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg mb-3">
                👥
              </div>
              <h3 class="font-bold text-sm text-white mb-1">Pelanggan Toko</h3>
              <p class="text-[11px] text-emerald-300 font-medium mb-3">Customer Seller</p>
              <p class="text-xs text-stone-400 leading-relaxed mb-4">
                Membeli produk digital 24 jam via Telegram Mini App, WhatsApp Bot, atau Toko Web secara instan tanpa login ribet.
              </p>
            </div>
            <div class="flex justify-center gap-2">
              <a href="/demo/store" class="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline">
                Mini App &rarr;
              </a>
              <span class="text-stone-600">|</span>
              <a href="/demo/whatsapp" class="text-xs text-green-400 hover:text-green-300 font-semibold underline">
                WhatsApp &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 6 PRODUCT CHANNELS GRID -->
      <section class="my-14">
        <div class="text-center max-w-2xl mx-auto mb-10">
          <h2 class="text-2xl font-bold text-white mb-2">6 Channel & Antarmuka Utama</h2>
          <p class="text-xs sm:text-sm text-stone-400">
            Seluruh titik interaksi terintegrasi ke dalam satu Authoritative Commerce & Inventory Engine.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="p-5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-stone-700 transition">
            <span class="text-2xl">📱</span>
            <h3 class="font-bold text-sm text-white mt-2 mb-1">Telegram Mini App</h3>
            <p class="text-xs text-stone-400 mb-3">Toko digital berbasis WebApp interaktif di dalam Telegram. Cepat, ringan, dan langsung bayar QRIS.</p>
            <a href="/demo/store" class="text-xs font-semibold text-[#C2410C] hover:underline">Buka Mini App &rarr;</a>
          </div>

          <div class="p-5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-stone-700 transition">
            <span class="text-2xl">🤖</span>
            <h3 class="font-bold text-sm text-white mt-2 mb-1">Telegram Seller Bot</h3>
            <p class="text-xs text-stone-400 mb-3">Notifikasi instan pesanan masuk, cek stok cepat, dan laporan harian langsung dari chat ponsel.</p>
            <a href="/demo/telegram-seller" class="text-xs font-semibold text-sky-400 hover:underline">Buka Bot Seller &rarr;</a>
          </div>

          <div class="p-5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-stone-700 transition">
            <span class="text-2xl">📊</span>
            <h3 class="font-bold text-sm text-white mt-2 mb-1">Seller Dashboard SaaS</h3>
            <p class="text-xs text-stone-400 mb-3">Pusat kendali 13 modul untuk manajemen produk, inventaris kode voucher, keuangan, dan staf.</p>
            <a href="/demo/seller" class="text-xs font-semibold text-orange-400 hover:underline">Buka Dashboard &rarr;</a>
          </div>

          <div class="p-5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-stone-700 transition">
            <span class="text-2xl">💬</span>
            <h3 class="font-bold text-sm text-white mt-2 mb-1">Customer WhatsApp Bot</h3>
            <p class="text-xs text-stone-400 mb-3">Channel obrolan WhatsApp untuk pembeli yang memilih bertransaksi di aplikasi pesan utama.</p>
            <a href="/demo/whatsapp" class="text-xs font-semibold text-emerald-400 hover:underline">Coba WhatsApp &rarr;</a>
          </div>

          <div class="p-5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-stone-700 transition">
            <span class="text-2xl">💻</span>
            <h3 class="font-bold text-sm text-white mt-2 mb-1">Customer Web Store (Add-on)</h3>
            <p class="text-xs text-stone-400 mb-3">Website storefront desktop/tablet opsional untuk menjangkau pembeli umum via Google/browser.</p>
            <a href="/demo/web-store" class="text-xs font-semibold text-amber-400 hover:underline">Buka Web Store &rarr;</a>
          </div>

          <div class="p-5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-stone-700 transition">
            <span class="text-2xl">🏢</span>
            <h3 class="font-bold text-sm text-white mt-2 mb-1">Platform Owner Console</h3>
            <p class="text-xs text-stone-400 mb-3">Control plane pemilik platform untuk memantau semua penyewa toko, paket langganan, dan kesehatan sistem.</p>
            <a href="/demo/owner" class="text-xs font-semibold text-purple-400 hover:underline">Buka Console &rarr;</a>
          </div>
        </div>
      </section>

      <!-- PROVEN ECOSYSTEM PORTFOLIO SHOWCASE -->
      <section class="my-14 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#1C1917] to-stone-950 border border-amber-900/30">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold mb-2">
              <span>🏆 Portofolio & Ekosistem Terbukti</span>
            </div>
            <h2 class="text-2xl font-bold text-white leading-tight">Proyek Riil yang Didukung Arsitektur Bintang Tech</h2>
            <p class="text-xs sm:text-sm text-stone-400 mt-1 max-w-2xl">
              Bukan konsep di atas kertas : sistem kami telah diuji pada vertikal F&B jastip ribuan outlet dan etalase produk digital komersial.
            </p>
          </div>
          <a href="/demo/portfolio" class="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-semibold text-xs border border-amber-500/30 transition flex items-center gap-1.5">
            <span>Buka Direktori Portofolio Lengkap</span>
            <span>&rarr;</span>
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- CARD 1: F&B JASTIP KOPKEN & JJ -->
          <div class="p-5 rounded-xl bg-stone-900/80 border border-stone-800 hover:border-amber-600/40 transition flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-2xl">☕</span>
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">1.328 OUTLET</span>
              </div>
              <h3 class="font-bold text-sm text-white mb-1">Bintang Store : F&B Jastip</h3>
              <p class="text-[11px] text-amber-400 font-medium mb-2">Kopi Kenangan & Janji Jiwa Online</p>
              <p class="text-xs text-stone-400 leading-relaxed mb-4">
                Sistem pesanan kopi dengan radar GPS Haversine terdekat, kustomisasi racikan minuman, Takeaway/Delivery, dan Bintang SplitPay.
              </p>
            </div>
            <a href="/demo/portfolio#kopken" class="text-xs text-amber-400 hover:underline font-semibold">
              Detail Proyek & Arsitektur &rarr;
            </a>
          </div>

          <!-- CARD 2: DIGITAL PRODUCTS STORE -->
          <div class="p-5 rounded-xl bg-stone-900/80 border border-stone-800 hover:border-orange-600/40 transition flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-2xl">🛍️</span>
                <span class="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[9px] font-bold">36 PRODUK</span>
              </div>
              <h3 class="font-bold text-sm text-white mb-1">Bintang Store : Produk Digital</h3>
              <p class="text-[11px] text-orange-400 font-medium mb-2">Akun AI, Streaming & Desain</p>
              <p class="text-xs text-stone-400 leading-relaxed mb-4">
                Toko produk digital dengan pengiriman serial key instan 24 jam, diskon voucher dinamis, dan pembayaran QRIS otomatis.
              </p>
            </div>
            <a href="/demo/store" class="text-xs text-orange-400 hover:underline font-semibold">
              Coba Toko (Mini App) &rarr;
            </a>
          </div>

          <!-- CARD 3: LIVE ORDER RADAR TRACKER -->
          <div class="p-5 rounded-xl bg-stone-900/80 border border-stone-800 hover:border-sky-600/40 transition flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-2xl">📡</span>
                <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">REAL-TIME RADAR</span>
              </div>
              <h3 class="font-bold text-sm text-white mb-1">Unified Live Order Tracker</h3>
              <p class="text-[11px] text-sky-400 font-medium mb-2">Pelacak Pesanan & QRIS Timer</p>
              <p class="text-xs text-stone-400 leading-relaxed mb-4">
                Modul pelacakan pesanan publik dilengkapi kartu QRIS interaktif, countdown timer 15 menit, dan radar progres penyiapan pesanan.
              </p>
            </div>
            <a href="/demo/portfolio#tracker" class="text-xs text-sky-400 hover:underline font-semibold">
              Eksplorasi Radar Pelacak &rarr;
            </a>
          </div>
        </div>
      </section>

      <!-- INTERACTIVE STORE SIMULATOR & RENTAL CALCULATOR -->
      <section class="my-14 p-6 sm:p-8 rounded-2xl bg-stone-900/90 border border-stone-800">
        <div class="max-w-2xl mx-auto text-center mb-8">
          <span class="text-xs text-amber-400 font-bold uppercase tracking-wider">Simulasi Calon Penyewa Toko</span>
          <h2 class="text-2xl font-bold text-white mt-1 mb-2">Kalkulator Sewa & Generator Toko Pribadi</h2>
          <p class="text-xs sm:text-sm text-stone-400">
            Tentukan identitas tokomu dan lihat bagaimana ekosistem Bintang Tech Studio langsung siap dijalankan dalam hitungan menit.
          </p>
        </div>

        <div class="max-w-xl mx-auto bg-stone-950 p-5 rounded-xl border border-stone-800 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-stone-300 mb-1">Nama Toko Digital Impianmu:</label>
            <input id="calc-store-name" type="text" value="Toko Sultan Game & Lisensi" class="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-stone-300 mb-1">Kategori Utama:</label>
              <select id="calc-category" class="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500">
                <option value="digital_accounts">Akun Premium & AI</option>
                <option value="game_vouchers">Voucher Game Online</option>
                <option value="software_keys">Lisensi Software & VPN</option>
                <option value="fnb_jastip">F&B & Jastip Minuman</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-300 mb-1">Pilihan Paket:</label>
              <select id="calc-plan" class="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" onchange="updateCalcEstimate()">
                <option value="starter">Starter (Rp50.000/bln)</option>
                <option value="pro">Pro (Custom)</option>
              </select>
            </div>
          </div>

          <div class="p-3 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-between text-xs">
            <div>
              <span class="text-stone-400">Estimasi Biaya Awal:</span>
              <p class="text-[11px] text-stone-500">Biaya sewa bln 1 + aktivasi setup</p>
            </div>
            <div class="text-right">
              <span id="calc-total-cost" class="font-bold text-base text-amber-400">Rp150.000</span>
              <p class="text-[10px] text-emerald-400 font-medium">Bulan berikutnya Rp50k/bln</p>
            </div>
          </div>

          <button onclick="launchCalculatedDemo()" class="w-full py-3 rounded-xl bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-xs shadow-lg shadow-orange-950/40 transition">
            🚀 Masuk ke Demo Toko dengan Profil Ini
          </button>
        </div>

        <script>
          function updateCalcEstimate() {
            const plan = document.getElementById('calc-plan').value;
            const costEl = document.getElementById('calc-total-cost');
            if (plan === 'starter') {
              costEl.textContent = 'Rp150.000';
            } else {
              costEl.textContent = 'Hubungi Tim Penjualan';
            }
          }

          function launchCalculatedDemo() {
            const name = document.getElementById('calc-store-name').value.trim() || 'Toko Demo Saya';
            try { sessionStorage.setItem('custom_store_name', name); } catch (_) {}
            window.location.href = '/demo/store';
          }
        </script>
      </section>

      <!-- PRICING & PLANS SECTION -->
      <section class="my-14 p-6 sm:p-8 rounded-2xl bg-[#1C1917] border border-stone-800">
        <div class="text-center max-w-2xl mx-auto mb-10">
          <h2 class="text-2xl font-bold text-white mb-2">Paket Langganan Platform</h2>
          <p class="text-xs sm:text-sm text-stone-400">
            Struktur sewa fleksibel yang dirancang untuk penjual digital dari skala pemula hingga berkembang.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          <!-- STARTER -->
          <div class="p-6 rounded-xl bg-stone-900 border-2 border-[#C2410C] flex flex-col justify-between relative shadow-xl">
            <div class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-[#C2410C] text-white text-[10px] font-bold uppercase tracking-wider">
              Paket Utama
            </div>
            <div>
              <h3 class="font-bold text-base text-white mb-1">Starter</h3>
              <p class="text-xs text-stone-400 mb-4">Cocok untuk toko digital yang ingin otomatisasi penuh Telegram.</p>
              <div class="mb-4">
                <span class="text-2xl sm:text-3xl font-extrabold text-white">Rp50.000</span>
                <span class="text-xs text-stone-400">/ bulan</span>
                <p class="text-[11px] text-amber-400 mt-1 font-medium">+ Biaya aktivasi & setup Rp100.000 (satu kali)</p>
              </div>
              <ul class="text-xs text-stone-300 space-y-2 mb-6">
                <li class="flex items-center gap-1.5">✓ Maksimal 20 Produk Aktif</li>
                <li class="flex items-center gap-1.5">✓ Telegram Bot & Mini App 24 Jam</li>
                <li class="flex items-center gap-1.5">✓ Seller Dashboard Foundation</li>
                <li class="flex items-center gap-1.5">✓ Fitur Broadcast Pelanggan</li>
                <li class="flex items-center gap-1.5">✓ Laporan Penjualan & Riwayat</li>
                <li class="flex items-center gap-1.5">✓ Sistem Voucher Diskon</li>
              </ul>
            </div>
            <a href="/demo/store" class="block w-full py-2.5 rounded-lg bg-[#C2410C] hover:bg-[#9a3412] text-white text-center font-bold text-xs transition">
              Coba Paket Starter
            </a>
          </div>

          <!-- PRO -->
          <div class="p-6 rounded-xl bg-stone-900/60 border border-stone-800 flex flex-col justify-between">
            <div>
              <h3 class="font-bold text-base text-white mb-1">Pro</h3>
              <p class="text-xs text-stone-400 mb-4">Untuk toko dengan katalog lebih luas dan kebutuhan multi-channel.</p>
              <div class="mb-4">
                <span class="text-xl sm:text-2xl font-bold text-white">Hubungi Kami</span>
                <p class="text-[11px] text-stone-400 mt-1">Konfigurasi kapasitas sesuai volume bisnis</p>
              </div>
              <ul class="text-xs text-stone-300 space-y-2 mb-6">
                <li class="flex items-center gap-1.5">✓ Hingga 100 Produk Aktif</li>
                <li class="flex items-center gap-1.5">✓ Integrasi WhatsApp Bot Tambahan</li>
                <li class="flex items-center gap-1.5">✓ Multi-staf & Role Otorisasi</li>
                <li class="flex items-center gap-1.5">✓ Laporan Analitik Lanjutan</li>
                <li class="flex items-center gap-1.5">✓ Prioritas Dukungan Teknis</li>
              </ul>
            </div>
            <a href="/demo/seller" class="block w-full py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-center font-semibold text-xs border border-stone-700 transition">
              Konsultasi Paket Pro
            </a>
          </div>

          <!-- BUSINESS -->
          <div class="p-6 rounded-xl bg-stone-900/60 border border-stone-800 flex flex-col justify-between">
            <div>
              <h3 class="font-bold text-base text-white mb-1">Business / Custom</h3>
              <p class="text-xs text-stone-400 mb-4">Solusi enterprise bagi distributor lisensi & agensi produk digital.</p>
              <div class="mb-4">
                <span class="text-xl sm:text-2xl font-bold text-white">Hubungi Kami</span>
                <p class="text-[11px] text-stone-400 mt-1">Dedicated infrastructure & custom domain</p>
              </div>
              <ul class="text-xs text-stone-300 space-y-2 mb-6">
                <li class="flex items-center gap-1.5">✓ Produk & Stok Tidak Terbatas</li>
                <li class="flex items-center gap-1.5">✓ Custom Domain Toko Web Mandiri</li>
                <li class="flex items-center gap-1.5">✓ Full WhatsApp + Telegram Ecosystem</li>
                <li class="flex items-center gap-1.5">✓ SLA Jaminan Uptime 99.9%</li>
                <li class="flex items-center gap-1.5">✓ Dedicated Database Partition</li>
              </ul>
            </div>
            <a href="/demo/owner" class="block w-full py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-center font-semibold text-xs border border-stone-700 transition">
              Eksplorasi Enterprise
            </a>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="mt-16 pt-8 border-t border-stone-800 text-center text-xs text-stone-500">
        <p class="mb-2">Bintang Tech Studio : Platform Sistem Dagang Digital Terotomasi</p>
        <p class="text-[11px]">Seluruh alur dalam demo ini menggunakan data simulasi lokal in-process yang aman tanpa dependensi eksternal.</p>
      </footer>
    </div>
  `;
  return renderPageShell('Platform Landing Page', 'landing', content);
}

// -------------------------------------------------------------
// 2. CUSTOMER TELEGRAM MINI APP (Mobile Simulation)
// -------------------------------------------------------------
export function handleRenderTelegramMiniApp(req: ParsedRequest): string {
  const categories = demoState.getCategories();
  const selectedCat = req.searchParams.get('cat') || 'all';
  const products = demoState.getProducts(selectedCat);
  const orders = demoState.getOrders();

  const content = `
    <div class="max-w-xl mx-auto px-3 py-6">
      <!-- DEMO DISCLOSURE BANNER -->
      <div class="p-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span>ℹ️</span>
          <span><b>Mode Simulasi Telegram WebApp</b> : Transaksi aman tanpa pemotongan saldo asli.</span>
        </div>
        <span class="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-mono">store_pilot_bintang_01</span>
      </div>

      <!-- TELEGRAM APP WRAPPER FRAME (390px styled) -->
      <div class="rounded-3xl bg-[#0C0A09] border-4 border-stone-800 shadow-2xl overflow-hidden flex flex-col min-h-[640px]">
        <!-- TELEGRAM STATUS / HEADER BAR -->
        <div class="bg-stone-900 px-4 py-2.5 flex items-center justify-between border-b border-stone-800 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-stone-400 text-sm cursor-pointer hover:text-white" onclick="alert('Simulasi tombol tutup Telegram WebApp')">✕</span>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-bold text-white text-[13px]">Bintang Store</span>
              <span class="text-[10px] text-stone-400">bot</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button id="cart-badge-btn" onclick="openCartDrawer()" class="relative px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs flex items-center gap-1">
              <span>🛒</span>
              <span id="cart-count" class="font-bold text-amber-400">0</span>
            </button>
            <span class="text-stone-400 text-xs">⋮</span>
          </div>
        </div>

        <!-- HERO BRAND BANNER -->
        <div class="bg-gradient-to-r from-stone-950 via-[#1C1917] to-stone-950 p-4 border-b border-stone-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 p-1 rounded-xl bg-stone-900 border border-stone-700 flex items-center justify-center">
              ${OFFICIAL_LOGO_SVG}
            </div>
            <div>
              <h2 class="font-extrabold text-sm text-white leading-tight">Toko Bintang Digital</h2>
              <p class="text-[11px] text-stone-400">Akun Premium & Lisensi Resmi Terbit 24 Jam</p>
            </div>
          </div>
          <span class="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
            Buka Otomatis
          </span>
        </div>

        <!-- CATEGORY PILLS FILTER -->
        <div class="px-3 py-2 bg-stone-950 border-b border-stone-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs">
          <a href="/demo/store?cat=all" class="px-3 py-1 rounded-full whitespace-nowrap transition ${
            selectedCat === 'all'
              ? 'bg-[#C2410C] text-white font-bold'
              : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
          }">
            Semua (36)
          </a>
          ${categories
            .map(
              (c) => `
            <a href="/demo/store?cat=${c.slug}" class="px-3 py-1 rounded-full whitespace-nowrap transition ${
              selectedCat === c.slug
                ? 'bg-[#C2410C] text-white font-bold'
                : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
            }">
              ${c.name}
            </a>
          `,
            )
            .join('')}
        </div>

        <!-- PRODUCTS GRID (CATALOG) -->
        <div class="p-3 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar space-y-2.5">
          ${products
            .map(
              (p) => `
            <div class="p-3 rounded-xl bg-stone-900/90 border border-stone-800 hover:border-stone-700 transition flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
                  ${p.monogram}
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <h3 class="font-bold text-xs text-white leading-snug">${p.name}</h3>
                    <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-semibold">${p.badge}</span>
                  </div>
                  <p class="text-[11px] text-stone-400 line-clamp-1">${p.duration} : ${p.shortDescription}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="font-extrabold text-xs text-white">Rp${p.price.toLocaleString('id-ID')}</span>
                    <span class="text-[10px] text-stone-500 line-through">Rp${p.originalPrice.toLocaleString('id-ID')}</span>
                    <span class="text-[10px] ${p.stock > 0 ? 'text-emerald-400' : 'text-red-400'} font-medium">
                      ${p.stock > 0 ? `Stok: ${p.stock}` : 'Habis'}
                    </span>
                  </div>
                </div>
              </div>
              <button onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price})" class="px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-xs shrink-0 transition ${
                p.stock > 0 ? '' : 'opacity-50 cursor-not-allowed'
              }" ${p.stock > 0 ? '' : 'disabled'}>
                + Beli
              </button>
            </div>
          `,
            )
            .join('')}
        </div>

        <!-- MINI APP FOOTER NAVIGATION TABS -->
        <div class="bg-stone-900 border-t border-stone-800 px-4 py-2 flex items-center justify-around text-[10px] text-stone-400">
          <button class="flex flex-col items-center text-amber-400 font-bold">
            <span>🏠</span>
            <span>Home</span>
          </button>
          <button onclick="openCartDrawer()" class="flex flex-col items-center hover:text-white">
            <span>🛒</span>
            <span>Keranjang</span>
          </button>
          <button onclick="openOrdersModal()" class="flex flex-col items-center hover:text-white">
            <span>📜</span>
            <span>Pesanan (${orders.length})</span>
          </button>
          <button onclick="alert('Profil Pembeli Demo Telegram')" class="flex flex-col items-center hover:text-white">
            <span>👤</span>
            <span>Akun</span>
          </button>
        </div>
      </div>

      <!-- CART & CHECKOUT DRAWER / MODAL -->
      <div id="cart-drawer" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-3">
        <div class="w-full max-w-md bg-[#1C1917] rounded-2xl border border-stone-800 p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-stone-800">
            <h3 class="font-bold text-sm text-white flex items-center gap-1.5">
              <span>🛒 Keranjang Belanja</span>
            </h3>
            <button onclick="closeCartDrawer()" class="text-stone-400 hover:text-white text-base">✕</button>
          </div>

          <div id="cart-items-container" class="py-4 space-y-2 flex-1">
            <p class="text-xs text-stone-400 text-center py-4">Keranjang masih kosong.</p>
          </div>

          <div class="pt-3 border-t border-stone-800 space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-stone-400">Total Pembayaran:</span>
              <span id="cart-total-price" class="font-extrabold text-sm text-white">Rp0</span>
            </div>

            <!-- CUSTOMER DETAILS FORM -->
            <div class="space-y-2 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80 text-xs">
              <div>
                <label for="input-customer-name" class="block text-[11px] text-stone-400 mb-1">Nama Pembeli:</label>
                <input id="input-customer-name" type="text" autocomplete="name" required aria-describedby="customer-name-error" class="w-full bg-stone-800 border border-stone-700 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500">
                <p id="customer-name-error" class="hidden text-red-400 text-[11px] mt-1" role="alert">Nama wajib diisi.</p>
              </div>
              <div>
                <label for="input-customer-contact" class="block text-[11px] text-stone-400 mb-1">WhatsApp / Username Telegram:</label>
                <input id="input-customer-contact" type="text" required aria-describedby="customer-contact-error" class="w-full bg-stone-800 border border-stone-700 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500">
                <p id="customer-contact-error" class="hidden text-red-400 text-[11px] mt-1" role="alert">Kontak wajib diisi.</p>
              </div>
              <div>
                <label for="select-payment-method" class="block text-[11px] text-stone-400 mb-1">Metode Pembayaran (Simulasi):</label>
                <select id="select-payment-method" class="w-full bg-stone-800 border border-stone-700 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500">
                  <option value="QRIS Instan (Simulasi)">QRIS Instan (Simulasi Bebas Saldo)</option>
                  <option value="BCA Virtual Account (Simulasi)">BCA Virtual Account (Simulasi)</option>
                  <option value="Mandiri Virtual Account (Simulasi)">Mandiri Virtual Account (Simulasi)</option>
                </select>
              </div>
            </div>

            <button id="btn-submit-checkout" onclick="submitCheckout('telegram_mini_app')" class="w-full py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-xs shadow-lg transition">
              ⚡ Konfirmasi & Bayar Simulasi
            </button>
          </div>
        </div>
      </div>

      <!-- RECEIPT / ORDER RESULT MODAL -->
      <div id="receipt-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-3">
        <div id="receipt-content" class="w-full max-w-md bg-[#1C1917] rounded-2xl border border-stone-800 p-5 shadow-2xl space-y-4">
        </div>
      </div>

      <!-- ORDERS LIST MODAL -->
      <div id="orders-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-3">
        <div class="w-full max-w-md bg-[#1C1917] rounded-2xl border border-stone-800 p-5 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-2 border-b border-stone-800">
            <h3 class="font-bold text-sm text-white">📜 Riwayat Pesanan Saya</h3>
            <button onclick="closeOrdersModal()" class="text-stone-400 hover:text-white text-sm">✕</button>
          </div>
          <div class="space-y-2 text-xs">
            ${orders
              .map(
                (o) => `
              <div class="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-mono font-bold text-amber-400">${o.orderId}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    o.paymentStatus === 'PAID'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }">${o.paymentStatus}</span>
                </div>
                <p class="text-stone-300">${o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</p>
                <div class="flex justify-between text-[11px] text-stone-500 pt-1">
                  <span>Total: Rp${o.totalAmount.toLocaleString('id-ID')}</span>
                  <span>${new Date(o.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- CLIENT CART SCRIPT -->
    <script>
      let cart = [];

      function addToCart(productId, productName, unitPrice) {
        const existing = cart.find(i => i.productId === productId);
        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({ productId, productName, unitPrice, quantity: 1 });
        }
        updateCartUi();
        openCartDrawer();
      }

      function updateCartUi() {
        const count = cart.reduce((acc, i) => acc + i.quantity, 0);
        document.getElementById('cart-count').textContent = count;

        const container = document.getElementById('cart-items-container');
        if (cart.length === 0) {
          container.innerHTML = '<p class="text-xs text-stone-400 text-center py-4">Keranjang masih kosong.</p>';
          document.getElementById('cart-total-price').textContent = 'Rp0';
          return;
        }

        let html = '';
        let total = 0;
        cart.forEach((item, idx) => {
          const sub = item.unitPrice * item.quantity;
          total += sub;
          html += \`
            <div class="p-2.5 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-between text-xs">
              <div>
                <p class="font-bold text-white">\${item.productName}</p>
                <p class="text-[11px] text-stone-400">Rp\${item.unitPrice.toLocaleString('id-ID')} x \${item.quantity}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-amber-400">Rp\${sub.toLocaleString('id-ID')}</span>
                <button onclick="removeFromCart(\${idx})" class="text-stone-500 hover:text-red-400 text-xs px-1">✕</button>
              </div>
            </div>
          \`;
        });

        container.innerHTML = html;
        document.getElementById('cart-total-price').textContent = 'Rp' + total.toLocaleString('id-ID');
      }

      function removeFromCart(idx) {
        cart.splice(idx, 1);
        updateCartUi();
      }

      function openCartDrawer() {
        document.getElementById('cart-drawer').classList.remove('hidden');
      }

      function closeCartDrawer() {
        document.getElementById('cart-drawer').classList.add('hidden');
      }

      function openOrdersModal() {
        document.getElementById('orders-modal').classList.remove('hidden');
      }

      function closeOrdersModal() {
        document.getElementById('orders-modal').classList.add('hidden');
      }

      async function submitCheckout(channel) {
        if (cart.length === 0) {
          alert('Keranjang belanja kosong.');
          return;
        }

        const name = document.getElementById('input-customer-name').value.trim();
        const contact = document.getElementById('input-customer-contact').value.trim();
        const nameError = document.getElementById('customer-name-error');
        const contactError = document.getElementById('customer-contact-error');
        nameError.classList.toggle('hidden', Boolean(name));
        contactError.classList.toggle('hidden', Boolean(contact));
        document.getElementById('input-customer-name').setAttribute('aria-invalid', String(!name));
        document.getElementById('input-customer-contact').setAttribute('aria-invalid', String(!contact));
        if (!name || !contact) {
          (name ? document.getElementById('input-customer-contact') : document.getElementById('input-customer-name')).focus();
          return;
        }

        const paymentMethod = document.getElementById('select-payment-method').value;

        const payload = {
          customerName: name,
          customerContact: contact,
          channel: channel || 'telegram_mini_app',
          paymentMethod: paymentMethod,
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity }))
        };

        const btn = document.getElementById('btn-submit-checkout');
        btn.disabled = true;
        btn.textContent = 'Memproses Pesanan...';

        try {
          const res = await fetch('/api/v1/demo/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Gagal memproses pesanan');
          }

          // Clear cart
          cart = [];
          updateCartUi();
          closeCartDrawer();

          // Show Receipt Modal
          renderReceiptModal(data.order);
        } catch (err) {
          alert('Error: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = '⚡ Konfirmasi & Bayar Simulasi';
        }
      }

      function renderReceiptModal(order) {
        const modal = document.getElementById('receipt-modal');
        const container = document.getElementById('receipt-content');

        container.innerHTML = \`
          <div class="text-center pb-3 border-b border-stone-800">
            <span class="text-3xl">🎉</span>
            <h3 class="font-extrabold text-base text-white mt-1">Pembayaran Berhasil!</h3>
            <p class="text-xs text-emerald-400 font-semibold">\${order.paymentMethod} (PAID)</p>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex justify-between text-stone-400">
              <span>Order ID:</span>
              <span class="font-mono font-bold text-white">\${order.orderId}</span>
            </div>
            <div class="flex justify-between text-stone-400">
              <span>Nama:</span>
              <span class="text-white">\${order.customerName}</span>
            </div>
            <div class="flex justify-between text-stone-400">
              <span>Total Bayar:</span>
              <span class="font-extrabold text-amber-400">Rp\${order.totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-1.5">
            <h4 class="font-bold text-[11px] text-amber-300 uppercase tracking-wider">📦 Lisensi / Akun Terbit Instan:</h4>
            \${order.fulfilledItems ? order.fulfilledItems.map(item => \`
              <div class="p-2 rounded bg-stone-950 font-mono text-[11px] text-emerald-300 select-all break-all border border-stone-800">
                \${item.name} &rarr; \${item.serialOrAccount}
              </div>
            \`).join('') : '<p class="text-stone-400 text-xs">Akun sedang diproses.</p>'}
          </div>

          <div class="pt-2 flex flex-col gap-2">
            <a href="/demo/seller" class="w-full py-2 rounded-lg bg-[#C2410C] hover:bg-[#9a3412] text-white text-center font-bold text-xs transition">
              📊 Lihat Pesanan di Seller Dashboard &rarr;
            </a>
            <a href="/demo/telegram-seller" class="w-full py-2 rounded-lg bg-sky-900 hover:bg-sky-800 text-sky-200 text-center font-semibold text-xs transition">
              🤖 Cek Notifikasi di Bot Telegram Seller &rarr;
            </a>
            <button onclick="document.getElementById('receipt-modal').classList.add('hidden')" class="w-full py-2 rounded-lg bg-stone-800 text-stone-300 text-xs">
              Tutup
            </button>
          </div>
        \`;

        modal.classList.remove('hidden');
      }
    </script>
  `;

  return renderPageShell('Customer Telegram Mini App', 'store', content);
}

// -------------------------------------------------------------
// 3. TELEGRAM SELLER BOT SIMULATOR
// -------------------------------------------------------------
export function handleRenderTelegramSellerBot(): string {
  const messages = demoState.getTelegramMessages();

  const content = `
    <div class="max-w-xl mx-auto px-4 py-8">
      <!-- HEADER EXPLANATION -->
      <div class="mb-4 p-3 rounded-xl bg-sky-900/20 border border-sky-800/40 text-sky-200 text-xs flex items-center justify-between">
        <div>
          <b>Telegram Seller Bot Simulator</b> : Membantu penjual memantau toko langsung dari ponsel tanpa buka browser.
        </div>
        <span class="text-[10px] bg-sky-900/40 px-2 py-0.5 rounded font-mono">@BintangSellerBot</span>
      </div>

      <!-- CHAT DEVICE FRAME -->
      <div class="rounded-3xl bg-[#0F141C] border-4 border-stone-800 shadow-2xl overflow-hidden flex flex-col min-h-[580px]">
        <!-- TELEGRAM BOT TOP BAR -->
        <div class="bg-[#17212B] px-4 py-3 flex items-center justify-between border-b border-stone-800">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              🤖
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h2 class="font-bold text-xs text-white">Bintang Seller Assistant</h2>
                <span class="text-sky-400 text-xs">✓</span>
              </div>
              <p class="text-[10px] text-stone-400">bot operasional resmi toko</p>
            </div>
          </div>
          <a href="/demo/seller" class="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-medium transition">
            Buka Dashboard
          </a>
        </div>

        <!-- TELEGRAM CHAT FEED -->
        <div class="p-4 flex-1 overflow-y-auto space-y-3.5 custom-scrollbar text-xs">
          ${messages
            .map(
              (m) => `
            <div class="flex flex-col items-start max-w-[92%]">
              <div class="p-3 rounded-2xl rounded-tl-sm bg-[#182533] border border-stone-800/60 text-stone-100 shadow-md space-y-2">
                <div class="whitespace-pre-wrap leading-relaxed">${m.sender === 'customer' ? escapeHtml(m.message) : m.message}</div>
                <div class="text-[9px] text-stone-400 text-right">${m.timestamp}</div>
              </div>
              ${
                m.buttons && m.buttons.length > 0
                  ? `
                <div class="mt-1.5 flex flex-wrap gap-1.5 w-full">
                  ${m.buttons
                    .map(
                      (b) => `
                    <a href="${b.action === 'open_dashboard' ? '/demo/seller' : '/demo/store'}" class="px-3 py-1.5 rounded-lg bg-[#2B5278] hover:bg-[#34628f] text-white font-medium text-[11px] text-center transition">
                      ${b.label}
                    </a>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
            </div>
          `,
            )
            .join('')}
        </div>

        <!-- SIMULATED CHAT COMMAND INPUT -->
        <div class="bg-[#17212B] p-3 border-t border-stone-800 flex items-center gap-2">
          <input type="text" readonly value="/orders - Cek daftar pesanan terbaru" class="flex-1 bg-[#0F141C] border border-stone-700/60 rounded-xl px-3 py-2 text-stone-300 text-xs cursor-not-allowed">
          <a href="/demo/store" title="Buat pesanan baru untuk memicu notifikasi bot" class="px-3 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-xs transition">
            + Order Demo
          </a>
        </div>
      </div>
    </div>
  `;

  return renderPageShell('Telegram Seller Bot Simulator', 'telegram-seller', content);
}

// -------------------------------------------------------------
// 4. SELLER DASHBOARD (SaaS Management)
// -------------------------------------------------------------
export function handleRenderSellerDashboard(): string {
  const orders = demoState.getOrders();
  const products = demoState.getProducts();

  const totalOmset = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalPaidOrders = orders.filter((o) => o.paymentStatus === 'PAID').length;
  const criticalStock = products.filter((p) => p.stock < 5).length;

  const content = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <!-- DASHBOARD TOP HEADER -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-bold text-white">Seller Dashboard</h1>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
              TOKO AKTIF
            </span>
          </div>
          <p class="text-xs text-stone-400 mt-1">Toko Bintang Tech (ID: store_pilot_bintang_01) : Paket Starter</p>
        </div>

        <div class="flex items-center gap-2">
          <a href="/demo/store" class="px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9a3412] text-white text-xs font-bold transition">
            🛍️ Buka Toko (Mini App)
          </a>
          <a href="/demo/telegram-seller" class="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition">
            🤖 Cek Bot Seller
          </a>
        </div>
      </div>

      <!-- OVERVIEW CARDS (4 METRICS) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-6">
        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Total Omset Penjualan</span>
          <div class="text-lg sm:text-xl font-extrabold text-white mt-1">Rp${totalOmset.toLocaleString('id-ID')}</div>
          <span class="text-[10px] text-emerald-400 font-medium">100% Terverifikasi</span>
        </div>

        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Pesanan Masuk</span>
          <div class="text-lg sm:text-xl font-extrabold text-white mt-1">${totalPaidOrders} Pesanan</div>
          <span class="text-[10px] text-amber-400 font-medium">Otomatisasi Penuh</span>
        </div>

        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Produk Aktif</span>
          <div class="text-lg sm:text-xl font-extrabold text-white mt-1">${products.length} / 20</div>
          <span class="text-[10px] text-stone-400 font-medium">Kapasitas Starter</span>
        </div>

        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Peringatan Stok</span>
          <div class="text-lg sm:text-xl font-extrabold text-white mt-1">${criticalStock} Produk</div>
          <span class="text-[10px] ${criticalStock > 0 ? 'text-orange-400' : 'text-emerald-400'} font-medium">
            ${criticalStock > 0 ? 'Perlu Restock' : 'Semua Aman'}
          </span>
        </div>
      </div>

      <!-- MAIN CONTENT TABS / TABLES (ORDERS & INVENTORY) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- LEFT: ORDERS LIST (2 COLS) -->
        <div class="lg:col-span-2 p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-sm text-white flex items-center gap-2">
              <span>📦 Daftar Pesanan Masuk (Real-Time Sinkron)</span>
              <span class="px-2 py-0.5 rounded bg-stone-800 text-[10px] font-mono text-amber-400">${orders.length} order</span>
            </h2>
            <a href="/demo/store" class="text-xs text-[#C2410C] hover:underline font-semibold">+ Buat Order Baru</a>
          </div>

          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left text-xs text-stone-300">
              <thead class="bg-stone-950/80 text-[11px] text-stone-400 uppercase tracking-wider border-b border-stone-800">
                <tr>
                  <th class="py-2.5 px-3">Order ID</th>
                  <th class="py-2.5 px-3">Pelanggan</th>
                  <th class="py-2.5 px-3">Produk</th>
                  <th class="py-2.5 px-3">Total</th>
                  <th class="py-2.5 px-3">Status</th>
                  <th class="py-2.5 px-3">Channel</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-800/60 font-mono">
                ${orders
                  .map(
                    (o) => `
                  <tr class="hover:bg-stone-800/40 transition">
                    <td class="py-3 px-3 font-bold text-amber-400">${o.orderId}</td>
                    <td class="py-3 px-3 font-sans font-medium text-white">${o.customerName}<br><span class="text-[10px] text-stone-500 font-mono">${o.customerContact}</span></td>
                    <td class="py-3 px-3 font-sans">${o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</td>
                    <td class="py-3 px-3 font-bold text-white">Rp${o.totalAmount.toLocaleString('id-ID')}</td>
                    <td class="py-3 px-3">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.paymentStatus === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }">
                        ${o.paymentStatus}
                      </span>
                    </td>
                    <td class="py-3 px-3 font-sans text-[11px] text-stone-400">
                      ${
                        o.channel === 'telegram_mini_app'
                          ? '📱 Telegram'
                          : o.channel === 'whatsapp_bot'
                            ? '💬 WhatsApp'
                            : '💻 Web Store'
                      }
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RIGHT: LIVE INVENTORY / STOCK LEVEL (1 COL) -->
        <div class="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-4">
          <h2 class="font-bold text-sm text-white flex items-center justify-between">
            <span>📊 Inventaris & Stok</span>
            <span class="text-[10px] text-stone-500">Atomic Reservation</span>
          </h2>

          <div class="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1 text-xs">
            ${products
              .slice(0, 8)
              .map(
                (p) => `
              <div class="p-2.5 rounded-lg bg-stone-950/70 border border-stone-800/70 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-white text-[11px]">${p.name}</h4>
                  <p class="text-[10px] text-stone-500">Rp${p.price.toLocaleString('id-ID')}</p>
                </div>
                <div class="text-right">
                  <span class="font-bold ${p.stock < 5 ? 'text-red-400' : 'text-emerald-400'}">${p.stock} unit</span>
                  <p class="text-[9px] text-stone-500">Tersedia</p>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>

          <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400">
            <span class="text-amber-400 font-bold">ℹ️ Info Transaksi:</span> Setiap pembelian di Mini App atau Web Store otomatis mengurangi stok di sini dalam 1 transaksi ACID PostgreSQL.
          </div>
        </div>
      </div>
    </div>
  `;

  return renderPageShell('Seller Dashboard SaaS', 'seller', content);
}

// -------------------------------------------------------------
// 5. CUSTOMER WHATSAPP BOT SIMULATOR
// -------------------------------------------------------------
export function handleRenderWhatsAppCustomerBot(): string {
  const messages = demoState.getWhatsAppMessages();

  const content = `
    <div class="max-w-xl mx-auto px-4 py-8">
      <div class="mb-4 p-3 rounded-xl bg-emerald-900/20 border border-emerald-800/40 text-emerald-200 text-xs flex items-center justify-between">
        <div>
          <b>WhatsApp Customer Bot Simulator</b> : Channel alternatif bagi pembeli yang bertransaksi via WhatsApp.
        </div>
        <span class="text-[10px] bg-emerald-900/40 px-2 py-0.5 rounded font-mono">Bukan Meta Cloud Live</span>
      </div>

      <!-- WHATSAPP FRAME -->
      <div class="rounded-3xl bg-[#0B141A] border-4 border-stone-800 shadow-2xl overflow-hidden flex flex-col min-h-[560px]">
        <!-- WA HEADER -->
        <div class="bg-[#1F2C34] px-4 py-3 flex items-center justify-between border-b border-stone-800">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-[#00A884] text-white flex items-center justify-center font-bold text-sm">
              🛍️
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h2 class="font-bold text-xs text-white">Toko Bintang Digital</h2>
                <span class="text-[#00A884] text-xs">✓</span>
              </div>
              <p class="text-[10px] text-stone-400">Official Business Account</p>
            </div>
          </div>
          <span class="text-stone-400 text-xs">⋮</span>
        </div>

        <!-- WA CHAT FEED -->
        <div class="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar text-xs">
          ${messages
            .map(
              (m) => `
            <div class="flex flex-col ${m.sender === 'customer' ? 'items-end' : 'items-start'} max-w-[85%] ${m.sender === 'customer' ? 'ml-auto' : ''}">
              <div class="p-3 rounded-2xl ${
                m.sender === 'customer'
                  ? 'bg-[#005C4B] text-white rounded-tr-sm'
                  : 'bg-[#202C33] text-stone-100 rounded-tl-sm'
              } shadow-md space-y-2">
                <div class="whitespace-pre-wrap leading-relaxed">${m.sender === 'customer' ? escapeHtml(m.message) : m.message}</div>
                <div class="text-[9px] text-stone-400 text-right">${m.timestamp}</div>
              </div>
              ${
                m.buttons && m.buttons.length > 0
                  ? `
                <div class="mt-1.5 flex flex-wrap gap-1 w-full">
                  ${m.buttons
                    .map(
                      (b) => `
                    <a href="/demo/store" class="px-3 py-1.5 rounded-lg bg-[#00A884] hover:bg-[#008f6f] text-white font-semibold text-[11px] text-center transition w-full">
                      ${b.label} &rarr;
                    </a>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
            </div>
          `,
            )
            .join('')}
        </div>

        <!-- WA INPUT -->
        <div class="bg-[#1F2C34] p-3 border-t border-stone-800 flex items-center gap-2">
          <input type="text" readonly value="Ketik pesan..." class="flex-1 bg-[#2A3942] border border-transparent rounded-full px-4 py-2 text-stone-400 text-xs cursor-not-allowed">
          <a href="/demo/store" class="w-8 h-8 rounded-full bg-[#00A884] flex items-center justify-center text-white text-sm">
            ➤
          </a>
        </div>
      </div>
    </div>
  `;

  return renderPageShell('WhatsApp Customer Bot Simulator', 'whatsapp', content);
}

// -------------------------------------------------------------
// 6. CUSTOMER WEB STORE (Optional Add-on)
// -------------------------------------------------------------
export function handleRenderCustomerWebStore(): string {
  const products = demoState.getProducts();

  const content = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <!-- ADD-ON EXPLANATION BANNER -->
      <div class="p-3 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
        <div>
          <b>Customer Web Store (Add-on Opsional)</b> : Toko web mandiri untuk menjangkau audiens di luar ekosistem Telegram.
        </div>
        <span class="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-mono">bintangstore.web.id</span>
      </div>

      <!-- WEB STOREFRONT HEADER -->
      <header class="p-5 rounded-2xl bg-stone-900 border border-stone-800 flex flex-wrap items-center justify-between gap-4 mb-8">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 p-1 rounded-xl bg-stone-950 border border-stone-700 flex items-center justify-center">
            ${OFFICIAL_LOGO_SVG}
          </div>
          <div>
            <h1 class="text-base sm:text-lg font-bold text-white">Bintang Tech Web Store</h1>
            <p class="text-xs text-stone-400">Lisensi & Akun Digital Resmi Bergaransi</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a href="/demo/store" class="px-3 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-xs transition">
            Buka di Telegram Mini App
          </a>
        </div>
      </header>

      <!-- FULL WIDTH PRODUCT GRID -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${products
          .slice(0, 12)
          .map(
            (p) => `
          <div class="p-4 rounded-xl bg-stone-900 border border-stone-800 flex flex-col justify-between hover:border-stone-700 transition">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 font-bold text-xs">
                  ${p.monogram}
                </span>
                <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">${p.badge}</span>
              </div>
              <h3 class="font-bold text-xs text-white mb-1">${p.name}</h3>
              <p class="text-[11px] text-stone-400 line-clamp-2 mb-3">${p.shortDescription}</p>
            </div>

            <div>
              <div class="flex items-baseline justify-between mb-3">
                <span class="text-xs font-extrabold text-white">Rp${p.price.toLocaleString('id-ID')}</span>
                <span class="text-[10px] text-stone-500 line-through">Rp${p.originalPrice.toLocaleString('id-ID')}</span>
              </div>
              <a href="/demo/store" class="block w-full py-2 rounded-lg bg-[#C2410C] hover:bg-[#9a3412] text-white text-center font-bold text-xs transition">
                Beli Produk
              </a>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  return renderPageShell('Customer Web Store Add-on', 'web-store', content);
}

// -------------------------------------------------------------
// 7. PLATFORM OWNER CONSOLE (Platform Control Plane)
// -------------------------------------------------------------
export function handleRenderOwnerConsole(): string {
  const logs = demoState.getActivityLogs();

  const content = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <!-- OWNER TOP HEADER -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-bold text-white">Platform Owner Console</h1>
            <span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
              PLATFORM OPERATOR
            </span>
          </div>
          <p class="text-xs text-stone-400 mt-1">Kendali Multi-Tenant, Paket Langganan, dan Audit Log Platform</p>
        </div>

        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            ● Sistem Sehat (Healthy)
          </span>
        </div>
      </div>

      <!-- PLATFORM OVERVIEW METRICS -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Total Penyewa Toko</span>
          <div class="text-lg sm:text-xl font-bold text-white mt-1">2 Toko Aktif</div>
          <span class="text-[10px] text-purple-400 font-medium">Multi-tenant RLS</span>
        </div>

        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Total Pendapatan Sewa</span>
          <div class="text-lg sm:text-xl font-bold text-white mt-1">Rp250.000 / bln</div>
          <span class="text-[10px] text-emerald-400 font-medium">100% On-time</span>
        </div>

        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Bot Engine Worker</span>
          <div class="text-lg sm:text-xl font-bold text-white mt-1">Running</div>
          <span class="text-[10px] text-emerald-400 font-medium">Outbox Processed</span>
        </div>

        <div class="p-4 rounded-xl bg-stone-900 border border-stone-800">
          <span class="text-[11px] text-stone-400">Status Keamanan Target</span>
          <div class="text-lg sm:text-xl font-bold text-white mt-1">Locked</div>
          <span class="text-[10px] text-amber-400 font-medium">Production Protected</span>
        </div>
      </div>

      <!-- TENANT DIRECTORY & ACTIVITY LOG -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- TENANTS DIRECTORY -->
        <div class="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-3">
          <h2 class="font-bold text-sm text-white flex items-center justify-between">
            <span>🏢 Direktori Penyewa Toko (Tenants)</span>
            <span class="text-[10px] text-stone-500">2 Tenants</span>
          </h2>

          <div class="space-y-2 text-xs">
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
              <div class="flex justify-between items-center">
                <span class="font-bold text-white">Toko Bintang Tech</span>
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">AKTIF</span>
              </div>
              <p class="text-stone-400 text-[11px]">ID: <code>store_pilot_bintang_01</code> : Paket Starter (Rp50k/bln)</p>
              <div class="flex items-center gap-2 pt-1 text-[10px] text-stone-500">
                <span>Channel: Telegram Bot + Mini App</span>
                <span>•</span>
                <a href="/demo/seller" class="text-orange-400 hover:underline">Inspeksi Dashboard &rarr;</a>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
              <div class="flex justify-between items-center">
                <span class="font-bold text-white">Digital Studio Beta</span>
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">AKTIF</span>
              </div>
              <p class="text-stone-400 text-[11px]">ID: <code>store_pilot_beta_99</code> : Paket Pro (Multi-channel)</p>
              <div class="flex items-center gap-2 pt-1 text-[10px] text-stone-500">
                <span>Channel: Telegram + WhatsApp + Web Store</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ACTIVITY AUDIT LOG -->
        <div class="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-3">
          <h2 class="font-bold text-sm text-white flex items-center justify-between">
            <span>📜 Audit Aktivitas Platform</span>
            <span class="text-[10px] text-stone-500">Live Log</span>
          </h2>

          <div class="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 text-xs font-mono">
            ${logs
              .map(
                (l) => `
              <div class="p-2.5 rounded-lg bg-stone-950/80 border border-stone-800 text-[11px] space-y-1">
                <div class="flex justify-between text-stone-400">
                  <span class="text-purple-300 font-bold">${l.action}</span>
                  <span class="text-[10px]">${new Date(l.timestamp).toLocaleTimeString('id-ID')}</span>
                </div>
                <p class="text-stone-300 font-sans text-xs">${l.details}</p>
                <p class="text-[10px] text-stone-500 font-sans">Aktor: ${l.actor}</p>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  return renderPageShell('Platform Owner Console', 'owner', content);
}

// -------------------------------------------------------------
// 7.5. PORTFOLIO & PROYEK EKOSISTEM DIRECTORY (/demo/portfolio)
// -------------------------------------------------------------
export function handleRenderPortfolioPage(): string {
  const content = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <!-- PORTFOLIO HERO -->
      <section class="text-center py-8 sm:py-12 border-b border-stone-800">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
          <span>📁 Direktori Portofolio & Proyek Riil</span>
        </div>
        <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          Ekosistem Dagang Terpadu Bintang Tech
        </h1>
        <p class="text-sm sm:text-base text-stone-300 max-w-3xl mx-auto leading-relaxed">
          Platform Bintang Tech Studio dirancang berdasarkan pembuktian lapangan di berbagai vertikal komersial:
          dari operasional F&B jastip berskala 1.328 gerai, etalase akun digital 24 jam, radar pelacak pesanan terpadu, hingga arsitektur referensi ringan zero-build.
        </p>
      </section>

      <!-- PORTFOLIO GRID -->
      <div class="my-12 space-y-12">
        <!-- PROJECT 1: F&B JASTIP (KOPI KENANGAN & JANJI JIWA) -->
        <article id="kopken" class="p-6 sm:p-8 rounded-3xl bg-stone-900/90 border border-amber-900/40 shadow-xl space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div class="flex items-center gap-3">
              <span class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold">
                ☕
              </span>
              <div>
                <h2 class="text-xl sm:text-2xl font-bold text-white">Bintang Store : F&B Jastip Online</h2>
                <p class="text-xs text-amber-400 font-medium">Kopi Kenangan & Janji Jiwa Multi-Outlet Ordering System</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                PRODUKSI RIIL
              </span>
              <span class="px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 text-xs font-mono">
                1.328 Outlet
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-300">
            <div class="space-y-3">
              <h3 class="font-bold text-sm text-white uppercase tracking-wider text-amber-400">Kapabilitas & Fitur Unggulan:</h3>
              <ul class="space-y-2 leading-relaxed">
                <li class="flex items-start gap-2">
                  <span class="text-amber-400 font-bold">✓</span>
                  <div><b>Database 1.328 Outlet se-Indonesia:</b> Berisi titik GPS presisi, jam buka-tutup kasir, dan status operasional gerai Signature / Mall / Standalone.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-amber-400 font-bold">✓</span>
                  <div><b>GPS Proximity via Haversine Formula:</b> Menghitung jarak gerai terdekat terhadap koordinat ponsel pelanggan dalam milidetik.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-amber-400 font-bold">✓</span>
                  <div><b>Kustomisasi Racikan Pas:</b> Pengaturan Suhu (Ice/Hot), Ukuran Cup (Regular/Large), Takaran Gula (Normal/Less/No Sugar), Es, dan Topping.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-amber-400 font-bold">✓</span>
                  <div><b>Dual Mode Pengambilan:</b> Mendukung Takeaway langsung di counter gerai dan Delivery via kurir instan (flat rate Rp5.000).</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-amber-400 font-bold">✓</span>
                  <div><b>Bintang SplitPay (Split Bill):</b> Patungan pesanan otomatis dengan upload bukti QRIS Host ke Supabase storage bucket <code>receipts</code>.</div>
                </li>
              </ul>
            </div>

            <div class="p-5 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col justify-between space-y-4">
              <div>
                <span class="text-[11px] text-stone-500 font-mono">STACK & ARSITEKTUR</span>
                <p class="font-bold text-white text-xs mt-1">Vanilla JS ES6+ (Zero-Build) · HTML5 Semantik · Tailwind CSS Extended · Supabase Storage</p>
                <p class="text-stone-400 text-xs mt-3 leading-relaxed">
                  Dirancang untuk kecepatan buka instan di koneksi seluler tanpa kompilasi bundler runtime.
                  Aset katalog kopi bersumber dari <code>menu.json</code> dan database gerai nasional dari <code>outlet.json</code>.
                </p>
              </div>

              <div class="pt-2 flex flex-wrap gap-2">
                <button onclick="openKopKenSimulationModal()" class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition">
                  ☕ Buka Simulasi Racikan Kopi & GPS
                </button>
                <a href="/demo/store" class="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition">
                  Lihat Toko Digital &rarr;
                </a>
              </div>
            </div>
          </div>
        </article>

        <!-- PROJECT 2: DIGITAL PRODUCTS STORE -->
        <article id="digital-store" class="p-6 sm:p-8 rounded-3xl bg-stone-900/90 border border-[#C2410C]/40 shadow-xl space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div class="flex items-center gap-3">
              <span class="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center text-2xl font-bold">
                🛍️
              </span>
              <div>
                <h2 class="text-xl sm:text-2xl font-bold text-white">Bintang Store : Produk Digital & Lisensi</h2>
                <p class="text-xs text-orange-400 font-medium">Automated Digital Goods Storefront (Telegram Mini App & Web)</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold border border-orange-500/30">
                ETALASE UTAMA
              </span>
              <span class="px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 text-xs font-mono">
                36 Produk
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-300">
            <div class="space-y-3">
              <h3 class="font-bold text-sm text-white uppercase tracking-wider text-orange-400">Kapabilitas & Fitur Unggulan:</h3>
              <ul class="space-y-2 leading-relaxed">
                <li class="flex items-start gap-2">
                  <span class="text-orange-400 font-bold">✓</span>
                  <div><b>Akun AI Generatif:</b> Google One AI Premium 2TB + Gemini Advanced, ChatGPT Plus (Private), Claude Pro.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-orange-400 font-bold">✓</span>
                  <div><b>Hiburan & Streaming:</b> Spotify Premium Individu/Family, YouTube Premium No-Ads, Netflix Ultra HD 4K.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-orange-400 font-bold">✓</span>
                  <div><b>Kreativitas & Produktivitas:</b> Canva Pro Edu Lifetime Garansi, Microsoft 365, VPN Keamanan.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-orange-400 font-bold">✓</span>
                  <div><b>Penerbitan Kredensial Otomatis:</b> Kode serial dan login akun diterbitkan instan pada layar penerimaan setelah pembayaran terkonfirmasi.</div>
                </li>
              </ul>
            </div>

            <div class="p-5 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col justify-between space-y-4">
              <div>
                <span class="text-[11px] text-stone-500 font-mono">INTEGRASI MULTI-CHANNEL</span>
                <p class="font-bold text-white text-xs mt-1">Telegram Mini App · WhatsApp Bot · Seller Dashboard · Web Store Add-on</p>
                <p class="text-stone-400 text-xs mt-3 leading-relaxed">
                  Menjadi etalase percontohan (Pilot Tenant) bagi tenant baru yang menyewa sistem Bintang Tech Studio.
                  Seluruh perubahan inventaris dan pesanan tersinkronisasi lintas channel secara ACID.
                </p>
              </div>

              <div class="pt-2 flex flex-wrap gap-2">
                <a href="/demo/store" class="px-4 py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9a3412] text-white font-bold text-xs transition">
                  🛍️ Buka Toko Pembeli (Mini App) &rarr;
                </a>
                <a href="/demo/seller" class="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition">
                  📊 Seller Dashboard &rarr;
                </a>
              </div>
            </div>
          </div>
        </article>

        <!-- PROJECT 3: UNIFIED LIVE ORDER TRACKER -->
        <article id="tracker" class="p-6 sm:p-8 rounded-3xl bg-stone-900/90 border border-sky-900/40 shadow-xl space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div class="flex items-center gap-3">
              <span class="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-2xl font-bold">
                📡
              </span>
              <div>
                <h2 class="text-xl sm:text-2xl font-bold text-white">Unified Live Order Tracker</h2>
                <p class="text-xs text-sky-400 font-medium">Radar Pelacakan Pesanan Terpadu & Modul QRIS Interaktif</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
                RADAR PUBLIK
              </span>
              <span class="px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 text-xs font-mono">
                tracking.html
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-300">
            <div class="space-y-3">
              <h3 class="font-bold text-sm text-white uppercase tracking-wider text-sky-400">Kapabilitas & Fitur Unggulan:</h3>
              <ul class="space-y-2 leading-relaxed">
                <li class="flex items-start gap-2">
                  <span class="text-sky-400 font-bold">✓</span>
                  <div><b>Kartu QRIS Interaktif:</b> Menampilkan barcode QRIS dinamis beresolusi tinggi dengan nomor referensi transaksi unik.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-sky-400 font-bold">✓</span>
                  <div><b>Countdown Timer 15 Menit:</b> Timer presisi untuk memastikan batas waktu pembayaran QRIS sebelum kedaluwarsa.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-sky-400 font-bold">✓</span>
                  <div><b>4 Tahap Progres Pesanan:</b> Menunggu Pembayaran ➔ Terverifikasi ➔ Diproses Sistem / Barista ➔ Siap Diambil / Terkirim.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-sky-400 font-bold">✓</span>
                  <div><b>Bintang SplitPay Radar:</b> Memantau status pembayaran tiap rekan patungan tanpa perlu bertanya manual di grup chat.</div>
                </li>
              </ul>
            </div>

            <div class="p-5 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col justify-between space-y-4">
              <div>
                <span class="text-[11px] text-stone-500 font-mono">PENGALAMAN PENGGUNA</span>
                <p class="font-bold text-white text-xs mt-1">Transisi Sinematik The Obsidian Gate · Real-Time State Persistence</p>
                <p class="text-stone-400 text-xs mt-3 leading-relaxed">
                  Membangun rasa aman dan transparansi tinggi bagi pelanggan setelah menekan tombol checkout QRIS.
                </p>
              </div>

              <div class="pt-2 flex flex-wrap gap-2">
                <button onclick="openTrackerSimulationModal()" class="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs transition">
                  📡 Buka Simulasi Radar Tracker
                </button>
              </div>
            </div>
          </div>
        </article>

        <!-- PROJECT 4: DIGITAL MINIMAL TEMPLATE -->
        <article id="template" class="p-6 sm:p-8 rounded-3xl bg-stone-900/90 border border-purple-900/40 shadow-xl space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div class="flex items-center gap-3">
              <span class="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-2xl font-bold">
                ⚡
              </span>
              <div>
                <h2 class="text-xl sm:text-2xl font-bold text-white">Digital Minimal Reference Template</h2>
                <p class="text-xs text-purple-400 font-medium">Arsitektur Modular Zero-Build untuk Toko Ringan Cepat</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                ARSITEKTUR REFERENSI
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-300">
            <div class="space-y-3">
              <h3 class="font-bold text-sm text-white uppercase tracking-wider text-purple-400">Keunggulan Desain:</h3>
              <ul class="space-y-2 leading-relaxed">
                <li class="flex items-start gap-2">
                  <span class="text-purple-400 font-bold">✓</span>
                  <div><b>Zero Runtime Bundler:</b> Memuat instan dalam tempo kurang dari 300ms tanpa beban bundler berat.</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-purple-400 font-bold">✓</span>
                  <div><b>Multi-Page Separation:</b> <code>index.html</code> (Landing), <code>webapp.html</code> (Customer Mini App), <code>admin.html</code> (Seller Dashboard).</div>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-purple-400 font-bold">✓</span>
                  <div><b>Adaptor Pembayaran Fleksibel:</b> Mendukung <code>demo-payment.js</code> dan adapter gateway pihak ketiga tanpa merombak UI.</div>
                </li>
              </ul>
            </div>

            <div class="p-5 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col justify-between space-y-4">
              <div>
                <span class="text-[11px] text-stone-500 font-mono">STATUS INTEGRASI</span>
                <p class="font-bold text-white text-xs mt-1">Diturunkan Menjadi Package @bintang/customer-store Monorepo</p>
                <p class="text-stone-400 text-xs mt-3 leading-relaxed">
                  Menjadi fondasi kode bersih bagi paket customer-store dan template penyewaan toko Bintang Tech Studio.
                </p>
              </div>

              <div class="pt-2">
                <a href="/demo/store" class="inline-block px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs transition">
                  Eksplorasi di Mini App &rarr;
                </a>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- KOPKEN INTERACTIVE PREVIEW MODAL -->
      <div id="kopken-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm hidden flex items-center justify-center p-3">
        <div class="w-full max-w-lg bg-[#1C1917] rounded-3xl border border-stone-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-stone-800">
            <div class="flex items-center gap-2">
              <span class="text-2xl">☕</span>
              <h3 class="font-bold text-sm text-white">Simulasi F&B Jastip : Kopi Kenangan</h3>
            </div>
            <button onclick="document.getElementById('kopken-modal').classList.add('hidden')" class="text-stone-400 hover:text-white text-base">✕</button>
          </div>

          <div class="space-y-4 text-xs text-stone-300">
            <!-- OUTLET SELECTOR SIMULATION -->
            <div class="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
              <div class="flex justify-between items-center">
                <label class="font-bold text-amber-400 text-[11px] uppercase tracking-wider">📍 Gerai Terdekat (Radar GPS Haversine):</label>
                <span class="text-[10px] text-emerald-400 font-semibold">Buka 08:00 - 22:00</span>
              </div>
              <select class="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-white text-xs">
                <option>Kopi Kenangan - Mall Kota Kasablanka (0.4 km) [Mall]</option>
                <option>Kopi Kenangan - Tebet Raya (1.2 km) [Standalone]</option>
                <option>Kopi Kenangan - Kuningan City (1.8 km) [Signature]</option>
                <option>Kopi Kenangan - Grand Indonesia (3.5 km) [Signature]</option>
              </select>
              <p class="text-[10px] text-stone-500">Mendeteksi otomatis dari 1.328 gerai se-Indonesia dengan rumus jarak Haversine.</p>
            </div>

            <!-- DRINK CUSTOMIZER SIMULATION -->
            <div class="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-3">
              <div class="flex justify-between items-center">
                <span class="font-bold text-white text-xs">Kopi Kenangan Mantan (Ice)</span>
                <span class="font-extrabold text-amber-400 text-xs">Rp19.000</span>
              </div>

              <div>
                <label class="block text-[11px] text-stone-400 mb-1">Ukuran Cup:</label>
                <div class="grid grid-cols-2 gap-2 text-center">
                  <div class="p-2 rounded-lg bg-orange-600/30 border border-orange-500 text-white font-bold">Regular (Cup 16oz)</div>
                  <div class="p-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-400">Large (+Rp5.000)</div>
                </div>
              </div>

              <div>
                <label class="block text-[11px] text-stone-400 mb-1">Takaran Gula Aren:</label>
                <div class="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  <div class="p-1.5 rounded bg-stone-950 border border-stone-800 text-stone-400">Less Sugar (50%)</div>
                  <div class="p-1.5 rounded bg-orange-600/30 border border-orange-500 text-white font-bold">Normal (100%)</div>
                  <div class="p-1.5 rounded bg-stone-950 border border-stone-800 text-stone-400">No Sugar (0%)</div>
                </div>
              </div>

              <div>
                <label class="block text-[11px] text-stone-400 mb-1">Metode Pengambilan:</label>
                <div class="grid grid-cols-2 gap-2 text-center">
                  <div class="p-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-400">Takeaway (Ambil di Toko)</div>
                  <div class="p-2 rounded-lg bg-orange-600/30 border border-orange-500 text-white font-bold">Delivery Instan (+Rp5k)</div>
                </div>
              </div>
            </div>

            <!-- SPLITPAY NOTICE -->
            <div class="p-3 rounded-xl bg-stone-950 border border-amber-900/40 text-[11px] text-stone-400 flex items-center gap-2.5">
              <span class="text-xl">💳</span>
              <div>
                <b class="text-amber-300">Bintang SplitPay Aktif:</b>
                <span>Dapat patungan bersama teman dengan membagi tagihan otomatis dan mengunggah bukti QRIS Host ke Supabase storage.</span>
              </div>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button onclick="document.getElementById('kopken-modal').classList.add('hidden')" class="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold">
              Tutup Simulasi
            </button>
          </div>
        </div>
      </div>

      <!-- TRACKER INTERACTIVE PREVIEW MODAL -->
      <div id="tracker-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm hidden flex items-center justify-center p-3">
        <div class="w-full max-w-md bg-[#1C1917] rounded-3xl border border-stone-800 p-6 shadow-2xl space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-stone-800">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📡</span>
              <h3 class="font-bold text-sm text-white">Radar Pelacak Pesanan (Live)</h3>
            </div>
            <button onclick="document.getElementById('tracker-modal').classList.add('hidden')" class="text-stone-400 hover:text-white text-base">✕</button>
          </div>

          <div class="space-y-4 text-xs">
            <div class="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-2">
              <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Countdown Pembayaran QRIS</span>
              <div id="sim-timer" class="text-3xl font-extrabold text-white font-mono">14:58</div>
              <p class="text-[11px] text-stone-400">Order ID: <code class="text-amber-300 font-bold">ORD-RADAR-2026</code></p>
            </div>

            <!-- TRACKING PROGRESS STEPS -->
            <div class="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-3">
              <span class="font-bold text-[11px] text-white uppercase tracking-wider block">Tahapan Progres:</span>
              <div class="space-y-2">
                <div class="flex items-center gap-2.5 text-emerald-400">
                  <span class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold">✓</span>
                  <span>Pesanan Dibuat Pelanggan</span>
                </div>
                <div class="flex items-center gap-2.5 text-emerald-400">
                  <span class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold">✓</span>
                  <span>Pembayaran QRIS Terverifikasi</span>
                </div>
                <div class="flex items-center gap-2.5 text-amber-400 animate-pulse">
                  <span class="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold">●</span>
                  <span>Sedang Diproses Sistem / Barista</span>
                </div>
                <div class="flex items-center gap-2.5 text-stone-500">
                  <span class="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-xs font-bold">○</span>
                  <span>Siap Diambil / Terkirim</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button onclick="document.getElementById('tracker-modal').classList.add('hidden')" class="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold">
              Tutup Radar
            </button>
          </div>
        </div>
      </div>

      <script>
        function openKopKenSimulationModal() {
          document.getElementById('kopken-modal').classList.remove('hidden');
        }
        function openTrackerSimulationModal() {
          document.getElementById('tracker-modal').classList.remove('hidden');
        }
      </script>
    </div>
  `;

  return renderPageShell('Portofolio & Ekosistem Proyek', 'portfolio', content);
}

// -------------------------------------------------------------
// 8. API ENDPOINT HANDLERS (CHECKOUT & RESET)
// -------------------------------------------------------------
export async function handleDemoCheckout(req: ParsedRequest): Promise<{
  readonly status: number;
  readonly body: { readonly success: boolean; readonly order?: DemoOrder; readonly error?: string };
}> {
  try {
    const body = await req.getBody<{
      readonly customerName?: string;
      readonly customerContact?: string;
      readonly channel?: 'telegram_mini_app' | 'whatsapp_bot' | 'web_store';
      readonly paymentMethod?: string;
      readonly items?: readonly { readonly productId: string; readonly quantity: number }[];
    }>();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestError('Keranjang harus memiliki minimal 1 item.');
    }
    if (typeof body.customerName !== 'string' || !body.customerName.trim()) {
      throw new BadRequestError('Nama pembeli wajib diisi.');
    }
    if (typeof body.customerContact !== 'string' || !body.customerContact.trim()) {
      throw new BadRequestError('Kontak pembeli wajib diisi.');
    }

    const order = demoState.createOrder({
      customerName: body.customerName ?? 'Pelanggan Demo',
      customerContact: body.customerContact ?? 'contact_demo@bintang.tech',
      channel: body.channel ?? 'telegram_mini_app',
      paymentMethod: body.paymentMethod ?? 'QRIS Instan (Simulasi)',
      items: body.items,
    });

    return {
      status: 201,
      body: {
        success: true,
        order,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export function handleDemoReset(): {
  readonly status: number;
  readonly body: { readonly success: boolean; readonly message: string };
} {
  demoState.reset();
  return {
    status: 200,
    body: {
      success: true,
      message: 'Demo state successfully reset to initial baseline',
    },
  };
}

export function handleDemoGetOrders(): {
  readonly status: number;
  readonly body: { readonly success: boolean; readonly orders: readonly DemoOrder[] };
} {
  return {
    status: 200,
    body: {
      success: true,
      orders: demoState.getOrders(),
    },
  };
}

export function handleDemoFulfillOrder(orderId: string): {
  readonly status: number;
  readonly body: { readonly success: boolean; readonly message?: string; readonly error?: string };
} {
  const success = demoState.fulfillOrder(orderId);
  if (!success) {
    return {
      status: 404,
      body: {
        success: false,
        error: `Pesanan dengan Order ID "${orderId}" tidak ditemukan.`,
      },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      message: `Pesanan ${orderId} berhasil ditandai sebagai FULFILLED (Selesai).`,
    },
  };
}

export async function handleDemoRestockProduct(
  req: ParsedRequest,
  productId: string,
): Promise<{
  readonly status: number;
  readonly body: {
    readonly success: boolean;
    readonly productId?: string;
    readonly newStock?: number;
    readonly error?: string;
  };
}> {
  try {
    const body = await req.getBody<{ readonly amount?: number }>();
    const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : 10;
    const newStock = demoState.restockProduct(productId, amount);
    return {
      status: 200,
      body: {
        success: true,
        productId,
        newStock,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function handleDemoTelegramCommand(req: ParsedRequest): Promise<{
  readonly status: number;
  readonly body: {
    readonly success: boolean;
    readonly reply?: string;
    readonly error?: string;
  };
}> {
  try {
    const body = await req.getBody<{ readonly command?: string }>();
    const cmd = (body.command || '/orders').trim();

    let botResponse = '';
    const orders = demoState.getOrders();
    const products = demoState.getProducts();

    if (cmd === '/orders') {
      const latest = orders.slice(0, 3);
      botResponse =
        '📋 <b>DAFTAR 3 PESANAN TERBARU:</b>\n\n' +
        latest
          .map(
            (o) =>
              `• <code>${o.orderId}</code> - ${o.customerName}\n  Rp${o.totalAmount.toLocaleString('id-ID')} (${o.paymentStatus}) [${o.fulfillmentStatus}]`,
          )
          .join('\n\n');
    } else if (cmd === '/stock') {
      const lowStock = products.filter((p) => p.stock < 5);
      if (lowStock.length === 0) {
        botResponse = '✅ <b>STATUS STOK AMAN:</b>\nSemua produk memiliki stok di atas 5 unit.';
      } else {
        botResponse =
          '⚠️ <b>PERINGATAN STOK MENIPIS:</b>\n\n' +
          lowStock.map((p) => `• ${p.name}: tersisa <b>${p.stock} unit</b>`).join('\n') +
          '\n\n<i>Silakan lakukan restock dari Seller Dashboard.</i>';
      }
    } else if (cmd === '/omset') {
      const total = orders.reduce((acc, o) => acc + o.totalAmount, 0);
      botResponse = `💰 <b>RINGKASAN OMSET HARI INI:</b>\n\nTotal Omset: <b>Rp${total.toLocaleString('id-ID')}</b>\nTotal Transaksi: <b>${orders.length} Pesanan</b>\nFulfillment Rate: <b>100%</b>`;
    } else if (cmd === '/broadcast') {
      botResponse =
        '📢 <b>PESAN PROMO TERKIRIM!</b>\n\nPesan promosi voucher diskon berhasil disiarkan ke 1.250 pelanggan aktif Telegram tokomu.';
    } else {
      botResponse = `🤖 Perintah tidak dikenal: ${escapeHtml(cmd)}.\nGunakan: /orders, /stock, /omset, atau /broadcast.`;
    }

    demoState.addTelegramMessage({
      sender: 'bot',
      message: botResponse,
    });

    return {
      status: 200,
      body: {
        success: true,
        reply: botResponse,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function handleDemoWhatsAppMessage(req: ParsedRequest): Promise<{
  readonly status: number;
  readonly body: {
    readonly success: boolean;
    readonly reply?: string;
    readonly error?: string;
  };
}> {
  try {
    const body = await req.getBody<{ readonly text?: string }>();
    const text = (body.text || '1').trim();

    demoState.addWhatsAppMessage({
      sender: 'customer',
      message: text,
    });

    let botReply = '';
    if (text.includes('1') || text.toLowerCase().includes('katalog')) {
      botReply =
        '📚 <b>KATALOG AKUN TERLARIS HARI INI:</b>\n\n1. Spotify Premium 1 Bulan: Rp19.000\n2. YouTube Premium 1 Bulan: Rp15.000\n3. Canva Pro Lifetime: Rp25.000\n4. ChatGPT Plus Private: Rp65.000\n\nKetik nomor produk atau klik tombol untuk langsung beli!';
    } else if (text.includes('2') || text.toLowerCase().includes('promo')) {
      botReply =
        '🎉 <b>KODE PROMO SPESIAL:</b>\nGunakan kode <code>BINTANGVIP</code> saat checkout untuk potongan langsung Rp5.000!';
    } else if (text.includes('3') || text.toLowerCase().includes('status')) {
      const latestOrder = demoState.getOrders()[0];
      botReply = latestOrder
        ? `📦 <b>STATUS PESANAN TERAKHIR:</b>\nOrder ID: ${latestOrder.orderId}\nStatus: ${latestOrder.paymentStatus} (${latestOrder.fulfillmentStatus})\nTotal: Rp${latestOrder.totalAmount.toLocaleString('id-ID')}`
        : 'Belum ada pesanan aktif.';
    } else {
      botReply =
        '👋 Halo! Customer Service Bot siap membantu. Silakan pilih:\n1. Katalog Akun & Harga\n2. Promo Spesial\n3. Cek Status Pesanan\n4. Hubungi Admin';
    }

    demoState.addWhatsAppMessage({
      sender: 'bot',
      message: botReply,
    });

    return {
      status: 200,
      body: {
        success: true,
        reply: botReply,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
