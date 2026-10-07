import {
  AuthenticatedStoreContext,
  StoreContext,
  PlatformContext,
  StoreRole,
  STORE_ROLES,
} from '@bintang/tenancy';
import { StorePermission, PlatformPermission } from './permissions.js';
import { hasStorePermission, hasPlatformPermission } from './policy.js';
import { EntitlementResolver, InMemoryEntitlementResolver } from './entitlements.js';
import { AuthorizationDecision, allow, deny } from './decision.js';
import {
  PermissionDeniedError,
  EntitlementDeniedError,
  ScopeMismatchError,
  UnauthenticatedError,
  InvalidAuthorizationContextError,
  AuthorizationError,
} from './errors.js';

export interface AuthorizeStoreActionRequest {
  readonly context: AuthenticatedStoreContext | StoreContext | null | undefined;
  readonly permission: StorePermission;
  readonly targetStoreId?: string | undefined;
  readonly requiredEntitlement?: string | undefined;
  readonly limitCheck?:
    | {
        readonly key: string;
        readonly currentCount: number;
      }
    | undefined;
}

export interface AuthorizePlatformActionRequest {
  readonly context: PlatformContext | null | undefined;
  readonly permission: PlatformPermission;
}

/**
 * Centralized Authorization Service evaluating tenant and platform operations.
 *
 * Enforces canonical principles:
 * - Role != Permission != Entitlement
 * - Authorization is tenant-aware
 * - Client parameters never override authenticated context
 * - Platform and Store domains are strictly separated
 */
export class AuthorizationService {
  constructor(
    private readonly entitlementResolver: EntitlementResolver = new InMemoryEntitlementResolver(),
  ) {}

  /**
   * Evaluates store-scoped action authorization.
   */
  async authorizeStoreAction(request: AuthorizeStoreActionRequest): Promise<AuthorizationDecision> {
    const ctx = request.context;

    // 1. Context & Authentication Verification
    if (!ctx || !ctx.userId) {
      return deny('DENY_UNAUTHENTICATED', 'Authentication required for store action');
    }

    if (!ctx.storeId) {
      return deny('DENY_NO_STORE_CONTEXT', 'StoreContext is missing storeId');
    }

    if (!ctx.role) {
      return deny('DENY_ROLE', 'StoreContext is missing role');
    }

    const role = ctx.role as StoreRole;
    if (!STORE_ROLES.includes(role)) {
      return deny('DENY_ROLE', `Invalid or unrecognized store role: ${ctx.role}`);
    }

    // 2. Cross-Tenant Scope Defense: Ensure target store matches authenticated context
    if (request.targetStoreId && request.targetStoreId !== ctx.storeId) {
      return deny(
        'DENY_SCOPE_MISMATCH',
        `Target store (${request.targetStoreId}) does not match authenticated StoreContext (${ctx.storeId})`,
        { storeId: ctx.storeId, userId: ctx.userId },
      );
    }

    // 3. Permission Evaluation (Role -> Permission)
    const hasPerm = hasStorePermission(role, request.permission);
    if (!hasPerm) {
      return deny(
        'DENY_PERMISSION',
        `Role ${role} is not granted permission: ${request.permission}`,
        {
          storeId: ctx.storeId,
          userId: ctx.userId,
          role,
          permission: request.permission,
        },
      );
    }

    // 4. Entitlement Evaluation (Role != Entitlement)
    if (request.requiredEntitlement) {
      const entitled = await this.entitlementResolver.hasFeature(
        ctx.storeId,
        request.requiredEntitlement,
      );
      if (!entitled) {
        return deny(
          'DENY_ENTITLEMENT',
          `Store is not entitled to feature: ${request.requiredEntitlement}`,
          {
            storeId: ctx.storeId,
            userId: ctx.userId,
            role,
            permission: request.permission,
            entitlementKey: request.requiredEntitlement,
          },
        );
      }
    }

    // 5. Numeric Limit Entitlement Check
    if (request.limitCheck) {
      const limit = await this.entitlementResolver.getLimit(ctx.storeId, request.limitCheck.key);
      if (request.limitCheck.currentCount >= limit) {
        return deny(
          'DENY_ENTITLEMENT',
          `Store has reached maximum limit for ${request.limitCheck.key} (current: ${request.limitCheck.currentCount}, limit: ${limit})`,
          {
            storeId: ctx.storeId,
            userId: ctx.userId,
            role,
            permission: request.permission,
            entitlementKey: request.limitCheck.key,
          },
        );
      }
    }

    // 6. Action is Fully Authorized
    return allow('Store action authorized', {
      storeId: ctx.storeId,
      userId: ctx.userId,
      role,
      permission: request.permission,
    });
  }

  /**
   * Evaluates platform-scoped action authorization.
   */
  async authorizePlatformAction(
    request: AuthorizePlatformActionRequest,
  ): Promise<AuthorizationDecision> {
    const ctx = request.context;

    // 1. Authentication & Platform Context Verification
    if (!ctx || !ctx.userId) {
      return deny('DENY_UNAUTHENTICATED', 'Authentication required for platform action');
    }

    if (!ctx.platformRole) {
      return deny('DENY_ROLE', 'PlatformContext is missing platformRole');
    }

    // 2. Platform Permission Evaluation
    const hasPerm = hasPlatformPermission(ctx.platformRole, request.permission);
    if (!hasPerm) {
      return deny(
        'DENY_PLATFORM_SCOPE',
        `Platform role ${ctx.platformRole} is not granted permission: ${request.permission}`,
        {
          userId: ctx.userId,
          role: ctx.platformRole,
          permission: request.permission,
        },
      );
    }

    return allow('Platform action authorized', {
      userId: ctx.userId,
      role: ctx.platformRole,
      permission: request.permission,
    });
  }

  /**
   * Asserts store action authorization or throws a typed domain error.
   */
  async assertAuthorizedStoreAction(request: AuthorizeStoreActionRequest): Promise<void> {
    const decision = await this.authorizeStoreAction(request);
    if (decision.allowed) {
      return;
    }

    switch (decision.reason) {
      case 'DENY_UNAUTHENTICATED':
        throw new UnauthenticatedError(decision.message);
      case 'DENY_NO_STORE_CONTEXT':
        throw new InvalidAuthorizationContextError(decision.message);
      case 'DENY_SCOPE_MISMATCH':
        throw new ScopeMismatchError(decision.message);
      case 'DENY_PERMISSION':
        throw new PermissionDeniedError(
          decision.message,
          request.permission,
          request.context?.role,
        );
      case 'DENY_ENTITLEMENT':
        throw new EntitlementDeniedError(
          decision.message,
          request.requiredEntitlement ?? request.limitCheck?.key,
        );
      default:
        throw new AuthorizationError(decision.message ?? 'Store action authorization failed');
    }
  }

  /**
   * Asserts platform action authorization or throws a typed domain error.
   */
  async assertAuthorizedPlatformAction(request: AuthorizePlatformActionRequest): Promise<void> {
    const decision = await this.authorizePlatformAction(request);
    if (decision.allowed) {
      return;
    }

    switch (decision.reason) {
      case 'DENY_UNAUTHENTICATED':
        throw new UnauthenticatedError(decision.message);
      case 'DENY_PLATFORM_SCOPE':
        throw new PermissionDeniedError(
          decision.message,
          request.permission,
          request.context?.platformRole,
        );
      default:
        throw new AuthorizationError(decision.message ?? 'Platform action authorization failed');
    }
  }
}
