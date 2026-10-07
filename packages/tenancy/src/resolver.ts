import { AuthenticatedStoreContext, createAuthenticatedStoreContext } from './context.js';
import {
  ResolveStoreContextInput,
  ProfileRepository,
  StoreRepository,
  StoreMemberRepository,
} from './types.js';
import {
  TenantAccessDeniedError,
  TenantNotFoundError,
  MembershipInactiveError,
  InvalidStoreContextError,
  TenancyError,
} from './errors.js';
import { Result, ok, err } from '@bintang/shared';

export interface TenantResolverOptions {
  readonly profileRepo: ProfileRepository;
  readonly storeRepo: StoreRepository;
  readonly memberRepo: StoreMemberRepository;
}

/**
 * Reusable Tenant Resolver validating and generating strongly-typed AuthenticatedStoreContext.
 *
 * Security Guarantee:
 * Never trusts client-supplied store_id. Validates the end-to-end chain:
 * authenticated user -> active profile -> target store -> valid membership -> ACTIVE membership status -> role.
 */
export class TenantResolver {
  constructor(private readonly options: TenantResolverOptions) {}

  /**
   * Resolves and verifies an AuthenticatedStoreContext for the given request.
   */
  async resolveStoreContext(
    input: ResolveStoreContextInput,
  ): Promise<Result<AuthenticatedStoreContext, TenancyError>> {
    const userId = input.userId?.trim();
    if (!userId) {
      return err(
        new InvalidStoreContextError('Cannot resolve StoreContext: missing or empty userId'),
      );
    }

    const storeId = input.storeId?.trim();
    if (!storeId) {
      return err(
        new InvalidStoreContextError('Cannot resolve StoreContext: missing or empty storeId'),
      );
    }

    // 1. Verify user profile exists and is ACTIVE
    const profile = await this.options.profileRepo.findById(userId);
    if (!profile || profile.status !== 'ACTIVE') {
      return err(
        new TenantAccessDeniedError(
          `User ${userId} does not have an active profile on the platform`,
        ),
      );
    }

    // 2. Verify target store exists
    const store = await this.options.storeRepo.findById(storeId);
    if (!store) {
      return err(new TenantNotFoundError(`Store ${storeId} not found`));
    }

    // 3. Verify user membership in the requested store
    const member = await this.options.memberRepo.findByStoreAndUser(storeId, userId);
    if (!member) {
      return err(
        new TenantAccessDeniedError(`User ${userId} has no membership in store ${storeId}`),
      );
    }

    // 4. Verify membership lifecycle status is strictly ACTIVE
    if (member.status !== 'ACTIVE') {
      return err(
        new MembershipInactiveError(
          `User membership in store ${storeId} is not ACTIVE (current status: ${member.status})`,
          member.status,
        ),
      );
    }

    // 5. Construct immutable AuthenticatedStoreContext
    try {
      const context = createAuthenticatedStoreContext({
        storeId: store.id,
        userId: profile.id,
        membershipId: member.id,
        role: member.role,
        tenantSlug: store.slug,
        correlationId: input.correlationId,
        requestId: input.requestId,
      });

      return ok(context);
    } catch (error) {
      return err(
        new InvalidStoreContextError(
          `Failed to create AuthenticatedStoreContext: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}
