/**
 * Bintang Tech Studio — Exact Decimal Money Helpers for Billing.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Implements strict integer cent arithmetic to guarantee zero floating point drift.
 */

import { BillingError } from './errors.js';

export function normalizeMoney(value: number | string, fieldName = 'amount'): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new BillingError(`${fieldName} must be a finite number`);
    }
    if (value < 0) {
      throw new BillingError(`${fieldName} cannot be negative`);
    }
    const cents = Math.round(value * 100);
    const whole = Math.floor(cents / 100);
    const fraction = cents % 100;
    return `${whole}.${String(fraction).padStart(2, '0')}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new BillingError(
        `${fieldName} must be a valid positive decimal string with up to 2 decimal places (got "${value}")`,
      );
    }
    const parts = trimmed.split('.');
    const whole = parts[0]!;
    const fraction = (parts[1] ?? '').padEnd(2, '0').slice(0, 2);
    return `${whole}.${fraction}`;
  }

  throw new BillingError(`${fieldName} must be a number or numeric string`);
}

function moneyToCents(amountStr: string): number {
  const parts = amountStr.split('.');
  const whole = parseInt(parts[0]!, 10);
  const fraction = parseInt(parts[1]!, 10);
  return whole * 100 + fraction;
}

function centsToMoney(cents: number): string {
  if (cents < 0) {
    throw new BillingError('Money calculation resulted in negative amount');
  }
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

export function addMoney(a: string, b: string): string {
  const centsA = moneyToCents(normalizeMoney(a));
  const centsB = moneyToCents(normalizeMoney(b));
  return centsToMoney(centsA + centsB);
}

export function subtractMoney(a: string, b: string): string {
  const centsA = moneyToCents(normalizeMoney(a));
  const centsB = moneyToCents(normalizeMoney(b));
  if (centsA < centsB) {
    throw new BillingError('Subtraction resulted in negative money amount');
  }
  return centsToMoney(centsA - centsB);
}

export function multiplyMoney(amountStr: string, multiplier: number): string {
  if (multiplier < 0) {
    throw new BillingError('Multiplier cannot be negative');
  }
  const cents = moneyToCents(normalizeMoney(amountStr));
  const totalCents = Math.round(cents * multiplier);
  return centsToMoney(totalCents);
}

export function compareMoney(a: string, b: string): number {
  const centsA = moneyToCents(normalizeMoney(a));
  const centsB = moneyToCents(normalizeMoney(b));
  if (centsA < centsB) return -1;
  if (centsA > centsB) return 1;
  return 0;
}

export function formatCurrency(amountStr: string, currency = 'IDR'): string {
  const normalized = normalizeMoney(amountStr);
  const whole = normalized.split('.')[0]!;
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (currency === 'IDR') {
    return `Rp ${formattedWhole}`;
  }
  return `${currency} ${formattedWhole}`;
}
