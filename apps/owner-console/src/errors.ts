/**
 * Bintang Tech Studio — Platform Owner Console Typed Errors Hierarchy.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

export class OwnerConsoleError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'OWNER_CONSOLE_ERROR', statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PlatformAccessDeniedError extends OwnerConsoleError {
  constructor(
    message = 'Akses ditolak: Anda tidak memiliki hak akses administratif ke Bintang Tech Owner Console.',
  ) {
    super(message, 'PLATFORM_ACCESS_DENIED', 403);
  }
}

export class PlatformOwnerPrivilegeRequiredError extends OwnerConsoleError {
  constructor(
    action = 'Operasi ini',
    message = `${action} hanya dapat dilakukan oleh pengguna dengan peran PLATFORM_OWNER.`,
  ) {
    super(message, 'PLATFORM_OWNER_REQUIRED', 403);
  }
}

export class SelfRoleMutationError extends OwnerConsoleError {
  constructor(
    message = 'Tidak diizinkan mengubah peran platform akun sendiri (Self-promotion / self-mutation rejected).',
  ) {
    super(message, 'SELF_ROLE_MUTATION_REJECTED', 400);
  }
}

export class LastPlatformOwnerDemotionError extends OwnerConsoleError {
  constructor(
    message = 'Tidak dapat mendemosi atau mencabut peran PLATFORM_OWNER terakhir pada sistem.',
  ) {
    super(message, 'LAST_PLATFORM_OWNER_PROTECTION', 400);
  }
}

export class PlatformStoreNotFoundError extends OwnerConsoleError {
  constructor(storeId: string) {
    super(`Toko dengan ID "${storeId}" tidak ditemukan pada platform.`, 'STORE_NOT_FOUND', 404);
  }
}

export class PlatformUserNotFoundError extends OwnerConsoleError {
  constructor(userId: string) {
    super(`Pengguna dengan ID "${userId}" tidak ditemukan pada platform.`, 'USER_NOT_FOUND', 404);
  }
}

export class PlatformTicketNotFoundError extends OwnerConsoleError {
  constructor(ticketId: string) {
    super(`Tiket support dengan ID "${ticketId}" tidak ditemukan.`, 'TICKET_NOT_FOUND', 404);
  }
}

export class PlatformPolicyNotFoundError extends OwnerConsoleError {
  constructor(policyKey: string) {
    super(`Kebijakan platform "${policyKey}" tidak ditemukan.`, 'POLICY_NOT_FOUND', 404);
  }
}

export class InvalidStoreLifecycleTransitionError extends OwnerConsoleError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Transisi siklus hidup toko tidak valid: dari "${fromStatus}" ke "${toStatus}".`,
      'INVALID_STORE_LIFECYCLE_TRANSITION',
      400,
    );
  }
}
