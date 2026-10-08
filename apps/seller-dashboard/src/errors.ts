/**
 * Bintang Tech Studio — Seller Dashboard Domain Errors.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

export abstract class SellerDashboardError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SellerUnauthenticatedError extends SellerDashboardError {
  readonly code = 'SELLER_UNAUTHENTICATED';
  readonly statusCode = 401;

  constructor(message: string = 'Autentikasi seller diperlukan untuk mengakses dashboard.') {
    super(message);
  }
}

export class SellerStoreAccessDeniedError extends SellerDashboardError {
  readonly code = 'STORE_ACCESS_DENIED';
  readonly statusCode = 403;

  constructor(message: string = 'Akses ke toko ini tidak diizinkan untuk akun Anda.') {
    super(message);
  }
}

export class StoreSuspendedError extends SellerDashboardError {
  readonly code = 'STORE_SUSPENDED';
  readonly statusCode = 403;

  constructor(message: string = 'Toko ini sedang disuspen. Silakan hubungi dukungan platform.') {
    super(message);
  }
}

export class StoreSwitchUnauthorizedError extends SellerDashboardError {
  readonly code = 'STORE_SWITCH_UNAUTHORIZED';
  readonly statusCode = 403;

  constructor(
    message: string = 'Perpindahan ke toko target ditolak: keanggotaan tidak ditemukan atau tidak aktif.',
  ) {
    super(message);
  }
}

export class ProductLimitExceededError extends SellerDashboardError {
  readonly code = 'PRODUCT_LIMIT_EXCEEDED';
  readonly statusCode = 403;

  constructor(limit: number) {
    super(
      `Batas maksimum produk untuk paket langganan Anda tercapai (${limit} produk). Silakan tingkatkan paket.`,
    );
  }
}

export class StaffLimitExceededError extends SellerDashboardError {
  readonly code = 'STAFF_LIMIT_EXCEEDED';
  readonly statusCode = 403;

  constructor(limit: number) {
    super(
      `Batas maksimum staf untuk paket langganan Anda tercapai (${limit} anggota). Silakan tingkatkan paket.`,
    );
  }
}

export class OwnerDemotionForbiddenError extends SellerDashboardError {
  readonly code = 'OWNER_DEMOTION_FORBIDDEN';
  readonly statusCode = 403;

  constructor(
    message: string = 'Pemilik toko (STORE_OWNER) tidak dapat didemosi atau dihapus melalui manajemen tim biasa.',
  ) {
    super(message);
  }
}

export class OwnerTransferNotSupportedError extends SellerDashboardError {
  readonly code = 'OWNER_TRANSFER_NOT_SUPPORTED';
  readonly statusCode = 400;

  constructor(
    message: string = 'Transfer kepemilikan toko bukan operasi CRUD biasa. Gunakan alur transfer kepemilikan khusus.',
  ) {
    super(message);
  }
}

export class SellerResourceNotFoundError extends SellerDashboardError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(message: string = 'Sumber daya tidak ditemukan pada toko ini.') {
    super(message);
  }
}

export class PriceTamperingRejectedError extends SellerDashboardError {
  readonly code = 'PRICE_TAMPERING_REJECTED';
  readonly statusCode = 400;

  constructor(message: string = 'Harga tidak valid atau manipulasi nilai terdeteksi.') {
    super(message);
  }
}

export class DirectStatusMutationRejectedError extends SellerDashboardError {
  readonly code = 'DIRECT_STATUS_MUTATION_REJECTED';
  readonly statusCode = 400;

  constructor(
    message: string = 'Mutasi status langsung tidak diizinkan. Gunakan transisi status domain yang sah.',
  ) {
    super(message);
  }
}

export class ChannelFeatureDisabledError extends SellerDashboardError {
  readonly code = 'CHANNEL_FEATURE_DISABLED';
  readonly statusCode = 403;

  constructor(channelName: string) {
    super(`Integrasi channel ${channelName} tidak diaktifkan pada paket langganan toko Anda.`);
  }
}
