/**
 * Bintang Tech Studio — Platform Audit & Activity Logging Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements strict append-only audit trail for all privileged platform actions.
 * Enforces automatic secret scrubbing / sanitization (zero token/credential leakage).
 */

import {
  PlatformAuditLog,
  AuditLogFilter,
  PlatformCaller,
  AuditActionType,
  AuditResult,
} from '../types.js';
import { PlatformAuditLogRepository } from './interfaces.js';

export interface LogActionParams {
  readonly caller: PlatformCaller;
  readonly action: AuditActionType | string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly storeId?: string | null | undefined;
  readonly details?: Record<string, unknown> | undefined;
  readonly result: AuditResult;
  readonly errorMessage?: string | null | undefined;
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /credential/i,
  /api[_-]?key/i,
  /auth/i,
  /private/i,
];

export class PlatformAuditService {
  constructor(private readonly repository: PlatformAuditLogRepository) {}

  /**
   * Appends an audit log record with automatic credential sanitization.
   */
  public async logAction(params: LogActionParams): Promise<PlatformAuditLog> {
    const sanitizedDetails = this.sanitizeDetails(params.details || {});

    const log: PlatformAuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      actorUserId: params.caller.userId,
      actorEmail: params.caller.email,
      platformRole: params.caller.platformRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      storeId: params.storeId || null,
      details: sanitizedDetails,
      result: params.result,
      errorMessage: params.errorMessage || null,
      ipAddress: params.caller.ipAddress || null,
      userAgent: params.caller.userAgent || null,
      requestId: params.caller.requestId || null,
      timestamp: new Date().toISOString(),
    };

    return this.repository.append(log);
  }

  /**
   * Queries audit logs with filtering.
   */
  public async listLogs(filter?: AuditLogFilter): Promise<readonly PlatformAuditLog[]> {
    return this.repository.list(filter);
  }

  /**
   * Strips sensitive secrets, tokens, and credentials from details payload.
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(details)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(key));
      if (isSensitive) {
        sanitized[key] = '[REDACTED_SECRET]';
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        sanitized[key] = this.sanitizeDetails(val as Record<string, unknown>);
      } else {
        sanitized[key] = val;
      }
    }

    return sanitized;
  }
}
