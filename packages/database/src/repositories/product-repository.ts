import {
  Product,
  ProductFilter,
  ProductRepository,
  ProductStatus,
  ProductType,
  StockMode,
} from '@bintang/commerce';
import { PostgrestClient } from '../client.js';
import { DbProduct } from '../types.js';

function toDomain(row: DbProduct): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    productType: row.product_type as ProductType,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    stockMode: row.stock_mode as StockMode,
    status: row.status as ProductStatus,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseProductRepository implements ProductRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, product: Product): Promise<Product> {
    const payload: Partial<DbProduct> = {
      id: product.id,
      store_id: storeId,
      category_id: product.categoryId,
      name: product.name,
      slug: product.slug.toLowerCase().trim(),
      description: product.description,
      product_type: product.productType,
      price: product.price,
      compare_at_price: product.compareAtPrice,
      stock_mode: product.stockMode,
      status: product.status,
      metadata: { ...product.metadata },
    };

    const inserted = await this.client.from<DbProduct>('products').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert product: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<Product | null> {
    const row = await this.client
      .from<DbProduct>('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findBySlug(storeId: string, slug: string): Promise<Product | null> {
    const row = await this.client
      .from<DbProduct>('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async list(storeId: string, filter?: ProductFilter): Promise<readonly Product[]> {
    let builder = this.client.from<DbProduct>('products').select('*').eq('store_id', storeId);

    if (filter?.categoryId) {
      builder = builder.eq('category_id', filter.categoryId);
    }
    if (filter?.productType) {
      builder = builder.eq('product_type', filter.productType);
    }

    const rows = await builder.execute();
    let items = rows.map(toDomain);

    if (filter?.status) {
      const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
      items = items.filter((item) => allowed.includes(item.status));
    } else if (!filter?.includeArchived) {
      items = items.filter((item) => item.status !== 'ARCHIVED');
    }

    return Object.freeze(items);
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Omit<Product, 'id' | 'storeId' | 'createdAt'>>,
  ): Promise<Product> {
    const updatePayload: Partial<DbProduct> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug.toLowerCase().trim();
    if (data.categoryId !== undefined) updatePayload.category_id = data.categoryId;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.productType !== undefined) updatePayload.product_type = data.productType;
    if (data.price !== undefined) updatePayload.price = data.price;
    if (data.compareAtPrice !== undefined) updatePayload.compare_at_price = data.compareAtPrice;
    if (data.stockMode !== undefined) updatePayload.stock_mode = data.stockMode;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.metadata !== undefined) updatePayload.metadata = { ...data.metadata };

    const rows = await this.client
      .from<DbProduct>('products')
      .eq('store_id', storeId)
      .eq('id', id)
      .update(updatePayload);

    const row = rows[0];
    if (!row) {
      throw new Error(`Product not found for update: ${id}`);
    }
    return toDomain(row);
  }

  async archive(storeId: string, id: string): Promise<Product> {
    return this.update(storeId, id, { status: 'ARCHIVED' });
  }

  async countProducts(
    storeId: string,
    filter?: { readonly excludeArchived?: boolean },
  ): Promise<number> {
    const products = await this.list(storeId, {
      includeArchived: !filter?.excludeArchived,
    });
    return products.length;
  }

  async countProductsByCategoryId(storeId: string, categoryId: string): Promise<number> {
    const products = await this.list(storeId, {
      categoryId,
      includeArchived: false,
    });
    return products.length;
  }
}
