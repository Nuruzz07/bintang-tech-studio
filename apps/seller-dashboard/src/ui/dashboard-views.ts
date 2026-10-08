/**
 * Bintang Tech Studio — Seller Dashboard Presentation View Builders.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 *
 * Server-rendered, clean, sanitized HTML templates for all 13 dashboard sections.
 * Enforces zero secret leakage in presentation output.
 */

import { SELLER_THEME, ICONS } from './tokens.js';
import {
  ActiveSellerStoreContext,
  SellerSession,
  DashboardSection,
  DashboardOverview,
  SellerProductView,
  SellerInventoryLevelView,
  SellerOrderSummaryView,
  SellerVoucherView,
  SellerPaymentAccountView,
  SellerChannelView,
  SellerBotBindingView,
  SellerTeamMemberView,
  SellerSubscriptionVisibilityView,
} from '../types.js';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderDashboardShell(
  ctx: ActiveSellerStoreContext,
  session: SellerSession,
  activeSection: DashboardSection,
  contentHtml: string,
): string {
  const sections: Array<{ id: DashboardSection; label: string; icon: string }> = [
    { id: 'overview', label: 'Ringkasan', icon: ICONS.overview },
    { id: 'products', label: 'Produk', icon: ICONS.products },
    { id: 'categories', label: 'Kategori', icon: ICONS.categories },
    { id: 'inventory', label: 'Inventaris', icon: ICONS.inventory },
    { id: 'orders', label: 'Pesanan', icon: ICONS.orders },
    { id: 'customers', label: 'Pelanggan', icon: ICONS.customers },
    { id: 'vouchers', label: 'Voucher', icon: ICONS.vouchers },
    { id: 'payments', label: 'Pembayaran', icon: ICONS.payments },
    { id: 'fulfillment', label: 'Pengiriman', icon: ICONS.fulfillment },
    { id: 'channels', label: 'Channel & Bot', icon: ICONS.channels },
    { id: 'team', label: 'Tim & Staf', icon: ICONS.team },
    { id: 'settings', label: 'Pengaturan', icon: ICONS.settings },
    { id: 'subscription', label: 'Langganan', icon: ICONS.subscription },
  ];

  const navLinks = sections
    .map((s) => {
      const isActive = s.id === activeSection;
      const activeClass = isActive
        ? `background: ${SELLER_THEME.colors.accent}; color: #ffffff; font-weight: 600;`
        : `color: ${SELLER_THEME.colors.textSecondary};`;
      return `
        <a href="?section=${s.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-size: 14px; transition: background 0.15s; ${activeClass}">
          <span>${s.icon}</span>
          <span>${escapeHtml(s.label)}</span>
        </a>
      `;
    })
    .join('');

  const storeOptions = session.availableStores
    .map((st) => {
      const isSelected = st.storeId === ctx.storeId ? 'selected' : '';
      return `<option value="${escapeHtml(st.storeId)}" ${isSelected}>${escapeHtml(st.storeName)} (${escapeHtml(st.role)})</option>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seller Dashboard — ${escapeHtml(ctx.storeName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${SELLER_THEME.fonts.sans};
      background: ${SELLER_THEME.colors.bgApp};
      color: ${SELLER_THEME.colors.textPrimary};
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      width: 260px;
      background: ${SELLER_THEME.colors.bgSidebar};
      border-right: 1px solid ${SELLER_THEME.colors.border};
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .topbar {
      height: 64px;
      border-bottom: 1px solid ${SELLER_THEME.colors.border};
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${SELLER_THEME.colors.bgApp};
    }
    .content {
      padding: 24px;
      flex: 1;
    }
    .card {
      background: ${SELLER_THEME.colors.bgCard};
      border: 1px solid ${SELLER_THEME.colors.border};
      border-radius: 10px;
      padding: 20px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 12px; border-bottom: 1px solid ${SELLER_THEME.colors.border}; color: ${SELLER_THEME.colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid ${SELLER_THEME.colors.borderMuted}; font-size: 14px; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div style="padding: 20px 16px; border-bottom: 1px solid ${SELLER_THEME.colors.border};">
      <div style="font-weight: 700; font-size: 16px; letter-spacing: -0.02em;">Bintang Tech Studio</div>
      <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted};">Seller Control Center</div>
    </div>

    <!-- Store Switcher -->
    <div style="padding: 16px; border-bottom: 1px solid ${SELLER_THEME.colors.border};">
      <label style="display: block; font-size: 11px; text-transform: uppercase; color: ${SELLER_THEME.colors.textMuted}; font-weight: 600; margin-bottom: 6px;">Toko Aktif</label>
      <select onchange="window.location.href='?action=switch_store&targetStoreId='+this.value" style="width: 100%; background: ${SELLER_THEME.colors.bgCard}; color: ${SELLER_THEME.colors.textPrimary}; border: 1px solid ${SELLER_THEME.colors.border}; padding: 8px 10px; border-radius: 6px; font-size: 13px;">
        ${storeOptions}
      </select>
    </div>

    <nav style="padding: 16px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto;">
      ${navLinks}
    </nav>
  </aside>

  <main class="main">
    <header class="topbar">
      <div>
        <h1 style="font-size: 18px; font-weight: 600;">${escapeHtml(ctx.storeName)}</h1>
        <span style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; font-family: ${SELLER_THEME.fonts.mono};">slug: ${escapeHtml(ctx.tenantSlug)}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 4px 10px; border-radius: 9999px; font-weight: 600;">
          ${ICONS.shield}
          ${escapeHtml(ctx.role)}
        </span>
        <span style="font-size: 13px; color: ${SELLER_THEME.colors.textSecondary};">${escapeHtml(session.userName)}</span>
      </div>
    </header>

    <div class="content">
      ${contentHtml}
    </div>
  </main>
</body>
</html>
  `;
}

export function renderOverviewHtml(overview: DashboardOverview): string {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Total Penjualan</div>
        <div style="font-size: 24px; font-weight: 700; color: ${SELLER_THEME.colors.success}; margin-top: 4px;">${escapeHtml(overview.formattedGrossRevenue)}</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Total Pesanan</div>
        <div style="font-size: 24px; font-weight: 700; margin-top: 4px;">${overview.totalOrders}</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Pesanan Berhasil</div>
        <div style="font-size: 24px; font-weight: 700; color: #38bdf8; margin-top: 4px;">${overview.fulfilledOrders}</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Stok Menipis</div>
        <div style="font-size: 24px; font-weight: 700; color: ${overview.lowStockCount > 0 ? SELLER_THEME.colors.danger : SELLER_THEME.colors.textPrimary}; margin-top: 4px;">${overview.lowStockCount}</div>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Pesanan Terbaru</h2>
      <table>
        <thead>
          <tr>
            <th>Nomor Pesanan</th>
            <th>Status</th>
            <th>Total</th>
            <th>Pengiriman</th>
            <th>Tanggal</th>
          </tr>
        </thead>
        <tbody>
          ${
            overview.recentOrders.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #64748b;">Belum ada pesanan terbaru.</td></tr>'
              : overview.recentOrders
                  .map(
                    (o) => `
            <tr>
              <td style="font-family: ${SELLER_THEME.fonts.mono}; font-weight: 600;">#${escapeHtml(o.orderNumber)}</td>
              <td><span style="font-weight: 600;">${escapeHtml(o.status)}</span></td>
              <td>${escapeHtml(o.formattedGrandTotal)}</td>
              <td>${escapeHtml(o.fulfillmentStatus)}</td>
              <td style="color: ${SELLER_THEME.colors.textMuted};">${new Date(o.createdAt).toLocaleDateString('id-ID')}</td>
            </tr>
          `,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderProductsHtml(products: readonly SellerProductView[]): string {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="font-size: 16px; font-weight: 600;">Katalog Produk (${products.length})</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nama Produk</th>
            <th>Kategori</th>
            <th>Harga</th>
            <th>Stok Tersedia</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            products.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #64748b;">Belum ada produk terdaftar.</td></tr>'
              : products
                  .map(
                    (p) => `
            <tr>
              <td>
                <div style="font-weight: 600;">${escapeHtml(p.name)}</div>
                <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; font-family: ${SELLER_THEME.fonts.mono};">${escapeHtml(p.slug)}</div>
              </td>
              <td>${escapeHtml(p.categoryName || 'Tanpa Kategori')}</td>
              <td style="font-weight: 600;">${escapeHtml(p.formattedPrice)}</td>
              <td>${p.availableStock} unit</td>
              <td><span style="font-size: 12px; font-weight: 600;">${escapeHtml(p.status)}</span></td>
            </tr>
          `,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderInventoryHtml(inventory: readonly SellerInventoryLevelView[]): string {
  return `
    <div class="card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Manajemen Inventaris</h2>
      <table>
        <thead>
          <tr>
            <th>Produk</th>
            <th>On Hand</th>
            <th>Reserved</th>
            <th>Tersedia</th>
            <th>Status Stok</th>
          </tr>
        </thead>
        <tbody>
          ${
            inventory.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #64748b;">Belum ada data inventaris.</td></tr>'
              : inventory
                  .map(
                    (i) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(i.productName)}</td>
              <td>${i.onHand}</td>
              <td>${i.reserved}</td>
              <td style="font-weight: 600;">${i.available}</td>
              <td>${i.isLowStock ? '<span style="color: #ef4444; font-weight: 600;">⚠️ Low Stock</span>' : '<span style="color: #10b981;">Aman</span>'}</td>
            </tr>
          `,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderOrdersHtml(orders: readonly SellerOrderSummaryView[]): string {
  return `
    <div class="card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Daftar Pesanan (${orders.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Nomor Pesanan</th>
            <th>Status Pembayaran</th>
            <th>Total Pembayaran</th>
            <th>Pengiriman</th>
            <th>Tanggal</th>
          </tr>
        </thead>
        <tbody>
          ${
            orders.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #64748b;">Belum ada pesanan.</td></tr>'
              : orders
                  .map(
                    (o) => `
            <tr>
              <td style="font-family: ${SELLER_THEME.fonts.mono}; font-weight: 600;">#${escapeHtml(o.orderNumber)}</td>
              <td><span style="font-weight: 600;">${escapeHtml(o.status)}</span></td>
              <td>${escapeHtml(o.formattedGrandTotal)}</td>
              <td>${escapeHtml(o.fulfillmentStatus)}</td>
              <td style="color: ${SELLER_THEME.colors.textMuted};">${new Date(o.createdAt).toLocaleDateString('id-ID')}</td>
            </tr>
          `,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderVouchersHtml(vouchers: readonly SellerVoucherView[]): string {
  return `
    <div class="card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Voucher Promo (${vouchers.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Kode Voucher</th>
            <th>Diskon</th>
            <th>Min. Belanja</th>
            <th>Penggunaan</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            vouchers.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #64748b;">Belum ada voucher aktif.</td></tr>'
              : vouchers
                  .map(
                    (v) => `
            <tr>
              <td style="font-family: ${SELLER_THEME.fonts.mono}; font-weight: 700; color: #818cf8;">${escapeHtml(v.code)}</td>
              <td>${escapeHtml(v.formattedDiscount)}</td>
              <td>${escapeHtml(v.formattedMinimumPurchase)}</td>
              <td>${v.usedCount} / ${v.usageLimit ? v.usageLimit : '∞'}</td>
              <td><span style="font-weight: 600;">${escapeHtml(v.status)}</span></td>
            </tr>
          `,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderPaymentsHtml(accounts: readonly SellerPaymentAccountView[]): string {
  return `
    <div class="card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Akun Pembayaran Toko</h2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>ID Akun</th>
            <th>Status</th>
            <th>Metode Aktif</th>
          </tr>
        </thead>
        <tbody>
          ${
            accounts.length === 0
              ? '<tr><td colspan="4" style="text-align: center; color: #64748b;">Belum ada akun pembayaran terkonfigurasi.</td></tr>'
              : accounts
                  .map(
                    (a) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(a.provider)}</td>
              <td style="font-family: ${SELLER_THEME.fonts.mono};">${escapeHtml(a.accountIdentifier)}</td>
              <td><span style="font-weight: 600; color: #10b981;">${escapeHtml(a.status)}</span></td>
              <td>${a.capabilities.map((c) => escapeHtml(c)).join(', ')}</td>
            </tr>
          `,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderChannelsHtml(
  _channels: readonly SellerChannelView[],
  botBinding: SellerBotBindingView | null,
): string {
  return `
    <div class="card" style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Channel Telegram Terhubung</h2>
      ${
        botBinding
          ? `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 16px;">
          <div style="font-weight: 600; font-size: 15px;">@${escapeHtml(botBinding.botUsername ?? 'bot')}</div>
          <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; font-family: ${SELLER_THEME.fonts.mono}; margin-top: 4px;">Bot ID: ${escapeHtml(botBinding.botId)}</div>
          <div style="margin-top: 12px; font-size: 13px;">Status: <span style="color: #10b981; font-weight: 600;">${botBinding.isActive ? 'Aktif Terhubung' : 'Nonaktif'}</span></div>
          ${botBinding.miniAppUrl ? `<div style="font-size: 13px; margin-top: 4px;">Mini App URL: <span style="font-family: ${SELLER_THEME.fonts.mono};">${escapeHtml(botBinding.miniAppUrl)}</span></div>` : ''}
        </div>
      `
          : '<div style="color: #94a3b8;">Belum ada bot Telegram yang terhubung pada toko ini.</div>'
      }
    </div>
  `;
}

export function renderTeamHtml(members: readonly SellerTeamMemberView[]): string {
  return `
    <div class="card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Anggota Tim Toko (${members.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Pengguna</th>
            <th>Peran</th>
            <th>Status</th>
            <th>Bergabung</th>
          </tr>
        </thead>
        <tbody>
          ${members
            .map(
              (m) => `
            <tr>
              <td>
                <div style="font-weight: 600;">${escapeHtml(m.userName)}</div>
                <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted};">${escapeHtml(m.userEmail)}</div>
              </td>
              <td><span style="font-weight: 600; color: #818cf8;">${escapeHtml(m.role)}</span></td>
              <td><span style="color: #10b981; font-weight: 600;">${escapeHtml(m.status)}</span></td>
              <td style="color: ${SELLER_THEME.colors.textMuted};">${new Date(m.joinedAt).toLocaleDateString('id-ID')}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderSubscriptionHtml(sub: SellerSubscriptionVisibilityView): string {
  return `
    <div class="card" style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Paket Langganan Saat Ini</h2>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 20px; font-weight: 700; color: #818cf8;">${escapeHtml(sub.planName)}</div>
          <div style="font-size: 13px; color: ${SELLER_THEME.colors.textMuted};">Status Paket: <span style="color: #10b981; font-weight: 600;">${escapeHtml(sub.status)}</span></div>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Kapasitas Produk</div>
        <div style="font-size: 20px; font-weight: 700; margin-top: 4px;">${sub.currentProducts} / ${sub.productLimit}</div>
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; margin-top: 4px;">Batas produk untuk paket ${escapeHtml(sub.planSlug)}</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Kapasitas Staf</div>
        <div style="font-size: 20px; font-weight: 700; margin-top: 4px;">${sub.currentStaff} / ${sub.staffLimit}</div>
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; margin-top: 4px;">Batas anggota staf toko</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Channel Telegram</div>
        <div style="font-size: 20px; font-weight: 700; color: ${sub.telegramAllowed ? '#10b981' : '#ef4444'}; margin-top: 4px;">${sub.telegramAllowed ? 'Aktif' : 'Terkunci'}</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: ${SELLER_THEME.colors.textMuted}; text-transform: uppercase;">Channel WhatsApp</div>
        <div style="font-size: 20px; font-weight: 700; color: ${sub.whatsappAllowed ? '#10b981' : '#64748b'}; margin-top: 4px;">${sub.whatsappAllowed ? 'Aktif' : 'Terkunci (Paket Lanjutan)'}</div>
      </div>
    </div>
  `;
}
