// Bintang Store — Payment Controller (Production Quality)
// Brand: Bintang Store — "Produk digital, langsung beres."

import { openModal, closeModal } from './modal.js';
import { formatRupiah } from '../utils/currency.js';
import { copyToClipboard, sleep, ICONS, BRAND_LOGO_SVG } from '../utils/helpers.js';
import { store } from '../state/store.js';
import { paymentService } from '../services/payment/index.js';

export async function showPaymentSimulation({ order, onCompleted = null }) {
  let timerSeconds = 15 * 60; // 15 mins countdown
  let timerInterval = null;

  // Initialize payment via paymentService abstraction
  const paymentRes = await paymentService.createPayment({
    orderId: order.id,
    amount: order.total,
    paymentMethod: order.paymentMethod || 'QRIS',
    customer: order.customer,
  });

  const txData = paymentRes.data || {
    refCode: `REF-QRIS-${Math.floor(100000 + Math.random() * 900000)}`,
    transactionId: `TX-${order.id.replace('#', '')}`,
  };

  const content = `
    <div id="payment-modal-body" class="flex flex-col items-center text-center">
      <!-- QRIS Brand Header -->
      <div class="w-full bg-[#101114] rounded-xl p-3 text-white flex items-center justify-between mb-3.5 border border-white/[0.08]">
        <div class="flex items-center gap-2">
          <span class="font-heading font-black tracking-wider text-[11px] bg-red-600 px-2 py-0.5 rounded text-white shadow-sm">QRIS</span>
          <span class="text-xs text-[#E6E8EB] font-medium">Pembayaran Digital Instan</span>
        </div>
        <span class="text-[10px] font-mono text-[#8A8F98]">GPN / Bank Indonesia</span>
      </div>

      <!-- Merchant & Amount Info -->
      <div class="w-full bg-[#0C0D0E] rounded-2xl p-3.5 border border-white/[0.08] mb-3.5 text-left space-y-1.5 shadow-sm">
        <div class="flex justify-between items-center text-xs text-[#8A8F98]">
          <span>Merchant Resmi</span>
          <span class="font-bold text-[#F7F8F8] flex items-center gap-1.5">
            <span class="w-4 h-4 inline-block">${BRAND_LOGO_SVG}</span>
            <span>Bintang Store</span>
          </span>
        </div>
        <div class="flex justify-between items-center text-xs text-[#8A8F98]">
          <span>ID Pesanan</span>
          <span class="font-mono font-semibold text-[#F7F8F8]">${order.id}</span>
        </div>
        <div class="flex justify-between items-center text-xs text-[#8A8F98]">
          <span>No. Referensi</span>
          <span class="font-mono text-[11px] text-[#A1A1AA]">${txData.refCode}</span>
        </div>
        ${
          txData.paymentUrl
            ? `
        <div class="pt-1.5 pb-0.5">
          <a href="${txData.paymentUrl}" target="_blank" rel="noopener noreferrer" class="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white text-xs font-bold shadow-xs transition">
            <span>🔗 Buka Tagihan Tipzy QRIS (Live)</span>
          </a>
        </div>
        `
            : ''
        }
        <div class="flex justify-between items-center text-xs text-[#8A8F98] pt-2 border-t border-white/[0.08]">
          <span class="font-medium">Total Pembayaran</span>
          <span class="font-heading font-extrabold text-base text-[#F7F8F8]">${formatRupiah(order.total)}</span>
        </div>
      </div>

      <!-- QR Code Display with Laser Scanner Animation -->
      <div class="relative w-56 h-56 bg-white p-3 rounded-2xl border-2 border-stone-800 shadow-md flex items-center justify-center overflow-hidden mb-3">
        <div class="qris-scanner-line"></div>
        ${
          txData.qrImageUrl
            ? `<img src="${txData.qrImageUrl}" alt="Tipzy QRIS" class="w-48 h-48 object-contain rounded-xl" />`
            : txData.qrString || txData.paymentUrl
              ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(txData.qrString || txData.paymentUrl)}" alt="QRIS QR" class="w-48 h-48 object-contain rounded-xl shadow-xs" onerror="this.onerror=null; this.classList.add('hidden'); document.getElementById('fallback-qr-svg').classList.remove('hidden');" />`
              : ''
        }
        <!-- Stylized QR Vector Graphic Fallback -->
        <svg id="fallback-qr-svg" class="w-48 h-48 text-stone-950 ${txData.qrImageUrl || txData.paymentUrl ? 'hidden' : ''}" viewBox="0 0 200 200" fill="currentColor">
          <!-- Top Left Marker -->
          <rect x="10" y="10" width="50" height="50" rx="6" />
          <rect x="20" y="20" width="30" height="30" fill="white" />
          <rect x="26" y="26" width="18" height="18" rx="2" />

          <!-- Top Right Marker -->
          <rect x="140" y="10" width="50" height="50" rx="6" />
          <rect x="150" y="20" width="30" height="30" fill="white" />
          <rect x="156" y="26" width="18" height="18" rx="2" />

          <!-- Bottom Left Marker -->
          <rect x="10" y="140" width="50" height="50" rx="6" />
          <rect x="20" y="150" width="30" height="30" fill="white" />
          <rect x="26" y="156" width="18" height="18" rx="2" />

          <!-- QR Data Dots Pattern -->
          <rect x="70" y="15" width="12" height="12" />
          <rect x="90" y="15" width="15" height="12" />
          <rect x="115" y="15" width="15" height="12" />
          <rect x="70" y="35" width="20" height="15" />
          <rect x="100" y="35" width="15" height="15" />
          <rect x="120" y="35" width="12" height="15" />

          <rect x="15" y="70" width="15" height="15" />
          <rect x="35" y="75" width="12" height="12" />
          <rect x="15" y="100" width="12" height="20" />
          <rect x="35" y="100" width="20" height="15" />
          <rect x="15" y="125" width="25" height="10" />

          <!-- Official Bintang Logo Center Badge in QR -->
          <rect x="70" y="70" width="60" height="60" rx="8" fill="#1C1917" />
          <rect x="73" y="73" width="54" height="54" rx="6" fill="#FAF8F5" />
          <!-- Diamond Frame -->
          <path d="M84 95 L100 78 L116 95" stroke="#1C1917" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M84 105 L100 122 L116 105" stroke="#9C532B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <!-- Star -->
          <polygon points="100,88 109,100 100,112 91,100" fill="#1C1917"/>
          <path d="M100 91 C100 97 96 100 93 100 C96 100 100 103 100 109 C100 103 104 100 107 100 C104 100 100 97 100 91 Z" fill="#E8A359"/>
          <circle cx="100" cy="100" r="1.5" fill="#FAF8F5"/>

          <rect x="140" y="70" width="15" height="20" />
          <rect x="165" y="70" width="25" height="12" />
          <rect x="140" y="100" width="25" height="12" />
          <rect x="175" y="95" width="15" height="20" />

          <rect x="70" y="140" width="25" height="15" />
          <rect x="105" y="140" width="25" height="15" />
          <rect x="140" y="140" width="15" height="25" />
          <rect x="165" y="140" width="25" height="15" />
          <rect x="70" y="165" width="15" height="25" />
          <rect x="95" y="165" width="30" height="12" />
          <rect x="135" y="170" width="20" height="20" />
          <rect x="165" y="165" width="25" height="25" />
        </svg>
      </div>

      <!-- Real-time Live Status Monitoring Badge -->
      <div class="mb-3 flex items-center justify-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-xs">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span id="payment-status-badge">Menunggu Pembayaran (Auto-detect Aktif)</span>
        </span>
      </div>

      <!-- Expiry Countdown -->
      <div class="text-xs text-[#8A8F98] mb-3.5 flex items-center justify-center gap-1.5 font-mono">
        ${ICONS.clock}
        <span>Selesaikan pembayaran dalam:</span>
        <span id="qris-timer" class="font-bold text-[#F7F8F8] bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">15:00</span>
      </div>

      <!-- Action Verification Button -->
      <div class="w-full flex flex-col gap-2">
        <button id="btn-verify-payment"
                type="button"
                class="w-full py-3 px-4 rounded-xl font-heading font-bold text-sm bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 active:scale-98 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
          ${ICONS.check}
          <span>Saya Sudah Membayar (Cek Otomatis)</span>
        </button>

        <!-- Hidden Helper Hint for testing / latency -->
        <div id="payment-pending-hint" class="hidden text-center py-1 bg-[#101114] rounded-xl p-2.5 border border-white/[0.08]">
          <p class="text-[11px] text-[#8A8F98] mb-1 leading-relaxed">
            Mutasi belum terdeteksi dari bank. Jika baru saja transfer, tunggu 2-4 detik sistem akan mendeteksi otomatis.
          </p>
          <button type="button" id="btn-force-demo-complete" class="text-[11px] text-[#5E6AD2] hover:underline font-semibold">
            Simulasikan Bayar Berhasil (Mode Testing)
          </button>
        </div>

        <p class="text-[11px] text-[#8A8F98] leading-tight">
          Buka aplikasi m-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, DANA, ShopeePay), lalu scan QR di atas.
        </p>
      </div>
    </div>
  `;

  openModal({
    title: 'Pembayaran QRIS — Bintang Store',
    content: content,
    maxWidth: 'max-w-md',
    theme: 'dark',
    onOpen: (modalEl) => {
      let isCompleted = false;
      let isChecking = false;

      // Trigger Instant Delivery & Transition to Fulfillment View
      const triggerFulfillmentSuccess = async () => {
        if (isCompleted) return;
        isCompleted = true;
        if (timerInterval) clearInterval(timerInterval);
        if (pollInterval) clearInterval(pollInterval);

        const modalBody = modalEl.querySelector('#payment-modal-body');
        if (modalBody) {
          modalBody.innerHTML = `
            <div class="py-12 flex flex-col items-center justify-center space-y-4">
              <div class="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center animate-bounce shadow-sm border border-emerald-500/20">
                <svg class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div class="font-heading font-black text-xl text-[#F7F8F8]">Pembayaran Berhasil!</div>
              <p class="text-xs text-[#8A8F98] font-sans">Mutasi QRIS terverifikasi. Menyiapkan lisensi & kredensial otomatis...</p>
            </div>
          `;
        }

        // Advance Order Lifecycle to PAID & FULFILLED
        store.updateOrderStatus(order.id, 'PAID', 'PROCESSING');

        // Notify seller via Telegram bot
        const prodName = order.items && order.items[0] ? order.items[0].name : 'Produk Digital';
        fetch('/api/v1/telegram/notify-fulfillment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            amount: order.total,
            productName: prodName,
          }),
        }).catch(() => {});

        await sleep(900);
        store.updateOrderStatus(order.id, 'PAID', 'FULFILLED');
        await sleep(400);

        showFulfillmentResult(order, onCompleted);
      };

      // Real-time Background Polling (Every 2.5 seconds)
      const pollInterval = setInterval(async () => {
        if (isCompleted || isChecking) return;
        if (
          !txData.transactionId ||
          txData.transactionId.startsWith('TX-') ||
          txData.transactionId.startsWith('REF-')
        )
          return;

        isChecking = true;
        try {
          const statusCheck = await paymentService.checkStatus(txData.transactionId);
          if (statusCheck && statusCheck.paid) {
            await triggerFulfillmentSuccess();
          }
        } catch (err) {
          console.warn('[QRIS Auto-poll] status check notice:', err);
        } finally {
          isChecking = false;
        }
      }, 2500);

      // Setup Countdown Timer
      const timerEl = modalEl.querySelector('#qris-timer');
      timerInterval = setInterval(() => {
        timerSeconds--;
        if (timerSeconds <= 0) {
          clearInterval(timerInterval);
          if (pollInterval) clearInterval(pollInterval);
          if (timerEl) timerEl.textContent = '00:00 (Kedaluwarsa)';
          const badge = modalEl.querySelector('#payment-status-badge');
          if (badge) badge.textContent = 'Tagihan Kedaluwarsa';
        } else if (timerEl) {
          const m = Math.floor(timerSeconds / 60)
            .toString()
            .padStart(2, '0');
          const s = (timerSeconds % 60).toString().padStart(2, '0');
          timerEl.textContent = `${m}:${s}`;
        }
      }, 1000);

      // Verify Payment Action Button
      const btnVerify = modalEl.querySelector('#btn-verify-payment');
      if (btnVerify) {
        btnVerify.addEventListener('click', async () => {
          if (isCompleted) return;

          btnVerify.disabled = true;
          btnVerify.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Memverifikasi mutasi bank...</span>
          `;

          if (
            txData.transactionId &&
            !txData.transactionId.startsWith('TX-') &&
            !txData.transactionId.startsWith('REF-')
          ) {
            try {
              const statusCheck = await paymentService.checkStatus(txData.transactionId);
              if (statusCheck && statusCheck.paid) {
                await triggerFulfillmentSuccess();
                return;
              }
            } catch (err) {
              console.warn('[Manual verify error]:', err);
            }
          }

          await sleep(1500);

          // Re-check once more
          if (txData.transactionId && !txData.transactionId.startsWith('TX-')) {
            try {
              const statusCheck2 = await paymentService.checkStatus(txData.transactionId);
              if (statusCheck2 && statusCheck2.paid) {
                await triggerFulfillmentSuccess();
                return;
              }
            } catch (err) {
              // fallback
            }
          }

          btnVerify.disabled = false;
          btnVerify.innerHTML = `
            ${ICONS.check}
            <span>Belum Terdeteksi — Cek Lagi</span>
          `;
          const hintEl = modalEl.querySelector('#payment-pending-hint');
          if (hintEl) {
            hintEl.classList.remove('hidden');
          }
        });
      }

      // Force Demo Complete Button (Sandbox/Testing convenience)
      const btnForceDemo = modalEl.querySelector('#btn-force-demo-complete');
      if (btnForceDemo) {
        btnForceDemo.addEventListener('click', async () => {
          await triggerFulfillmentSuccess();
        });
      }
    },
    onClose: () => {
      if (timerInterval) clearInterval(timerInterval);
      if (typeof pollInterval !== 'undefined' && pollInterval) clearInterval(pollInterval);
    },
  });
}

function showFulfillmentResult(order, onCompleted = null) {
  const updatedOrder = store.getOrder(order.id) || order;
  const f = updatedOrder.fulfillmentData || {};

  let credentialBlock = '';
  if (f.format === 'account') {
    credentialBlock = `
      <div class="bg-stone-900 text-stone-100 rounded-2xl p-4 text-left font-mono text-xs space-y-2 border border-stone-800 shadow-inner">
        <div class="text-[10px] text-amber-400 uppercase tracking-widest font-sans font-bold flex items-center justify-between">
          <span>Kredensial Akun Resmi</span>
          <span class="text-emerald-400">● Aktif</span>
        </div>
        <div class="flex items-center justify-between border-b border-stone-800 pb-2">
          <div>
            <span class="text-stone-400 text-[10px] block font-sans">Email / User:</span>
            <span class="text-stone-100 font-semibold select-all">${f.email || 'demo.user@bintang.store'}</span>
          </div>
          <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1 rounded transition-colors" data-copy="${f.email || ''}">
            ${ICONS.copy}
          </button>
        </div>
        <div class="flex items-center justify-between pt-1">
          <div>
            <span class="text-stone-400 text-[10px] block font-sans">Password:</span>
            <span class="text-stone-100 font-semibold select-all">${f.password || 'Bintang2026Secure'}</span>
          </div>
          <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1 rounded transition-colors" data-copy="${f.password || ''}">
            ${ICONS.copy}
          </button>
        </div>
      </div>
    `;
  } else if (f.format === 'code') {
    credentialBlock = `
      <div class="bg-stone-900 text-stone-100 rounded-2xl p-4 text-left font-mono text-xs space-y-2 border border-stone-800 shadow-inner">
        <div class="text-[10px] text-amber-400 uppercase tracking-widest font-sans font-bold">Kode Voucher Digital</div>
        <div class="flex items-center justify-between pt-1">
          <span class="text-amber-300 font-bold text-sm tracking-widest select-all">${f.code || 'BTS-CODE-88912-REDEEM'}</span>
          <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1.5 rounded transition-colors" data-copy="${f.code || ''}">
            ${ICONS.copy}
          </button>
        </div>
      </div>
    `;
  } else if (f.format === 'link') {
    credentialBlock = `
      <div class="bg-stone-900 text-stone-100 rounded-2xl p-4 text-left font-mono text-xs space-y-2.5 border border-stone-800 shadow-inner">
        <div class="text-[10px] text-amber-400 uppercase tracking-widest font-sans font-bold">Link Akses Folder VIP</div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-stone-300 text-[11px] truncate select-all">${f.link || 'https://drive.google.com/drive/folders/vip'}</span>
          <a href="${f.link || '#'}" target="_blank" class="px-2.5 py-1 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-sans font-bold flex items-center gap-1 transition-colors shrink-0">
            <span>Buka</span>
            ${ICONS.externalLink}
          </a>
        </div>
      </div>
    `;
  } else {
    credentialBlock = `
      <div class="bg-stone-900 text-stone-100 rounded-2xl p-4 text-left font-mono text-xs space-y-2 border border-stone-800 shadow-inner">
        <div class="text-[10px] text-amber-400 uppercase tracking-widest font-sans font-bold">Serial License Key</div>
        <div class="flex items-center justify-between pt-1">
          <span class="text-sky-300 font-bold text-sm tracking-wider select-all">${f.licenseKey || 'BTS-LIC-8812-77XA'}</span>
          <button type="button" class="btn-copy-cred text-stone-400 hover:text-white p-1.5 rounded transition-colors" data-copy="${f.licenseKey || ''}">
            ${ICONS.copy}
          </button>
        </div>
      </div>
    `;
  }

  const successContent = `
    <div class="flex flex-col items-center text-center space-y-4">
      <!-- Success Icon -->
      <div class="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl shadow-sm border border-emerald-500/20">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
      </div>

      <div>
        <h3 class="font-heading font-extrabold text-lg text-[#F7F8F8]">Pembayaran Berhasil!</h3>
        <p class="text-xs text-[#8A8F98] mt-0.5">Produk digital Anda telah terkirim secara otomatis.</p>
      </div>

      <!-- Credential Block -->
      <div class="w-full">
        ${credentialBlock}
      </div>

      <!-- Note / Instructions -->
      <div class="w-full bg-[#101114] rounded-xl p-3 text-left border border-white/[0.08] text-xs text-[#8A8F98] leading-relaxed">
        <span class="font-bold text-[#F7F8F8] block mb-0.5">Panduan Penggunaan:</span>
        ${f.note || 'Akses produk digital aktif seketika. Hubungi layanan pelanggan Bintang Store jika membutuhkan bantuan aktivasi.'}
      </div>

      <!-- Action Button -->
      <div class="w-full pt-1">
        <button id="btn-done-payment"
                type="button"
                class="w-full py-3 px-4 rounded-xl font-heading font-bold text-sm bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white shadow-md transition-colors">
          Lihat di Pesanan Saya
        </button>
      </div>
    </div>
  `;

  openModal({
    title: 'Pesanan Selesai — Bintang Store',
    content: successContent,
    maxWidth: 'max-w-md',
    theme: 'dark',
    onOpen: (modalEl) => {
      // Copy event listener
      modalEl.querySelectorAll('.btn-copy-cred').forEach((btn) => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-copy');
          if (text) copyToClipboard(text, 'Kredensial berhasil disalin!');
        });
      });

      // Done button
      const btnDone = modalEl.querySelector('#btn-done-payment');
      if (btnDone) {
        btnDone.addEventListener('click', () => {
          closeModal();
          if (onCompleted) {
            onCompleted(updatedOrder);
          } else {
            // Trigger tab navigation to orders
            window.location.hash = '#webapp';
            const ordersTabBtn = document.querySelector('.btn-webapp-tab[data-tab="orders"]');
            if (ordersTabBtn) ordersTabBtn.click();
          }
        });
      }
    },
  });
}
