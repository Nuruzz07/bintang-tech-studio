import { InvalidQuantityError, NegativeStockError, InventoryInvariantError } from './errors.js';

/**
 * Validates that an amount is a finite, non-negative integer.
 */
export function validateQuantity(quantity: number, fieldName = 'quantity'): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new InvalidQuantityError(`${fieldName} must be a valid number`);
  }
  if (!Number.isInteger(quantity)) {
    throw new InvalidQuantityError(`${fieldName} must be an integer`);
  }
  if (quantity < 0) {
    throw new NegativeStockError(`${fieldName} cannot be negative`);
  }
  return quantity;
}

/**
 * Validates that an amount is a strictly positive integer (> 0).
 */
export function validatePositiveAmount(amount: number, fieldName = 'amount'): number {
  const qty = validateQuantity(amount, fieldName);
  if (qty <= 0) {
    throw new InvalidQuantityError(`${fieldName} must be greater than zero`);
  }
  return qty;
}

/**
 * Verifies core inventory invariants:
 * 1. quantityOnHand >= 0
 * 2. quantityReserved >= 0
 * 3. quantityReserved <= quantityOnHand
 */
export function validateInventoryInvariants(
  quantityOnHand: number,
  quantityReserved: number,
): void {
  if (quantityOnHand < 0) {
    throw new NegativeStockError(`quantityOnHand cannot be negative (received: ${quantityOnHand})`);
  }
  if (quantityReserved < 0) {
    throw new NegativeStockError(
      `quantityReserved cannot be negative (received: ${quantityReserved})`,
    );
  }
  if (quantityReserved > quantityOnHand) {
    throw new InventoryInvariantError(
      `quantityReserved (${quantityReserved}) cannot exceed quantityOnHand (${quantityOnHand})`,
      { quantityOnHand, quantityReserved },
    );
  }
}

/**
 * Generates an RFC4122 version 4 UUID string.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
