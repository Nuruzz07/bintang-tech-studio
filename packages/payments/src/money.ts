import { PaymentError } from './errors.js';

/**
 * Normalizes a number, integer, or numeric string to a strict 2-decimal string.
 * Uses integer cent arithmetic to avoid floating-point inaccuracies.
 */
export function normalizeMoney(value: number | string, fieldName = 'amount'): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new PaymentError(`${fieldName} must be a finite number`);
    }
    if (value < 0) {
      throw new PaymentError(`${fieldName} cannot be negative`);
    }
    const cents = Math.round(value * 100);
    const whole = Math.floor(cents / 100);
    const fraction = cents % 100;
    return `${whole}.${String(fraction).padStart(2, '0')}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new PaymentError(
        `${fieldName} must be a valid positive decimal string with up to 2 decimal places (got "${value}")`,
      );
    }
    const parts = trimmed.split('.');
    const whole = parts[0]!;
    const fraction = (parts[1] ?? '').padEnd(2, '0').slice(0, 2);
    return `${whole}.${fraction}`;
  }

  throw new PaymentError(`${fieldName} must be a number or numeric string`);
}

/**
 * Multiplies a 2-decimal normalized money string by a positive integer.
 */
export function multiplyMoney(amountStr: string, multiplier: number): string {
  const normalized = normalizeMoney(amountStr);
  const cents = moneyToCents(normalized);
  const totalCents = cents * multiplier;
  return centsToMoney(totalCents);
}

/**
 * Adds two 2-decimal money strings.
 */
export function addMoney(a: string, b: string): string {
  const centsA = moneyToCents(normalizeMoney(a));
  const centsB = moneyToCents(normalizeMoney(b));
  return centsToMoney(centsA + centsB);
}

/**
 * Subtracts money string b from a.
 * Throws PaymentError if result is negative.
 */
export function subtractMoney(a: string, b: string): string {
  const centsA = moneyToCents(normalizeMoney(a));
  const centsB = moneyToCents(normalizeMoney(b));
  const resultCents = centsA - centsB;
  if (resultCents < 0) {
    throw new PaymentError(`Subtraction result cannot be negative (${a} - ${b})`);
  }
  return centsToMoney(resultCents);
}

/**
 * Compares two money strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
export function compareMoney(a: string, b: string): number {
  const centsA = moneyToCents(normalizeMoney(a));
  const centsB = moneyToCents(normalizeMoney(b));
  if (centsA < centsB) return -1;
  if (centsA > centsB) return 1;
  return 0;
}

function moneyToCents(normalized: string): number {
  const parts = normalized.split('.');
  const whole = parseInt(parts[0]!, 10);
  const fraction = parseInt(parts[1]!, 10);
  return whole * 100 + fraction;
}

function centsToMoney(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}
