import { Store, StoreRepository, StoreStatus } from '@bintang/tenancy';
import { PostgrestClient } from '../client.js';
import { DbStore } from '../types.js';

function toDomain(row: DbStore): Store {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    slug: row.slug,
    templateVersionId: row.template_version_id,
    status: row.status as StoreStatus,
    currency: row.currency,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseStoreRepository implements StoreRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async findById(id: string): Promise<Store | null> {
    const row = await this.client.from<DbStore>('stores').select('*').eq('id', id).maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Store | null> {
    const row = await this.client
      .from<DbStore>('stores')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByOwnerUserId(ownerUserId: string): Promise<Store[]> {
    const rows = await this.client
      .from<DbStore>('stores')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .execute();
    return rows.map(toDomain);
  }

  async create(store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> {
    const insertPayload: Partial<DbStore> = {
      owner_user_id: store.ownerUserId,
      name: store.name,
      slug: store.slug,
      template_version_id: store.templateVersionId,
      status: store.status,
      currency: store.currency,
      settings: store.settings,
    };

    const inserted = await this.client.from<DbStore>('stores').insert(insertPayload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert store: empty response');
    }
    return toDomain(row);
  }

  async update(
    id: string,
    updates: Partial<Omit<Store, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Store> {
    const updatePayload: Partial<DbStore> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.slug !== undefined) updatePayload.slug = updates.slug;
    if (updates.templateVersionId !== undefined)
      updatePayload.template_version_id = updates.templateVersionId;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.currency !== undefined) updatePayload.currency = updates.currency;
    if (updates.settings !== undefined) updatePayload.settings = updates.settings;

    const rows = await this.client.from<DbStore>('stores').eq('id', id).update(updatePayload);
    const row = rows[0];
    if (!row) {
      throw new Error(`Store not found for update: ${id}`);
    }
    return toDomain(row);
  }

  async updateOwner(id: string, newOwnerUserId: string): Promise<Store> {
    const rows = await this.client.from<DbStore>('stores').eq('id', id).update({
      owner_user_id: newOwnerUserId,
      updated_at: new Date().toISOString(),
    });
    const row = rows[0];
    if (!row) {
      throw new Error(`Store not found for owner update: ${id}`);
    }
    return toDomain(row);
  }
}
