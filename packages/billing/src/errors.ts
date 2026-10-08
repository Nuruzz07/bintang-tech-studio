/**
 * Bintang Tech Studio — Billing & Onboarding Error Taxonomy.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

export class BillingError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'BILLING_ERROR', statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class PlanNotFoundError extends BillingError {
  constructor(planIdentifier: string) {
    super(`Paket langganan tidak ditemukan: ${planIdentifier}`, 'PLAN_NOT_FOUND', 404);
  }
}

export class InvalidPlanError extends BillingError {
  constructor(message: string) {
    super(message, 'INVALID_PLAN', 400);
  }
}

export class SubscriptionNotFoundError extends BillingError {
  constructor(subscriptionId: string) {
    super(`Data langganan tidak ditemukan: ${subscriptionId}`, 'SUBSCRIPTION_NOT_FOUND', 404);
  }
}

export class SubscriptionStateTransitionError extends BillingError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Transisi status langganan tidak diizinkan: ${fromStatus} -> ${toStatus}`,
      'SUBSCRIPTION_STATE_TRANSITION_INVALID',
      422,
    );
  }
}

export class SubscriptionCancelledError extends BillingError {
  constructor() {
    super('Langganan telah dibatalkan dan tidak dapat digunakan.', 'SUBSCRIPTION_CANCELLED', 422);
  }
}

export class InvoiceNotFoundError extends BillingError {
  constructor(invoiceId: string) {
    super(`Tagihan tidak ditemukan: ${invoiceId}`, 'INVOICE_NOT_FOUND', 404);
  }
}

export class InvoiceAlreadyPaidError extends BillingError {
  constructor(invoiceId: string) {
    super(`Tagihan ${invoiceId} sudah berstatus LUNAS.`, 'INVOICE_ALREADY_PAID', 409);
  }
}

export class InvoiceStateTransitionError extends BillingError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Transisi status tagihan tidak valid: ${fromStatus} -> ${toStatus}`,
      'INVOICE_STATE_TRANSITION_INVALID',
      422,
    );
  }
}

export class BillingPaymentNotFoundError extends BillingError {
  constructor(paymentId: string) {
    super(`Pembayaran tagihan tidak ditemukan: ${paymentId}`, 'BILLING_PAYMENT_NOT_FOUND', 404);
  }
}

export class BillingPaymentStateTransitionError extends BillingError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Transisi status pembayaran billing tidak valid: ${fromStatus} -> ${toStatus}`,
      'BILLING_PAYMENT_STATE_TRANSITION_INVALID',
      422,
    );
  }
}

export class BillingPaymentAmountMismatchError extends BillingError {
  constructor(expected: string, received: string) {
    super(
      `Nominal pembayaran (${received}) tidak sesuai dengan total tagihan (${expected}).`,
      'BILLING_AMOUNT_MISMATCH',
      422,
    );
  }
}

export class BillingPaymentCurrencyMismatchError extends BillingError {
  constructor(expected: string, received: string) {
    super(
      `Mata uang pembayaran (${received}) tidak sesuai dengan tagihan (${expected}).`,
      'BILLING_CURRENCY_MISMATCH',
      422,
    );
  }
}

export class BillingPaymentStoreMismatchError extends BillingError {
  constructor() {
    super(
      'Pembayaran billing tidak cocok dengan toko pada tagihan.',
      'BILLING_STORE_MISMATCH',
      403,
    );
  }
}

export class BillingPaymentDuplicateEventError extends BillingError {
  constructor(eventId: string) {
    super(
      `Event webhook provider billing sudah pernah diproses: ${eventId}`,
      'BILLING_DUPLICATE_EVENT',
      409,
    );
  }
}

export class BillingPaymentConflictEventError extends BillingError {
  constructor(message: string) {
    super(message, 'BILLING_CONFLICT_EVENT', 409);
  }
}

export class BillingSignatureVerificationError extends BillingError {
  constructor() {
    super('Verifikasi tanda tangan webhook billing gagal.', 'BILLING_INVALID_SIGNATURE', 401);
  }
}
export { BillingSignatureVerificationError as BillingWebhookSignatureError };

export class BillingIdempotencyConflictError extends BillingError {
  constructor(key: string) {
    super(
      `Operasi billing duplikat terdeteksi untuk kunci idempotensi: ${key}`,
      'BILLING_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
}

export class FinancialImmutabilityError extends BillingError {
  constructor(resource: string) {
    super(
      `Catatan keuangan resmi (${resource}) bersifat permanen dan tidak dapat dihapus.`,
      'FINANCIAL_IMMUTABILITY_VIOLATION',
      403,
    );
  }
}

export class BillingStoreAccessDeniedError extends BillingError {
  constructor(message = 'Akses ditolak: Operasi di luar batas otoritas toko Anda.') {
    super(message, 'BILLING_ACCESS_DENIED', 403);
  }
}

export class ProvisioningError extends BillingError {
  constructor(message: string) {
    super(message, 'PROVISIONING_ERROR', 500);
  }
}

export class ProvisioningAlreadyCompletedError extends BillingError {
  constructor(storeId: string) {
    super(
      `Proses provisioning untuk toko ${storeId} sudah selesai sebelumnya.`,
      'PROVISIONING_ALREADY_COMPLETED',
      409,
    );
  }
}

export class OnboardingError extends BillingError {
  constructor(message: string) {
    super(message, 'ONBOARDING_ERROR', 400);
  }
}

export class OnboardingSessionNotFoundError extends BillingError {
  constructor(sessionId: string) {
    super(`Sesi onboarding tidak ditemukan: ${sessionId}`, 'ONBOARDING_SESSION_NOT_FOUND', 404);
  }
}

export class OnboardingInvalidStateTransitionError extends BillingError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Transisi status onboarding tidak valid: ${fromStatus} -> ${toStatus}`,
      'ONBOARDING_INVALID_STATE_TRANSITION',
      422,
    );
  }
}
