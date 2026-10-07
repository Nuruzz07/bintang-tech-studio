import { describe, it, expect } from 'vitest';
import { createStoreContext } from '../src/context.js';
import { ValidationError } from '@bintang/shared';

describe('StoreContext Contract', () => {
  it('creates an immutable StoreContext with required storeId', () => {
    const ctx = createStoreContext({
      storeId: 'store_123',
      tenantSlug: 'bintang-digital',
      userId: 'user_456',
      role: 'owner',
    });

    expect(ctx.storeId).toBe('store_123');
    expect(ctx.tenantSlug).toBe('bintang-digital');
    expect(ctx.userId).toBe('user_456');
    expect(ctx.role).toBe('owner');
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('trims whitespace from context identifiers', () => {
    const ctx = createStoreContext({
      storeId: '  store_abc  ',
      requestId: '  req_xyz  ',
    });

    expect(ctx.storeId).toBe('store_abc');
    expect(ctx.requestId).toBe('req_xyz');
  });

  it('throws ValidationError if storeId is missing or empty', () => {
    expect(() => createStoreContext({ storeId: '' })).toThrow(ValidationError);
    expect(() => createStoreContext({ storeId: '   ' })).toThrow(ValidationError);
    // @ts-expect-error Testing runtime invalid input
    expect(() => createStoreContext({})).toThrow(ValidationError);
  });
});
