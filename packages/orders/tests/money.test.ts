import { describe, it, expect } from 'vitest';
import { normalizeMoney, multiplyMoney, addMoney, subtractMoney } from '../src/money.js';

describe('M07 Money & Financial Calculations Suite', () => {
  it('normalizes integer number to 2-decimal string', () => {
    expect(normalizeMoney(50000)).toBe('50000.00');
    expect(normalizeMoney(0)).toBe('0.00');
  });

  it('normalizes decimal numbers correctly', () => {
    expect(normalizeMoney(1234.5)).toBe('1234.50');
    expect(normalizeMoney(1234.56)).toBe('1234.56');
  });

  it('normalizes formatted string values', () => {
    expect(normalizeMoney('50000')).toBe('50000.00');
    expect(normalizeMoney('50000.5')).toBe('50000.50');
    expect(normalizeMoney('50000.00')).toBe('50000.00');
  });

  it('rejects negative numbers or strings', () => {
    expect(() => normalizeMoney(-100)).toThrow();
    expect(() => normalizeMoney('-50.00')).toThrow();
  });

  it('rejects invalid or non-numeric inputs', () => {
    expect(() => normalizeMoney(NaN)).toThrow();
    expect(() => normalizeMoney(Infinity)).toThrow();
    expect(() => normalizeMoney('abc')).toThrow();
    expect(() => normalizeMoney('10.999')).toThrow(); // More than 2 decimals
  });

  it('multiplies price by integer quantity accurately without float errors', () => {
    expect(multiplyMoney('50000.00', 3)).toBe('150000.00');
    expect(multiplyMoney(33333.33, 3)).toBe('99999.99'); // 33333.33 * 3 = 99999.99
    expect(multiplyMoney('0.10', 3)).toBe('0.30'); // 0.10 * 3 = 0.30, avoids 0.30000000000000004
  });

  it('rejects non-integer or non-positive quantity in multiplyMoney', () => {
    expect(() => multiplyMoney('50000.00', 0)).toThrow();
    expect(() => multiplyMoney('50000.00', -1)).toThrow();
    expect(() => multiplyMoney('50000.00', 1.5)).toThrow();
  });

  it('adds money values accurately', () => {
    expect(addMoney('50000.00', '25000.00')).toBe('75000.00');
    expect(addMoney('0.10', '0.20')).toBe('0.30');
    expect(addMoney(100, 250)).toBe('350.00');
  });

  it('subtracts money values accurately', () => {
    expect(subtractMoney('100000.00', '35000.00')).toBe('65000.00');
    expect(subtractMoney('50000.00', '50000.00')).toBe('0.00');
  });

  it('rejects subtraction resulting in negative amount', () => {
    expect(() => subtractMoney('20000.00', '30000.00')).toThrow(
      'Resulting monetary amount cannot be negative',
    );
  });
});
