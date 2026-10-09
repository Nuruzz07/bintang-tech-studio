import { Customer, CustomerRepository } from '@bintang/orders';
import { PostgrestClient } from '../client.js';
import { DbCustomer } from '../types.js';

function toDomain(row: DbCustomer): Customer {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name ?? '',
    email: row.email,
    phone: row.phone,
    telegramId: typeof metadata['telegramId'] === 'string' ? metadata['telegramId'] : null,
    whatsappNumber:
      typeof metadata['whatsappNumber'] === 'string' ? metadata['whatsappNumber'] : null,
    totalOrders: typeof metadata['totalOrders'] === 'number' ? metadata['totalOrders'] : 0,
    totalSpent: typeof metadata['totalSpent'] === 'string' ? metadata['totalSpent'] : '0.00',
    lastOrderAt: typeof metadata['lastOrderAt'] === 'string' ? metadata['lastOrderAt'] : null,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseCustomerRepository implements CustomerRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, customer: Customer): Promise<Customer> {
    const metadata = {
      ...(customer.metadata ?? {}),
      telegramId: customer.telegramId,
      whatsappNumber: customer.whatsappNumber,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      lastOrderAt: customer.lastOrderAt,
    };

    const payload: Partial<DbCustomer> = {
      id: customer.id,
      store_id: storeId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      metadata,
    };

    const inserted = await this.client.from<DbCustomer>('customers').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert customer: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<Customer | null> {
    const row = await this.client
      .from<DbCustomer>('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByEmail(storeId: string, email: string): Promise<Customer | null> {
    const row = await this.client
      .from<DbCustomer>('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async list(storeId: string): Promise<readonly Customer[]> {
    const rows = await this.client
      .from<DbCustomer>('customers')
      .select('*')
      .eq('store_id', storeId)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }
}
