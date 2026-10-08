/**
 * Bintang Tech Studio — Telegram Channel Engine Error Domain.
 * Baseline: Milestone M11 Telegram Engine.
 */

export class TelegramEngineError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'TELEGRAM_ENGINE_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TelegramBotNotFoundError extends TelegramEngineError {
  constructor(botId: string) {
    super(`Telegram bot not found or unmapped: ${botId}`, 'BOT_NOT_FOUND');
  }
}

export class TelegramBotInactiveError extends TelegramEngineError {
  constructor(botId: string, status: string) {
    super(`Telegram bot ${botId} is not active (status: ${status})`, 'BOT_INACTIVE');
  }
}

export class TelegramStoreMismatchError extends TelegramEngineError {
  constructor(message: string = 'Telegram bot does not match targeted store context') {
    super(message, 'STORE_MISMATCH');
  }
}

export class TelegramInvalidUpdateError extends TelegramEngineError {
  constructor(message: string = 'Invalid or malformed Telegram update payload') {
    super(message, 'INVALID_UPDATE');
  }
}

export class TelegramDuplicateUpdateError extends TelegramEngineError {
  constructor(botId: string, updateId: number) {
    super(`Duplicate Telegram update ignored: ${botId}:${updateId}`, 'DUPLICATE_UPDATE');
  }
}

export class TelegramCustomerAccessDeniedError extends TelegramEngineError {
  constructor(message: string = 'Akses tidak tersedia untuk pelanggan ini.') {
    super(message, 'CUSTOMER_ACCESS_DENIED');
  }
}

export class TelegramSellerAccessDeniedError extends TelegramEngineError {
  constructor(message: string = 'Akses ditolak: Operasi membutuhkan otorisasi penjual/staff.') {
    super(message, 'SELLER_ACCESS_DENIED');
  }
}

export class TelegramCommandUnknownError extends TelegramEngineError {
  constructor(command: string) {
    super(`Perintah tidak dikenali: ${command}`, 'COMMAND_UNKNOWN');
  }
}

export class TelegramCallbackMalformedError extends TelegramEngineError {
  constructor(message: string = 'Format data callback tidak valid.') {
    super(message, 'CALLBACK_MALFORMED');
  }
}

export class TelegramResourceNotFoundError extends TelegramEngineError {
  constructor(message: string = 'Data yang diminta tidak ditemukan.') {
    super(message, 'RESOURCE_NOT_FOUND');
  }
}

export class TelegramRateLimitError extends TelegramEngineError {
  constructor(message: string = 'Batas pengiriman pesan terlampaui. Silakan coba sesaat lagi.') {
    super(message, 'RATE_LIMIT_EXCEEDED');
  }
}

export class TelegramAdapterError extends TelegramEngineError {
  constructor(message: string, code: string = 'ADAPTER_ERROR') {
    super(message, code);
  }
}
