import { Profile, PlatformRole, PLATFORM_ROLES, ProfileRepository } from './types.js';
import { PlatformRoleElevationError, InvalidRoleError } from './errors.js';
import { NotFoundError, ValidationError } from '@bintang/shared';

export interface CreateProfileInput {
  readonly id: string;
  readonly fullName?: string | null;
  readonly avatarUrl?: string | null;
  readonly platformRole?: PlatformRole;
  readonly status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export interface UpdateProfileInput {
  readonly fullName?: string | null;
  readonly avatarUrl?: string | null;
  readonly status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  /**
   * Protected field: platformRole cannot be set by regular users.
   */
  readonly platformRole?: PlatformRole;
}

export class IdentityService {
  constructor(private readonly profileRepo: ProfileRepository) {}

  /**
   * Retrieves profile by auth user ID.
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const normalizedId = userId?.trim();
    if (!normalizedId) return null;
    return this.profileRepo.findById(normalizedId);
  }

  /**
   * Initializes profile for a new auth user.
   * Default platformRole is always 'USER'.
   */
  async createProfile(input: CreateProfileInput): Promise<Profile> {
    const id = input.id?.trim();
    if (!id) {
      throw new ValidationError('Profile id is required (must match auth.users id)');
    }

    const platformRole: PlatformRole = input.platformRole ?? 'USER';
    if (!PLATFORM_ROLES.includes(platformRole)) {
      throw new InvalidRoleError(`Invalid platform role: ${input.platformRole}`);
    }

    return this.profileRepo.create({
      id,
      fullName: input.fullName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      platformRole,
      status: input.status ?? 'ACTIVE',
    });
  }

  /**
   * Updates profile attributes.
   * Strictly defends against platform role elevation.
   */
  async updateProfile(
    userId: string,
    updates: UpdateProfileInput,
    callerPlatformRole?: PlatformRole,
  ): Promise<Profile> {
    const existing = await this.profileRepo.findById(userId);
    if (!existing) {
      throw new NotFoundError(`Profile for user ${userId} not found`);
    }

    // Check platform_role tampering / self-promotion
    if (updates.platformRole !== undefined && updates.platformRole !== existing.platformRole) {
      if (!callerPlatformRole || callerPlatformRole !== 'PLATFORM_OWNER') {
        throw new PlatformRoleElevationError(
          'Modifying platform_role requires PLATFORM_OWNER role. User cannot self-elevate.',
        );
      }
      if (!PLATFORM_ROLES.includes(updates.platformRole)) {
        throw new InvalidRoleError(`Invalid platform role: ${updates.platformRole}`);
      }
    }

    return this.profileRepo.update(userId, {
      ...(updates.fullName !== undefined ? { fullName: updates.fullName } : {}),
      ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.platformRole !== undefined && callerPlatformRole === 'PLATFORM_OWNER'
        ? { platformRole: updates.platformRole }
        : {}),
    });
  }

  /**
   * Helper to validate whether a string is a valid PlatformRole.
   */
  isPlatformRole(role: string): role is PlatformRole {
    return PLATFORM_ROLES.includes(role as PlatformRole);
  }
}
