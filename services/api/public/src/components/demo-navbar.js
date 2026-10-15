// Bintang Tech Studio — Top Demo Switcher Navbar (Secondary / Subtle Demo Controls)
import { store } from '../state/store.js';
import { showToast, BRAND_LOGO_SVG } from '../utils/helpers.js';
import { openAuthModal } from './auth-modal.js';

export function renderDemoNavbar(currentView = 'landing') {
  const views = [
    { id: 'landing', label: 'Portfolio', icon: '✨' },
    { id: 'telegram', label: 'Telegram Bot', icon: '🤖' },
    { id: 'webapp', label: 'Customer WebApp', icon: '📱' },
    { id: 'admin', label: 'Admin Dashboard', icon: '📊' },
    { id: 'telegram-admin', label: 'Telegram Admin', icon: '⚡' },
  ];

  return `
    <header class="demo-topbar sticky top-0 z-50 text-stone-300 select-none bg-[#0D0F14]/95 backdrop-blur-md border-b border-stone-800/60 shadow-sm">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 h-10 flex items-center justify-between gap-2">
        <!-- Brand & Template Indicator -->
        <div class="flex items-center gap-2 shrink-0">
          <a href="#landing" class="flex items-center gap-2 group transition-opacity hover:opacity-100 opacity-90" title="Bintang Tech Studio Portfolio">
            <span class="w-5 h-5 flex items-center justify-center shrink-0">
              ${BRAND_LOGO_SVG}
            </span>
            <span class="font-heading font-semibold text-xs tracking-tight text-stone-200 group-hover:text-amber-300 transition-colors hidden sm:inline">
              Bintang Tech Studio
            </span>
          </a>
          <span class="text-stone-700 hidden sm:inline">/</span>
          <span class="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-stone-900 border border-stone-800 text-stone-400">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Demo Controls · T-01
          </span>
        </div>

        <!-- Navigation Tabs (Subtle & Secondary) -->
        <nav class="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none" aria-label="Demo switcher controls">
          ${views
            .map((v) => {
              const isActive = currentView === v.id;
              return `
              <a href="#${v.id}"
                 class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 whitespace-nowrap ${
                   isActive
                     ? 'bg-terracotta-500/20 text-terracotta-300 font-semibold ring-1 ring-terracotta-500/40'
                     : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                 }">
                <span class="text-xs">${v.icon}</span>
                <span>${v.label}</span>
              </a>
            `;
            })
            .join('')}
        </nav>

        <!-- Actions: Auth & Reset Demo -->
        <div class="flex items-center gap-1.5 shrink-0">
          ${(() => {
            let authUser = null;
            try {
              authUser = JSON.parse(localStorage.getItem('bts_auth_user') || 'null');
            } catch {}

            if (authUser) {
              return `
                <div class="flex items-center gap-1.5">
                  <span class="text-[11px] font-mono text-stone-300 hidden sm:inline max-w-[130px] truncate" title="${authUser.email || ''}">
                    👤 ${authUser.fullName || authUser.email || 'Seller'}
                  </span>
                  <button id="btn-logout-auth"
                          type="button"
                          title="Keluar dari akun seller"
                          class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-800 transition-colors">
                    <span>Keluar</span>
                  </button>
                </div>
              `;
            }

            return `
              <button id="btn-open-auth-modal"
                      type="button"
                      title="Masuk atau daftar akun seller"
                      class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-heading font-bold text-white bg-terracotta-600 hover:bg-terracotta-700 shadow-xs transition-colors">
                <span>Masuk / Daftar</span>
              </button>
            `;
          })()}
          <button id="btn-reset-demo"
                  type="button"
                  title="Reset seluruh data simulasi ke awal"
                  class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono uppercase text-stone-500 hover:text-amber-300 hover:bg-stone-800/80 border border-stone-800 transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span class="hidden lg:inline">Reset State</span>
          </button>
        </div>
      </div>
    </header>
  `;
}

export function initDemoNavbarEvents() {
  const btnAuth = document.getElementById('btn-open-auth-modal');
  if (btnAuth) {
    btnAuth.addEventListener('click', () => {
      openAuthModal({ defaultTab: 'login' });
    });
  }

  const btnLogout = document.getElementById('btn-logout-auth');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('bts_auth_user');
      localStorage.removeItem('bts_access_token');
      localStorage.removeItem('bts_refresh_token');
      showToast('Anda telah keluar dari akun.', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
  }

  const btnReset = document.getElementById('btn-reset-demo');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (
        confirm(
          'Reset seluruh data simulasi (produk, keranjang, pesanan, pelanggan) ke pengaturan awal?',
        )
      ) {
        store.resetToDefaults();
        showToast('Seluruh data simulasi telah di-reset ke default!', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    });
  }
}
