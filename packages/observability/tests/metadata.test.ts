import { describe, it, expect } from 'vitest';
import { createObservabilityContext, maskSensitiveData } from '../src/metadata.js';
import { ValidationError } from '@bintang/shared';

describe('ObservabilityContext Contract', () => {
  it('creates an immutable ObservabilityContext', () => {
    const ctx = createObservabilityContext({
      requestId: 'req_123',
      correlationId: 'corr_456',
      storeId: 'store_789',
      actorUserId: 'user_001',
    });

    expect(ctx.requestId).toBe('req_123');
    expect(ctx.correlationId).toBe('corr_456');
    expect(ctx.storeId).toBe('store_789');
    expect(ctx.actorUserId).toBe('user_001');
    expect(ctx.timestamp).toBeDefined();
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('throws ValidationError if requestId is missing or blank', () => {
    expect(() => createObservabilityContext({ requestId: '' })).toThrow(ValidationError);
    expect(() => createObservabilityContext({ requestId: '   ' })).toThrow(ValidationError);
    // @ts-expect-error Testing invalid runtime input
    expect(() => createObservabilityContext({})).toThrow(ValidationError);
  });
});

describe('maskSensitiveData utility', () => {
  it('masks sensitive fields including password, token, pin', () => {
    const input = {
      user: 'john_doe',
      password: 'supersecretpassword',
      token: 'bot12345:ABCDEF',
      pin: '123456',
      metadata: {
        amount: 50000,
        apiKey: 'secret_live_key',
      },
    };

    const sanitized = maskSensitiveData(input);

    expect(sanitized['user']).toBe('john_doe');
    expect(sanitized['password']).toBe('[REDACTED]');
    expect(sanitized['token']).toBe('[REDACTED]');
    expect(sanitized['pin']).toBe('[REDACTED]');

    const meta = sanitized['metadata'] as Record<string, unknown>;
    expect(meta['amount']).toBe(50000);
    expect(meta['apiKey']).toBe('[REDACTED]');
  });
});
