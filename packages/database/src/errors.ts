import { ApplicationError, NotFoundError, ValidationError, ConflictError } from '@bintang/shared';

export class DatabaseError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

export class DatabaseConnectionError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_CONNECTION_ERROR', 503, details);
  }
}

export class RecordNotFoundError extends NotFoundError {
  constructor(entity: string, identifier: string) {
    super(`${entity} not found: ${identifier}`, { entity, identifier });
  }
}

export class UniqueConstraintError extends ConflictError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class InvariantViolationError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

/**
 * Helper to determine if an error is strictly an RPC-not-found / endpoint-not-mocked condition (404 PGRST202),
 * as opposed to an authoritative PostgreSQL database rejection or authorization error.
 */
export function isMissingRpcError(err: unknown): boolean {
  if (err instanceof DatabaseError) {
    const msg = err.message;
    return (
      msg.includes('404') &&
      (msg.includes('PGRST202') || msg.includes('Not Found') || msg.includes('not found'))
    );
  }
  return false;
}
