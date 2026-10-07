/**
 * Bintang Tech Studio — Explicit Authorization Decision Contract.
 * Baseline: Master Blueprint v3.0 / Milestone M04.
 */

export type DecisionReason =
  | 'ALLOW'
  | 'DENY_UNAUTHENTICATED'
  | 'DENY_NO_STORE_CONTEXT'
  | 'DENY_STORE_NOT_FOUND'
  | 'DENY_MEMBERSHIP_INACTIVE'
  | 'DENY_ROLE'
  | 'DENY_PERMISSION'
  | 'DENY_ENTITLEMENT'
  | 'DENY_PLATFORM_SCOPE'
  | 'DENY_SCOPE_MISMATCH';

export interface AuthorizationDecisionContext {
  readonly storeId?: string | undefined;
  readonly userId?: string | undefined;
  readonly role?: string | undefined;
  readonly permission?: string | undefined;
  readonly entitlementKey?: string | undefined;
}

/**
 * Strongly-typed authorization evaluation result.
 */
export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: DecisionReason;
  readonly message?: string | undefined;
  readonly context?: AuthorizationDecisionContext | undefined;
}

/**
 * Creates an ALLOW authorization decision.
 */
export function allow(
  message = 'Action authorized',
  context?: AuthorizationDecisionContext | undefined,
): AuthorizationDecision {
  return Object.freeze({
    allowed: true,
    reason: 'ALLOW',
    message,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}

/**
 * Creates a DENY authorization decision with an explicit reason.
 */
export function deny(
  reason: Exclude<DecisionReason, 'ALLOW'>,
  message: string,
  context?: AuthorizationDecisionContext | undefined,
): AuthorizationDecision {
  return Object.freeze({
    allowed: false,
    reason,
    message,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}
