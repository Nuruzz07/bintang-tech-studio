// Bintang Store — Customer WebApp Page
// Production-grade Digital Commerce Storefront
// Brand: Bintang Store — "Produk digital, langsung beres."

import { store } from '../state/store.js';
import { CATEGORIES } from '../data/products.js';
import { CATEGORIES_DATA } from '../data/categories.js';
import { PROMOTIONAL_VOUCHERS, validateVoucher } from '../data/vouchers.js';
import { formatRupiah } from '../utils/currency.js';
import {
  escapeHtml,
  copyToClipboard,
  showToast,
  sleep,
  ICONS,
  BRAND_LOGO_SVG,
} from '../utils/helpers.js';
import { renderProductCard } from '../components/product-card.js';
import { openModal, closeModal } from '../components/modal.js';
import { showPaymentSimulation } from '../components/qris-modal.js';

// Page local UI state
let currentStoreTemplate = localStorage.getItem('bts_store_template') || 'dark'; // 'dark' | 'ivory'
let currentActiveCategory = 'Semua';
let currentSearchTerm = '';
let currentSortBy = 'popular'; // 'popular' | 'price_asc' | 'price_desc' | 'discount'
let currentSubTab = 'home'; // 'home' | 'products' | 'orders' | 'account'
let ordersFilter = 'Semua'; // 'Semua' | 'menunggu' | 'proses' | 'selesai' | 'batal'

export function renderWebAppPage() {
  const settings = store.getSettings();
  const cartCount = store.getCartCount();
  const isDark = currentStoreTemplate === 'dark';

  return `
    <div class="view-container ${
      isDark ? 'bg-[#08090A] text-[#F7F8F8]' : 'bg-[#FAF7F2] text-stone-900'
    } min-h-screen pb-24 sm:pb-20 relative overflow-x-hidden selection:bg-[#5E6AD2]/30 selection:text-white">
      
      <!-- SUBTLE BRAND WATERMARK (~2% Opacity - Organic Brand Texture) -->
      <div class="fixed right-3 bottom-20 w-72 sm:w-80 h-72 sm:h-80 opacity-[0.02] pointer-events-none select-none -z-0">
        ${BRAND_LOGO_SVG}
      </div>

      <!-- 1. BINTANG STORE STOREFRONT HEADER -->
      <header class="sticky top-0 z-30 ${
        isDark ? 'bg-[#08090A]/90 border-white/[0.06]' : 'bg-white/95 border-stone-200/90'
      } backdrop-blur-md border-b shadow-sm">
        
        <!-- Store Brand Bar: Bintang Store + Template Switcher + Cart -->
        <div class="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          
          <!-- Logo & Store Name -->
          <button id="webapp-nav-home-btn" class="flex items-center gap-2.5 text-left group cursor-pointer">
            <span class="w-8 h-8 rounded-xl ${
              isDark ? 'bg-[#16181D] border-white/[0.08]' : 'bg-stone-950 border-stone-800'
            } border p-1 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              ${BRAND_LOGO_SVG}
            </span>
            <div>
              <h1 class="font-heading font-black text-sm sm:text-base leading-tight ${
                isDark ? 'text-white' : 'text-stone-950'
              } group-hover:text-terracotta-500 transition-colors">
                ${escapeHtml(settings.storeName)}
              </h1>
              <p class="text-[10px] ${isDark ? 'text-[#8A8F98]' : 'text-stone-500'} hidden sm:block leading-tight font-normal">
                ${escapeHtml(settings.tagline)}
              </p>
            </div>
          </button>

          <!-- Middle: Template Switcher -->
          <div class="inline-flex items-center gap-1 p-0.5 rounded-full ${
            isDark
              ? 'bg-white/[0.04] border border-white/[0.08]'
              : 'bg-stone-100 border border-stone-200'
          } text-[11px] font-mono">
            <button id="btn-switch-tpl-dark" type="button" class="px-2.5 py-0.5 rounded-full transition-colors ${
              isDark
                ? 'bg-white text-black font-semibold shadow-xs'
                : 'text-stone-500 hover:text-stone-900'
            }">
              Dark
            </button>
            <button id="btn-switch-tpl-ivory" type="button" class="px-2.5 py-0.5 rounded-full transition-colors ${
              !isDark
                ? 'bg-stone-900 text-white font-semibold shadow-xs'
                : 'text-[#8A8F98] hover:text-white'
            }">
              Ivory
            </button>
          </div>

          <!-- Cart Trigger with Counter Badge -->
          <button id="btn-open-cart"
                  type="button"
                  class="relative p-2 sm:px-3 sm:py-2 rounded-xl ${
                    isDark
                      ? 'bg-[#101114] hover:bg-[#16181D] text-white border border-white/[0.08]'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  } active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  aria-label="Keranjang Belanja">
            <span class="w-4 h-4 flex items-center justify-center">${ICONS.cart}</span>
            <span class="hidden sm:inline text-xs font-semibold">Keranjang</span>
            <span id="webapp-cart-badge"
                  class="w-4 h-4 rounded-full bg-terracotta-500 text-white text-[10px] font-bold flex items-center justify-center -ml-0.5 ${
                    cartCount > 0 ? 'scale-100' : 'scale-0 opacity-0'
                  } transition-transform">
              ${cartCount}
            </span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="max-w-6xl mx-auto px-3 sm:px-6 pb-2">
          <div class="relative">
            <span class="absolute inset-y-0 left-2.5 flex items-center ${
              isDark ? 'text-zinc-500' : 'text-stone-400'
            } pointer-events-none w-3.5 h-3.5">
              ${ICONS.search}
            </span>
            <input id="webapp-search-input"
                   type="text"
                   placeholder="Cari 36+ produk (Spotify, Canva, AI)..."
                   value="${escapeHtml(currentSearchTerm)}"
                   class="w-full pl-8 pr-7 py-2 text-xs ${
                     isDark
                       ? 'bg-[#0C0D0F] text-white border-white/[0.08] focus:bg-[#101114] focus:border-[#5E6AD2]'
                       : 'bg-stone-100 text-stone-900 border-stone-200/80 focus:bg-white focus:border-terracotta-500'
                   } rounded-xl border focus:outline-none transition-all">
            ${
              currentSearchTerm
                ? `<button id="btn-clear-search" class="absolute inset-y-0 right-2 flex items-center ${
                    isDark
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-stone-400 hover:text-stone-700'
                  } cursor-pointer">
                    <span class="w-3.5 h-3.5 flex items-center justify-center">${ICONS.close}</span>
                   </button>`
                : ''
            }
          </div>
        </div>
      </header>

      <!-- 2. MAIN CONTAINER TABS -->
      <main class="max-w-6xl mx-auto px-3 sm:px-6 pt-3.5 sm:pt-5 pb-36">
        <div id="webapp-tab-content">
          ${renderTabContent(currentSubTab)}
        </div>
      </main>

      <!-- 3. CUSTOMER-ONLY BOTTOM NAVIGATION -->
      <nav class="fixed bottom-0 inset-x-0 z-40 ${
        isDark
          ? 'bg-[#08090A]/95 backdrop-blur-md border-t border-white/[0.06] text-[#8A8F98]'
          : 'bg-white/95 backdrop-blur-md border-t border-stone-200 text-stone-400'
      } py-2 px-4 sm:px-6 flex justify-between items-center shadow-lg select-none">
        <div class="max-w-md mx-auto w-full flex justify-between items-center">
          <button type="button" class="btn-webapp-tab flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            currentSubTab === 'home'
              ? isDark
                ? 'text-white font-bold'
                : 'text-terracotta-600 font-bold'
              : isDark
                ? 'text-[#8A8F98] hover:text-white'
                : 'text-stone-400 hover:text-stone-700'
          }" data-tab="home">
            <span class="w-5 h-5 flex items-center justify-center">${ICONS.home}</span>
            <span>Home</span>
          </button>

          <button type="button" class="btn-webapp-tab flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            currentSubTab === 'products'
              ? isDark
                ? 'text-white font-bold'
                : 'text-terracotta-600 font-bold'
              : isDark
                ? 'text-[#8A8F98] hover:text-white'
                : 'text-stone-400 hover:text-stone-700'
          }" data-tab="products">
            <span class="w-5 h-5 flex items-center justify-center">${ICONS.package}</span>
            <span>Produk</span>
          </button>

          <button type="button" class="btn-webapp-tab flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            currentSubTab === 'orders'
              ? isDark
                ? 'text-white font-bold'
                : 'text-terracotta-600 font-bold'
              : isDark
                ? 'text-[#8A8F98] hover:text-white'
                : 'text-stone-400 hover:text-stone-700'
          }" data-tab="orders">
            <span class="w-5 h-5 flex items-center justify-center">${ICONS.orders}</span>
            <span>Pesanan</span>
          </button>

          <button type="button" class="btn-webapp-tab flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            currentSubTab === 'account'
              ? isDark
                ? 'text-white font-bold'
                : 'text-terracotta-600 font-bold'
              : isDark
                ? 'text-[#8A8F98] hover:text-white'
                : 'text-stone-400 hover:text-stone-700'
          }" data-tab="account">
            <span class="w-5 h-5 flex items-center justify-center">${ICONS.user}</span>
            <span>Akun</span>
          </button>
        </div>
      </nav>

    </div>
  `;
}

// Subtab Dispatcher
function renderTabContent(tab) {
  if (tab === 'orders') {
    return renderOrdersTab();
  }
  if (tab === 'account') {
    return renderAccountTab();
  }
  if (tab === 'products') {
    return renderProductsTab();
  }
  // Default: Home Tab
  return renderHomeTab();
}

// ==========================================
// 1. HOME TAB (Commercial Homepage)
// ==========================================
function renderHomeTab() {
  const isDark = currentStoreTemplate === 'dark';
  const bestSellers = store.getBestSellers(4);
  const recommended = store.getRecommendedProducts(4);
  const promotional = store.getPromotionalProducts(4);
  const newProducts = store.getNewProducts(4);

  return `
    <div class="space-y-7">
      
      <!-- HERO PROMOTIONAL BANNER -->
      <section class="relative overflow-hidden rounded-3xl ${
        isDark
          ? 'bg-[#101114] border border-white/[0.08]'
          : 'bg-gradient-to-r from-stone-950 via-[#181D26] to-terracotta-950 border border-stone-800'
      } text-white p-4 sm:p-7 shadow-lg">
        <!-- Brand Watermark in Background (~4% Opacity) -->
        <div class="absolute -right-6 -bottom-6 w-44 sm:w-48 h-44 sm:h-48 opacity-[0.04] pointer-events-none select-none">
          ${BRAND_LOGO_SVG}
        </div>
        
        <div class="relative z-10 space-y-2 sm:space-y-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/90 text-stone-950 shadow-sm uppercase tracking-wider">
            <span>PRODUK DIGITAL</span>
          </div>
          <h2 class="font-heading font-black text-xl sm:text-2xl text-white tracking-tight leading-snug">
            Produk Digital, Langsung Beres.
          </h2>
          <p class="text-xs sm:text-sm ${isDark ? 'text-[#A1A1AA]' : 'text-stone-300'} max-w-lg leading-relaxed">
            Temukan produk digital pilihan dengan proses pembelian yang simpel dan cepat.
          </p>

          <div class="pt-1 flex flex-wrap items-center gap-2.5">
            <button type="button"
                    class="btn-switch-to-catalog px-4 py-2 rounded-xl text-xs font-bold bg-terracotta-500 hover:bg-terracotta-600 active:scale-95 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
              <span>Jelajahi 36+ Produk</span>
              ${ICONS.arrowRight}
            </button>
          </div>
        </div>
      </section>

      <!-- ACTIVE VOUCHER CALLOUT CARD -->
      <section class="${
        isDark
          ? 'bg-[#101114] border border-white/[0.08] text-white'
          : 'bg-white border border-stone-200/90 text-stone-900'
      } rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${
            isDark
              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
          } flex items-center justify-center shrink-0">
            ${ICONS.voucher}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs sm:text-sm ${isDark ? 'text-white' : 'text-stone-900'}">Voucher Promo Aktif:</span>
              <code class="font-mono font-bold text-xs ${
                isDark
                  ? 'bg-[#16181D] text-amber-300 border border-white/[0.08]'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              } px-2 py-0.5 rounded">BINTANG10</code>
            </div>
            <p class="text-[11px] sm:text-xs ${isDark ? 'text-[#8A8F98]' : 'text-stone-500'} mt-0.5">Diskon 10% untuk semua produk digital. Berlaku di halaman checkout.</p>
          </div>
        </div>
        <button type="button"
                id="btn-copy-promo-voucher"
                class="self-start sm:self-center px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                  isDark
                    ? 'bg-white hover:bg-zinc-200 text-black shadow-sm'
                    : 'bg-stone-900 hover:bg-stone-800 text-white'
                } active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[36px]">
          ${ICONS.copy}
          <span>Salin Voucher</span>
        </button>
      </section>

      <!-- CATEGORY QUICK SELECTOR -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-xs sm:text-base ${isDark ? 'text-white' : 'text-stone-900'} uppercase tracking-wider font-mono">
            Kategori Pilihan
          </h2>
          <button type="button" class="btn-switch-to-catalog text-xs font-medium text-terracotta-500 hover:underline cursor-pointer">
            Lihat Semua →
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          ${CATEGORIES_DATA.map((c) => {
            const count = store.getProductsByCategory(c.name).length;
            return `
              <button type="button"
                      class="btn-category-card p-2.5 sm:p-3 rounded-2xl ${
                        isDark
                          ? 'bg-[#101114] border border-white/[0.08] hover:border-white/[0.2]'
                          : 'bg-white border border-stone-200/80 hover:border-terracotta-500/60'
                      } hover:shadow-md transition-all text-left flex flex-col justify-between space-y-1.5 group cursor-pointer"
                      data-category="${c.name}">
                <div class="flex items-center justify-between">
                  <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${
                    isDark ? 'bg-[#16181D] text-[#D0D6E0]' : 'bg-stone-100 text-stone-700'
                  } flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
                    ${c.name.substring(0, 2).toUpperCase()}
                  </span>
                  <span class="text-[10px] font-mono ${isDark ? 'text-[#8A8F98]' : 'text-stone-400'}">${count} item</span>
                </div>
                <div>
                  <h3 class="font-semibold text-xs ${isDark ? 'text-white group-hover:text-terracotta-400' : 'text-stone-900 group-hover:text-terracotta-600'} transition-colors">${c.name}</h3>
                  <p class="text-[10px] ${isDark ? 'text-[#8A8F98]' : 'text-stone-400'} line-clamp-1">${c.badge}</p>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </section>

      <!-- SECTION 1: BEST SELLERS -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-amber-500">⭐</span>
            <h2 class="font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-stone-900'}">
              Produk Terlaris (Best Seller)
            </h2>
          </div>
          <button type="button" class="btn-filter-category text-xs font-medium text-terracotta-500 hover:underline cursor-pointer" data-category="Semua">
            Semua →
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          ${bestSellers.map((p) => renderProductCard(p, { isDark })).join('')}
        </div>
      </section>

      <!-- SECTION 2: REKOMENDASI PILIHAN -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-rose-500">🔥</span>
            <h2 class="font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-stone-900'}">
              Rekomendasi Pilihan
            </h2>
          </div>
          <button type="button" class="btn-filter-category text-xs font-medium text-terracotta-500 hover:underline cursor-pointer" data-category="AI & Productivity">
            AI Tools →
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          ${recommended.map((p) => renderProductCard(p, { isDark })).join('')}
        </div>
      </section>

      <!-- SECTION 3: PROMO & LIMITED DEALS -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-emerald-500">🏷️</span>
            <h2 class="font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-stone-900'}">
              Promo & Diskon Terbesar
            </h2>
          </div>
          <button type="button" class="btn-switch-to-catalog text-xs font-medium text-terracotta-500 hover:underline cursor-pointer">
            Katalog →
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          ${promotional.map((p) => renderProductCard(p, { isDark })).join('')}
        </div>
      </section>

      <!-- SECTION 4: PRODUK TERBARU -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sky-500">✨</span>
            <h2 class="font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-stone-900'}">
              Produk Baru Ditambahkan
            </h2>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          ${newProducts.map((p) => renderProductCard(p, { isDark })).join('')}
        </div>
      </section>

      <!-- TRUST & GUARANTEE SECTION -->
      <section class="rounded-2xl ${
        isDark
          ? 'bg-[#101114] border-white/[0.08] text-white'
          : 'bg-white border-stone-200/90 text-stone-900'
      } border p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <h3 class="font-bold text-xs uppercase tracking-wider ${isDark ? 'text-[#8A8F98]' : 'text-stone-400'} text-center font-mono">
          Layanan Bintang Store
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
          <div class="space-y-1">
            <div class="w-8 h-8 sm:w-9 sm:h-9 mx-auto rounded-xl ${
              isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            } flex items-center justify-center">
              ${ICONS.shieldCheck}
            </div>
            <h4 class="font-bold text-xs ${isDark ? 'text-white' : 'text-stone-900'}">Garansi Layanan</h4>
            <p class="text-[11px] ${isDark ? 'text-[#8A8F98]' : 'text-stone-500'}">Bantuan ganti baru atau solusi penuh bila produk berkendala selama masa aktif.</p>
          </div>
          <div class="space-y-1">
            <div class="w-8 h-8 sm:w-9 sm:h-9 mx-auto rounded-xl ${
              isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
            } flex items-center justify-center">
              ${ICONS.zap}
            </div>
            <h4 class="font-bold text-xs ${isDark ? 'text-white' : 'text-stone-900'}">Akses Cepat</h4>
            <p class="text-[11px] ${isDark ? 'text-[#8A8F98]' : 'text-stone-500'}">Kredensial dan petunjuk aktivasi otomatis siap setelah pembayaran diverifikasi.</p>
          </div>
          <div class="space-y-1">
            <div class="w-8 h-8 sm:w-9 sm:h-9 mx-auto rounded-xl ${
              isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'
            } flex items-center justify-center">
              ${ICONS.help}
            </div>
            <h4 class="font-bold text-xs ${isDark ? 'text-white' : 'text-stone-900'}">Bantuan Pelanggan</h4>
            <p class="text-[11px] ${isDark ? 'text-[#8A8F98]' : 'text-stone-500'}">Bantuan aktivasi dan tanya jawab siap dipandu via Telegram Customer Care.</p>
          </div>
        </div>
      </section>

    </div>
  `;
}

// ==========================================
// 2. PRODUK TAB (Complete Catalog)
// ==========================================
function renderProductsTab() {
  const filteredProducts = store.searchProducts(
    currentSearchTerm,
    currentActiveCategory,
    currentSortBy,
  );

  return `
    <div class="space-y-5">
      
      <!-- HEADER & SORTING BAR -->
      <div class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 class="font-heading font-extrabold text-lg sm:text-xl text-stone-900">Katalog Produk Digital</h2>
            <p class="text-xs text-stone-500">Pilih dari 36 produk digital berkualitas dengan pengiriman instan.</p>
          </div>
          
          <!-- Sorting Selector -->
          <div class="flex items-center gap-2 self-start sm:self-center text-xs">
            <span class="text-stone-400 font-medium">Urutkan:</span>
            <select id="webapp-sort-select" class="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-800 font-semibold focus:outline-none focus:border-terracotta-500 transition-colors">
              <option value="popular" ${currentSortBy === 'popular' ? 'selected' : ''}>Terpopuler</option>
              <option value="price_asc" ${currentSortBy === 'price_asc' ? 'selected' : ''}>Harga Terendah</option>
              <option value="price_desc" ${currentSortBy === 'price_desc' ? 'selected' : ''}>Harga Tertinggi</option>
              <option value="discount" ${currentSortBy === 'discount' ? 'selected' : ''}>Diskon Terbesar</option>
            </select>
          </div>
        </div>

        <!-- CATEGORY FILTER PILLS -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          ${CATEGORIES.map((cat) => {
            const isSelected = currentActiveCategory === cat;
            return `
              <button type="button"
                      class="btn-category-pill px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                        isSelected
                          ? 'bg-terracotta-500 text-white shadow-sm ring-2 ring-terracotta-400'
                          : 'bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200'
                      }"
                      data-category="${cat}">
                ${cat}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- ACTIVE FILTER INDICATOR -->
      ${
        currentSearchTerm || currentActiveCategory !== 'Semua'
          ? `
            <div class="flex items-center justify-between bg-stone-100/80 px-3 py-1.5 rounded-xl text-xs text-stone-600">
              <div class="flex items-center gap-2">
                <span>Filter: <b>${escapeHtml(currentActiveCategory)}</b></span>
                ${currentSearchTerm ? `<span>· Pencarian: "<b>${escapeHtml(currentSearchTerm)}</b>"</span>` : ''}
                <span class="text-stone-400 font-mono">(${filteredProducts.length} hasil)</span>
              </div>
              <button type="button" id="btn-reset-catalog-filters" class="text-terracotta-600 hover:underline font-semibold">
                Reset
              </button>
            </div>
          `
          : ''
      }

      <!-- PRODUCT GRID (2 columns mobile, 3-4 columns desktop) -->
      ${
        filteredProducts.length === 0
          ? `
            <div class="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-300 p-6 space-y-3">
              <div class="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                ${ICONS.search}
              </div>
              <h3 class="font-heading font-bold text-base text-stone-800">Tidak ada produk ditemukan</h3>
              <p class="text-xs text-stone-500 max-w-sm mx-auto">
                Coba gunakan kata kunci lain seperti "Spotify", "Canva", atau pilih kategori "Semua".
              </p>
              <button type="button" id="btn-reset-filters" class="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                Tampilkan Semua Produk
              </button>
            </div>
          `
          : `
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              ${filteredProducts.map((p) => renderProductCard(p)).join('')}
            </div>
          `
      }

    </div>
  `;
}

// ==========================================
// 3. PESANAN TAB (Order History & Detail)
// ==========================================
function renderOrdersTab() {
  const orders = store.getOrders(ordersFilter);

  return `
    <div class="max-w-3xl mx-auto space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="font-heading font-extrabold text-xl text-stone-900">Pesanan Saya</h2>
          <p class="text-xs text-stone-500">Pantau status transaksi dan akses kredensial produk digital Anda.</p>
        </div>
        <span class="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-stone-200/80 text-stone-700 self-start sm:self-center">
          ${orders.length} Transaksi
        </span>
      </div>

      <!-- FILTER TABS: Semua, Menunggu Bayar, Diproses, Selesai, Batal -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        ${[
          { id: 'Semua', label: 'Semua' },
          { id: 'menunggu', label: 'Menunggu Bayar' },
          { id: 'proses', label: 'Diproses' },
          { id: 'selesai', label: 'Selesai' },
          { id: 'batal', label: 'Dibatalkan' },
        ]
          .map((f) => {
            const isSel = ordersFilter === f.id;
            return `
            <button type="button"
                    class="btn-order-filter px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                      isSel
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }"
                    data-status="${f.id}">
              ${f.label}
            </button>
          `;
          })
          .join('')}
      </div>

      <!-- ORDERS LIST -->
      ${
        orders.length === 0
          ? `
            <div class="text-center py-16 bg-white rounded-2xl border border-stone-200 p-6 space-y-3 shadow-sm">
              <div class="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                ${ICONS.history}
              </div>
              <h3 class="font-heading font-bold text-base text-stone-800">Belum Ada Pesanan</h3>
              <p class="text-xs text-stone-500 max-w-sm mx-auto">
                Anda belum memiliki riwayat pesanan pada filter ini.
              </p>
              <button type="button" class="btn-switch-to-catalog px-4 py-2 rounded-xl text-xs font-bold bg-terracotta-500 hover:bg-terracotta-600 text-white transition-colors">
                Mulai Belanja Sekarang
              </button>
            </div>
          `
          : `
            <div class="space-y-3">
              ${orders
                .map((o) => {
                  const isFulfilled =
                    o.fulfillmentStatus === 'FULFILLED' || o.fulfillmentStatus === 'COMPLETED';
                  const isPending =
                    o.paymentStatus === 'PENDING_PAYMENT' || o.paymentStatus === 'UNPAID';
                  const isCancelled =
                    o.paymentStatus === 'CANCELLED' || o.paymentStatus === 'EXPIRED';

                  let statusBadge = '';
                  if (isFulfilled) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Selesai</span>`;
                  } else if (isPending) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Menunggu Bayar</span>`;
                  } else if (isCancelled) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">Dibatalkan</span>`;
                  } else {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">Diproses</span>`;
                  }

                  return `
                  <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-sm hover:border-terracotta-400 transition-all space-y-3">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-mono font-bold text-sm text-stone-900">${o.id}</span>
                          <span class="text-xs text-stone-400">· ${o.date}</span>
                        </div>
                        <h3 class="font-heading font-bold text-sm sm:text-base text-stone-900 mt-1">${escapeHtml(o.product.name)}</h3>
                      </div>
                      ${statusBadge}
                    </div>

                    <div class="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-stone-400">Total:</span>
                        <span class="font-heading font-extrabold text-stone-950 text-sm sm:text-base">${formatRupiah(o.total)}</span>
                        <span class="text-stone-400 font-mono text-[11px]">(${o.paymentMethod})</span>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        ${
                          isPending
                            ? `<button type="button"
                                       class="btn-resume-pay flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition-all min-h-[40px] flex items-center justify-center cursor-pointer"
                                       data-id="${o.id}">
                                Bayar Sekarang
                               </button>`
                            : ''
                        }
                        <button type="button"
                                class="btn-view-order-detail-card flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-800 transition-all min-h-[40px] flex items-center justify-center cursor-pointer"
                                data-id="${o.id}">
                          ${isFulfilled ? 'Akses Produk →' : 'Detail Pesanan →'}
                        </button>
                      </div>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          `
      }

    </div>
  `;
}

// ==========================================
// 4. AKUN TAB (Real Customer Profile)
// ==========================================
function renderAccountTab() {
  const orders = store.getOrders();
  const fulfilledCount = orders.filter(
    (o) => o.fulfillmentStatus === 'FULFILLED' || o.fulfillmentStatus === 'COMPLETED',
  ).length;
  const activeVouchersCount = PROMOTIONAL_VOUCHERS.filter((v) => v.active).length;

  return `
    <div class="max-w-2xl mx-auto space-y-5 sm:space-y-6">
      
      <!-- PROFILE HEADER CARD -->
      <div class="bg-white rounded-3xl border border-stone-200/90 p-4 sm:p-6 shadow-sm flex items-center gap-3.5 sm:gap-4 relative overflow-hidden">
        <div class="absolute -right-4 -bottom-4 w-32 sm:w-36 h-32 sm:h-36 opacity-[0.025] pointer-events-none select-none">
          ${BRAND_LOGO_SVG}
        </div>
        
        <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-stone-950 border border-stone-800 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
          ${BRAND_LOGO_SVG}
        </div>
        
        <div class="relative z-10 space-y-0.5 min-w-0">
          <div class="flex items-center gap-1.5">
            <h2 class="font-heading font-extrabold text-sm sm:text-lg text-stone-900 truncate">Pelanggan Bintang Store</h2>
            <span class="text-sky-500 font-mono text-xs font-bold" title="Akun Terverifikasi">✓</span>
          </div>
          <p class="text-[11px] sm:text-xs text-stone-500 font-medium truncate">Terhubung via Telegram Mini App</p>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            ● Status: Aktif
          </span>
        </div>
      </div>

      <!-- TRANSACTION SUMMARY STATS -->
      <div class="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
        <div class="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 shadow-sm">
          <span class="text-[9px] sm:text-[10px] text-stone-400 font-mono uppercase tracking-wider block">Total Pesanan</span>
          <div class="font-heading font-extrabold text-lg sm:text-xl text-stone-900 mt-0.5">${orders.length}</div>
          <span class="text-[10px] text-stone-400 font-medium">Transaksi</span>
        </div>
        
        <div class="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 shadow-sm">
          <span class="text-[9px] sm:text-[10px] text-stone-400 font-mono uppercase tracking-wider block">Produk Selesai</span>
          <div class="font-heading font-extrabold text-lg sm:text-xl text-emerald-600 mt-0.5">${fulfilledCount}</div>
          <span class="text-[10px] text-stone-400 font-medium">Terkirim</span>
        </div>

        <div class="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 shadow-sm">
          <span class="text-[9px] sm:text-[10px] text-stone-400 font-mono uppercase tracking-wider block">Voucher Promo</span>
          <div class="font-heading font-extrabold text-lg sm:text-xl text-amber-600 mt-0.5">${activeVouchersCount}</div>
          <span class="text-[10px] text-stone-400 font-medium">Tersedia</span>
        </div>
      </div>

      <!-- CUSTOMER MENU LIST -->
      <div class="bg-white rounded-2xl border border-stone-200/90 overflow-hidden divide-y divide-stone-100 shadow-sm">
        
        <button type="button" class="btn-account-nav-orders w-full p-3.5 sm:p-4 flex items-center justify-between text-xs font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 transition-colors cursor-pointer min-h-[44px]">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-stone-100 text-stone-700">${ICONS.history}</span>
            <span class="text-stone-900 font-medium text-xs">Pesanan Saya</span>
          </div>
          <span class="text-stone-400">→</span>
        </button>

        <button type="button" class="btn-account-show-voucher w-full p-3.5 sm:p-4 flex items-center justify-between text-xs font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 transition-colors cursor-pointer min-h-[44px]">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-stone-100 text-stone-700">${ICONS.voucher}</span>
            <span class="text-stone-900 font-medium text-xs">Voucher & Promo Saya</span>
          </div>
          <span class="text-stone-400">→</span>
        </button>

        <button type="button" class="btn-account-help w-full p-3.5 sm:p-4 flex items-center justify-between text-xs font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 transition-colors cursor-pointer min-h-[44px]">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-stone-100 text-stone-700">${ICONS.help}</span>
            <span class="text-stone-900 font-medium text-xs">Pusat Bantuan & FAQ</span>
          </div>
          <span class="text-stone-400">→</span>
        </button>

        <button type="button" class="btn-account-terms w-full p-3.5 sm:p-4 flex items-center justify-between text-xs font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 transition-colors cursor-pointer min-h-[44px]">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-stone-100 text-stone-700">${ICONS.shieldCheck}</span>
            <span class="text-stone-900 font-medium text-xs">Garansi & Ketentuan Layanan</span>
          </div>
          <span class="text-stone-400">→</span>
        </button>

        <button type="button" class="btn-account-privacy w-full p-3.5 sm:p-4 flex items-center justify-between text-xs font-semibold text-stone-800 hover:bg-stone-50 active:bg-stone-100 transition-colors cursor-pointer min-h-[44px]">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-stone-100 text-stone-700">${ICONS.lock}</span>
            <span class="text-stone-900 font-medium text-xs">Kebijakan Privasi</span>
          </div>
          <span class="text-stone-400">→</span>
        </button>

      </div>

      <!-- SUPPORT CALLOUT -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="space-y-0.5">
          <span class="font-bold text-amber-900 block">Butuh Bantuan Kendala Akun?</span>
          <span class="text-amber-800 text-[11px]">Tim kami siap melayani di Telegram Customer Care Bintang Store.</span>
        </div>
        <a href="https://t.me/bintangstoresupport" target="_blank" class="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-95 text-white font-bold text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer">
          <span>Chat Customer Care</span>
          ${ICONS.externalLink}
        </a>
      </div>

    </div>
  `;
}

// ==========================================
// MODAL CONTROLLERS & INTERACTIONS
// ==========================================

// 1. PRODUCT DETAIL MODAL
function openProductDetailModal(productId) {
  const product = store.getProduct(productId);
  if (!product) return;

  const isAvailable = product.active && product.stock > 0;
  const benefits = product.benefits || [
    'Garansi penuh 30 hari ganti baru jika terkendala',
    'Aktivasi otomatis & instant delivery',
    'Dukungan teknis responsif 24/7',
  ];

  const content = `
    <div class="space-y-4">
      
      <!-- Visual Banner Tile -->
      <div class="relative w-full h-32 sm:h-36 bg-gradient-to-br from-stone-950 to-[#181D26] rounded-2xl overflow-hidden p-3.5 sm:p-4 flex flex-col justify-between border border-stone-800 text-white shadow-inner">
        <div class="absolute -right-4 -bottom-4 w-28 h-28 opacity-[0.04] pointer-events-none select-none">
          ${BRAND_LOGO_SVG}
        </div>
        <div class="relative z-10 flex items-center justify-between">
          <span class="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-white/10 text-stone-200 border border-white/20">
            ${escapeHtml(product.category)}
          </span>
          ${
            product.badge
              ? `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-terracotta-500 text-white">
                  ${escapeHtml(product.badge)}
                </span>`
              : ''
          }
        </div>

        <div class="relative z-10 flex items-baseline justify-between">
          <div class="font-heading font-black text-4xl text-amber-300">
            ${product.monogram || product.name.substring(0, 3).toUpperCase()}
          </div>
          <span class="text-xs font-mono text-stone-300 font-medium">
            ${escapeHtml(product.duration || '1 Bulan')}
          </span>
        </div>
      </div>

      <!-- Title & Price Block -->
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <h2 class="font-heading font-black text-lg text-stone-950">${escapeHtml(product.name)}</h2>
          <!-- Rating -->
          <div class="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <span>★</span> <span>${product.rating || '4.9'}</span>
          </div>
        </div>

        <!-- Price -->
        <div class="flex items-baseline gap-2 pt-1">
          <span class="font-heading font-extrabold text-2xl text-stone-950 leading-none">
            ${formatRupiah(product.price)}
          </span>
          ${
            product.originalPrice && product.originalPrice > product.price
              ? `<span class="text-xs text-stone-400 line-through">${formatRupiah(product.originalPrice)}</span>
                 <span class="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded">
                   Hemat ${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                 </span>`
              : ''
          }
        </div>

        <div class="pt-1 flex items-center gap-2 text-xs font-mono">
          ${
            isAvailable
              ? `<span class="text-emerald-600 font-medium">● Stok Tersedia (${product.stock} item)</span>`
              : `<span class="text-red-600 font-bold">● Stok Habis</span>`
          }
          <span class="text-stone-300">|</span>
          <span class="text-stone-500">${product.soldCount || 100}+ terjual</span>
        </div>
      </div>

      <!-- Full Description -->
      <div class="space-y-1 pt-1">
        <h3 class="font-heading font-bold text-xs uppercase tracking-wider text-stone-400">Deskripsi Produk</h3>
        <p class="text-xs text-stone-700 leading-relaxed">
          ${escapeHtml(product.description || product.shortDescription)}
        </p>
      </div>

      <!-- Benefits / Features List -->
      <div class="space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80">
        <h3 class="font-heading font-bold text-xs uppercase tracking-wider text-stone-700">Keunggulan & Fitur:</h3>
        <ul class="text-xs text-stone-600 space-y-1.5">
          ${benefits
            .map(
              (b) => `
            <li class="flex items-start gap-2">
              <span class="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
              <span>${escapeHtml(b)}</span>
            </li>
          `,
            )
            .join('')}
        </ul>
      </div>

      <!-- Important Rules / Guarantees -->
      <div class="space-y-1 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-900 leading-relaxed">
        <span class="font-bold block mb-0.5">⚠️ Catatan & Garansi:</span>
        ${escapeHtml(product.importantInfo || 'Garansi berlaku selama masa aktif. Kredensial akun dikirim instan setelah pembayaran.')}
      </div>

      <!-- Dual Action CTAs -->
      <div class="pt-2 flex items-center gap-2">
        <button type="button"
                id="btn-detail-add-cart"
                class="flex-1 py-3 px-4 rounded-xl font-heading font-bold text-xs sm:text-sm bg-stone-100 hover:bg-stone-200 text-stone-900 transition-colors flex items-center justify-center gap-2"
                data-id="${product.id}"
                ${!isAvailable ? 'disabled' : ''}>
          ${ICONS.cart}
          <span>Tambah Keranjang</span>
        </button>

        <button type="button"
                id="btn-detail-buy-now"
                class="flex-1 py-3 px-4 rounded-xl font-heading font-bold text-xs sm:text-sm bg-terracotta-500 hover:bg-terracotta-600 active:scale-98 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                data-id="${product.id}"
                ${!isAvailable ? 'disabled' : ''}>
          <span>Beli Sekarang</span>
          ${ICONS.arrowRight}
        </button>
      </div>

    </div>
  `;

  openModal({
    title: product.name,
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      // Add to cart from detail
      const btnAdd = modalEl.querySelector('#btn-detail-add-cart');
      if (btnAdd) {
        btnAdd.addEventListener('click', () => {
          const res = store.addToCart(product.id, 1);
          if (res.success) {
            showToast(res.message, 'success');
            updateCartBadge();
            closeModal();
          } else {
            showToast(res.message, 'error');
          }
        });
      }

      // Buy now from detail
      const btnBuy = modalEl.querySelector('#btn-detail-buy-now');
      if (btnBuy) {
        btnBuy.addEventListener('click', () => {
          closeModal();
          openCheckoutModal(product);
        });
      }
    },
  });
}

// 2. CART DRAWER / MODAL
function openCartModal() {
  const items = store.getCartItems();
  const subtotal = store.getCartSubtotal();
  const discount = store.getCartDiscount();
  const total = store.getCartTotal();
  const voucherCode = store.getCart().voucherCode;

  const content = `
    <div class="space-y-4">
      
      <!-- Cart Items List -->
      ${
        items.length === 0
          ? `
            <div class="text-center py-10 space-y-3">
              <div class="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                ${ICONS.cart}
              </div>
              <h3 class="font-heading font-bold text-base text-stone-800">Keranjang Belanja Kosong</h3>
              <p class="text-xs text-stone-500 max-w-xs mx-auto">
                Silakan pilih produk digital dari katalog kami untuk dimasukkan ke keranjang.
              </p>
              <button type="button" class="btn-modal-close-and-shop px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                Mulai Belanja
              </button>
            </div>
          `
          : `
            <div class="max-h-64 overflow-y-auto space-y-2.5 pr-1 divide-y divide-stone-100">
              ${items
                .map(
                  (i) => `
                <div class="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <h4 class="font-heading font-bold text-xs sm:text-sm text-stone-900 truncate">
                      ${escapeHtml(i.product.name)}
                    </h4>
                    <div class="text-[11px] text-stone-400 font-mono">
                      ${formatRupiah(i.product.price)} · ${escapeHtml(i.product.duration || 'Digital')}
                    </div>
                  </div>

                  <!-- Stepper Qty -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btn-cart-dec w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-xs transition-colors" data-id="${i.productId}">
                      -
                    </button>
                    <span class="w-6 text-center font-mono font-bold text-xs text-stone-900">${i.quantity}</span>
                    <button type="button" class="btn-cart-inc w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-xs transition-colors" data-id="${i.productId}">
                      +
                    </button>
                    <button type="button" class="btn-cart-del ml-1 text-stone-400 hover:text-red-600 p-1 transition-colors" data-id="${i.productId}" title="Hapus">
                      ${ICONS.trash}
                    </button>
                  </div>
                </div>
              `,
                )
                .join('')}
            </div>

            <!-- Voucher Section -->
            <div class="pt-2 border-t border-stone-200 space-y-2">
              <label class="text-xs font-bold text-stone-800 block">Kupon Promo / Voucher</label>
              <div class="flex gap-2">
                <input id="input-cart-voucher"
                       type="text"
                       placeholder="Contoh: BINTANG10"
                       value="${escapeHtml(voucherCode || '')}"
                       class="flex-1 px-3 py-2 text-xs font-mono uppercase bg-stone-100 rounded-xl border border-stone-200 focus:bg-white focus:border-terracotta-500 focus:outline-none">
                <button type="button"
                        id="btn-apply-cart-voucher"
                        class="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white transition-colors shrink-0">
                  Gunakan
                </button>
              </div>
              
              <!-- Voucher Feedback Alert Container -->
              <div id="cart-voucher-feedback">
                ${
                  voucherCode && discount > 0
                    ? `<div class="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between font-medium">
                        <span>✓ Voucher <b>${voucherCode}</b> aktif (Hemat ${formatRupiah(discount)})</span>
                        <button type="button" id="btn-remove-cart-voucher" class="text-emerald-700 hover:underline font-bold text-[10px]">Hapus</button>
                       </div>`
                    : ''
                }
              </div>
            </div>

            <!-- Cost Summary -->
            <div class="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 space-y-1.5 text-xs text-stone-600">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span class="font-mono font-bold text-stone-900">${formatRupiah(subtotal)}</span>
              </div>
              ${
                discount > 0
                  ? `<div class="flex justify-between text-emerald-600 font-semibold">
                      <span>Potongan Diskon:</span>
                      <span class="font-mono">-${formatRupiah(discount)}</span>
                     </div>`
                  : ''
              }
              <div class="flex justify-between pt-2 border-t border-stone-200 text-stone-900 font-bold text-sm">
                <span>Total Belanja:</span>
                <span class="font-heading font-extrabold text-base text-terracotta-600">${formatRupiah(total)}</span>
              </div>
            </div>

            <!-- Checkout Action Button -->
            <div class="pt-1">
              <button type="button"
                      id="btn-cart-checkout"
                      class="w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm bg-terracotta-500 hover:bg-terracotta-600 active:scale-98 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <span>Lanjut ke Pembayaran</span>
                ${ICONS.arrowRight}
              </button>
            </div>
          `
      }

    </div>
  `;

  openModal({
    title: 'Keranjang Belanja',
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      // Stepper events
      modalEl.querySelectorAll('.btn-cart-inc').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const item = items.find((i) => i.productId === id);
          if (item) {
            store.updateQuantity(id, item.quantity + 1);
            closeModal();
            openCartModal();
            updateCartBadge();
          }
        });
      });

      modalEl.querySelectorAll('.btn-cart-dec').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const item = items.find((i) => i.productId === id);
          if (item) {
            store.updateQuantity(id, item.quantity - 1);
            closeModal();
            openCartModal();
            updateCartBadge();
          }
        });
      });

      modalEl.querySelectorAll('.btn-cart-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          store.removeFromCart(id);
          closeModal();
          openCartModal();
          updateCartBadge();
        });
      });

      // Apply Voucher event
      const btnApplyVoucher = modalEl.querySelector('#btn-apply-cart-voucher');
      const inputVoucher = modalEl.querySelector('#input-cart-voucher');
      if (btnApplyVoucher && inputVoucher) {
        btnApplyVoucher.addEventListener('click', () => {
          const code = inputVoucher.value.trim();
          const res = store.applyVoucher(code);
          if (res.success) {
            showToast(res.message, 'success');
            closeModal();
            openCartModal();
          } else {
            const feedbackEl = modalEl.querySelector('#cart-voucher-feedback');
            if (feedbackEl) {
              feedbackEl.innerHTML = `
                <div class="p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 font-medium">
                  ✕ ${escapeHtml(res.message)}
                </div>
              `;
            }
          }
        });
      }

      // Remove Voucher event
      const btnRemoveVoucher = modalEl.querySelector('#btn-remove-cart-voucher');
      if (btnRemoveVoucher) {
        btnRemoveVoucher.addEventListener('click', () => {
          store.removeVoucher();
          showToast('Voucher dihapus', 'info');
          closeModal();
          openCartModal();
        });
      }

      // Empty state continue shopping
      const btnCloseShop = modalEl.querySelector('.btn-modal-close-and-shop');
      if (btnCloseShop) {
        btnCloseShop.addEventListener('click', () => {
          closeModal();
          switchToSubTab('products');
        });
      }

      // Proceed to checkout
      const btnCheckout = modalEl.querySelector('#btn-cart-checkout');
      if (btnCheckout) {
        btnCheckout.addEventListener('click', () => {
          closeModal();
          openCheckoutModal(null);
        });
      }
    },
  });
}

// 3. CHECKOUT MODAL
function openCheckoutModal(singleProduct = null) {
  let checkoutItems = [];
  let subtotal = 0;
  let discount = 0;
  let total = 0;

  if (singleProduct) {
    checkoutItems = [{ product: singleProduct, quantity: 1 }];
    subtotal = singleProduct.price;
    discount = 0;
    total = subtotal;
  } else {
    checkoutItems = store.getCartItems();
    subtotal = store.getCartSubtotal();
    discount = store.getCartDiscount();
    total = store.getCartTotal();
  }

  if (checkoutItems.length === 0) {
    showToast('Keranjang Anda masih kosong!', 'warning');
    return;
  }

  const content = `
    <div class="space-y-4">
      
      <!-- Customer Information Form -->
      <div class="space-y-2.5">
        <h3 class="font-heading font-bold text-xs uppercase tracking-wider text-stone-500">Data Pemesan</h3>
        
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1">Nama Lengkap</label>
          <input id="checkout-name"
                 type="text"
                 placeholder="Nama Anda"
                 value="Pelanggan Bintang"
                 class="w-full px-3 py-2 text-xs bg-stone-100 rounded-xl border border-stone-200 focus:bg-white focus:border-terracotta-500 focus:outline-none">
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-semibold text-stone-700 mb-1">WhatsApp / Telegram</label>
            <input id="checkout-phone"
                   type="text"
                   placeholder="08123456789"
                   value="08123456789"
                   class="w-full px-3 py-2 text-xs bg-stone-100 rounded-xl border border-stone-200 focus:bg-white focus:border-terracotta-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-stone-700 mb-1">Email (Cadangan Akses)</label>
            <input id="checkout-email"
                   type="email"
                   placeholder="email@example.com"
                   value="buyer@bintang.store"
                   class="w-full px-3 py-2 text-xs bg-stone-100 rounded-xl border border-stone-200 focus:bg-white focus:border-terracotta-500 focus:outline-none">
          </div>
        </div>
      </div>

      <!-- Payment Method Selection -->
      <div class="space-y-2 pt-1 border-t border-stone-100">
        <h3 class="font-heading font-bold text-xs uppercase tracking-wider text-stone-500">Pilih Metode Pembayaran</h3>
        
        <div class="space-y-2">
          <label class="payment-option flex items-center justify-between p-3 rounded-xl border-2 border-terracotta-500 bg-terracotta-50/30 cursor-pointer">
            <div class="flex items-center gap-2.5">
              <input type="radio" name="checkout-payment-method" value="QRIS" checked class="accent-terracotta-600">
              <div>
                <span class="font-bold text-xs text-stone-900 block">QRIS (Semua Bank & E-Wallet)</span>
                <span class="text-[10px] text-stone-500">BCA, Mandiri, BRI, GoPay, OVO, DANA, ShopeePay</span>
              </div>
            </div>
            <span class="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Otomatis</span>
          </label>

          <label class="payment-option flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-colors">
            <div class="flex items-center gap-2.5">
              <input type="radio" name="checkout-payment-method" value="E-Wallet" class="accent-terracotta-600">
              <div>
                <span class="font-bold text-xs text-stone-900 block">E-Wallet Direct</span>
                <span class="text-[10px] text-stone-500">GoPay, OVO, DANA, LinkAja</span>
              </div>
            </div>
            <span class="text-[10px] font-mono text-stone-400">Instan</span>
          </label>

          <label class="payment-option flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-colors">
            <div class="flex items-center gap-2.5">
              <input type="radio" name="checkout-payment-method" value="Virtual Account" class="accent-terracotta-600">
              <div>
                <span class="font-bold text-xs text-stone-900 block">Virtual Account Bank</span>
                <span class="text-[10px] text-stone-500">BCA VA, Mandiri VA, BRI VA, BNI VA</span>
              </div>
            </div>
            <span class="text-[10px] font-mono text-stone-400">Verifikasi Cepat</span>
          </label>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 space-y-2 text-xs">
        <h4 class="font-heading font-bold text-stone-800 uppercase text-[11px]">Ringkasan Pembayaran</h4>
        <div class="space-y-1 text-stone-600">
          <div class="flex justify-between">
            <span>Subtotal (${checkoutItems.reduce((acc, i) => acc + i.quantity, 0)} item):</span>
            <span class="font-mono">${formatRupiah(subtotal)}</span>
          </div>
          ${
            discount > 0
              ? `<div class="flex justify-between text-emerald-600 font-semibold">
                  <span>Diskon Promo:</span>
                  <span class="font-mono">-${formatRupiah(discount)}</span>
                 </div>`
              : ''
          }
          <div class="flex justify-between pt-1.5 border-t border-stone-200 font-bold text-stone-900 text-sm">
            <span>Total Tagihan:</span>
            <span class="font-heading font-extrabold text-terracotta-600 text-base">${formatRupiah(total)}</span>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <div class="pt-1">
        <button id="btn-submit-checkout"
                type="button"
                class="w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm bg-terracotta-500 hover:bg-terracotta-600 active:scale-98 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
          <span>Bayar Sekarang (${formatRupiah(total)})</span>
          ${ICONS.arrowRight}
        </button>
      </div>

    </div>
  `;

  openModal({
    title: 'Checkout Pesanan — Bintang Store',
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      // Payment option toggle highlight
      const options = modalEl.querySelectorAll('.payment-option');
      options.forEach((opt) => {
        opt.addEventListener('click', () => {
          options.forEach((o) => {
            o.classList.remove('border-terracotta-500', 'bg-terracotta-50/30');
            o.classList.add('border-stone-200', 'bg-white');
          });
          opt.classList.remove('border-stone-200', 'bg-white');
          opt.classList.add('border-terracotta-500', 'bg-terracotta-50/30');
        });
      });

      // Submit checkout event
      const btnSubmit = modalEl.querySelector('#btn-submit-checkout');
      if (btnSubmit) {
        btnSubmit.addEventListener('click', () => {
          const name = modalEl.querySelector('#checkout-name').value.trim() || 'Pelanggan Bintang';
          const phone = modalEl.querySelector('#checkout-phone').value.trim() || '08123456789';
          const email =
            modalEl.querySelector('#checkout-email').value.trim() || 'buyer@bintang.store';
          const paymentMethod =
            modalEl.querySelector('input[name="checkout-payment-method"]:checked')?.value || 'QRIS';

          // Create order in Store
          try {
            const order = store.createOrder({
              customer: {
                name,
                phone,
                email,
                telegram: `@${name.toLowerCase().replace(/\s+/g, '_')}`,
              },
              paymentMethod,
              singleProduct: singleProduct ? { id: singleProduct.id, quantity: 1 } : null,
              paymentStatus: 'PENDING_PAYMENT',
              fulfillmentStatus: 'PROCESSING',
            });

            closeModal();
            updateCartBadge();

            // Launch Payment Simulation
            showPaymentSimulation({
              order,
              onCompleted: () => {
                switchToSubTab('orders');
              },
            });
          } catch (err) {
            showToast('Gagal membuat pesanan: ' + err.message, 'error');
          }
        });
      }
    },
  });
}

// 4. ORDER DETAIL MODAL
function openOrderDetailModal(orderId) {
  const order = store.getOrder(orderId);
  if (!order) return;

  const f = order.fulfillmentData || {};
  const isFulfilled =
    order.fulfillmentStatus === 'FULFILLED' || order.fulfillmentStatus === 'COMPLETED';
  const isPending = order.paymentStatus === 'PENDING_PAYMENT' || order.paymentStatus === 'UNPAID';

  let fulfillmentBox = '';
  if (isFulfilled) {
    let credContent = '';
    if (f.format === 'account') {
      credContent = `
        <div class="space-y-2">
          <div class="flex items-center justify-between border-b border-stone-800 pb-1.5">
            <div>
              <span class="text-[10px] text-stone-400 block font-sans">Email / Username:</span>
              <span class="text-stone-100 font-semibold select-all">${escapeHtml(f.email || '')}</span>
            </div>
            <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1" data-copy="${f.email || ''}">
              ${ICONS.copy}
            </button>
          </div>
          <div class="flex items-center justify-between pt-0.5">
            <div>
              <span class="text-[10px] text-stone-400 block font-sans">Password:</span>
              <span class="text-stone-100 font-semibold select-all" id="order-pwd-display">••••••••</span>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" id="btn-toggle-pwd" class="text-stone-400 hover:text-white p-1" title="Tampilkan/Sembunyikan">
                ${ICONS.eye}
              </button>
              <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1" data-copy="${f.password || ''}">
                ${ICONS.copy}
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (f.format === 'code') {
      credContent = `
        <div class="flex items-center justify-between">
          <span class="text-amber-300 font-bold text-sm tracking-wider select-all">${f.code || ''}</span>
          <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1.5" data-copy="${f.code || ''}">
            ${ICONS.copy}
          </button>
        </div>
      `;
    } else if (f.format === 'link') {
      credContent = `
        <div class="flex items-center justify-between gap-2">
          <span class="text-stone-300 text-xs truncate select-all">${f.link || ''}</span>
          <a href="${f.link || '#'}" target="_blank" class="px-2.5 py-1 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-sans font-bold flex items-center gap-1 shrink-0">
            <span>Buka</span> ${ICONS.externalLink}
          </a>
        </div>
      `;
    } else {
      credContent = `
        <div class="flex items-center justify-between">
          <span class="text-sky-300 font-bold text-sm tracking-wider select-all">${f.licenseKey || ''}</span>
          <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1.5" data-copy="${f.licenseKey || ''}">
            ${ICONS.copy}
          </button>
        </div>
      `;
    }

    fulfillmentBox = `
      <div class="space-y-2 bg-[#0D1117] text-white p-4 rounded-2xl border border-stone-800 shadow-inner font-mono text-xs">
        <div class="flex items-center justify-between text-amber-400 font-sans font-bold text-[11px] uppercase tracking-wider">
          <span>Akses Produk Digital</span>
          <span class="text-emerald-400">● Terkirim Instan</span>
        </div>
        ${credContent}
        <div class="pt-2 border-t border-stone-800 text-[11px] font-sans text-stone-400 leading-relaxed">
          ${escapeHtml(f.note || 'Garansi berlaku selama masa aktif. Hubungi CS bila perlu bantuan.')}
        </div>
      </div>
    `;
  }

  const content = `
    <div class="space-y-4">
      
      <!-- Order Header Status -->
      <div class="bg-stone-50 rounded-2xl p-4 border border-stone-200/90 space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-mono font-bold text-stone-900 text-sm">${order.id}</span>
            <span class="text-xs text-stone-400 block">${order.date}</span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
            isFulfilled
              ? 'bg-emerald-100 text-emerald-800'
              : isPending
                ? 'bg-amber-100 text-amber-800'
                : 'bg-sky-100 text-sky-800'
          }">
            ${isFulfilled ? 'Selesai' : isPending ? 'Menunggu Bayar' : 'Diproses'}
          </span>
        </div>

        <!-- 4-Step Lifecycle Timeline -->
        <div class="pt-3 border-t border-stone-200/80">
          <div class="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-2 font-semibold">Progres Pesanan:</div>
          <div class="grid grid-cols-4 gap-1 text-center">
            ${(
              order.timeline || [
                { step: 'Dibuat', status: 'completed' },
                {
                  step: 'Dibayar',
                  status: isFulfilled ? 'completed' : isPending ? 'pending' : 'completed',
                },
                { step: 'Diproses', status: isFulfilled ? 'completed' : 'active' },
                { step: 'Terkirim', status: isFulfilled ? 'completed' : 'pending' },
              ]
            )
              .map(
                (t) => `
              <div class="space-y-1">
                <div class="h-1.5 rounded-full ${
                  t.status === 'completed'
                    ? 'bg-emerald-500'
                    : t.status === 'active'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-stone-200'
                }"></div>
                <span class="text-[10px] font-medium ${
                  t.status === 'completed' ? 'text-stone-800 font-bold' : 'text-stone-400'
                } block leading-tight truncate">${t.step}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>

      <!-- Fulfillment Box (If Fulfilled) -->
      ${fulfillmentBox}

      <!-- Order Items Detail -->
      <div class="space-y-2 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
        <h4 class="font-heading font-bold text-stone-800 uppercase text-[10px] tracking-wider">Item Pesanan:</h4>
        <div class="space-y-1.5 divide-y divide-stone-200/60">
          ${(order.items || [{ name: order.product.name, price: order.amount, quantity: 1 }])
            .map(
              (it) => `
            <div class="pt-1.5 first:pt-0 flex justify-between items-center">
              <div>
                <span class="font-bold text-stone-900">${escapeHtml(it.name)}</span>
                <span class="text-stone-400 font-mono block text-[11px]">${it.quantity}x @ ${formatRupiah(it.price)}</span>
              </div>
              <span class="font-mono font-bold text-stone-900">${formatRupiah(it.price * it.quantity)}</span>
            </div>
          `,
            )
            .join('')}
        </div>

        <div class="pt-2 border-t border-stone-200 space-y-1 text-stone-600">
          <div class="flex justify-between">
            <span>Metode Pembayaran:</span>
            <span class="font-semibold text-stone-900">${order.paymentMethod}</span>
          </div>
          ${
            order.discountAmount > 0
              ? `<div class="flex justify-between text-emerald-600 font-semibold">
                  <span>Diskon Voucher (${order.voucherApplied || ''}):</span>
                  <span class="font-mono">-${formatRupiah(order.discountAmount)}</span>
                 </div>`
              : ''
          }
          <div class="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900 text-sm">
            <span>Total:</span>
            <span class="font-heading font-extrabold text-terracotta-600 text-base">${formatRupiah(order.total)}</span>
          </div>
        </div>
      </div>

      <!-- Action if pending -->
      ${
        isPending
          ? `
            <button type="button" id="btn-modal-resume-pay" class="w-full py-3 px-4 rounded-xl font-heading font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center justify-center gap-2">
              ${ICONS.payment}
              <span>Lanjutkan Pembayaran QRIS</span>
            </button>
          `
          : ''
      }

    </div>
  `;

  openModal({
    title: 'Detail Pesanan ' + order.id,
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      // Copy credentials listener
      modalEl.querySelectorAll('.btn-copy-cred').forEach((btn) => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-copy');
          if (text) copyToClipboard(text, 'Kredensial disalin ke clipboard!');
        });
      });

      // Toggle password listener
      const btnTogglePwd = modalEl.querySelector('#btn-toggle-pwd');
      const pwdDisplay = modalEl.querySelector('#order-pwd-display');
      if (btnTogglePwd && pwdDisplay) {
        let isRevealed = false;
        btnTogglePwd.addEventListener('click', () => {
          isRevealed = !isRevealed;
          pwdDisplay.textContent = isRevealed ? f.password || 'Bintang2026Secure' : '••••••••';
        });
      }

      // Resume payment listener
      const btnResume = modalEl.querySelector('#btn-modal-resume-pay');
      if (btnResume) {
        btnResume.addEventListener('click', () => {
          closeModal();
          showPaymentSimulation({
            order,
            onCompleted: () => {
              switchToSubTab('orders');
            },
          });
        });
      }
    },
  });
}

// 5. VOUCHER LIST MODAL
function openVoucherListModal() {
  const content = `
    <div class="space-y-3">
      <p class="text-xs text-stone-500">Salin kode voucher di bawah dan gunakan pada halaman checkout.</p>
      <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        ${PROMOTIONAL_VOUCHERS.filter((v) => v.active)
          .map(
            (v) => `
          <div class="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 flex items-center justify-between gap-3">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <code class="font-mono font-bold text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">${v.code}</code>
                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">${v.badge}</span>
              </div>
              <p class="text-xs text-stone-700 font-medium">${v.description}</p>
              <span class="text-[10px] text-stone-400 block font-mono">Min. belanja: ${formatRupiah(v.minSpend)}</span>
            </div>
            <button type="button"
                    class="btn-copy-voucher-item px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white shrink-0 transition-colors"
                    data-code="${v.code}">
              Salin
            </button>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  openModal({
    title: 'Voucher Promo Tersedia',
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      modalEl.querySelectorAll('.btn-copy-voucher-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-code');
          copyToClipboard(code, `Voucher ${code} berhasil disalin!`);
        });
      });
    },
  });
}

// 6. FAQ & HELP MODAL
function openHelpModal() {
  const faqs = [
    {
      q: 'Berapa lama proses pengiriman produk digital?',
      a: 'Pengiriman produk digital di Bintang Store 100% otomatis. Begitu pembayaran Anda terverifikasi (2-5 detik), akun/kredensial langsung terbit di halaman Pesanan Saya.',
    },
    {
      q: 'Bagaimana cara klaim garansi jika akun berkendala?',
      a: 'Seluruh produk digital kami bergaransi penuh 30 hari. Cukup hubungi tim CS Telegram kami di @bintangstoresupport dengan menyebutkan Order ID Anda (#BS-xxxxx).',
    },
    {
      q: 'Apakah akun streaming & AI legal dan aman?',
      a: 'Ya, kami hanya menyediakan akun legal dari jalur subscription resmi (Family Plan, Edu License, atau Private Subscription) tanpa modifikasi ilegal.',
    },
    {
      q: 'Bisa bayar menggunakan apa saja?',
      a: 'Mendukung QRIS untuk seluruh bank (BCA, Mandiri, BRI, BNI) dan E-Wallet (GoPay, OVO, DANA, ShopeePay), serta Transfer Virtual Account.',
    },
  ];

  const content = `
    <div class="space-y-3">
      <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
        ${faqs
          .map(
            (f) => `
          <div class="bg-stone-50 p-3 rounded-2xl border border-stone-200/80 space-y-1">
            <h4 class="font-heading font-bold text-xs text-stone-900">${f.q}</h4>
            <p class="text-xs text-stone-600 leading-relaxed">${f.a}</p>
          </div>
        `,
          )
          .join('')}
      </div>
      <div class="pt-2 text-center">
        <a href="https://t.me/bintangstoresupport" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-terracotta-500 hover:bg-terracotta-600 text-white transition-colors">
          <span>Hubungi Tim CS di Telegram</span>
          ${ICONS.externalLink}
        </a>
      </div>
    </div>
  `;

  openModal({
    title: 'Pusat Bantuan & Layanan CS',
    content: content,
    maxWidth: 'max-w-md',
  });
}

// 7. TERMS & WARRANTY MODAL
function openTermsModal() {
  const content = `
    <div class="space-y-3 text-xs text-stone-600 leading-relaxed max-h-72 overflow-y-auto pr-1">
      <div class="space-y-1">
        <h4 class="font-heading font-bold text-stone-900 text-xs">1. Ketentuan Garansi Digital</h4>
        <p>Bintang Store memberikan garansi penuh 30 hari (atau sesuai masa durasi produk) sejak tanggal transaksi. Jika akun mengalami logout dini atau kendala login, kami akan mengganti akun baru tanpa biaya tambahan.</p>
      </div>
      <div class="space-y-1">
        <h4 class="font-heading font-bold text-stone-900 text-xs">2. Aturan Penggunaan Akun</h4>
        <p>Untuk akun bertipe 'Shared Profile' atau '1 Device', dilarang keras mengubah password akun utama, mengubah alamat email profil, atau login melebihi batas perangkat yang ditentukan.</p>
      </div>
      <div class="space-y-1">
        <h4 class="font-heading font-bold text-stone-900 text-xs">3. Kebijakan Pengembalian Dana (Refund)</h4>
        <p>Pengembalian dana 100% berlaku jika stok pengganti tidak tersedia dalam waktu 2x24 jam sejak laporan kendala diterima oleh layanan pelanggan.</p>
      </div>
    </div>
  `;

  openModal({
    title: 'Garansi & Ketentuan Layanan',
    content: content,
    maxWidth: 'max-w-md',
  });
}

// 8. PRIVACY POLICY MODAL
function openPrivacyModal() {
  const content = `
    <div class="space-y-3 text-xs text-stone-600 leading-relaxed">
      <p>Bintang Store menghormati privasi Anda. Data email dan nomor kontak yang dimasukkan saat checkout hanya digunakan untuk mengirimkan konfirmasi transaksi dan kredensial produk digital cadangan.</p>
      <p>Kami tidak pernah membagikan atau menjual data pribadi pelanggan kepada pihak ketiga mana pun.</p>
    </div>
  `;

  openModal({
    title: 'Kebijakan Privasi',
    content: content,
    maxWidth: 'max-w-md',
  });
}

// ==========================================
// EVENT BINDINGS & ORCHESTRATION
// ==========================================

function updateCartBadge() {
  const badge = document.getElementById('webapp-cart-badge');
  const count = store.getCartCount();
  if (badge) {
    badge.textContent = count;
    if (count > 0) {
      badge.classList.remove('scale-0', 'opacity-0');
      badge.classList.add('scale-100', 'opacity-100');
    } else {
      badge.classList.remove('scale-100', 'opacity-100');
      badge.classList.add('scale-0', 'opacity-0');
    }
  }
}

function switchToSubTab(tab) {
  currentSubTab = tab;
  const container = document.getElementById('webapp-tab-content');
  if (container) {
    container.innerHTML = renderTabContent(currentSubTab);
    bindEventsForCurrentTab();
  }

  // Update bottom nav highlights
  document.querySelectorAll('.btn-webapp-tab').forEach((btn) => {
    const bTab = btn.getAttribute('data-tab');
    if (bTab === currentSubTab) {
      btn.classList.add('text-terracotta-600', 'font-bold');
      btn.classList.remove('text-stone-400');
    } else {
      btn.classList.remove('text-terracotta-600', 'font-bold');
      btn.classList.add('text-stone-400');
    }
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function bindEventsForCurrentTab() {
  // 1. Common Product Card Interactions
  document.querySelectorAll('.btn-view-product').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openProductDetailModal(id);
    });
  });

  document.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const res = store.addToCart(id, 1);
      if (res.success) {
        showToast(res.message, 'success');
        updateCartBadge();
      } else {
        showToast(res.message, 'error');
      }
    });
  });

  document.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-product-id');
      if (id) openProductDetailModal(id);
    });
  });

  // 2. Home Tab Specific Bindings
  const btnPromoVoucher = document.getElementById('btn-copy-promo-voucher');
  if (btnPromoVoucher) {
    btnPromoVoucher.addEventListener('click', () => {
      copyToClipboard('BINTANG10', 'Kode BINTANG10 disalin ke clipboard!');
    });
  }

  document.querySelectorAll('.btn-switch-to-catalog').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchToSubTab('products');
    });
  });

  document.querySelectorAll('.btn-category-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      currentActiveCategory = cat || 'Semua';
      switchToSubTab('products');
    });
  });

  document.querySelectorAll('.btn-filter-category').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      currentActiveCategory = cat || 'Semua';
      switchToSubTab('products');
    });
  });

  // 3. Products Tab Specific Bindings
  document.querySelectorAll('.btn-category-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentActiveCategory = btn.getAttribute('data-category') || 'Semua';
      switchToSubTab('products');
    });
  });

  const sortSelect = document.getElementById('webapp-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortBy = e.target.value;
      switchToSubTab('products');
    });
  }

  const btnResetCatalogFilters = document.getElementById('btn-reset-catalog-filters');
  if (btnResetCatalogFilters) {
    btnResetCatalogFilters.addEventListener('click', () => {
      currentSearchTerm = '';
      currentActiveCategory = 'Semua';
      switchToSubTab('products');
    });
  }

  const btnResetFilters = document.getElementById('btn-reset-filters');
  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      currentSearchTerm = '';
      currentActiveCategory = 'Semua';
      switchToSubTab('products');
    });
  }

  // 4. Orders Tab Specific Bindings
  document.querySelectorAll('.btn-order-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      ordersFilter = btn.getAttribute('data-status') || 'Semua';
      switchToSubTab('orders');
    });
  });

  document.querySelectorAll('.btn-view-order-detail-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openOrderDetailModal(id);
    });
  });

  document.querySelectorAll('.btn-resume-pay').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const order = store.getOrder(id);
      if (order) {
        showPaymentSimulation({
          order,
          onCompleted: () => {
            switchToSubTab('orders');
          },
        });
      }
    });
  });

  // 5. Account Tab Specific Bindings
  const btnNavOrders = document.querySelector('.btn-account-nav-orders');
  if (btnNavOrders) {
    btnNavOrders.addEventListener('click', () => switchToSubTab('orders'));
  }

  const btnShowVouchers = document.querySelector('.btn-account-show-voucher');
  if (btnShowVouchers) {
    btnShowVouchers.addEventListener('click', openVoucherListModal);
  }

  const btnHelp = document.querySelector('.btn-account-help');
  if (btnHelp) {
    btnHelp.addEventListener('click', openHelpModal);
  }

  const btnTerms = document.querySelector('.btn-account-terms');
  if (btnTerms) {
    btnTerms.addEventListener('click', openTermsModal);
  }

  const btnPrivacy = document.querySelector('.btn-account-privacy');
  if (btnPrivacy) {
    btnPrivacy.addEventListener('click', openPrivacyModal);
  }
}

export function initWebAppEvents() {
  // Home logo click
  const navHomeBtn = document.getElementById('webapp-nav-home-btn');
  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', () => switchToSubTab('home'));
  }

  // Open Cart Modal
  const btnOpenCart = document.getElementById('btn-open-cart');
  if (btnOpenCart) {
    btnOpenCart.addEventListener('click', openCartModal);
  }

  // Search Inputs & Clear Actions
  const searchInput = document.getElementById('webapp-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      if (currentSubTab !== 'products') {
        currentSubTab = 'products';
      }
      switchToSubTab('products');
    });
  }

  const btnClearSearch = document.getElementById('btn-clear-search');
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      currentSearchTerm = '';
      if (searchInput) searchInput.value = '';
      switchToSubTab('products');
    });
  }

  const searchInputMobile = document.getElementById('webapp-search-input-mobile');
  if (searchInputMobile) {
    searchInputMobile.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      if (currentSubTab !== 'products') {
        currentSubTab = 'products';
      }
      switchToSubTab('products');
    });
  }

  const btnClearSearchMobile = document.getElementById('btn-clear-search-mobile');
  if (btnClearSearchMobile) {
    btnClearSearchMobile.addEventListener('click', () => {
      currentSearchTerm = '';
      if (searchInputMobile) searchInputMobile.value = '';
      if (searchInput) searchInput.value = '';
      switchToSubTab('products');
    });
  }

  // Bottom Navigation tabs
  document.querySelectorAll('.btn-webapp-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchToSubTab(tab);
    });
  });

  // Template Switcher (Dark Obsidian vs Ivory Minimal)
  const btnTplDark = document.getElementById('btn-switch-tpl-dark');
  const btnTplIvory = document.getElementById('btn-switch-tpl-ivory');
  if (btnTplDark && btnTplIvory) {
    btnTplDark.addEventListener('click', () => {
      currentStoreTemplate = 'dark';
      localStorage.setItem('bts_store_template', 'dark');
      const root = document.getElementById('app-root');
      if (root) {
        root.innerHTML = renderWebAppPage();
        initWebAppEvents();
      }
    });
    btnTplIvory.addEventListener('click', () => {
      currentStoreTemplate = 'ivory';
      localStorage.setItem('bts_store_template', 'ivory');
      const root = document.getElementById('app-root');
      if (root) {
        root.innerHTML = renderWebAppPage();
        initWebAppEvents();
      }
    });
  }

  // Bind initial tab events
  bindEventsForCurrentTab();
  updateCartBadge();
}
