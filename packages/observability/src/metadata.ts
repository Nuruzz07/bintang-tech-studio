import { ValidationError } from '@bintang/shared';

/**
 * Structured telemetry context mandatory for distributed tracing and audit logs.
 */
export interface ObservabilityContext {
  readonly requestId: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly storeId?: string;
  readonly actorUserId?: string;
  readonly timestamp: string;
}

export interface ObservabilityContextInput {
  readonly requestId: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly storeId?: string;
  readonly actorUserId?: string;
  readonly timestamp?: string;
}

/**
 * Validates and instantiates an immutable ObservabilityContext.
 */
export function createObservabilityContext(input: ObservabilityContextInput): ObservabilityContext {
  const normalizedRequestId = input.requestId?.trim();
  if (!normalizedRequestId) {
    throw new ValidationError('ObservabilityContext requires a non-empty requestId');
  }

  return Object.freeze({
    requestId: normalizedRequestId,
    ...(input.correlationId ? { correlationId: input.correlationId.trim() } : {}),
    ...(input.causationId ? { causationId: input.causationId.trim() } : {}),
    ...(input.storeId ? { storeId: input.storeId.trim() } : {}),
    ...(input.actorUserId ? { actorUserId: input.actorUserId.trim() } : {}),
    timestamp: input.timestamp ? input.timestamp.trim() : new Date().toISOString(),
  });
}

const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'pin',
  'apikey',
  'api_key',
  'authorization',
  'credit_card',
  'cvv',
]);

/**
 * Redacts sensitive fields in payloads before logging to enforce PII/secret minimization.
 */
export function maskSensitiveData(
  data: Record<string, unknown>,
  customSensitiveKeys?: string[],
): Record<string, unknown> {
  const sensitiveKeys = customSensitiveKeys
    ? new Set([...DEFAULT_SENSITIVE_KEYS, ...customSensitiveKeys.map((k) => k.toLowerCase())])
    : DEFAULT_SENSITIVE_KEYS;

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = maskSensitiveData(val as Record<string, unknown>, customSensitiveKeys);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
