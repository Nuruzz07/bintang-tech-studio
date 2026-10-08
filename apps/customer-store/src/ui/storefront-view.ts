/**
 * Bintang Tech Studio — Pure Customer Storefront Presentation View.
 * Baseline: Milestone M10 Customer Store Migration.
 *
 * Preserves the proven Bintang Store customer UX:
 * - Deep Obsidian (#0C0A09), Warm Ivory (#FAF7F2), Terracotta (#C2410C), Gold (#D97706)
 * - Restrained, modern, commerce-oriented design
 * - 4 Customer Tabs: Home, Produk, Pesanan, Akun
 * - Strictly excludes all Seller, Admin, Template Switcher, and Owner surfaces.
 */

import type { CustomerProductView, CustomerProductDetailView } from '../types.js';
import { STORE_ICONS, BRAND_LOGO_SVG } from './icons.js';

export function renderStorefrontHeader(
  storeName: string,
  tagline: string,
  cartCount: number,
): string {
  return `
    <header class="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-xl bg-stone-950 border border-stone-800 p-1 flex items-center justify-center shrink-0 shadow-sm">
            ${BRAND_LOGO_SVG}
          </span>
          <div>
            <h1 class="font-bold text-base leading-tight text-stone-950">${storeName}</h1>
            <p class="text-[11px] text-stone-500 hidden sm:block">${tagline}</p>
          </div>
        </div>

        <button id="btn-open-cart" type="button" class="relative p-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center gap-1.5 cursor-pointer">
          <span class="w-4 h-4">${STORE_ICONS.cart}</span>
          <span class="text-xs font-semibold">Keranjang</span>
          <span id="header-cart-badge" class="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center ${cartCount > 0 ? '' : 'hidden'}">
            ${cartCount}
          </span>
        </button>
      </div>
    </header>
  `;
}

export function renderHeroBanner(): string {
  return `
    <div class="rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-white p-5 sm:p-7 shadow-lg relative overflow-hidden mb-6 border border-stone-800">
      <div class="relative z-10 max-w-xl">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium mb-3">
          <span class="w-3.5 h-3.5">${STORE_ICONS.zap}</span>
          <span>Digital Commerce Terpercaya</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-black tracking-tight leading-snug mb-2">
          Produk digital, langsung beres.
        </h2>
        <p class="text-xs sm:text-sm text-stone-300 mb-4 leading-relaxed">
          Akun premium, lisensi resmi, dan voucher instan terbit otomatis 24 jam dengan jaminan garansi penuh.
        </p>
        <div class="flex flex-wrap items-center gap-2 text-[11px] text-stone-300">
          <span class="inline-flex items-center gap-1 bg-stone-800/80 px-2 py-1 rounded-lg">
            <span class="w-3 h-3 text-emerald-400">${STORE_ICONS.check}</span> Pengiriman Otomatis
          </span>
          <span class="inline-flex items-center gap-1 bg-stone-800/80 px-2 py-1 rounded-lg">
            <span class="w-3 h-3 text-amber-400">${STORE_ICONS.shield}</span> Garansi Ganti Baru
          </span>
          <span class="inline-flex items-center gap-1 bg-stone-800/80 px-2 py-1 rounded-lg">
            <span class="w-3 h-3 text-blue-400">${STORE_ICONS.zap}</span> QRIS Semua Bank / E-Wallet
          </span>
        </div>
      </div>
    </div>
  `;
}

export function renderProductCard(product: CustomerProductView): string {
  return `
    <div class="product-card bg-white rounded-2xl border border-stone-200/90 p-4 flex flex-col justify-between hover:shadow-md transition-shadow group" data-product-id="${product.id}">
      <div>
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="w-10 h-10 rounded-xl bg-stone-950 text-amber-400 font-black text-sm flex items-center justify-center shrink-0">
            ${product.monogram ?? 'BS'}
          </div>
          ${product.badge ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 text-[10px] font-bold uppercase tracking-wider">${product.badge}</span>` : ''}
        </div>

        <h3 class="font-bold text-sm text-stone-900 group-hover:text-amber-700 transition-colors line-clamp-1 mb-1">
          ${product.name}
        </h3>
        ${product.duration ? `<p class="text-[11px] text-stone-500 font-medium mb-2">${product.duration}</p>` : ''}
        ${product.shortDescription ? `<p class="text-xs text-stone-600 line-clamp-2 mb-3 leading-relaxed">${product.shortDescription}</p>` : ''}
      </div>

      <div class="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 mt-2">
        <div>
          <div class="text-sm font-black text-stone-950">${product.formattedPrice}</div>
          ${product.formattedCompareAtPrice ? `<div class="text-[10px] text-stone-400 line-through">${product.formattedCompareAtPrice}</div>` : ''}
        </div>
        <button type="button" class="btn-product-detail px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold cursor-pointer transition-colors" data-product-id="${product.id}">
          Detail
        </button>
      </div>
    </div>
  `;
}

export function renderProductDetailModal(product: CustomerProductDetailView): string {
  return `
    <div class="p-5 sm:p-6 max-w-lg mx-auto">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-stone-950 text-amber-400 font-black text-base flex items-center justify-center shrink-0">
            ${product.monogram ?? 'BS'}
          </div>
          <div>
            <h3 class="font-bold text-lg text-stone-950">${product.name}</h3>
            ${product.duration ? `<p class="text-xs text-stone-500 font-medium">${product.duration}</p>` : ''}
          </div>
        </div>
        <button id="modal-close-btn" class="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer">
          <span class="w-5 h-5">${STORE_ICONS.close}</span>
        </button>
      </div>

      <div class="mb-4">
        <div class="text-lg font-black text-stone-950">${product.formattedPrice}</div>
        ${product.formattedCompareAtPrice ? `<div class="text-xs text-stone-400 line-through">${product.formattedCompareAtPrice}</div>` : ''}
      </div>

      ${product.description ? `<p class="text-xs text-stone-700 leading-relaxed mb-4">${product.description}</p>` : ''}

      ${
        product.benefits && product.benefits.length > 0
          ? `
        <div class="mb-4">
          <h4 class="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">Keuntungan Produk</h4>
          <ul class="space-y-1.5 text-xs text-stone-600">
            ${product.benefits.map((b) => `<li class="flex items-center gap-2"><span class="w-3.5 h-3.5 text-emerald-600 shrink-0">${STORE_ICONS.check}</span><span>${b}</span></li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }

      ${
        product.importantInfo
          ? `
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 mb-5 leading-relaxed">
          <span class="font-bold">Informasi Penting:</span> ${product.importantInfo}
        </div>
      `
          : ''
      }

      <div class="flex items-center gap-3 pt-3 border-t border-stone-200">
        <button id="btn-modal-add-cart" type="button" class="w-full py-2.5 rounded-xl bg-stone-950 hover:bg-amber-600 text-white font-bold text-xs transition-colors cursor-pointer" data-product-id="${product.id}">
          Tambah ke Keranjang
        </button>
      </div>
    </div>
  `;
}

export function renderBottomNav(activeTab: 'home' | 'products' | 'orders' | 'account'): string {
  const tabs = [
    { id: 'home', label: 'Home', icon: STORE_ICONS.home },
    { id: 'products', label: 'Produk', icon: STORE_ICONS.layers },
    { id: 'orders', label: 'Pesanan', icon: STORE_ICONS.package },
    { id: 'account', label: 'Akun', icon: STORE_ICONS.user },
  ];

  return `
    <nav class="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 py-1.5 px-4">
      <div class="max-w-md mx-auto flex items-center justify-around">
        ${tabs
          .map(
            (t) => `
          <button type="button" class="nav-tab-btn flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl ${activeTab === t.id ? 'text-amber-700 font-bold' : 'text-stone-500 font-medium'} text-[11px] transition-colors cursor-pointer" data-tab-id="${t.id}">
            <span class="w-4 h-4">${t.icon}</span>
            <span>${t.label}</span>
          </button>
        `,
          )
          .join('')}
      </div>
    </nav>
  `;
}
