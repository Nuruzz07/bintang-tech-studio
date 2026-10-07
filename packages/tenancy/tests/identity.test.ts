import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityService } from '../src/identity-service.js';
import { InMemoryProfileRepository } from '../src/memory-repository.js';
import { PlatformRoleElevationError, InvalidRoleError } from '../src/errors.js';
import { ConflictError, NotFoundError, ValidationError } from '@bintang/shared';

describe('Identity & Platform Role Foundation', () => {
  let profileRepo: InMemoryProfileRepository;
  let identityService: IdentityService;

  beforeEach(() => {
    profileRepo = new InMemoryProfileRepository();
    identityService = new IdentityService(profileRepo);
  });

  it('creates profile with default platformRole "USER" and status "ACTIVE"', async () => {
    const profile = await identityService.createProfile({
      id: 'auth_user_001',
      fullName: 'Bintang Merchant',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(profile.id).toBe('auth_user_001');
    expect(profile.fullName).toBe('Bintang Merchant');
    expect(profile.avatarUrl).toBe('https://example.com/avatar.png');
    expect(profile.platformRole).toBe('USER');
    expect(profile.status).toBe('ACTIVE');
    expect(profile.createdAt).toBeDefined();
  });

  it('enforces profile uniqueness by auth user id', async () => {
    await identityService.createProfile({
      id: 'auth_user_unique',
      fullName: 'Original User',
    });

    await expect(
      identityService.createProfile({
        id: 'auth_user_unique',
        fullName: 'Duplicate User',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects profile creation with invalid platform role', async () => {
    await expect(
      identityService.createProfile({
        id: 'auth_user_bad_role',
        // @ts-expect-error Testing invalid platform role
        platformRole: 'SUPER_ADMIN',
      }),
    ).rejects.toThrow(InvalidRoleError);
  });

  it('rejects profile creation without id', async () => {
    await expect(
      identityService.createProfile({
        id: '',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('allows user to update their own non-privileged profile data', async () => {
    await identityService.createProfile({
      id: 'auth_user_update',
      fullName: 'Old Name',
    });

    const updated = await identityService.updateProfile('auth_user_update', {
      fullName: 'New Name',
      avatarUrl: 'https://cdn.example.com/pic.jpg',
    });

    expect(updated.fullName).toBe('New Name');
    expect(updated.avatarUrl).toBe('https://cdn.example.com/pic.jpg');
    expect(updated.platformRole).toBe('USER');
  });

  it('strictly blocks regular user from self-promoting to PLATFORM_ADMIN or PLATFORM_OWNER', async () => {
    await identityService.createProfile({
      id: 'auth_user_regular',
      fullName: 'Regular User',
    });

    // Caller provides no platform role (or role 'USER') and attempts to set PLATFORM_ADMIN
    await expect(
      identityService.updateProfile(
        'auth_user_regular',
        { platformRole: 'PLATFORM_ADMIN' },
        'USER',
      ),
    ).rejects.toThrow(PlatformRoleElevationError);

    await expect(
      identityService.updateProfile(
        'auth_user_regular',
        { platformRole: 'PLATFORM_OWNER' },
        undefined,
      ),
    ).rejects.toThrow(PlatformRoleElevationError);
  });

  it('allows PLATFORM_OWNER to assign platform roles to users', async () => {
    await identityService.createProfile({
      id: 'auth_user_promotee',
      fullName: 'Staff To Admin',
    });

    const promoted = await identityService.updateProfile(
      'auth_user_promotee',
      { platformRole: 'PLATFORM_ADMIN' },
      'PLATFORM_OWNER',
    );

    expect(promoted.platformRole).toBe('PLATFORM_ADMIN');
  });

  it('throws NotFoundError when updating non-existent user profile', async () => {
    await expect(
      identityService.updateProfile('non_existent_id', { fullName: 'Nobody' }),
    ).rejects.toThrow(NotFoundError);
  });
});
