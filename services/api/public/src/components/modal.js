// Accessible Modal Controller
import { ICONS } from '../utils/helpers.js';

let activeModal = null;

export function openModal({
  title = '',
  content = '',
  maxWidth = 'max-w-lg',
  showClose = true,
  onOpen = null,
}) {
  closeModal();

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'app-modal-overlay';
  modalOverlay.className =
    'fixed inset-0 z-[9990] flex items-center justify-center p-4 modal-backdrop transition-opacity duration-200 opacity-0';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');

  modalOverlay.innerHTML = `
    <div class="relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden transform transition-all duration-200 scale-95 opacity-0 flex flex-col max-h-[90vh]">
      ${
        title || showClose
          ? `<div class="px-5 py-4 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/50">
              <h3 class="font-heading font-bold text-stone-900 text-base">${title}</h3>
              ${
                showClose
                  ? `<button type="button" class="btn-close-modal p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors" aria-label="Tutup modal">
                      ${ICONS.close}
                    </button>`
                  : ''
              }
            </div>`
          : ''
      }
      <div class="p-5 overflow-y-auto flex-1">
        ${content}
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  document.body.style.overflow = 'hidden';
  activeModal = modalOverlay;

  // Animate in
  requestAnimationFrame(() => {
    modalOverlay.classList.remove('opacity-0');
    const container = modalOverlay.querySelector('.relative');
    if (container) {
      container.classList.remove('scale-95', 'opacity-0');
      container.classList.add('scale-100', 'opacity-100');
    }
  });

  // Events
  const closeBtn = modalOverlay.querySelector('.btn-close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', handleKeydown);
  modalOverlay._cleanupKeydown = handleKeydown;

  if (onOpen) onOpen(modalOverlay);
  return modalOverlay;
}

export function closeModal() {
  if (!activeModal) return;

  const overlay = activeModal;
  activeModal = null;

  if (overlay._cleanupKeydown) {
    document.removeEventListener('keydown', overlay._cleanupKeydown);
  }

  overlay.classList.add('opacity-0');
  const container = overlay.querySelector('.relative');
  if (container) {
    container.classList.add('scale-95', 'opacity-0');
  }

  setTimeout(() => {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
    document.body.style.overflow = '';
  }, 200);
}
