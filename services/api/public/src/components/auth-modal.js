// Bintang Tech Studio — Authentication & Registration Modal
// Supports Email + Password with OTP verification to Gmail, and Direct Google Sign-In.

import { openModal, closeModal } from './modal.js';
import { showToast, BRAND_LOGO_SVG } from '../utils/helpers.js';
import { store } from '../state/store.js';

export function openAuthModal({ defaultTab = 'login', onSuccess = null } = {}) {
  let activeTab = defaultTab; // 'login' | 'register'
  let registerStep = 1; // 1: form, 2: otp
  let pendingEmail = '';

  const GOOGLE_ICON_SVG = `
    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  `;

  function renderContent() {
    return `
      <div id="auth-modal-container" class="space-y-5 text-[#F7F8F8]">
        <!-- Brand Header -->
        <div class="text-center space-y-1">
          <div class="w-10 h-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-[#16181D] border border-white/[0.08] shadow-sm">
            <div class="w-4 h-4 rounded-full bg-gradient-to-tr from-[#5E6AD2] to-indigo-400 flex items-center justify-center">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
          </div>
          <h2 class="font-bold text-lg text-white tracking-tight">
            ${activeTab === 'login' ? 'Masuk ke Dashboard Seller' : 'Daftar Akun Seller Baru'}
          </h2>
          <p class="text-xs text-[#8A8F98]">
            ${
              activeTab === 'login'
                ? 'Kelola toko digital, pantau omset & kirim produk otomatis'
                : 'Mulai jualan produk digital otomatis dalam hitungan menit'
            }
          </p>
        </div>

        <!-- Tab Switcher -->
        <div class="flex p-1 bg-[#0C0D0F] border border-white/[0.06] rounded-xl gap-1">
          <button type="button"
                  id="tab-btn-login"
                  class="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'login'
                      ? 'bg-white/[0.1] border border-white/[0.12] text-white shadow-sm'
                      : 'text-[#8A8F98] hover:text-white'
                  }">
            Masuk (Login)
          </button>
          <button type="button"
                  id="tab-btn-register"
                  class="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'register'
                      ? 'bg-white/[0.1] border border-white/[0.12] text-white shadow-sm'
                      : 'text-[#8A8F98] hover:text-white'
                  }">
            Daftar Baru
          </button>
        </div>

        ${
          activeTab === 'login'
            ? `
          <!-- FORM LOGIN -->
          <form id="form-auth-login" class="space-y-4">
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1.5">Email Akun (Gmail / Email)</label>
              <input type="email" id="login-email" required placeholder="seller@gmail.com" class="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 text-xs bg-[#0C0D0F] text-white placeholder-[#555]" />
            </div>
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1.5">Password</label>
              <input type="password" id="login-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 text-xs bg-[#0C0D0F] text-white placeholder-[#555]" />
            </div>
            <button type="submit" id="btn-submit-login" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-white hover:bg-zinc-200 text-black shadow-sm transition-all active:scale-98">
              Masuk ke Dashboard
            </button>
          </form>
        `
            : registerStep === 1
              ? `
          <!-- FORM DAFTAR STEP 1 -->
          <form id="form-auth-register" class="space-y-3.5">
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1">Nama Lengkap</label>
              <input type="text" id="reg-name" required placeholder="Nama Anda" class="w-full px-3.5 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 text-xs bg-[#0C0D0F] text-white placeholder-[#555]" />
            </div>
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1">Nama Toko Digital</label>
              <input type="text" id="reg-store" required placeholder="Contoh: Bintang Store Digital" class="w-full px-3.5 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 text-xs bg-[#0C0D0F] text-white placeholder-[#555]" />
            </div>
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1">Alamat Email (Gmail)</label>
              <input type="email" id="reg-email" required placeholder="nama@gmail.com" class="w-full px-3.5 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 text-xs bg-[#0C0D0F] text-white placeholder-[#555]" />
            </div>
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1">Password Baru (min 6 karakter)</label>
              <input type="password" id="reg-password" minlength="6" required placeholder="••••••••" class="w-full px-3.5 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 text-xs bg-[#0C0D0F] text-white placeholder-[#555]" />
            </div>
            <button type="submit" id="btn-submit-register" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-white hover:bg-zinc-200 text-black shadow-sm transition-all active:scale-98">
              Daftar & Kirim Kode OTP ke Gmail
            </button>
          </form>
        `
              : `
          <!-- FORM VERIFIKASI OTP STEP 2 -->
          <form id="form-auth-otp" class="space-y-4">
            <div class="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
              <div class="font-bold flex items-center gap-1.5 text-white">
                <span>📩 Cek Inbox Gmail Kamu</span>
              </div>
              <p class="text-[11px] text-[#A5B4FC] leading-relaxed">
                Kode 6-digit OTP telah dikirimkan ke: <b>${pendingEmail}</b>. Masukkan kode di bawah atau klik link di email untuk mengaktifkan akun.
              </p>
              <p class="text-[10px] text-[#8A8F98] italic">
                *Tips: Jika tidak ada di Kotak Masuk (Inbox), silakan cek di folder <b>Spam</b>.
              </p>
            </div>
            <div>
              <label class="block text-[11px] font-sans font-medium tracking-wider uppercase text-[#8A8F98] mb-1 text-center">Kode Verifikasi (OTP) dari Email</label>
              <input type="text" id="reg-otp-code" maxlength="12" required placeholder="Ketik / Tempel Kode OTP" class="w-full px-4 py-3 rounded-xl border border-white/[0.18] text-center font-mono font-black text-xl tracking-[0.25em] focus:outline-none focus:border-indigo-400 uppercase bg-[#0C0D0F] text-white" autocomplete="one-time-code" />
            </div>
            <button type="submit" id="btn-submit-otp" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-all active:scale-98">
              Verifikasi & Buka Dashboard
            </button>
            <div class="flex items-center justify-between text-xs px-1">
              <button type="button" id="btn-back-to-reg" class="text-[#8A8F98] hover:text-white font-medium flex items-center gap-1 transition-colors">
                <span>← Ganti Email</span>
              </button>
              <button type="button" id="btn-resend-otp" class="text-indigo-400 hover:text-indigo-300 font-medium underline">
                Kirim Ulang Kode OTP
              </button>
            </div>
          </form>
        `
        }

        <!-- Divider -->
        <div class="relative flex items-center justify-center my-4">
          <div class="border-t border-white/[0.06] w-full"></div>
          <span class="bg-[#101114] px-3 text-[10px] font-mono uppercase text-[#64748B] absolute">atau</span>
        </div>

        <!-- Direct Google OAuth Sign-in Button -->
        <div>
          <button type="button"
                  id="btn-google-oauth"
                  class="w-full py-2.5 px-4 rounded-xl border border-white/[0.08] bg-[#16181D] hover:bg-white/[0.06] text-white font-medium text-xs flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-98">
            ${GOOGLE_ICON_SVG}
            <span>Lanjutkan Langsung dengan Google (Gmail)</span>
          </button>
        </div>

        <!-- Privacy & Security Notice -->
        <div class="text-center text-[10px] text-[#64748B] leading-tight font-mono">
          Terlindungi dengan enkripsi Supabase Auth & PostgreSQL RLS isolation.
        </div>
      </div>
    `;
  }

  function bindEvents(modalEl) {
    // Tab switching
    const tabLogin = modalEl.querySelector('#tab-btn-login');
    const tabRegister = modalEl.querySelector('#tab-btn-register');

    if (tabLogin) {
      tabLogin.addEventListener('click', () => {
        activeTab = 'login';
        registerStep = 1;
        modalEl.querySelector('#auth-modal-wrapper').innerHTML = renderContent();
        bindEvents(modalEl);
      });
    }

    if (tabRegister) {
      tabRegister.addEventListener('click', () => {
        activeTab = 'register';
        registerStep = 1;
        modalEl.querySelector('#auth-modal-wrapper').innerHTML = renderContent();
        bindEvents(modalEl);
      });
    }

    // Google OAuth Handler
    const btnGoogle = modalEl.querySelector('#btn-google-oauth');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        btnGoogle.disabled = true;
        btnGoogle.innerHTML = `<span>Menghubungkan ke Google...</span>`;
        try {
          const redirectTo = encodeURIComponent(
            window.location.origin + window.location.pathname + '#admin',
          );
          const res = await fetch(`/api/v1/auth/google-url?redirect_to=${redirectTo}`);
          if (res.ok) {
            const data = await res.json();
            const url = data.data?.url;
            if (url) {
              window.location.href = url;
              return;
            }
          }
        } catch {
          // fallback
        }
        showToast('Gagal menghubungi server Google OAuth', 'error');
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = `${GOOGLE_ICON_SVG}<span>Lanjutkan Langsung dengan Google (Gmail)</span>`;
      });
    }

    // Login Form Submit
    const formLogin = modalEl.querySelector('#form-auth-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = modalEl.querySelector('#btn-submit-login');
        const email = modalEl.querySelector('#login-email')?.value;
        const password = modalEl.querySelector('#login-password')?.value;

        btn.disabled = true;
        btn.innerHTML = `<span>Memverifikasi...</span>`;

        try {
          const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();
          if (res.ok && data.data?.success) {
            showToast('Login berhasil! Selamat datang kembali.', 'success');
            const userData = { ...(data.data.user || { email }), store: data.data.store };
            localStorage.setItem('bts_auth_user', JSON.stringify(userData));
            closeModal();
            if (onSuccess) onSuccess(userData);
            else window.location.hash = '#admin';
            return;
          } else {
            showToast(data.error?.message || 'Login gagal, periksa email & password', 'error');
          }
        } catch (err) {
          showToast('Koneksi login bermasalah', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = `Masuk ke Dashboard`;
      });
    }

    // Register Form Submit (Step 1 -> Send OTP)
    const formRegister = modalEl.querySelector('#form-auth-register');
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = modalEl.querySelector('#btn-submit-register');
        const fullName = modalEl.querySelector('#reg-name')?.value;
        const storeName = modalEl.querySelector('#reg-store')?.value;
        const email = modalEl.querySelector('#reg-email')?.value;
        const password = modalEl.querySelector('#reg-password')?.value;

        pendingEmail = email;
        btn.disabled = true;
        btn.innerHTML = `<span>Mengirim Kode OTP ke Gmail...</span>`;

        try {
          const res = await fetch('/api/v1/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName, storeName }),
          });

          const data = await res.json();
          if (res.ok && data.data?.success) {
            showToast('Kode OTP telah dikirim ke email kamu!', 'success');
            registerStep = 2;
            modalEl.querySelector('#auth-modal-wrapper').innerHTML = renderContent();
            bindEvents(modalEl);
            return;
          } else {
            showToast(data.error?.message || 'Pendaftaran gagal', 'error');
          }
        } catch (err) {
          showToast('Koneksi pendaftaran bermasalah', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = `Daftar & Kirim Kode OTP ke Gmail`;
      });
    }

    // OTP Verification Submit (Step 2)
    const formOtp = modalEl.querySelector('#form-auth-otp');
    if (formOtp) {
      formOtp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = modalEl.querySelector('#btn-submit-otp');
        const token = modalEl.querySelector('#reg-otp-code')?.value;

        btn.disabled = true;
        btn.innerHTML = `<span>Memverifikasi Kode OTP...</span>`;

        try {
          const res = await fetch('/api/v1/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingEmail, token, type: 'signup' }),
          });

          const data = await res.json();
          if (res.ok && data.data?.success) {
            showToast('Akun berhasil diverifikasi! Selamat datang.', 'success');
            const userData = {
              ...(data.data.user || { email: pendingEmail }),
              store: data.data.store,
            };
            localStorage.setItem('bts_auth_user', JSON.stringify(userData));
            closeModal();
            if (onSuccess) onSuccess(userData);
            else window.location.hash = '#admin';
            return;
          } else {
            showToast(data.error?.message || 'Kode OTP salah atau kedaluwarsa', 'error');
          }
        } catch (err) {
          showToast('Koneksi verifikasi bermasalah', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = `Verifikasi & Buka Dashboard`;
      });
    }

    // Back to Register Button Handler
    const btnBack = modalEl.querySelector('#btn-back-to-reg');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        registerStep = 1;
        modalEl.querySelector('#auth-modal-wrapper').innerHTML = renderContent();
        bindEvents(modalEl);
      });
    }

    // Resend OTP Button Handler
    const btnResend = modalEl.querySelector('#btn-resend-otp');
    if (btnResend && pendingEmail) {
      btnResend.addEventListener('click', async () => {
        btnResend.disabled = true;
        btnResend.innerText = 'Mengirim ulang kode OTP...';

        try {
          const res = await fetch('/api/v1/auth/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingEmail, type: 'signup' }),
          });

          const data = await res.json();
          if (res.ok && data.data?.success) {
            showToast('Kode OTP baru telah dikirim ke email kamu!', 'success');
          } else {
            showToast(data.error?.message || 'Gagal mengirim ulang OTP', 'error');
          }
        } catch {
          showToast('Koneksi kirim ulang OTP bermasalah', 'error');
        }

        setTimeout(() => {
          btnResend.disabled = false;
          btnResend.innerText = 'Kirim Ulang Kode OTP';
        }, 30000);
      });
    }
  }

  openModal({
    title: '',
    content: `<div id="auth-modal-wrapper">${renderContent()}</div>`,
    maxWidth: 'max-w-md',
    onOpen: (modalEl) => {
      bindEvents(modalEl);
    },
  });
}
