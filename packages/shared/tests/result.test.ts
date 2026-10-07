import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, map, mapErr, unwrap, unwrapOr } from '../src/result.js';

describe('Result Type', () => {
  it('creates a successful result with ok()', () => {
    const res = ok(42);
    expect(res.success).toBe(true);
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
    expect(res.value).toBe(42);
  });

  it('creates an error result with err()', () => {
    const errorObj = new Error('Something failed');
    const res = err(errorObj);
    expect(res.success).toBe(false);
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
    expect(res.error).toBe(errorObj);
  });

  it('transforms successful values via map()', () => {
    const res = ok(10);
    const mapped = map(res, (n) => n * 2);
    expect(unwrap(mapped)).toBe(20);
  });

  it('passes error unchanged when mapping with map()', () => {
    const errorObj = new Error('failure');
    const res = err(errorObj);
    const mapped = map(res, (n: number) => n * 2);
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe(errorObj);
    }
  });

  it('transforms error via mapErr()', () => {
    const res = err('original');
    const mapped = mapErr(res, (msg) => new Error(`Mapped: ${msg}`));
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error.message).toBe('Mapped: original');
    }
  });

  it('unwraps successful value or throws error', () => {
    expect(unwrap(ok('hello'))).toBe('hello');
    expect(() => unwrap(err(new Error('boom')))).toThrow('boom');
  });

  it('provides default value via unwrapOr() on failure', () => {
    expect(unwrapOr(ok('val'), 'fallback')).toBe('val');
    expect(unwrapOr(err(new Error('fail')), 'fallback')).toBe('fallback');
  });
});
