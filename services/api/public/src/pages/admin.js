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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'inventory', label: 'Inventory', icon: '📋' },
    { id: 'orders', label: 'Orders', icon: '📑' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return `
    <div class="view-container bg-[#0a0a0c] min-h-screen text-[#f7f8f8] pb-16 font-sans selection:bg-[#5e6ad2] selection:text-white">
      
      <!-- ADMIN HEADER & METRICS SUMMARY (Linear Workspace Style) -->
      <header class="bg-[#0a0a0c]/80 backdrop-blur-md border-b border-[#22232a] sticky top-10 z-30 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="h-14 flex items-center justify-between gap-4">
            <!-- Left Branding -->
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg bg-[#5e6ad2] p-1 flex items-center justify-center shrink-0 shadow-sm text-white font-bold text-xs">
                L
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="font-bold text-sm sm:text-base text-white">Linear Seller Workspace</h1>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#16181d] text-emerald-400 border border-[#22232a]">
                    Engine Live
                  </span>
                </div>
                <p class="text-[11px] text-[#8a8f98] hidden sm:block">${escapeHtml(settings.storeName)} · Automated Sales System</p>
              </div>
            </div>

            <!-- Header Quick Action: Tambah Produk -->
            <div class="flex items-center gap-2">
              <button id="btn-admin-add-product"
                      type="button"
                      class="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-gray-100 text-black shadow-sm transition-all flex items-center gap-1.5">
                <i class="fas fa-plus text-[10px]"></i>
                <span>Tambah Produk</span>
              </button>
            </div>
          </div>

          <!-- ADMIN NAVIGATION TABS -->
          <nav class="flex items-center gap-1 overflow-x-auto border-t border-[#1a1c23] py-2 scrollbar-none" aria-label="Admin tabs">
            ${tabs
              .map((t) => {
                const isActive = adminActiveTab === t.id;
                return `
                <button type="button"
                        class="btn-admin-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-[#1c1e24] text-white shadow-sm ring-1 ring-white/10'
                            : 'text-[#8a8f98] hover:text-white hover:bg-[#14151b]'
                        }"
                        data-tab="${t.id}">
                  <span>${t.icon}</span>
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
        <div class="bg-[#101217] p-5 rounded-2xl border border-[#22242c] shadow-sm space-y-2 card-hover-raycast">
          <div class="flex items-center justify-between text-[#94a3b8]">
            <span class="text-xs font-mono uppercase">Total Sales</span>
            <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">${ICONS.trendingUp}</span>
          </div>
          <div class="font-heading font-black text-2xl text-white">Rp2.450.000</div>
          <div class="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <span>↑ 18.4%</span>
            <span class="text-[#64748b] font-normal">dari minggu lalu</span>
          </div>
        </div>

        <!-- KPI 2: WhatsApp & Telegram Bot Engine -->
        <div class="bg-[#101217] p-5 rounded-2xl border border-emerald-500/30 shadow-sm space-y-2 card-hover-raycast">
          <div class="flex items-center justify-between text-[#94a3b8]">
            <span class="text-xs font-mono uppercase font-bold text-emerald-400">Multi-Channel Bot</span>
            <span class="flex h-2.5 w-2.5 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div class="font-heading font-black text-xl text-white flex items-center gap-2">
            <span>WA & TG LIVE</span>
          </div>
          <div class="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span>🟢 Zero-Click Fulfillment Aktif</span>
          </div>
        </div>

        <!-- KPI 3: Orders -->
        <div class="bg-[#101217] p-5 rounded-2xl border border-[#22242c] shadow-sm space-y-2 card-hover-raycast">
          <div class="flex items-center justify-between text-[#94a3b8]">
            <span class="text-xs font-mono uppercase">Orders</span>
            <span class="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">${ICONS.shoppingBag}</span>
          </div>
          <div class="font-heading font-black text-2xl text-white">128</div>
          <div class="text-[11px] text-[#94a3b8]">
            <span class="font-bold text-white">100%</span> otomatis terkirim
          </div>
        </div>

        <!-- KPI 4: Active Products -->
        <div class="bg-[#101217] p-5 rounded-2xl border border-[#22242c] shadow-sm space-y-2 card-hover-raycast">
          <div class="flex items-center justify-between text-[#94a3b8]">
            <span class="text-xs font-mono uppercase">Products</span>
            <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">${ICONS.package}</span>
          </div>
          <div class="font-heading font-black text-2xl text-white">${activeCount} <span class="text-sm font-normal text-[#64748b]">/ ${products.length}</span></div>
          <div class="text-[11px] text-[#94a3b8]">
            ${lowStock.length} produk stok menipis
          </div>
        </div>
      </div>

      <!-- SALES OVERVIEW & TOP PRODUCTS -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Sales Overview Visual Chart -->
        <div class="lg:col-span-8 bg-[#101217] p-5 rounded-2xl border border-[#22242c] shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-heading font-bold text-sm text-white">Sales Overview (7 Hari Terakhir)</h3>
              <p class="text-xs text-[#94a3b8]">Grafik transaksi penjualan produk digital harian.</p>
            </div>
            <span class="text-xs font-mono text-terracotta-400 font-bold bg-terracotta-500/10 border border-terracotta-500/20 px-2 py-1 rounded">Rata-rata Rp350K/hari</span>
          </div>

          <!-- CSS Bar Chart Visualization -->
          <div class="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-[#22242c]">
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
                <div class="text-[10px] font-mono text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity">
                  ${col.val}k
                </div>
                <div class="w-full max-w-[36px] bg-[#1a1d26] group-hover:bg-terracotta-500 rounded-t-lg transition-all" style="height: ${col.pct};"></div>
                <span class="text-[11px] font-mono text-[#94a3b8]">${col.day}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>

        <!-- Low Stock Alerts -->
        <div class="lg:col-span-4 bg-[#101217] p-5 rounded-2xl border border-[#22242c] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-heading font-bold text-sm text-white">Stok Menipis (Low Stock)</h3>
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
            </div>
            <div class="space-y-2.5">
              ${lowStock
                .map(
                  (p) => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#14161e] border border-[#22242c] text-xs">
                  <div>
                    <div class="font-bold text-white">${escapeHtml(p.name)}</div>
                    <div class="text-[10px] text-[#94a3b8] font-mono">${p.category}</div>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                    Sisa ${p.stock}
                  </span>
                </div>
              `,
                )
                .join('')}
            </div>
          </div>
          <button type="button" class="btn-goto-inventory w-full mt-3 py-2 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-white bg-[#14161e] hover:bg-[#1a1c26] border border-[#22242c] transition-colors text-center">
            Kelola Stok di Inventori →
          </button>
        </div>

      </div>

      <!-- RECENT ORDERS TABLE (Linear Table Style) -->
      <div class="bg-[#101217] rounded-2xl border border-[#22242c] shadow-sm overflow-hidden">
        <div class="p-5 border-b border-[#22242c] flex items-center justify-between">
          <div>
            <h3 class="font-heading font-bold text-sm text-white">Recent Orders (Transaksi Masuk)</h3>
            <p class="text-xs text-[#94a3b8]">Daftar transaksi masuk dan status fulfillment otomatis lintas channel.</p>
          </div>
          <button type="button" class="btn-goto-orders text-xs font-bold text-terracotta-400 hover:underline">
            Lihat Semua Pesanan →
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-[#94a3b8]">
            <thead class="bg-[#14161e] font-mono uppercase text-[10px] text-[#64748b] border-b border-[#22242c]">
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
      <div class="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div class="relative flex-1 max-w-sm">
            <span class="absolute inset-y-0 left-3 flex items-center text-stone-400 pointer-events-none">
              ${ICONS.search}
            </span>
            <input id="admin-prod-search"
                   type="text"
                   placeholder="Cari produk di admin..."
                   value="${escapeHtml(productSearchTerm)}"
                   class="w-full pl-9 pr-3 py-2 text-xs bg-stone-100 rounded-xl border border-transparent focus:bg-white focus:border-terracotta-500 focus:outline-none">
          </div>
          <!-- Category Select -->
          <select id="admin-prod-category-filter" class="px-3 py-2 text-xs bg-stone-100 rounded-xl border border-transparent focus:bg-white focus:outline-none font-semibold text-stone-700">
            ${CATEGORIES.map(
              (cat) => `
              <option value="${cat}" ${productCategoryFilter === cat ? 'selected' : ''}>${cat}</option>
            `,
            ).join('')}
          </select>
        </div>

        <div class="text-xs text-stone-500 font-mono">
          Total: <b class="text-stone-900">${filtered.length}</b> produk
        </div>
      </div>

      <!-- Products Table -->
      <div class="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-stone-600">
            <thead class="bg-stone-50 font-mono uppercase text-[10px] text-stone-400 border-b border-stone-200">
              <tr>
                <th class="px-4 py-3">Produk</th>
                <th class="px-4 py-3">Kategori & Tipe</th>
                <th class="px-4 py-3">Harga</th>
                <th class="px-4 py-3">Stok</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              ${filtered
                .map(
                  (p) => `
                <tr class="hover:bg-stone-50/80 transition-colors">
                  <td class="px-4 py-3">
                    <div class="font-bold text-stone-900 text-sm">${escapeHtml(p.name)}</div>
                    <div class="text-[11px] text-stone-400">${escapeHtml(p.duration || '-')}</div>
                  </td>
                  <td class="px-4 py-3 font-mono">
                    <span class="px-2 py-0.5 rounded text-[10px] bg-stone-100 text-stone-700">${p.category}</span>
                    <span class="text-[10px] text-stone-400 ml-1">(${p.type})</span>
                  </td>
                  <td class="px-4 py-3 font-mono font-bold text-stone-900">
                    ${formatRupiah(p.price)}
                  </td>
                  <td class="px-4 py-3 font-mono">
                    <span class="font-bold ${p.stock <= 5 ? 'text-amber-600' : 'text-stone-800'}">${p.stock}</span>
                  </td>
                  <td class="px-4 py-3">
                    <button type="button"
                            class="btn-toggle-active px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition-colors ${
                              p.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-600'
                            }"
                            data-id="${p.id}">
                      ${p.active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button type="button"
                            class="btn-edit-product px-3 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
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
      <div class="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
        <div>
          <h3 class="font-heading font-bold text-sm text-stone-900">Ringkasan Inventori Stok</h3>
          <p class="text-xs text-stone-400">Pantau ketersediaan stok produk digital, unit dipesan, dan total terjual.</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-stone-600">
            <thead class="bg-stone-50 font-mono uppercase text-[10px] text-stone-400 border-b border-stone-200">
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
            <tbody class="divide-y divide-stone-100">
              ${inventory
                .map(
                  (item) => `
                <tr class="hover:bg-stone-50/80 transition-colors">
                  <td class="px-4 py-3 font-bold text-stone-900">${escapeHtml(item.name)}</td>
                  <td class="px-4 py-3 text-stone-400 font-mono text-[11px]">${item.category}</td>
                  <td class="px-4 py-3 text-center font-mono font-bold text-stone-800">${item.stock}</td>
                  <td class="px-4 py-3 text-center font-mono font-bold text-emerald-600">${item.available}</td>
                  <td class="px-4 py-3 text-center font-mono text-amber-600">${item.reserved}</td>
                  <td class="px-4 py-3 text-center font-mono font-bold text-purple-600">${item.sold}</td>
                  <td class="px-4 py-3 text-right">
                    <button type="button"
                            class="btn-quick-stock px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono font-bold text-xs"
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
      <div class="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
        <div>
          <h3 class="font-heading font-bold text-sm text-stone-900">Manajemen Transaksi (Orders)</h3>
          <p class="text-xs text-stone-400">Total ${orders.length} pesanan terekam dalam sistem simulasi.</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-stone-600">
            <thead class="bg-stone-50 font-mono uppercase text-[10px] text-stone-400 border-b border-stone-200">
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
            <tbody class="divide-y divide-stone-100">
              ${orders
                .map(
                  (o) => `
                <tr class="hover:bg-stone-50/80 transition-colors">
                  <td class="px-4 py-3 font-mono font-bold text-stone-900">${o.id}</td>
                  <td class="px-4 py-3">
                    <div class="font-bold text-stone-900">${escapeHtml(o.customer.name)}</div>
                    <div class="text-[11px] text-stone-400 font-mono">${escapeHtml(o.customer.telegram)}</div>
                  </td>
                  <td class="px-4 py-3 font-medium text-stone-800">${escapeHtml(o.product.name)}</td>
                  <td class="px-4 py-3 font-mono font-bold text-stone-900">${formatRupiah(o.total)}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ${o.paymentStatus}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      o.fulfillmentStatus === 'FULFILLED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }">
                      ${o.fulfillmentStatus}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-[11px] text-stone-400 font-mono">${o.date}</td>
                  <td class="px-4 py-3 text-right">
                    <button type="button"
                            class="btn-admin-order-detail px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs"
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
      <div class="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
        <div>
          <h3 class="font-heading font-bold text-sm text-stone-900">Data Pelanggan (Customers)</h3>
          <p class="text-xs text-stone-400">Database kontak pelanggan yang pernah berbelanja di toko.</p>
        </div>
        <span class="text-xs font-mono font-bold bg-stone-100 px-3 py-1 rounded-full">${customers.length} Pelanggan</span>
      </div>

      <div class="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-stone-600">
            <thead class="bg-stone-50 font-mono uppercase text-[10px] text-stone-400 border-b border-stone-200">
              <tr>
                <th class="px-4 py-3">Customer</th>
                <th class="px-4 py-3">Telegram</th>
                <th class="px-4 py-3">Email</th>
                <th class="px-4 py-3 text-center">Orders</th>
                <th class="px-4 py-3">Total Spending</th>
                <th class="px-4 py-3">Order Terakhir</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              ${customers
                .map(
                  (c) => `
                <tr class="hover:bg-stone-50/80 transition-colors">
                  <td class="px-4 py-3 font-bold text-stone-900">${escapeHtml(c.name)}</td>
                  <td class="px-4 py-3 font-mono text-sky-600 font-medium">${escapeHtml(c.telegram)}</td>
                  <td class="px-4 py-3 text-stone-500">${escapeHtml(c.email)}</td>
                  <td class="px-4 py-3 text-center font-mono font-bold text-stone-800">${c.ordersCount}</td>
                  <td class="px-4 py-3 font-mono font-bold text-terracotta-600">${formatRupiah(c.totalSpending)}</td>
                  <td class="px-4 py-3 text-[11px] text-stone-400 font-mono">${c.lastOrder}</td>
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
      <form id="admin-settings-form" class="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4 text-xs">
        <div class="border-b border-stone-100 pb-3">
          <h3 class="font-heading font-bold text-base text-stone-900">Pengaturan Toko Digital</h3>
          <p class="text-stone-400">Konfigurasi toko Bintang Store.</p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block font-bold text-stone-700 mb-1">Nama Toko (Store Name)</label>
            <input id="set-store-name" type="text" value="${escapeHtml(settings.storeName)}" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
          </div>
          <div>
            <label class="block font-bold text-stone-700 mb-1">Tagline</label>
            <input id="set-tagline" type="text" value="${escapeHtml(settings.tagline)}" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
          </div>
          <div>
            <label class="block font-bold text-stone-700 mb-1">Deskripsi Singkat</label>
            <textarea id="set-description" rows="2" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">${escapeHtml(settings.storeDescription)}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-stone-700 mb-1">Aksen Warna Utama</label>
              <input id="set-accent" type="text" value="${escapeHtml(settings.primaryAccent)}" class="w-full px-3 py-2 font-mono bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
            </div>
            <div>
              <label class="block font-bold text-stone-700 mb-1">Username Bot Telegram</label>
              <input id="set-bot" type="text" value="${escapeHtml(settings.telegramBotUsername)}" class="w-full px-3 py-2 font-mono bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 pt-2">
            <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
              <span class="text-stone-400 block font-mono text-[10px] uppercase">Status Payment Gateway</span>
              <span class="font-bold text-emerald-600">${settings.paymentGatewayStatus}</span>
            </div>
            <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
              <span class="text-stone-400 block font-mono text-[10px] uppercase">Status WebApp</span>
              <span class="font-bold text-emerald-600">${settings.webAppStatus}</span>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-stone-100 flex justify-between items-center">
          <button type="submit" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-terracotta-500 hover:bg-terracotta-600 text-white shadow transition-all">
            Simpan Pengaturan
          </button>
          <button id="btn-settings-reset" type="button" class="text-xs text-red-600 hover:underline">
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
    <form id="form-add-product" class="space-y-4 text-xs">
      <div>
        <label class="block font-bold text-stone-700 mb-1">Nama Produk</label>
        <input id="add-prod-name" type="text" required placeholder="Contoh: Canva Pro" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block font-bold text-stone-700 mb-1">Kategori</label>
          <select id="add-prod-cat" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
            ${CATEGORIES.filter((c) => c !== 'Semua')
              .map((c) => `<option value="${c}">${c}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="block font-bold text-stone-700 mb-1">Tipe Produk</label>
          <select id="add-prod-type" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
            <option value="account">Akun (Email & Password)</option>
            <option value="code">Kode Voucher</option>
            <option value="link">Link Cloud Drive</option>
            <option value="license">Lisensi Software</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block font-bold text-stone-700 mb-1">Harga (Rp)</label>
          <input id="add-prod-price" type="number" required min="1000" step="1000" value="20000" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none font-mono">
        </div>
        <div>
          <label class="block font-bold text-stone-700 mb-1">Stok Awal</label>
          <input id="add-prod-stock" type="number" required min="1" value="10" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none font-mono">
        </div>
      </div>
      <div>
        <label class="block font-bold text-stone-700 mb-1">Deskripsi Produk</label>
        <textarea id="add-prod-desc" rows="2" required placeholder="Deskripsi fitur..." class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none"></textarea>
      </div>
      <button type="submit" class="w-full py-2.5 rounded-xl text-xs font-bold bg-terracotta-500 hover:bg-terracotta-600 text-white shadow transition-all">
        Simpan Produk Baru
      </button>
    </form>
  `;

  openModal({
    title: 'Tambah Produk Digital',
    content: content,
    maxWidth: 'max-w-md',
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
    <form id="form-edit-product" class="space-y-4 text-xs">
      <div>
        <label class="block font-bold text-stone-700 mb-1">Nama Produk</label>
        <input id="edit-prod-name" type="text" required value="${escapeHtml(product.name)}" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block font-bold text-stone-700 mb-1">Harga (Rp)</label>
          <input id="edit-prod-price" type="number" required min="1000" step="1000" value="${product.price}" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none font-mono">
        </div>
        <div>
          <label class="block font-bold text-stone-700 mb-1">Stok Tersedia</label>
          <input id="edit-prod-stock" type="number" required min="0" value="${product.stock}" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none font-mono">
        </div>
      </div>
      <div>
        <label class="block font-bold text-stone-700 mb-1">Deskripsi Produk</label>
        <textarea id="edit-prod-desc" rows="3" class="w-full px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-none">${escapeHtml(product.description)}</textarea>
      </div>
      <button type="submit" class="w-full py-2.5 rounded-xl text-xs font-bold bg-terracotta-500 hover:bg-terracotta-600 text-white shadow transition-all">
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
