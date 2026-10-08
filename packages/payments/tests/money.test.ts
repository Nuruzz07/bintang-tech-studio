import { describe, it, expect } from 'vitest';
import {
  normalizeMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  compareMoney,
} from '../src/money.js';
import { PaymentError } from '../src/errors.js';
import { validatePositiveAmount } from '../src/validation.js';

describe('M08 Deterministic Financial Arithmetic & Money Suite', () => {
  describe('normalizeMoney', () => {
    it('normalizes integer numbers to 2 decimal places', () => {
      expect(normalizeMoney(100)).toBe('100.00');
      expect(normalizeMoney(0)).toBe('0.00');
      expect(normalizeMoney(150000)).toBe('150000.00');
    });

    it('normalizes floating point numbers rounding to nearest cent', () => {
      expect(normalizeMoney(10.5)).toBe('10.50');
      expect(normalizeMoney(10.555)).toBe('10.56');
      expect(normalizeMoney(10.554)).toBe('10.55');
    });

    it('normalizes valid string formats', () => {
      expect(normalizeMoney('100')).toBe('100.00');
      expect(normalizeMoney('100.5')).toBe('100.50');
      expect(normalizeMoney('100.50')).toBe('100.50');
      expect(normalizeMoney('0')).toBe('0.00');
    });

    it('STRICTLY rejects invalid formats and non-numeric strings', () => {
      expect(() => normalizeMoney('abc')).toThrow(PaymentError);
      expect(() => normalizeMoney('-100')).toThrow(PaymentError);
      expect(() => normalizeMoney('100.123')).toThrow(PaymentError);
      expect(() => normalizeMoney(NaN)).toThrow(PaymentError);
      expect(() => normalizeMoney(Infinity)).toThrow(PaymentError);
      expect(() => normalizeMoney(-50)).toThrow(PaymentError);
    });
  });

  describe('addMoney', () => {
    it('accurately adds amounts avoiding floating point errors', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754
      expect(addMoney('0.10', '0.20')).toBe('0.30');
      expect(addMoney('10000.50', '25000.75')).toBe('35001.25');
      expect(addMoney('0.00', '150.00')).toBe('150.00');
    });
  });

  describe('subtractMoney', () => {
    it('accurately subtracts amounts', () => {
      expect(subtractMoney('100.00', '40.00')).toBe('60.00');
      expect(subtractMoney('35001.25', '25000.75')).toBe('10000.50');
      expect(subtractMoney('50.00', '50.00')).toBe('0.00');
    });

    it('STRICTLY rejects subtraction resulting in negative balance', () => {
      expect(() => subtractMoney('50.00', '60.00')).toThrow(PaymentError);
    });
  });

  describe('multiplyMoney', () => {
    it('accurately multiplies money by integer multiplier', () => {
      expect(multiplyMoney('25000.00', 3)).toBe('75000.00');
      expect(multiplyMoney('12.34', 5)).toBe('61.70');
      expect(multiplyMoney('100.00', 0)).toBe('0.00');
    });
  });

  describe('compareMoney', () => {
    it('correctly orders money amounts', () => {
      expect(compareMoney('100.00', '200.00')).toBe(-1);
      expect(compareMoney('200.00', '100.00')).toBe(1);
      expect(compareMoney('150.50', '150.50')).toBe(0);
      expect(compareMoney('0.00', '0.00')).toBe(0);
    });
  });

  describe('validatePositiveAmount', () => {
    it('accepts strictly positive amounts', () => {
      expect(validatePositiveAmount('10.00')).toBe('10.00');
      expect(validatePositiveAmount(500)).toBe('500.00');
    });

    it('rejects zero amounts', () => {
      expect(() => validatePositiveAmount('0.00')).toThrow(PaymentError);
      expect(() => validatePositiveAmount(0)).toThrow(PaymentError);
    });
  });
});
