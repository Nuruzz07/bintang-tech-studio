// Bintang Store — Product Card Component
// Clean Visual Hierarchy & Typography-Based Aesthetic Visual Tiles

import { formatRupiah } from '../utils/currency.js';
import { escapeHtml, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';

function getProductTileMeta(product) {
  // Category-based aesthetic gradients & accent colors
  const categoryThemes = {
    Streaming: {
      accentBg: 'from-emerald-950/60 to-stone-950',
      accentBorder: 'border-emerald-500/30',
      accentText: 'text-emerald-300',
    },
    'AI & Productivity': {
      accentBg: 'from-teal-950/60 to-stone-950',
      accentBorder: 'border-teal-500/30',
      accentText: 'text-teal-300',
    },
    Design: {
      accentBg: 'from-amber-950/60 to-terracotta-950/70',
      accentBorder: 'border-terracotta-500/30',
      accentText: 'text-terracotta-300',
    },
    Gaming: {
      accentBg: 'from-red-950/60 to-stone-950',
      accentBorder: 'border-amber-500/30',
      accentText: 'text-amber-300',
    },
    Software: {
      accentBg: 'from-blue-950/60 to-stone-950',
      accentBorder: 'border-sky-500/30',
      accentText: 'text-sky-300',
    },
    'Cloud & Storage': {
      accentBg: 'from-cyan-950/60 to-stone-950',
      accentBorder: 'border-cyan-500/30',
      accentText: 'text-cyan-300',
    },
    Education: {
      accentBg: 'from-indigo-950/60 to-stone-950',
      accentBorder: 'border-indigo-500/30',
      accentText: 'text-indigo-300',
    },
    'Digital Tools': {
      accentBg: 'from-purple-950/60 to-stone-950',
      accentBorder: 'border-purple-500/30',
      accentText: 'text-purple-300',
    },
  };

  const theme = categoryThemes[product.category] || {
    accentBg: 'from-stone-900 to-obsidian-950',
    accentBorder: 'border-stone-700/40',
    accentText: 'text-stone-300',
  };

  // Derive monogram if not set
  let monogram = product.monogram;
  if (!monogram) {
    const words = product.name.split(' ');
    if (words.length > 1) {
      monogram = (words[0][0] + words[1][0]).toUpperCase();
    } else {
      monogram = product.name.substring(0, 3).toUpperCase();
    }
  }

  return {
    monogram,
    subtitle: product.duration || product.category.toUpperCase(),
    accentBg: theme.accentBg,
    accentBorder: theme.accentBorder,
    accentText: theme.accentText,
  };
}

export function renderProductCard(product, options = { showAddToCart: true }) {
  const isAvailable = product.active && product.stock > 0;
  const isLowStock = isAvailable && product.stock <= 5;
  const isSoldOut = !isAvailable;
  const tile = getProductTileMeta(product);

  const typeMap = {
    account: { label: 'Akun', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    code: { label: 'Kode', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    link: { label: 'Link/Drive', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    license: {
      label: 'Lisensi',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
  };
  const typeInfo = typeMap[product.type] || {
    label: product.type || 'Digital',
    color: 'bg-stone-500/10 text-stone-400 border-stone-500/20',
  };

  return `
    <article class="product-card group relative bg-white rounded-2xl border border-stone-200/90 hover:border-terracotta-500/60 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden select-none cursor-pointer ${
      isSoldOut ? 'opacity-60 bg-stone-50' : ''
    }" data-product-id="${product.id}">
      
      <!-- 1. COMPACT PRODUCT VISUAL TILE -->
      <div class="relative w-full h-20 sm:h-24 bg-[#0C0E14] overflow-hidden flex flex-col justify-between p-2 sm:p-2.5 border-b border-stone-100">
        <!-- Tile Subtle Radial Background Glow -->
        <div class="absolute inset-0 bg-gradient-to-br ${tile.accentBg} pointer-events-none"></div>

        <!-- Ultra-Subtle Watermark Logo in Corner (~4% opacity) -->
        <div class="absolute -right-2 -bottom-2 w-14 sm:w-16 h-14 sm:h-16 opacity-[0.04] pointer-events-none select-none">
          ${BRAND_LOGO_SVG}
        </div>

        <!-- Tile Top Row: Format & Highlight Badge -->
        <div class="relative z-10 flex items-center justify-between gap-1">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider font-semibold border ${typeInfo.color}">
            ${typeInfo.label}
          </span>
          ${
            product.badge
              ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-terracotta-500/20 text-terracotta-300 border border-terracotta-500/30">
                  ${escapeHtml(product.badge)}
                </span>`
              : ''
          }
        </div>

        <!-- Tile Center/Bottom: Monogram & Category -->
        <div class="relative z-10 flex items-baseline justify-between pt-0.5">
          <div class="font-heading font-black text-lg sm:text-xl tracking-tight ${tile.accentText} group-hover:scale-105 transition-transform duration-200 origin-left">
            ${tile.monogram}
          </div>
          
          <!-- Category Chip -->
          <div class="text-[9px] font-mono text-stone-400 uppercase bg-stone-900/80 px-1.5 py-0.5 rounded border border-stone-800/80 truncate max-w-[80px] text-right">
            ${escapeHtml(product.category)}
          </div>
        </div>
      </div>

      <!-- 2. PRODUCT INFO & HIERARCHY -->
      <div class="p-2.5 sm:p-3 flex-1 flex flex-col justify-between space-y-1.5 sm:space-y-2">
        <div>
          <!-- Product Name (Comfortable 2-line wrap without clipping) -->
          <h3 class="font-heading font-bold text-xs sm:text-sm text-stone-900 group-hover:text-terracotta-600 transition-colors line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.4rem]">
            ${escapeHtml(product.name)}
          </h3>
          
          <!-- Duration / Variant & Availability -->
          <div class="flex items-center justify-between gap-1 mt-1 text-[10px] sm:text-[11px] font-mono">
            <span class="text-stone-400 truncate">${escapeHtml(product.duration || 'Digital')}</span>
            <!-- Availability Pill -->
            <span class="shrink-0 font-medium ${
              isSoldOut
                ? 'text-red-500 font-bold'
                : isLowStock
                  ? 'text-amber-600 font-bold'
                  : 'text-emerald-600'
            }">
              ${isSoldOut ? '● Habis' : isLowStock ? `● Sisa ${product.stock}` : '✓ Tersedia'}
            </span>
          </div>
        </div>

        <!-- Price & Action Bar (Zero Truncation on Price) -->
        <div class="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1.5">
          <div class="flex-1 min-w-0 pr-0.5">
            <div class="font-heading font-extrabold text-xs sm:text-sm text-stone-950 leading-tight whitespace-nowrap">
              ${formatRupiah(product.price)}
            </div>
            ${
              product.originalPrice && product.originalPrice > product.price
                ? `<div class="text-[9px] sm:text-[10px] text-stone-400 line-through leading-tight truncate">
                    ${formatRupiah(product.originalPrice)}
                  </div>`
                : ''
            }
          </div>

          <!-- CTAs: Detail & Cart -->
          <div class="flex items-center gap-1 shrink-0">
            <button type="button"
                    class="btn-view-product hidden sm:inline-flex px-2 py-1 rounded-lg text-[11px] font-semibold bg-stone-100 text-stone-800 hover:bg-stone-200 transition-colors"
                    data-id="${product.id}"
                    aria-label="Lihat detail ${escapeHtml(product.name)}">
              Lihat
            </button>
            ${
              options.showAddToCart && isAvailable
                ? `<button type="button"
                           class="btn-add-cart w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-white bg-terracotta-500 hover:bg-terracotta-600 active:scale-95 shadow-sm transition-all flex items-center justify-center"
                           data-id="${product.id}"
                           title="Tambah ke Keranjang"
                           aria-label="Tambah ${escapeHtml(product.name)} ke keranjang">
                    <span class="w-3.5 h-3.5 flex items-center justify-center">${ICONS.cart}</span>
                   </button>`
                : `<button type="button"
                           class="btn-view-product sm:hidden w-7 h-7 rounded-lg text-stone-600 bg-stone-100 hover:bg-stone-200 flex items-center justify-center"
                           data-id="${product.id}"
                           aria-label="Lihat detail ${escapeHtml(product.name)}">
                    <span class="w-3.5 h-3.5 flex items-center justify-center">${ICONS.arrowRight}</span>
                   </button>`
            }
          </div>
        </div>
      </div>
    </article>
  `;
}
