// Bintang Tech Studio — Unified Linear Studio Navbar
import { store } from '../state/store.js';
import { showToast } from '../utils/helpers.js';
import { openAuthModal } from './auth-modal.js';

export function renderDemoNavbar(currentView = 'admin') {
  const views = [
    { id: 'landing', label: 'Landing' },
    { id: 'admin', label: 'Workspace' },
    { id: 'webapp', label: 'Customer Store' },
    { id: 'telegram', label: 'Telegram Bot' },
    { id: 'telegram-admin', label: 'Telegram Admin' },
  ];

  return `
    <header class="sticky top-0 z-50 h-[56px] bg-[#08090A]/80 backdrop-blur-md border-b border-white/[0.06] select-none text-[#F7F8F8]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        
        <!-- Brand & Engine Indicator -->
        <div class="flex items-center gap-3 shrink-0">
          <a href="#landing" class="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div class="w-4 h-4 rounded-full bg-gradient-to-tr from-[#5E6AD2] to-indigo-400 flex items-center justify-center shadow-sm">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
            <span class="font-semibold text-[14px] tracking-[-0.02em] text-[#F7F8F8] hidden sm:inline">
              Bintang Tech
            </span>
          </a>
          <span class="h-3.5 w-[1px] bg-white/[0.1] hidden sm:inline"></span>
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ENGINE LIVE</span>
          </div>
        </div>

        <!-- Navigation Tabs (Clean Linear Style - No Slop) -->
        <nav class="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none" aria-label="Studio navigation">
          ${views
            .map((v) => {
              const isActive = currentView === v.id;
              return `
              <a href="#${v.id}"
                 class="px-3 py-1.5 rounded-md text-[13px] transition-colors whitespace-nowrap ${
                   isActive
                     ? 'text-[#F7F8F8] bg-white/[0.08] font-medium'
                     : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                 }">
                ${v.label}
              </a>
            `;
            })
            .join('')}
        </nav>

        <!-- Actions: Auth & Reset Demo -->
        <div class="flex items-center gap-2 shrink-0">
          ${(() => {
            let authUser = null;
            try {
              authUser = JSON.parse(localStorage.getItem('bts_auth_user') || 'null');
            } catch {}

            if (authUser) {
              return `
                <div class="flex items-center gap-2">
                  <span class="text-[12px] font-mono text-[#8A8F98] hidden md:inline max-w-[130px] truncate" title="${authUser.email || ''}">
                    ${authUser.fullName || authUser.email || 'Seller'}
                  </span>
                  <button id="btn-logout-auth"
                          type="button"
                          class="px-2.5 py-1 rounded-md text-[11px] font-mono text-[#8A8F98] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors">
                    Keluar
                  </button>
                </div>
              `;
            }

            return `
              <button id="btn-open-auth-modal"
                      type="button"
                      class="px-3 py-1 text-[13px] font-medium text-[#08090A] bg-[#F7F8F8] hover:bg-white rounded-md transition-colors shadow-sm">
                Masuk / Daftar
              </button>
            `;
          })()}
          <button id="btn-reset-demo"
                  type="button"
                  title="Reset seluruh data simulasi ke awal"
                  class="p-1.5 rounded-md text-[#64748B] hover:text-[#F7F8F8] hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
                  aria-label="Reset State">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
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
