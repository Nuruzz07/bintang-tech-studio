// Bintang Store — Vouchers & Promotion Data

export const PROMOTIONAL_VOUCHERS = [
  {
    code: 'BINTANG10',
    name: 'Promo Bintang 10%',
    type: 'percentage',
    value: 10,
    minSpend: 10000,
    maxDiscount: 25000,
    description: 'Diskon 10% untuk semua produk digital tanpa batas kategori.',
    expiresAt: '2026-12-31T23:59:59Z',
    active: true,
    badge: 'Diskon 10%',
  },
  {
    code: 'STARTER5',
    name: 'Potongan Pelanggan Baru',
    type: 'fixed',
    value: 5000,
    minSpend: 25000,
    maxDiscount: 5000,
    description: 'Potongan Rp5.000 untuk transaksi minimal Rp25.000.',
    expiresAt: '2026-12-31T23:59:59Z',
    active: true,
    singleUse: true,
    badge: 'Hemat Rp5.000',
  },
  {
    code: 'PROMOHEMAT',
    name: 'Flash Promo Toko',
    type: 'percentage',
    value: 15,
    minSpend: 50000,
    maxDiscount: 30000,
    description: 'Diskon spesial 15% untuk transaksi minimal Rp50.000.',
    expiresAt: '2026-12-31T23:59:59Z',
    active: true,
    badge: 'Diskon 15%',
  },
  {
    code: 'DIGITALVIP',
    name: 'Spesial Pelanggan Setia',
    type: 'percentage',
    value: 20,
    minSpend: 100000,
    maxDiscount: 50000,
    description: 'Diskon 20% untuk pembelian grosir atau bundle minimal Rp100.000.',
    expiresAt: '2026-12-31T23:59:59Z',
    active: true,
    badge: 'Diskon 20%',
  },
  {
    code: 'EXPIRED2025',
    name: 'Promo Tahun Lalu (Kedaluwarsa)',
    type: 'percentage',
    value: 25,
    minSpend: 10000,
    maxDiscount: 50000,
    description: 'Voucher promo tahun lalu.',
    expiresAt: '2025-01-01T00:00:00Z',
    active: false,
    badge: 'Kedaluwarsa',
  },
];

/**
 * Validates a voucher code against cart subtotal and usage history
 * Returns { valid: boolean, state: string, message: string, discount: number, voucher: object|null }
 */
export function validateVoucher(code, subtotal = 0, usedVouchers = []) {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) {
    return {
      valid: false,
      state: 'empty',
      message: 'Masukkan kode voucher.',
      discount: 0,
      voucher: null,
    };
  }

  const voucher = PROMOTIONAL_VOUCHERS.find((v) => v.code === cleanCode);

  // 1. Invalid Code
  if (!voucher) {
    return {
      valid: false,
      state: 'invalid',
      message: `Kode voucher "${cleanCode}" tidak ditemukan atau tidak valid.`,
      discount: 0,
      voucher: null,
    };
  }

  // 2. Expired Voucher
  const now = new Date();
  const expiryDate = new Date(voucher.expiresAt);
  if (!voucher.active || now > expiryDate) {
    return {
      valid: false,
      state: 'expired',
      message: `Kode voucher "${cleanCode}" telah kedaluwarsa.`,
      discount: 0,
      voucher: voucher,
    };
  }

  // 3. Already Used (only for single-use vouchers like STARTER5)
  if (voucher.singleUse && Array.isArray(usedVouchers) && usedVouchers.includes(cleanCode)) {
    return {
      valid: false,
      state: 'already_used',
      message: `Kode voucher "${cleanCode}" sudah pernah digunakan pada akun ini.`,
      discount: 0,
      voucher: voucher,
    };
  }

  // 4. Minimum Spend Not Met
  if (subtotal < voucher.minSpend) {
    const formattedMin = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(voucher.minSpend);
    return {
      valid: false,
      state: 'min_spend_not_met',
      message: `Minimal belanja untuk voucher ini adalah ${formattedMin}. Tambah produk lagi untuk menikmati diskon.`,
      discount: 0,
      voucher: voucher,
    };
  }

  // 5. Valid: Calculate Discount
  let discountAmount = 0;
  if (voucher.type === 'percentage') {
    discountAmount = Math.round((subtotal * voucher.value) / 100);
    if (voucher.maxDiscount) {
      discountAmount = Math.min(discountAmount, voucher.maxDiscount);
    }
  } else {
    discountAmount = Math.min(voucher.value, subtotal);
  }

  return {
    valid: true,
    state: 'valid',
    message: `Voucher ${voucher.code} berhasil digunakan! Anda hemat Rp${discountAmount.toLocaleString('id-ID')}.`,
    discount: discountAmount,
    voucher: voucher,
  };
}
