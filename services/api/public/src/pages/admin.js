// Bintang Tech Studio — Template 01: DIGITAL MINIMAL
// Admin Dashboard Page

import { store } from '../state/store.js';
import { CATEGORIES } from '../data/products.js';
import { formatRupiah, parseRupiah } from '../utils/currency.js';
import { escapeHtml, showToast, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';
import { openModal, closeModal } from '../components/modal.js';

let adminActiveTab = 'overview'; // 'overview' | 'products' | 'inventory' | 'orders' | 'customers' | 'settings'
let productSearchTerm = '';
let productCategoryFilter = 'Semua';

export function renderAdminPage() {
  const settings = store.getSettings();

  let authUser = null;
  try {
    authUser = JSON.parse(localStorage.getItem('bts_auth_user') || 'null');
  } catch {}
  const activeStoreName = authUser?.store?.name || authUser?.storeName || 'Bintang Store';
  const activeStoreSlug = authUser?.store?.slug || 'bintang-store';

  const hash = window.location.hash || '';
  if (hash.includes('inventory')) adminActiveTab = 'inventory';
  else if (hash.includes('products')) adminActiveTab = 'products';
  else if (hash.includes('orders')) adminActiveTab = 'orders';
  else if (hash.includes('customers')) adminActiveTab = 'customers';
  else if (hash.includes('settings')) adminActiveTab = 'settings';
  else if (hash === '#admin') adminActiveTab = 'overview';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'products', label: 'Products' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'orders', label: 'Orders' },
    { id: 'customers', label: 'Customers' },
    { id: 'settings', label: 'Settings' },
  ];

  return `
    <div class="view-container bg-[#08090A] min-h-screen text-[#F7F8F8] pb-16 font-sans selection:bg-[#5E6AD2]/30 selection:text-white">
      
      <!-- ADMIN HEADER & WORKSPACE BANNER (Linear Workspace Style) -->
      <header class="border-b border-white/[0.06] bg-[#08090A]/60 backdrop-blur-md">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="h-16 flex items-center justify-between gap-4">
            <!-- Left Branding & Workspace Info -->
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#5E6AD2] to-indigo-400 p-0.5 flex items-center justify-center shrink-0 shadow-sm">
                <span class="w-2.5 h-2.5 rounded-full bg-white"></span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="font-semibold text-sm sm:text-base text-[#F7F8F8] tracking-tight">${activeStoreName} Workspace</h1>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.04] text-[#A1A1AA] border border-white/[0.08]">
                    ${activeStoreSlug} · 36 Produk
                  </span>
                </div>
                <p class="text-[12px] text-[#8A8F98] hidden sm:block">Automated Multi-Channel Sales System (WhatsApp & Telegram)</p>
              </div>
            </div>

            <!-- Header Quick Action: Tambah Produk -->
            <div class="flex items-center gap-2">
              <button id="btn-admin-add-product"
                      type="button"
                      class="px-4 py-1.5 rounded-full text-xs font-semibold bg-white hover:bg-zinc-200 text-black shadow-sm transition-all flex items-center gap-1.5">
                <i class="fas fa-plus text-[10px]"></i>
                <span>Tambah Produk</span>
              </button>
            </div>
          </div>

          <!-- ADMIN NAVIGATION TABS (No Emojis - Pure Linear) -->
          <nav class="flex items-center gap-1 overflow-x-auto border-t border-white/[0.06] py-2 scrollbar-none" aria-label="Admin tabs">
            ${tabs
              .map((t) => {
                const isActive = adminActiveTab === t.id;
                return `
                <button type="button"
                        class="btn-admin-tab flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-white/[0.08] text-[#F7F8F8] shadow-sm ring-1 ring-white/10'
                            : 'text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-white/[0.04]'
                        }"
                        data-tab="${t.id}">
                  <span>${t.label}</span>
                </button>
              `;
              })
              .join('')}
          </nav>
        </div>
      </header>

      <!-- ADMIN TAB CONTENT AREA -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div id="admin-main-container">
          ${renderAdminTabContent()}
        </div>
      </main>

    </div>
  `;
}

function renderAdminTabContent() {
  switch (adminActiveTab) {
    case 'products':
      return renderAdminProductsTab();
    case 'inventory':
      return renderAdminInventoryTab();
    case 'orders':
      return renderAdminOrdersTab();
    case 'customers':
      return renderAdminCustomersTab();
    case 'settings':
      return renderAdminSettingsTab();
    default:
      return renderAdminOverviewTab();
  }
}

// 1. OVERVIEW TAB
function renderAdminOverviewTab() {
  const products = store.getProducts();
  const activeCount = products.filter((p) => p.active).length;
  const orders = store.getOrders();
  const customers = store.getCustomers();

  // Low stock products (stock <= 5)
  const lowStock = products.filter((p) => p.active && p.stock <= 5);
  // Top products
  const topProducts = [...products]
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, 4);

  return `
    <div class="space-y-6">
      
      <!-- 4 KEY KPI CARDS -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- KPI 1: Total Sales -->
        <div class="bg-[#101114] p-5 rounded-xl border border-white/[0.08] shadow-sm space-y-2">
          <div class="flex items-center justify-between text-[#8A8F98]">
            <span class="text-[11px] font-mono uppercase tracking-wider">Total Sales</span>
            <span class="p-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs">${ICONS.trendingUp}</span>
          </div>
          <div class="font-bold text-2xl text-white tracking-tight">Rp2.450.000</div>
          <div class="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span>↑ 18.4%</span>
            <span class="text-[#64748B] font-normal">dari minggu lalu</span>
          </div>
        </div>

        <!-- KPI 2: WhatsApp & Telegram Bot Engine -->
        <div class="bg-[#101114] p-5 rounded-xl border border-emerald-500/30 shadow-sm space-y-2">
          <div class="flex items-center justify-between text-[#8A8F98]">
            <span class="text-[11px] font-mono uppercase tracking-wider font-semibold text-emerald-400">Multi-Channel Bot</span>
            <span class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div class="font-bold text-xl text-white tracking-tight flex items-center gap-2">
            <span>WA & TG LIVE</span>
          </div>
          <div class="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Zero-Click Fulfillment Aktif</span>
          </div>
        </div>

        <!-- KPI 3: Orders -->
        <div class="bg-[#101114] p-5 rounded-xl border border-white/[0.08] shadow-sm space-y-2">
          <div class="flex items-center justify-between text-[#8A8F98]">
            <span class="text-[11px] font-mono uppercase tracking-wider">Orders</span>
            <span class="p-1 rounded-md bg-blue-500/10 text-blue-400 text-xs">${ICONS.shoppingBag}</span>
          </div>
          <div class="font-bold text-2xl text-white tracking-tight">128</div>
          <div class="text-[11px] text-[#8A8F98]">
            <span class="font-semibold text-white">100%</span> otomatis terkirim
          </div>
        </div>

        <!-- KPI 4: Active Products -->
        <div class="bg-[#101114] p-5 rounded-xl border border-white/[0.08] shadow-sm space-y-2">
          <div class="flex items-center justify-between text-[#8A8F98]">
            <span class="text-[11px] font-mono uppercase tracking-wider">Products</span>
            <span class="p-1 rounded-md bg-amber-500/10 text-amber-400 text-xs">${ICONS.package}</span>
          </div>
          <div class="font-bold text-2xl text-white tracking-tight">${activeCount} <span class="text-sm font-normal text-[#64748B]">/ ${products.length}</span></div>
          <div class="text-[11px] text-[#8A8F98]">
            ${lowStock.length} produk stok menipis
          </div>
        </div>
      </div>

      <!-- SALES OVERVIEW & TOP PRODUCTS -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Sales Overview Visual Chart -->
        <div class="lg:col-span-8 bg-[#101114] p-5 rounded-xl border border-white/[0.08] shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-sm text-white">Sales Overview (7 Hari Terakhir)</h3>
              <p class="text-xs text-[#8A8F98]">Grafik transaksi penjualan produk digital harian.</p>
            </div>
            <span class="text-xs font-mono text-[#D0D6E0] bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 rounded-md">Rata-rata Rp350K/hari</span>
          </div>

          <!-- CSS Bar Chart Visualization -->
          <div class="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-white/[0.06]">
            ${[
              { day: 'Sen', val: 320, pct: '64%' },
              { day: 'Sel', val: 410, pct: '82%' },
              { day: 'Rab', val: 280, pct: '56%' },
              { day: 'Kam', val: 390, pct: '78%' },
              { day: 'Jum', val: 450, pct: '90%' },
              { day: 'Sab', val: 500, pct: '100%' },
              { day: 'Min', val: 420, pct: '84%' },
            ]
              .map(
                (col) => `
              <div class="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                <div class="text-[10px] font-mono text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity">
                  ${col.val}k
                </div>
                <div class="w-full max-w-[36px] bg-white/[0.06] group-hover:bg-[#5E6AD2] rounded-t-md transition-colors" style="height: ${col.pct};"></div>
                <span class="text-[11px] font-mono text-[#8A8F98]">${col.day}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>

        <!-- Low Stock Alerts -->
        <div class="lg:col-span-4 bg-[#101114] p-5 rounded-xl border border-white/[0.08] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-sm text-white">Stok Menipis (Low Stock)</h3>
              <span class="w-2 h-2 rounded-full ${lowStock.length > 0 ? 'bg-red-500' : 'bg-emerald-400'}"></span>
            </div>
            <div class="space-y-2.5">
              ${
                lowStock.length > 0
                  ? lowStock
                      .map(
                        (p) => `
                <div class="flex items-center justify-between p-2.5 rounded-lg bg-[#0C0D0F] border border-white/[0.06] text-xs">
                  <div>
                    <div class="font-medium text-white">${escapeHtml(p.name)}</div>
                    <div class="text-[10px] text-[#8A8F98] font-mono">${p.category}</div>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                    Sisa ${p.stock}
                  </span>
                </div>
              `,
                      )
                      .join('')
                  : `
                <div class="p-6 text-center text-xs text-[#8A8F98] font-mono bg-[#0C0D0F] rounded-lg border border-white/[0.04]">
                  ✓ Semua stok produk aman (36/36)
                </div>
              `
              }
            </div>
          </div>
          <button type="button" class="btn-goto-inventory w-full mt-3 py-2 rounded-lg text-xs font-medium text-[#8A8F98] hover:text-white bg-[#0C0D0F] hover:bg-white/[0.06] border border-white/[0.06] transition-colors text-center">
            Kelola Stok di Inventori →
          </button>
        </div>

      </div>

      <!-- RECENT ORDERS TABLE (Linear Table Style) -->
      <div class="bg-[#101114] rounded-xl border border-white/[0.08] shadow-sm overflow-hidden">
        <div class="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-sm text-white">Recent Orders (Transaksi Masuk)</h3>
            <p class="text-xs text-[#8A8F98]">Daftar transaksi masuk dan status fulfillment otomatis lintas channel.</p>
          </div>
          <button type="button" class="btn-goto-orders text-xs font-medium text-[#F7F8F8] hover:underline">
            Lihat Semua Pesanan →
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-[#8A8F98]">
            <thead class="bg-[#0C0D0F] font-mono uppercase text-[10px] text-[#64748B] border-b border-white/[0.06]">
              <tr>
                <th class="px-4 py-3">Order ID</th>
                <th class="px-4 py-3">Customer</th>
                <th class="px-4 py-3">Produk</th>
                <th class="px-4 py-3">Total</th>
                <th class="px-4 py-3">Pembayaran</th>
                <th class="px-4 py-3">Fulfillment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#1c1f26]">
              ${orders
                .slice(0, 5)
                .map(
                  (o) => `
                <tr class="hover:bg-[#161821] transition-colors">
                  <td class="px-4 py-3 font-mono font-bold text-white">${o.id}</td>
                  <td class="px-4 py-3">
                    <div class="font-semibold text-white">${escapeHtml(o.customer.name)}</div>
                    <div class="text-[11px] text-[#64748b] font-mono">${escapeHtml(o.customer.telegram)}</div>
                  </td>
                  <td class="px-4 py-3 font-medium text-white">${escapeHtml(o.product.name)}</td>
                  <td class="px-4 py-3 font-mono font-bold text-terracotta-400">${formatRupiah(o.total)}</td>
                  <td class="px-4 py-3 font-mono">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ${o.paymentStatus}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      o.fulfillmentStatus === 'FULFILLED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }">
                      ${o.fulfillmentStatus}
                    </span>
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// 2. PRODUCTS TAB
function renderAdminProductsTab() {
  const products = store.getProducts();
  const filtered = products.filter((p) => {
    const matchCat = productCategoryFilter === 'Semua' || p.category === productCategoryFilter;
    const matchSearch =
      !productSearchTerm ||
      p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return `
    <div class="space-y-4">
      <!-- Search & Filters Bar -->
      <div class="bg-[#101114] p-4 rounded-xl border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div class="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div class="relative flex-1 max-w-sm">
            <span class="absolute inset-y-0 left-3 flex items-center text-[#8A8F98] pointer-events-none">
              ${ICONS.search}
            </span>
            <input id="admin-prod-search"
                   type="text"
                   placeholder="Cari produk di admin..."
                   value="${escapeHtml(productSearchTerm)}"
                   class="w-full pl-9 pr-3 py-2 text-xs bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none placeholder-[#555]">
          </div>
          <!-- Category Select -->
          <select id="admin-prod-category-filter" class="px-3 py-2 text-xs bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none font-medium">
            ${CATEGORIES.map(
              (cat) => `
              <option value="${cat}" ${productCategoryFilter === cat ? 'selected' : ''}>${cat}</option>
            `,
            ).join('')}
          </select>
        </div>

        <div class="text-xs text-[#8A8F98] font-mono">
          Total: <b class="text-white">${filtered.length}</b> produk
        </div>
      </div>

      <!-- Products Table -->
      <div class="bg-[#101114] rounded-xl border border-white/[0.08] overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-[#8A8F98]">
            <thead class="bg-[#0C0D0F] font-mono uppercase text-[10px] text-[#64748B] border-b border-white/[0.06]">
              <tr>
                <th class="px-4 py-3">Produk</th>
                <th class="px-4 py-3">Kategori & Tipe</th>
                <th class="px-4 py-3">Harga</th>
                <th class="px-4 py-3">Stok</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.04]">
              ${filtered
                .map(
                  (p) => `
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="px-4 py-3">
                    <div class="font-medium text-white text-sm">${escapeHtml(p.name)}</div>
                    <div class="text-[11px] text-[#8A8F98] font-mono">${escapeHtml(p.duration || '-')}</div>
                  </td>
                  <td class="px-4 py-3 font-mono">
                    <span class="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-[#D0D6E0] border border-white/[0.06]">${p.category}</span>
                    <span class="text-[10px] text-[#8A8F98] ml-1 font-sans">(${p.type})</span>
                  </td>
                  <td class="px-4 py-3 font-mono font-semibold text-white">
                    ${formatRupiah(p.price)}
                  </td>
                  <td class="px-4 py-3 font-mono">
                    <span class="font-semibold ${p.stock <= 5 ? 'text-amber-400' : 'text-emerald-400'}">${p.stock}</span>
                  </td>
                  <td class="px-4 py-3">
                    <button type="button"
                            class="btn-toggle-active px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-colors ${
                              p.active
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/[0.04] text-[#8A8F98] border border-white/[0.08]'
                            }"
                            data-id="${p.id}">
                      ${p.active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button type="button"
                            class="btn-edit-product px-3 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] transition-colors"
                            data-id="${p.id}">
                      Edit
                    </button>
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 3. INVENTORY TAB
function renderAdminInventoryTab() {
  const inventory = store.getInventorySummary();

  return `
    <div class="space-y-4">
      <div class="bg-[#101114] p-4 rounded-xl border border-white/[0.08] flex items-center justify-between shadow-sm">
        <div>
          <h3 class="font-semibold text-sm text-white">Ringkasan Inventori Stok</h3>
          <p class="text-xs text-[#8A8F98]">Pantau ketersediaan stok produk digital, unit dipesan, dan total terjual.</p>
        </div>
      </div>

      <div class="bg-[#101114] rounded-xl border border-white/[0.08] overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-[#8A8F98]">
            <thead class="bg-[#0C0D0F] font-mono uppercase text-[10px] text-[#64748B] border-b border-white/[0.06]">
              <tr>
                <th class="px-4 py-3">Produk</th>
                <th class="px-4 py-3">Kategori</th>
                <th class="px-4 py-3 text-center">Stok Total</th>
                <th class="px-4 py-3 text-center">Available</th>
                <th class="px-4 py-3 text-center">Reserved</th>
                <th class="px-4 py-3 text-center">Sold (Terjual)</th>
                <th class="px-4 py-3 text-right">Update Stok</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.04]">
              ${inventory
                .map(
                  (item) => `
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="px-4 py-3 font-medium text-white">${escapeHtml(item.name)}</td>
                  <td class="px-4 py-3 text-[#8A8F98] font-mono text-[11px]">${item.category}</td>
                  <td class="px-4 py-3 text-center font-mono font-medium text-white">${item.stock}</td>
                  <td class="px-4 py-3 text-center font-mono font-semibold text-emerald-400">${item.available}</td>
                  <td class="px-4 py-3 text-center font-mono text-amber-400">${item.reserved}</td>
                  <td class="px-4 py-3 text-center font-mono font-medium text-[#A5B4FC]">${item.sold}</td>
                  <td class="px-4 py-3 text-right">
                    <button type="button"
                            class="btn-quick-stock px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] font-mono text-xs transition-colors"
                            data-id="${item.id}"
                            data-stock="${item.stock}">
                      + Ubah
                    </button>
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 4. ORDERS TAB
function renderAdminOrdersTab() {
  const orders = store.getOrders();

  return `
    <div class="space-y-4">
      <div class="bg-[#101114] p-4 rounded-xl border border-white/[0.08] flex items-center justify-between shadow-sm">
        <div>
          <h3 class="font-semibold text-sm text-white">Manajemen Transaksi (Orders)</h3>
          <p class="text-xs text-[#8A8F98]">Total ${orders.length} pesanan terekam dalam sistem.</p>
        </div>
      </div>

      <div class="bg-[#101114] rounded-xl border border-white/[0.08] overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-[#8A8F98]">
            <thead class="bg-[#0C0D0F] font-mono uppercase text-[10px] text-[#64748B] border-b border-white/[0.06]">
              <tr>
                <th class="px-4 py-3">Order ID</th>
                <th class="px-4 py-3">Customer</th>
                <th class="px-4 py-3">Produk</th>
                <th class="px-4 py-3">Nominal</th>
                <th class="px-4 py-3">Payment</th>
                <th class="px-4 py-3">Fulfillment</th>
                <th class="px-4 py-3">Waktu</th>
                <th class="px-4 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.04]">
              ${orders
                .map(
                  (o) => `
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="px-4 py-3 font-mono font-medium text-white">${o.id}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-white">${escapeHtml(o.customer.name)}</div>
                    <div class="text-[11px] text-[#8A8F98] font-mono">${escapeHtml(o.customer.telegram)}</div>
                  </td>
                  <td class="px-4 py-3 font-medium text-[#D0D6E0]">${escapeHtml(o.product.name)}</td>
                  <td class="px-4 py-3 font-mono font-semibold text-white">${formatRupiah(o.total)}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      ${o.paymentStatus}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono ${
                      o.fulfillmentStatus === 'FULFILLED'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                    }">
                      ${o.fulfillmentStatus}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-[11px] text-[#8A8F98] font-mono">${o.date}</td>
                  <td class="px-4 py-3 text-right">
                    <button type="button"
                            class="btn-admin-order-detail px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] text-xs font-medium transition-colors"
                            data-id="${o.id}">
                      Akses
                    </button>
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 5. CUSTOMERS TAB
function renderAdminCustomersTab() {
  const customers = store.getCustomers();

  return `
    <div class="space-y-4">
      <div class="bg-[#101114] p-4 rounded-xl border border-white/[0.08] flex items-center justify-between shadow-sm">
        <div>
          <h3 class="font-semibold text-sm text-white">Data Pelanggan (Customers)</h3>
          <p class="text-xs text-[#8A8F98]">Database kontak pelanggan yang pernah berbelanja di toko.</p>
        </div>
        <span class="text-xs font-mono font-medium text-white bg-white/[0.06] border border-white/[0.08] px-3 py-1 rounded-full">${customers.length} Pelanggan</span>
      </div>

      <div class="bg-[#101114] rounded-xl border border-white/[0.08] overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-[#8A8F98]">
            <thead class="bg-[#0C0D0F] font-mono uppercase text-[10px] text-[#64748B] border-b border-white/[0.06]">
              <tr>
                <th class="px-4 py-3">Customer</th>
                <th class="px-4 py-3">Telegram</th>
                <th class="px-4 py-3">Email</th>
                <th class="px-4 py-3 text-center">Orders</th>
                <th class="px-4 py-3">Total Spending</th>
                <th class="px-4 py-3">Order Terakhir</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.04]">
              ${customers
                .map(
                  (c) => `
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="px-4 py-3 font-medium text-white">${escapeHtml(c.name)}</td>
                  <td class="px-4 py-3 font-mono text-indigo-400 font-medium">${escapeHtml(c.telegram)}</td>
                  <td class="px-4 py-3 text-[#8A8F98]">${escapeHtml(c.email)}</td>
                  <td class="px-4 py-3 text-center font-mono font-medium text-white">${c.ordersCount}</td>
                  <td class="px-4 py-3 font-mono font-semibold text-emerald-400">${formatRupiah(c.totalSpending)}</td>
                  <td class="px-4 py-3 text-[11px] text-[#8A8F98] font-mono">${c.lastOrder}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 6. SETTINGS TAB
function renderAdminSettingsTab() {
  const settings = store.getSettings();

  return `
    <div class="max-w-3xl space-y-6">
      <form id="admin-settings-form" class="bg-[#101114] p-6 rounded-xl border border-white/[0.08] shadow-sm space-y-5 text-xs text-[#F7F8F8]">
        <div class="border-b border-white/[0.06] pb-3">
          <h3 class="font-semibold text-base text-white">Pengaturan Toko Digital</h3>
          <p class="text-xs text-[#8A8F98]">Konfigurasi toko Bintang Store.</p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block font-medium text-[#D0D6E0] mb-1.5 text-xs">Nama Toko (Store Name)</label>
            <input id="set-store-name" type="text" value="${escapeHtml(settings.storeName)}" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
          </div>
          <div>
            <label class="block font-medium text-[#D0D6E0] mb-1.5 text-xs">Tagline</label>
            <input id="set-tagline" type="text" value="${escapeHtml(settings.tagline)}" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
          </div>
          <div>
            <label class="block font-medium text-[#D0D6E0] mb-1.5 text-xs">Deskripsi Singkat</label>
            <textarea id="set-description" rows="2" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">${escapeHtml(settings.storeDescription)}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-medium text-[#D0D6E0] mb-1.5 text-xs">Aksen Warna Utama</label>
              <input id="set-accent" type="text" value="${escapeHtml(settings.primaryAccent)}" class="w-full px-3.5 py-2.5 font-mono bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
            </div>
            <div>
              <label class="block font-medium text-[#D0D6E0] mb-1.5 text-xs">Username Bot Telegram</label>
              <input id="set-bot" type="text" value="${escapeHtml(settings.telegramBotUsername)}" class="w-full px-3.5 py-2.5 font-mono bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 pt-2">
            <div class="p-3.5 rounded-lg bg-[#0C0D0F] border border-white/[0.06] space-y-1">
              <span class="text-[#8A8F98] block font-mono text-[10px] uppercase tracking-wider">Status Payment Gateway</span>
              <span class="font-mono text-emerald-400 font-medium">${settings.paymentGatewayStatus}</span>
            </div>
            <div class="p-3.5 rounded-lg bg-[#0C0D0F] border border-white/[0.06] space-y-1">
              <span class="text-[#8A8F98] block font-mono text-[10px] uppercase tracking-wider">Status WebApp</span>
              <span class="font-mono text-emerald-400 font-medium">${settings.webAppStatus}</span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-white/[0.06] flex justify-between items-center">
          <button type="submit" class="px-4 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-200 text-black shadow-sm transition-all">
            Simpan Pengaturan
          </button>
          <button id="btn-settings-reset" type="button" class="text-xs text-red-400 hover:text-red-300 font-medium hover:underline">
            Reset Data Demo ke Default
          </button>
        </div>
      </form>
    </div>
  `;
}

export function initAdminEvents() {
  const container = document.getElementById('admin-main-container');

  const refreshAdminContent = () => {
    if (container) {
      container.innerHTML = renderAdminTabContent();
      attachAdminTabEvents();
    }
  };

  // Nav tabs
  document.querySelectorAll('.btn-admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminActiveTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.btn-admin-tab').forEach((b) => {
        b.classList.remove('bg-stone-900', 'text-white');
        b.classList.add('text-stone-600');
      });
      btn.classList.add('bg-stone-900', 'text-white');
      btn.classList.remove('text-stone-600');
      refreshAdminContent();
    });
  });

  // Top "Tambah Produk" button
  const btnAdd = document.getElementById('btn-admin-add-product');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      openAddProductModal(() => refreshAdminContent());
    });
  }

  attachAdminTabEvents();
}

function attachAdminTabEvents() {
  // Navigation shortcuts from Overview
  const btnGotoInv = document.querySelector('.btn-goto-inventory');
  if (btnGotoInv) {
    btnGotoInv.addEventListener('click', () => {
      adminActiveTab = 'inventory';
      updateTabHighlight();
    });
  }

  const btnGotoOrders = document.querySelector('.btn-goto-orders');
  if (btnGotoOrders) {
    btnGotoOrders.addEventListener('click', () => {
      adminActiveTab = 'orders';
      updateTabHighlight();
    });
  }

  // Products Tab: Search & Category filter
  const prodSearch = document.getElementById('admin-prod-search');
  if (prodSearch) {
    prodSearch.addEventListener('input', (e) => {
      productSearchTerm = e.target.value;
      const c = document.getElementById('admin-main-container');
      if (c) {
        c.innerHTML = renderAdminTabContent();
        attachAdminTabEvents();
      }
    });
  }

  const catFilter = document.getElementById('admin-prod-category-filter');
  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      productCategoryFilter = e.target.value;
      const c = document.getElementById('admin-main-container');
      if (c) {
        c.innerHTML = renderAdminTabContent();
        attachAdminTabEvents();
      }
    });
  }

  // Toggle active switch
  document.querySelectorAll('.btn-toggle-active').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      store.toggleProductActive(id);
      showToast('Status produk diperbarui', 'info');
      const c = document.getElementById('admin-main-container');
      if (c) {
        c.innerHTML = renderAdminTabContent();
        attachAdminTabEvents();
      }
    });
  });

  // Edit product
  document.querySelectorAll('.btn-edit-product').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const p = store.getProduct(id);
      if (p) {
        openEditProductModal(p, () => {
          const c = document.getElementById('admin-main-container');
          if (c) {
            c.innerHTML = renderAdminTabContent();
            attachAdminTabEvents();
          }
        });
      }
    });
  });

  // Quick stock editor in Inventory
  document.querySelectorAll('.btn-quick-stock').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const currentStock = parseInt(btn.getAttribute('data-stock'), 10) || 0;
      const newStockStr = prompt(`Masukkan jumlah stok baru:`, currentStock);
      if (newStockStr !== null) {
        const val = parseInt(newStockStr, 10);
        if (!isNaN(val) && val >= 0) {
          store.updateProduct(id, { stock: val });
          showToast(`Stok berhasil diupdate menjadi ${val}!`, 'success');
          const c = document.getElementById('admin-main-container');
          if (c) {
            c.innerHTML = renderAdminTabContent();
            attachAdminTabEvents();
          }
        }
      }
    });
  });

  // Orders tab: view payload
  document.querySelectorAll('.btn-admin-order-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const order = store.getOrder(id);
      if (order) {
        openModal({
          title: `Data Akses Order ${order.id}`,
          content: `
            <div class="space-y-3 text-xs">
              <div><b>Produk:</b> ${escapeHtml(order.product.name)}</div>
              <div><b>Customer:</b> ${escapeHtml(order.customer.name)} (${order.customer.telegram})</div>
              <div><b>Status:</b> ${order.fulfillmentStatus}</div>
              <div class="bg-stone-900 text-white p-3 rounded-xl font-mono text-xs">
                ${JSON.stringify(order.fulfillmentData, null, 2)}
              </div>
            </div>
          `,
        });
      }
    });
  });

  // Settings form submission
  const setForm = document.getElementById('admin-settings-form');
  if (setForm) {
    setForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sName = document.getElementById('set-store-name').value;
      const sTag = document.getElementById('set-tagline').value;
      const sDesc = document.getElementById('set-description').value;
      const sAccent = document.getElementById('set-accent').value;
      const sBot = document.getElementById('set-bot').value;

      store.updateSettings({
        storeName: sName,
        tagline: sTag,
        storeDescription: sDesc,
        primaryAccent: sAccent,
        telegramBotUsername: sBot,
      });

      showToast('Pengaturan toko berhasil disimpan!', 'success');
    });
  }

  const btnReset = document.getElementById('btn-settings-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Reset seluruh data simulasi ke awal?')) {
        store.resetToDefaults();
        showToast('Data simulasi di-reset!', 'success');
        setTimeout(() => window.location.reload(), 300);
      }
    });
  }
}

function updateTabHighlight() {
  document.querySelectorAll('.btn-admin-tab').forEach((b) => {
    if (b.getAttribute('data-tab') === adminActiveTab) {
      b.classList.add('bg-stone-900', 'text-white');
      b.classList.remove('text-stone-600');
    } else {
      b.classList.remove('bg-stone-900', 'text-white');
      b.classList.add('text-stone-600');
    }
  });
  const c = document.getElementById('admin-main-container');
  if (c) {
    c.innerHTML = renderAdminTabContent();
    attachAdminTabEvents();
  }
}

// Modal: Tambah Produk
function openAddProductModal(onSuccess) {
  const content = `
    <form id="form-add-product" class="space-y-4 text-xs text-[#F7F8F8]">
      <div>
        <label class="block font-medium text-[#D0D6E0] mb-1.5">Nama Produk</label>
        <input id="add-prod-name" type="text" required placeholder="Contoh: Canva Pro" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none placeholder-[#555]">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-medium text-[#D0D6E0] mb-1.5">Kategori</label>
          <select id="add-prod-cat" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
            ${CATEGORIES.filter((c) => c !== 'Semua')
              .map((c) => `<option value="${c}">${c}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="block font-medium text-[#D0D6E0] mb-1.5">Tipe Produk</label>
          <select id="add-prod-type" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
            <option value="account">Akun (Email & Password)</option>
            <option value="code">Kode Voucher</option>
            <option value="link">Link Cloud Drive</option>
            <option value="license">Lisensi Software</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-medium text-[#D0D6E0] mb-1.5">Harga (Rp)</label>
          <input id="add-prod-price" type="number" required min="1000" step="1000" value="20000" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none font-mono">
        </div>
        <div>
          <label class="block font-medium text-[#D0D6E0] mb-1.5">Stok Awal</label>
          <input id="add-prod-stock" type="number" required min="1" value="10" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none font-mono">
        </div>
      </div>
      <div>
        <label class="block font-medium text-[#D0D6E0] mb-1.5">Deskripsi Produk</label>
        <textarea id="add-prod-desc" rows="2" required placeholder="Deskripsi fitur..." class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none placeholder-[#555]"></textarea>
      </div>
      <button type="submit" class="w-full py-2.5 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-200 text-black shadow-sm transition-all">
        Simpan Produk Baru
      </button>
    </form>
  `;

  openModal({
    title: 'Tambah Produk Digital',
    content: content,
    maxWidth: 'max-w-md',
    theme: 'dark',
    onOpen: (modalEl) => {
      const form = modalEl.querySelector('#form-add-product');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = modalEl.querySelector('#add-prod-name').value;
          const category = modalEl.querySelector('#add-prod-cat').value;
          const type = modalEl.querySelector('#add-prod-type').value;
          const price = parseInt(modalEl.querySelector('#add-prod-price').value, 10);
          const stock = parseInt(modalEl.querySelector('#add-prod-stock').value, 10);
          const description = modalEl.querySelector('#add-prod-desc').value;

          store.addProduct({
            name,
            category,
            type,
            price,
            stock,
            description,
            duration: '1 Bulan',
            visual: 'palette',
            badge: 'New',
          });

          showToast('Produk baru berhasil ditambahkan!', 'success');
          closeModal();
          if (onSuccess) onSuccess();
        });
      }
    },
  });
}

// Modal: Edit Produk
function openEditProductModal(product, onSuccess) {
  const content = `
    <form id="form-edit-product" class="space-y-4 text-xs text-[#F7F8F8]">
      <div>
        <label class="block font-medium text-[#D0D6E0] mb-1.5">Nama Produk</label>
        <input id="edit-prod-name" type="text" required value="${escapeHtml(product.name)}" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-medium text-[#D0D6E0] mb-1.5">Harga (Rp)</label>
          <input id="edit-prod-price" type="number" required min="1000" step="1000" value="${product.price}" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none font-mono">
        </div>
        <div>
          <label class="block font-medium text-[#D0D6E0] mb-1.5">Stok Tersedia</label>
          <input id="edit-prod-stock" type="number" required min="0" value="${product.stock}" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none font-mono">
        </div>
      </div>
      <div>
        <label class="block font-medium text-[#D0D6E0] mb-1.5">Deskripsi Produk</label>
        <textarea id="edit-prod-desc" rows="3" class="w-full px-3.5 py-2.5 bg-[#0C0D0F] text-white rounded-lg border border-white/[0.08] focus:border-[#5E6AD2] focus:outline-none">${escapeHtml(product.description)}</textarea>
      </div>
      <button type="submit" class="w-full py-2.5 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-200 text-black shadow-sm transition-all">
        Simpan Perubahan
      </button>
    </form>
  `;

  openModal({
    title: `Edit Produk: ${escapeHtml(product.name)}`,
    content: content,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      const form = modalEl.querySelector('#form-edit-product');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = modalEl.querySelector('#edit-prod-name').value;
          const price = parseInt(modalEl.querySelector('#edit-prod-price').value, 10);
          const stock = parseInt(modalEl.querySelector('#edit-prod-stock').value, 10);
          const description = modalEl.querySelector('#edit-prod-desc').value;

          store.updateProduct(product.id, {
            name,
            price,
            stock,
            description,
          });

          showToast('Data produk berhasil diperbarui!', 'success');
          closeModal();
          if (onSuccess) onSuccess();
        });
      }
    },
  });
}
