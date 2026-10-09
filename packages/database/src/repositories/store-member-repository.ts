import { StoreMember, StoreMemberRepository, StoreRole, MembershipStatus } from '@bintang/tenancy';
import { PostgrestClient } from '../client.js';
import { DbStoreMember } from '../types.js';

function toDomain(row: DbStoreMember): StoreMember {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    role: row.role as StoreRole,
    status: row.status as MembershipStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseStoreMemberRepository implements StoreMemberRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async findById(id: string): Promise<StoreMember | null> {
    const row = await this.client
      .from<DbStoreMember>('store_members')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByStoreAndUser(storeId: string, userId: string): Promise<StoreMember | null> {
    const row = await this.client
      .from<DbStoreMember>('store_members')
      .select('*')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByStoreId(storeId: string): Promise<StoreMember[]> {
    const rows = await this.client
      .from<DbStoreMember>('store_members')
      .select('*')
      .eq('store_id', storeId)
      .execute();
    return rows.map(toDomain);
  }

  async findByUserId(userId: string): Promise<StoreMember[]> {
    const rows = await this.client
      .from<DbStoreMember>('store_members')
      .select('*')
      .eq('user_id', userId)
      .execute();
    return rows.map(toDomain);
  }

  async create(member: Omit<StoreMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreMember> {
    const insertPayload: Partial<DbStoreMember> = {
      store_id: member.storeId,
      user_id: member.userId,
      role: member.role,
      status: member.status,
    };

    const inserted = await this.client.from<DbStoreMember>('store_members').insert(insertPayload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert store member: empty response');
    }
    return toDomain(row);
  }

  async update(
    id: string,
    updates: Partial<Omit<StoreMember, 'id' | 'storeId' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoreMember> {
    const updatePayload: Partial<DbStoreMember> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.role !== undefined) updatePayload.role = updates.role;
    if (updates.status !== undefined) updatePayload.status = updates.status;

    const rows = await this.client
      .from<DbStoreMember>('store_members')
      .eq('id', id)
      .update(updatePayload);
    const row = rows[0];
    if (!row) {
      throw new Error(`Store member not found for update: ${id}`);
    }
    return toDomain(row);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.client.from<DbStoreMember>('store_members').eq('id', id).delete();
    return deleted.length > 0;
  }
}
