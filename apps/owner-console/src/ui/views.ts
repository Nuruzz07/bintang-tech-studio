/**
 * Bintang Tech Studio — Platform Owner Console UI Views.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements dense, readable, restrained server-side HTML rendering
 * for the 14 platform control plane modules.
 */

import { OwnerConsoleViewData, OwnerConsoleTab } from '../types.js';
import { OWNER_CONSOLE_THEME, escapeHtml } from './tokens.js';

export function renderOwnerConsoleHtml(data: OwnerConsoleViewData): string {
  const { activeTab, caller } = data;

  const navItems: Array<{ id: OwnerConsoleTab; label: string; badge?: string }> = [
    { id: 'overview', label: 'Platform Overview' },
    { id: 'stores', label: 'Stores / Tenants' },
    { id: 'users', label: 'Platform Users' },
    { id: 'plans', label: 'SaaS Plans' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'billing', label: 'Invoices & Billing' },
    { id: 'templates', label: 'Templates' },
    { id: 'bots', label: 'Bots & Channels' },
    { id: 'orders', label: 'Cross-Store Orders' },
    { id: 'support', label: 'Support Tickets' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'health', label: 'System Health' },
    { id: 'settings', label: 'Platform Policies' },
  ];

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bintang Tech Studio — Platform Owner Console</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: ${OWNER_CONSOLE_THEME.colors.bgApp};
      color: ${OWNER_CONSOLE_THEME.colors.textPrimary};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    .layout { display: flex; min-height: 100vh; }
    .sidebar {
      width: 240px;
      background-color: ${OWNER_CONSOLE_THEME.colors.bgSidebar};
      border-right: 1px solid ${OWNER_CONSOLE_THEME.colors.border};
      display: flex;
      flex-direction: column;
    }
    .brand {
      padding: 16px 20px;
      font-size: 15px;
      font-weight: 700;
      color: ${OWNER_CONSOLE_THEME.colors.primary};
      border-bottom: 1px solid ${OWNER_CONSOLE_THEME.colors.border};
      letter-spacing: -0.01em;
    }
    .nav { padding: 12px 8px; flex: 1; }
    .nav-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      color: ${OWNER_CONSOLE_THEME.colors.textSecondary};
      text-decoration: none;
      border-radius: 6px;
      margin-bottom: 2px;
      font-size: 13px;
      font-weight: 500;
    }
    .nav-link:hover {
      background-color: ${OWNER_CONSOLE_THEME.colors.bgCardHover};
      color: ${OWNER_CONSOLE_THEME.colors.textPrimary};
    }
    .nav-link.active {
      background-color: rgba(56, 189, 248, 0.1);
      color: ${OWNER_CONSOLE_THEME.colors.primary};
      font-weight: 600;
    }
    .user-footer {
      padding: 14px 16px;
      border-top: 1px solid ${OWNER_CONSOLE_THEME.colors.border};
      font-size: 12px;
    }
    .user-role-badge {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border-radius: 4px;
      font-weight: 600;
      font-size: 11px;
      margin-top: 4px;
    }
    .main { flex: 1; padding: 28px 36px; overflow-y: auto; }
    .header { margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header p { color: ${OWNER_CONSOLE_THEME.colors.textMuted}; font-size: 13px; }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background-color: ${OWNER_CONSOLE_THEME.colors.bgCard};
      border: 1px solid ${OWNER_CONSOLE_THEME.colors.border};
      border-radius: 8px;
      padding: 16px;
    }
    .card-label { font-size: 12px; color: ${OWNER_CONSOLE_THEME.colors.textMuted}; font-weight: 500; margin-bottom: 4px; }
    .card-value { font-size: 24px; font-weight: 700; color: ${OWNER_CONSOLE_THEME.colors.textPrimary}; }
    .card-subtext { font-size: 11px; color: ${OWNER_CONSOLE_THEME.colors.textSecondary}; margin-top: 4px; }
    .table-container {
      background-color: ${OWNER_CONSOLE_THEME.colors.bgCard};
      border: 1px solid ${OWNER_CONSOLE_THEME.colors.border};
      border-radius: 8px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      background-color: rgba(255, 255, 255, 0.02);
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      color: ${OWNER_CONSOLE_THEME.colors.textSecondary};
      border-bottom: 1px solid ${OWNER_CONSOLE_THEME.colors.border};
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid ${OWNER_CONSOLE_THEME.colors.borderSubtle};
      font-size: 13px;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background-color: ${OWNER_CONSOLE_THEME.colors.bgCardHover}; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .badge-active { background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
    .badge-setup { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
    .badge-suspended { background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
    .badge-neutral { background: rgba(107, 114, 128, 0.15); color: #9ca3af; border-color: rgba(107, 114, 128, 0.3); }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">BINTANG TECH · CONTROL</div>
      <nav class="nav">
        ${navItems
          .map(
            (item) => `
          <a href="?tab=${item.id}" class="nav-link ${activeTab === item.id ? 'active' : ''}">
            <span>${escapeHtml(item.label)}</span>
          </a>`,
          )
          .join('')}
      </nav>
      <div class="user-footer">
        <div style="font-weight: 600;">${escapeHtml(caller.email)}</div>
        <div class="user-role-badge">${escapeHtml(caller.platformRole)}</div>
      </div>
    </aside>
    <main class="main">
      ${renderTabContent(data)}
    </main>
  </div>
</body>
</html>`;
}

function renderTabContent(data: OwnerConsoleViewData): string {
  switch (data.activeTab) {
    case 'overview':
      return renderOverviewTab(data);
    case 'stores':
      return renderStoresTab(data);
    case 'users':
      return renderUsersTab(data);
    case 'plans':
      return renderPlansTab(data);
    case 'subscriptions':
      return renderSubscriptionsTab(data);
    case 'billing':
      return renderBillingTab(data);
    case 'templates':
      return renderTemplatesTab(data);
    case 'bots':
      return renderBotsTab(data);
    case 'orders':
      return renderOrdersTab(data);
    case 'support':
      return renderSupportTab(data);
    case 'audit':
      return renderAuditTab(data);
    case 'health':
      return renderHealthTab(data);
    case 'settings':
      return renderSettingsTab(data);
    default:
      return renderOverviewTab(data);
  }
}

function renderOverviewTab(data: OwnerConsoleViewData): string {
  const m = data.metrics;
  if (!m) return '<p>Memuat metrik ringkasan platform...</p>';

  return `
    <div class="header">
      <h1>Platform Overview</h1>
      <p>Telemetri dan performa SaaS multi-tenant Bintang Tech Studio (${escapeHtml(m.classification)})</p>
    </div>

    <div class="card-grid">
      <div class="card">
        <div class="card-label">TOTAL TOKO (TENANTS)</div>
        <div class="card-value">${m.stores.total}</div>
        <div class="card-subtext">${m.stores.active} Aktif · ${m.stores.setup} Setup · ${m.stores.suspended} Suspended</div>
      </div>
      <div class="card">
        <div class="card-label">LANGGANAN AKTIF</div>
        <div class="card-value">${m.subscriptions.active}</div>
        <div class="card-subtext">${m.subscriptions.trial} Trial · ${m.subscriptions.pastDue} Past Due</div>
      </div>
      <div class="card">
        <div class="card-label">TOTAL PENERIMAAN BILLING</div>
        <div class="card-value">${escapeHtml(m.billing.formattedTotalCollected)}</div>
        <div class="card-subtext">${m.billing.paidInvoices} dari ${m.billing.totalInvoices} invoice terbayar</div>
      </div>
      <div class="card">
        <div class="card-label">STATUS SISTEM</div>
        <div class="card-value" style="color: #34d399;">${escapeHtml(m.systemHealthStatus)}</div>
        <div class="card-subtext">${m.bots.connected} bot aktif · ${m.supportTickets.open} tiket open</div>
      </div>
    </div>
  `;
}

function renderStoresTab(data: OwnerConsoleViewData): string {
  const stores = data.stores || [];
  return `
    <div class="header">
      <h1>Stores / Tenants</h1>
      <p>Manajemen dan pengawasan status seluruh toko merchant pada platform (${stores.length} total)</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>NAMA TOKO</th>
            <th>SLUG</th>
            <th>STATUS</th>
            <th>MEMBERS</th>
            <th>MATA UANG</th>
            <th>DIBUAT PADA</th>
          </tr>
        </thead>
        <tbody>
          ${stores
            .map(
              (s) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
              <td><code>${escapeHtml(s.slug)}</code></td>
              <td><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : s.status === 'SETUP' ? 'badge-setup' : 'badge-suspended'}">${escapeHtml(s.status)}</span></td>
              <td>${s.memberCount} member</td>
              <td>${escapeHtml(s.currency)}</td>
              <td>${escapeHtml(s.createdAt.slice(0, 10))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderUsersTab(data: OwnerConsoleViewData): string {
  const users = data.users || [];
  return `
    <div class="header">
      <h1>Platform Users</h1>
      <p>Pengguna platform dan hak akses administratif (${users.length} total)</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>NAMA / EMAIL</th>
            <th>PERAN PLATFORM</th>
            <th>STATUS AKUN</th>
            <th>TOKO DIMILIKI</th>
            <th>TERDAFTAR</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (u) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(u.email)}</td>
              <td><span class="badge badge-active">${escapeHtml(u.platformRole)}</span></td>
              <td><span class="badge badge-active">${escapeHtml(u.status)}</span></td>
              <td>${u.storesOwnedCount} toko</td>
              <td>${escapeHtml(u.createdAt.slice(0, 10))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlansTab(data: OwnerConsoleViewData): string {
  const plans = data.plans || [];
  return `
    <div class="header">
      <h1>SaaS Plans</h1>
      <p>Katalog paket langganan dan alokasi kuota produk</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>PAKET</th>
            <th>HARGA BULANAN</th>
            <th>BIAYA SETUP</th>
            <th>BATAS PRODUK</th>
            <th>TIPE</th>
          </tr>
        </thead>
        <tbody>
          ${plans
            .map(
              (p) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(p.name)}</td>
              <td>${escapeHtml(p.formattedMonthlyPrice)}</td>
              <td>${escapeHtml(p.formattedActivationFee)}</td>
              <td>${p.maxProducts} produk</td>
              <td><span class="badge ${p.isPlaceholder ? 'badge-setup' : 'badge-active'}">${p.isPlaceholder ? 'Configurable Placeholder' : 'Authoritative Baseline'}</span></td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSubscriptionsTab(data: OwnerConsoleViewData): string {
  const subs = data.subscriptions || [];
  return `
    <div class="header">
      <h1>Subscriptions</h1>
      <p>Status siklus hidup langganan merchant across tenants</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>TOKO</th>
            <th>PAKET</th>
            <th>STATUS</th>
            <th>PERIODE MULAI</th>
            <th>PERIODE BERAKHIR</th>
          </tr>
        </thead>
        <tbody>
          ${subs
            .map(
              (s) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(s.storeName)}</td>
              <td>${escapeHtml(s.planName)}</td>
              <td><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-setup'}">${escapeHtml(s.status)}</span></td>
              <td>${escapeHtml(s.currentPeriodStart.slice(0, 10))}</td>
              <td>${escapeHtml(s.currentPeriodEnd.slice(0, 10))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBillingTab(data: OwnerConsoleViewData): string {
  const invoices = data.invoices || [];
  return `
    <div class="header">
      <h1>Invoices & Billing</h1>
      <p>Catatan keuangan dan penagihan biaya langganan platform</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>NO. INVOICE</th>
            <th>TOKO</th>
            <th>STATUS</th>
            <th>TOTAL</th>
            <th>BIAYA SETUP</th>
            <th>TANGGAL PENERBITAN</th>
          </tr>
        </thead>
        <tbody>
          ${invoices
            .map(
              (inv) => `
            <tr>
              <td style="font-weight: 600;"><code>${escapeHtml(inv.invoiceNumber)}</code></td>
              <td>${escapeHtml(inv.storeName)}</td>
              <td><span class="badge ${inv.status === 'PAID' ? 'badge-active' : 'badge-setup'}">${escapeHtml(inv.status)}</span></td>
              <td style="font-weight: 600;">${escapeHtml(inv.formattedTotal)}</td>
              <td>${inv.hasActivationFee ? '<span class="badge badge-setup">Setup Included</span>' : 'Langganan Saja'}</td>
              <td>${escapeHtml(inv.issuedAt.slice(0, 10))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTemplatesTab(data: OwnerConsoleViewData): string {
  const tmpls = data.templates || [];
  return `
    <div class="header">
      <h1>Templates</h1>
      <p>Katalog template storefront dan kompatibilitas versi</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>NAMA TEMPLATE</th>
            <th>SLUG</th>
            <th>VERSI TERBIT</th>
            <th>TOKO MENGGUNAKAN</th>
          </tr>
        </thead>
        <tbody>
          ${tmpls
            .map(
              (t) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(t.name)}</td>
              <td><code>${escapeHtml(t.slug)}</code></td>
              <td><span class="badge badge-active">${escapeHtml(t.publishedVersion || 'None')}</span></td>
              <td>${t.storesUsingCount} toko</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBotsTab(data: OwnerConsoleViewData): string {
  const bots = data.bots || [];
  return `
    <div class="header">
      <h1>Bots & Channels</h1>
      <p>Metadata bot Telegram / WhatsApp (Kredensial rahasia disamarkan ketat)</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>TOKO</th>
            <th>BOT / SALURAN</th>
            <th>STATUS</th>
            <th>KREDENSIAL REF (MASKED)</th>
            <th>LAST SEEN</th>
          </tr>
        </thead>
        <tbody>
          ${bots
            .map(
              (b) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(b.storeName)}</td>
              <td>${escapeHtml(b.displayName)} (@${escapeHtml(b.username || 'unknown')})</td>
              <td><span class="badge badge-active">${escapeHtml(b.status)}</span></td>
              <td><code>${escapeHtml(b.maskedCredentialRef)}</code></td>
              <td>${b.lastSeenAt ? escapeHtml(b.lastSeenAt.slice(0, 16)) : '-'}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderOrdersTab(data: OwnerConsoleViewData): string {
  const orders = data.orders || [];
  return `
    <div class="header">
      <h1>Cross-Store Orders</h1>
      <p>Pengawasan transaksi pesanan lintas toko (Data PII Pelanggan diminimalisasi)</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>NO. ORDER</th>
            <th>TOKO</th>
            <th>STATUS</th>
            <th>TOTAL</th>
            <th>IDENTITAS MASKED</th>
            <th>WAKTU</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o) => `
            <tr>
              <td style="font-weight: 600;"><code>${escapeHtml(o.orderNumber)}</code></td>
              <td>${escapeHtml(o.storeName)}</td>
              <td><span class="badge badge-active">${escapeHtml(o.status)}</span></td>
              <td>${escapeHtml(o.formattedTotalAmount)}</td>
              <td><code>${escapeHtml(o.customerMaskedIdentity)}</code></td>
              <td>${escapeHtml(o.createdAt.slice(0, 16))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSupportTab(data: OwnerConsoleViewData): string {
  const tickets = data.tickets || [];
  return `
    <div class="header">
      <h1>Support Tickets</h1>
      <p>Tiket bantuan teknis dan operasional merchant</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>NO. TIKET</th>
            <th>SUBJEK</th>
            <th>PRIORITAS</th>
            <th>STATUS</th>
            <th>TOKO</th>
          </tr>
        </thead>
        <tbody>
          ${tickets
            .map(
              (t) => `
            <tr>
              <td><code>${escapeHtml(t.ticketNumber)}</code></td>
              <td style="font-weight: 600;">${escapeHtml(t.subject)}</td>
              <td><span class="badge badge-setup">${escapeHtml(t.priority)}</span></td>
              <td><span class="badge badge-active">${escapeHtml(t.status)}</span></td>
              <td>${escapeHtml(t.storeName)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAuditTab(data: OwnerConsoleViewData): string {
  const logs = data.auditLogs || [];
  return `
    <div class="header">
      <h1>Audit Logs</h1>
      <p>Jejak audit append-only tindakan administratif platform</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>AKTOR</th>
            <th>PERAN</th>
            <th>AKSI</th>
            <th>RESOURCE</th>
            <th>HASIL</th>
            <th>WAKTU</th>
          </tr>
        </thead>
        <tbody>
          ${logs
            .map(
              (l) => `
            <tr>
              <td>${escapeHtml(l.actorEmail)}</td>
              <td><span class="badge badge-setup">${escapeHtml(l.platformRole)}</span></td>
              <td style="font-weight: 600;"><code>${escapeHtml(l.action)}</code></td>
              <td>${escapeHtml(l.resourceType)} (${escapeHtml(l.resourceId)})</td>
              <td><span class="badge ${l.result === 'SUCCESS' ? 'badge-active' : 'badge-suspended'}">${escapeHtml(l.result)}</span></td>
              <td>${escapeHtml(l.timestamp.slice(0, 19).replace('T', ' '))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderHealthTab(data: OwnerConsoleViewData): string {
  const h = data.health;
  if (!h) return '<p>Memuat telemetri kesehatan sistem...</p>';

  return `
    <div class="header">
      <h1>System Health</h1>
      <p>Status komponen sistem (${escapeHtml(h.classification)} · Uptime: ${h.uptimeSeconds}s)</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>KOMPONEN</th>
            <th>STATUS</th>
            <th>LATENSI</th>
            <th>SIMULATION?</th>
            <th>LAST HEARTBEAT</th>
          </tr>
        </thead>
        <tbody>
          ${h.components
            .map(
              (c) => `
            <tr>
              <td style="font-weight: 600;">${escapeHtml(c.name)}</td>
              <td><span class="badge ${c.status === 'HEALTHY' ? 'badge-active' : 'badge-suspended'}">${escapeHtml(c.status)}</span></td>
              <td>${c.latencyMs ? `${c.latencyMs} ms` : '-'}</td>
              <td><span class="badge badge-setup">${c.isSimulation ? 'Foundation Sim' : 'Live'}</span></td>
              <td>${escapeHtml(c.lastHeartbeat.slice(11, 19))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSettingsTab(data: OwnerConsoleViewData): string {
  const policies = data.policies || [];
  return `
    <div class="header">
      <h1>Platform Policies & Settings</h1>
      <p>Kebijakan operasional platform, maintenance mode, dan izin registrasi</p>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>KUNCI KEBIJAKAN</th>
            <th>DESKRIPSI</th>
            <th>NILAI</th>
            <th>HAK AKSES</th>
          </tr>
        </thead>
        <tbody>
          ${policies
            .map(
              (p) => `
            <tr>
              <td style="font-weight: 600;"><code>${escapeHtml(p.key)}</code></td>
              <td>${escapeHtml(p.description)}</td>
              <td><code>${escapeHtml(JSON.stringify(p.value))}</code></td>
              <td><span class="badge ${p.isOwnerOnly ? 'badge-suspended' : 'badge-setup'}">${p.isOwnerOnly ? 'PLATFORM_OWNER Only' : 'Admin'}</span></td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
