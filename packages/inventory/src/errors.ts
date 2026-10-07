import {
  ApplicationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '@bintang/shared';

/**
 * Base Inventory Error.
 */
export class InventoryError extends ApplicationError {
  constructor(message: string, code = 'INVENTORY_ERROR', statusCode = 400, details?: unknown) {
    super(message, code, statusCode, details);
  }
}

export class InventoryNotFoundError extends NotFoundError {
  constructor(productIdOrInventoryId: string) {
    super(`Inventory record not found for product: ${productIdOrInventoryId}`, {
      resource: productIdOrInventoryId,
    });
  }
}

export class InsufficientStockError extends ConflictError {
  constructor(requested: number, available: number, productId?: string) {
    super(`Insufficient available stock (requested: ${requested}, available: ${available})`, {
      requested,
      available,
      productId,
    });
  }
}

export class InvalidQuantityError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class NegativeStockError extends ValidationError {
  constructor(message = 'Stock quantity cannot be negative', details?: unknown) {
    super(message, details);
  }
}

export class ReservationNotFoundError extends NotFoundError {
  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`, { reservationId });
  }
}

export class InvalidReservationError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class CrossTenantInventoryError extends ForbiddenError {
  constructor(
    message = 'Inventory resource does not belong to the current store or does not exist',
  ) {
    super(message);
  }
}

export class UnsupportedStockModeError extends ValidationError {
  constructor(stockMode: string, operation: string) {
    super(`Operation "${operation}" is not supported for stockMode "${stockMode}"`, {
      stockMode,
      operation,
    });
  }
}

export class InventoryInvariantError extends ConflictError {
  constructor(message: string, details?: unknown) {
    super(`Inventory invariant violation: ${message}`, details);
  }
}
