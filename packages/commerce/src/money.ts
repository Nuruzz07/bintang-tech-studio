import { InvalidProductDataError } from './errors.js';

/**
 * Money utilities for catalog pricing.
 * Authoritative persistence is NUMERIC(15,2).
 * Floating-point representation is strictly forbidden as source of truth.
 */

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Normalizes and validates a price input into an authoritative 2-decimal string (e.g. "50000.00").
 */
export function normalizeMoney(value: string | number, fieldName = 'price'): string {
  if (value === undefined || value === null) {
    throw new InvalidProductDataError(`${fieldName} is required`);
  }

  let strVal: string;
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
      throw new InvalidProductDataError(`${fieldName} must be a valid non-negative number`);
    }
    // Round to 2 decimal places deterministically
    strVal = value.toFixed(2);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || !MONEY_REGEX.test(trimmed)) {
      throw new InvalidProductDataError(
        `${fieldName} must be a valid non-negative numeric string (e.g. "50000" or "50000.00")`,
      );
    }
    const num = Number.parseFloat(trimmed);
    if (Number.isNaN(num) || num < 0) {
      throw new InvalidProductDataError(`${fieldName} must be non-negative`);
    }
    strVal = num.toFixed(2);
  } else {
    throw new InvalidProductDataError(`${fieldName} must be a string or number`);
  }

  return strVal;
}

/**
 * Compares two normalized money strings.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareMoney(a: string, b: string): number {
  const numA = Number.parseFloat(a);
  const numB = Number.parseFloat(b);
  if (numA < numB) return -1;
  if (numA > numB) return 1;
  return 0;
}
