import { describe, it, expect } from 'vitest';
import {
  ApplicationError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../src/errors.js';

describe('ApplicationError Hierarchy', () => {
  it('instantiates base ApplicationError with defaults', () => {
    const error = new ApplicationError('Generic failure');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.message).toBe('Generic failure');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('instantiates NotFoundError with 404 status code', () => {
    const error = new NotFoundError('Item missing', { id: '123' });
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ id: '123' });
  });

  it('instantiates ValidationError with 400 status code', () => {
    const error = new ValidationError('Invalid email');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.statusCode).toBe(400);
  });

  it('instantiates UnauthorizedError and ForbiddenError with expected codes', () => {
    const unauth = new UnauthorizedError();
    const forbidden = new ForbiddenError();
    expect(unauth.statusCode).toBe(401);
    expect(unauth.code).toBe('UNAUTHORIZED');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.code).toBe('FORBIDDEN');
  });

  it('instantiates ConflictError with 409 status code', () => {
    const conflict = new ConflictError('Record already exists');
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe('CONFLICT');
  });
});
