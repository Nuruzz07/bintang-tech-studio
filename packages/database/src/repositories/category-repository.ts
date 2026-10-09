import { Category, CategoryFilter, CategoryRepository, CategoryStatus } from '@bintang/commerce';
import { PostgrestClient } from '../client.js';
import { DbCategory } from '../types.js';

function toDomain(row: DbCategory): Category {
  const metadata = row.metadata ?? {};
  const status = (metadata['status'] as CategoryStatus) || 'ACTIVE';
  const sortOrder = typeof metadata['sortOrder'] === 'number' ? metadata['sortOrder'] : 0;

  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder,
    status,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseCategoryRepository implements CategoryRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, category: Category): Promise<Category> {
    const metadata = {
      ...(category.metadata ?? {}),
      status: category.status,
      sortOrder: category.sortOrder,
    };

    const payload: Partial<DbCategory> = {
      id: category.id,
      store_id: storeId,
      name: category.name,
      slug: category.slug.toLowerCase().trim(),
      description: category.description,
      metadata,
    };

    const inserted = await this.client.from<DbCategory>('categories').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert category: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<Category | null> {
    const row = await this.client
      .from<DbCategory>('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findBySlug(storeId: string, slug: string): Promise<Category | null> {
    const row = await this.client
      .from<DbCategory>('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async list(storeId: string, filter?: CategoryFilter): Promise<readonly Category[]> {
    const rows = await this.client
      .from<DbCategory>('categories')
      .select('*')
      .eq('store_id', storeId)
      .execute();

    let items = rows.map(toDomain);

    if (filter?.status) {
      const allowedStatuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      items = items.filter((item) => allowedStatuses.includes(item.status));
    } else if (!filter?.includeArchived) {
      items = items.filter((item) => item.status !== 'ARCHIVED');
    }

    return Object.freeze(items.sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Omit<Category, 'id' | 'storeId' | 'createdAt'>>,
  ): Promise<Category> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new Error(`Category ${id} not found in store ${storeId}`);
    }

    const mergedMetadata: Record<string, unknown> = {
      ...existing.metadata,
      ...(data.metadata ?? {}),
    };
    if (data.status !== undefined) mergedMetadata['status'] = data.status;
    if (data.sortOrder !== undefined) mergedMetadata['sortOrder'] = data.sortOrder;

    const updatePayload: Partial<DbCategory> = {
      updated_at: new Date().toISOString(),
      metadata: mergedMetadata,
    };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug.toLowerCase().trim();
    if (data.description !== undefined) updatePayload.description = data.description;

    const rows = await this.client
      .from<DbCategory>('categories')
      .eq('store_id', storeId)
      .eq('id', id)
      .update(updatePayload);

    const row = rows[0];
    if (!row) {
      throw new Error(`Failed to update category: ${id}`);
    }
    return toDomain(row);
  }

  async archive(storeId: string, id: string): Promise<Category> {
    return this.update(storeId, id, { status: 'ARCHIVED' });
  }
}
