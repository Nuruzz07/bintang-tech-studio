import {
  StoreMember,
  StoreRole,
  STORE_ROLES,
  InviteMemberInput,
  StoreMemberRepository,
  StoreRepository,
  ProfileRepository,
} from './types.js';
import {
  OwnerInvariantViolationError,
  InvalidRoleError,
  TenantNotFoundError,
  TenantMutationForbiddenError,
} from './errors.js';
import { NotFoundError, ConflictError, ValidationError } from '@bintang/shared';

export class MembershipService {
  constructor(
    private readonly memberRepo: StoreMemberRepository,
    private readonly storeRepo: StoreRepository,
    private readonly profileRepo: ProfileRepository,
  ) {}

  /**
   * Invites a new member to a store.
   * Status defaults to 'INVITED'.
   * Cannot invite a user as STORE_OWNER (only one owner permitted).
   */
  async inviteMember(input: InviteMemberInput): Promise<StoreMember> {
    const storeId = input.storeId?.trim();
    const userId = input.userId?.trim();
    const role = input.role;

    if (!storeId || !userId) {
      throw new ValidationError('storeId and userId are required');
    }

    if (role === 'STORE_OWNER') {
      throw new OwnerInvariantViolationError(
        'Cannot invite a member directly as STORE_OWNER. Use dedicated owner transfer instead.',
      );
    }

    if (!STORE_ROLES.includes(role)) {
      throw new InvalidRoleError(`Invalid store role: ${role}`);
    }

    const store = await this.storeRepo.findById(storeId);
    if (!store) {
      throw new TenantNotFoundError(`Store ${storeId} not found`);
    }

    const profile = await this.profileRepo.findById(userId);
    if (!profile) {
      throw new NotFoundError(`Profile for user ${userId} not found`);
    }

    const existingMember = await this.memberRepo.findByStoreAndUser(storeId, userId);
    if (existingMember) {
      throw new ConflictError(
        `User ${userId} already has membership in store ${storeId} (status: ${existingMember.status})`,
      );
    }

    return this.memberRepo.create({
      storeId,
      userId,
      role,
      status: 'INVITED',
    });
  }

  /**
   * Activates an invited or suspended membership.
   */
  async activateMember(storeId: string, userId: string): Promise<StoreMember> {
    const member = await this.getMemberOrThrow(storeId, userId);
    if (member.status === 'ACTIVE') {
      return member;
    }

    return this.memberRepo.update(member.id, {
      status: 'ACTIVE',
    });
  }

  /**
   * Suspends a store member.
   * Strictly defends against suspending the active STORE_OWNER.
   */
  async suspendMember(storeId: string, userId: string): Promise<StoreMember> {
    const member = await this.getMemberOrThrow(storeId, userId);
    const store = await this.storeRepo.findById(storeId);

    if (store && store.ownerUserId === userId && member.role === 'STORE_OWNER') {
      throw new OwnerInvariantViolationError(
        'Cannot suspend the active STORE_OWNER. Transfer ownership first.',
      );
    }

    return this.memberRepo.update(member.id, {
      status: 'SUSPENDED',
    });
  }

  /**
   * Removes a member from a store.
   * Strictly defends against removing the active STORE_OWNER.
   */
  async removeMember(storeId: string, userId: string): Promise<StoreMember> {
    const member = await this.getMemberOrThrow(storeId, userId);
    const store = await this.storeRepo.findById(storeId);

    if (store && store.ownerUserId === userId && member.role === 'STORE_OWNER') {
      throw new OwnerInvariantViolationError(
        'Cannot remove the active STORE_OWNER. Transfer ownership first.',
      );
    }

    return this.memberRepo.update(member.id, {
      status: 'REMOVED',
    });
  }

  /**
   * Updates a member's role (e.g. STORE_ADMIN <-> STORE_STAFF).
   * Strictly defends against demoting the active STORE_OWNER or assigning STORE_OWNER without transfer.
   */
  async updateMemberRole(
    storeId: string,
    userId: string,
    newRole: StoreRole,
  ): Promise<StoreMember> {
    const member = await this.getMemberOrThrow(storeId, userId);
    const store = await this.storeRepo.findById(storeId);

    if (!STORE_ROLES.includes(newRole)) {
      throw new InvalidRoleError(`Invalid role: ${newRole}`);
    }

    // Demotion check
    if (
      store &&
      store.ownerUserId === userId &&
      member.role === 'STORE_OWNER' &&
      newRole !== 'STORE_OWNER'
    ) {
      throw new OwnerInvariantViolationError(
        'Cannot demote the active STORE_OWNER. Use dedicated owner transfer service.',
      );
    }

    // Elevation to STORE_OWNER check
    if (newRole === 'STORE_OWNER' && (!store || store.ownerUserId !== userId)) {
      throw new OwnerInvariantViolationError(
        'Cannot promote member to STORE_OWNER directly. Use dedicated owner transfer service.',
      );
    }

    return this.memberRepo.update(member.id, {
      role: newRole,
    });
  }

  /**
   * Explicitly verifies that membership tenant identifiers (storeId, userId) cannot be mutated.
   */
  async assertNoTenantMutation(
    memberId: string,
    proposedStoreId: string,
    proposedUserId: string,
  ): Promise<void> {
    const existing = await this.memberRepo.findById(memberId);
    if (!existing) {
      throw new NotFoundError(`Membership ${memberId} not found`);
    }

    if (existing.storeId !== proposedStoreId || existing.userId !== proposedUserId) {
      throw new TenantMutationForbiddenError(
        'Changing storeId or userId on an existing membership is strictly forbidden',
      );
    }
  }

  /**
   * Retrieves membership or throws NotFoundError.
   */
  private async getMemberOrThrow(storeId: string, userId: string): Promise<StoreMember> {
    const member = await this.memberRepo.findByStoreAndUser(storeId.trim(), userId.trim());
    if (!member) {
      throw new NotFoundError(`Membership not found for user ${userId} in store ${storeId}`);
    }
    return member;
  }
}
