import { Profile, ProfileRepository, PlatformRole, ProfileStatus } from '@bintang/tenancy';
import { PostgrestClient } from '../client.js';
import { DbProfile } from '../types.js';

function toDomain(row: DbProfile): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    platformRole: row.platform_role as PlatformRole,
    status: row.status as ProfileStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async findById(id: string): Promise<Profile | null> {
    const row = await this.client
      .from<DbProfile>('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async create(profile: Omit<Profile, 'createdAt' | 'updatedAt'>): Promise<Profile> {
    const insertPayload: Partial<DbProfile> = {
      id: profile.id,
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      platform_role: profile.platformRole,
      status: profile.status,
    };

    const inserted = await this.client.from<DbProfile>('profiles').insert(insertPayload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert profile: empty response');
    }
    return toDomain(row);
  }

  async update(
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Profile> {
    const updatePayload: Partial<DbProfile> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.fullName !== undefined) updatePayload.full_name = updates.fullName;
    if (updates.avatarUrl !== undefined) updatePayload.avatar_url = updates.avatarUrl;
    if (updates.platformRole !== undefined) updatePayload.platform_role = updates.platformRole;
    if (updates.status !== undefined) updatePayload.status = updates.status;

    const rows = await this.client.from<DbProfile>('profiles').eq('id', id).update(updatePayload);
    const row = rows[0];
    if (!row) {
      throw new Error(`Profile not found for update: ${id}`);
    }
    return toDomain(row);
  }
}
