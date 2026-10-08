import { ValidationError } from '@bintang/shared';

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Normalizes input value to authoritative 2-decimal string (e.g. "50000.00").
 */
export function normalizeMoney(value: string | number, fieldName = 'amount'): string {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`);
  }

  let strVal: string;
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
      throw new ValidationError(`${fieldName} must be a valid non-negative number`);
    }
    strVal = value.toFixed(2);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || !MONEY_REGEX.test(trimmed)) {
      throw new ValidationError(
        `${fieldName} must be a valid non-negative numeric string (e.g. "50000" or "50000.00")`,
      );
    }
    const num = Number.parseFloat(trimmed);
    if (Number.isNaN(num) || num < 0) {
      throw new ValidationError(`${fieldName} must be non-negative`);
    }
    strVal = num.toFixed(2);
  } else {
    throw new ValidationError(`${fieldName} must be a string or number`);
  }

  return strVal;
}

/**
 * Multiplies an authoritative 2-decimal unit price by an integer quantity.
 * Eliminates floating-point rounding errors by operating in integer cents.
 */
export function multiplyMoney(price: string | number, quantity: number): string {
  const normalizedPrice = normalizeMoney(price, 'price');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError('Quantity must be a positive integer');
  }

  const cents = Math.round(Number.parseFloat(normalizedPrice) * 100);
  const totalCents = cents * quantity;
  return (totalCents / 100).toFixed(2);
}

/**
 * Adds two authoritative 2-decimal money strings.
 */
export function addMoney(a: string | number, b: string | number): string {
  const normA = normalizeMoney(a, 'amount A');
  const normB = normalizeMoney(b, 'amount B');

  const centsA = Math.round(Number.parseFloat(normA) * 100);
  const centsB = Math.round(Number.parseFloat(normB) * 100);
  return ((centsA + centsB) / 100).toFixed(2);
}

/**
 * Subtracts money amount B from amount A.
 * Fails if result would be negative.
 */
export function subtractMoney(a: string | number, b: string | number): string {
  const normA = normalizeMoney(a, 'amount A');
  const normB = normalizeMoney(b, 'amount B');

  const centsA = Math.round(Number.parseFloat(normA) * 100);
  const centsB = Math.round(Number.parseFloat(normB) * 100);

  const diff = centsA - centsB;
  if (diff < 0) {
    throw new ValidationError('Resulting monetary amount cannot be negative');
  }
  return (diff / 100).toFixed(2);
}
