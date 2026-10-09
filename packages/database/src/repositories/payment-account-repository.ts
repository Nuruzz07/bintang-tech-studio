import {
  PaymentAccount,
  PaymentAccountRepository,
  PaymentAccountStatus,
  PaymentProviderCapability,
} from '@bintang/payments';
import { PostgrestClient } from '../client.js';
import { DbPaymentAccount } from '../types.js';

function toDomain(row: DbPaymentAccount): PaymentAccount {
  const config = row.configuration ?? {};
  const displayName =
    typeof config['displayName'] === 'string' ? config['displayName'] : row.provider;
  const currency = typeof config['currency'] === 'string' ? config['currency'] : 'IDR';
  const credentialReference =
    typeof config['credentialReference'] === 'string' ? config['credentialReference'] : '';
  const capabilities = (
    Array.isArray(config['capabilities'])
      ? config['capabilities']
      : ['createPayment', 'verifyPayment', 'webhook']
  ) as PaymentProviderCapability[];

  return {
    id: row.id,
    storeId: row.store_id,
    provider: row.provider,
    displayName,
    status: row.status as PaymentAccountStatus,
    currency,
    credentialReference,
    capabilities,
    configuration: config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabasePaymentAccountRepository implements PaymentAccountRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, account: PaymentAccount): Promise<PaymentAccount> {
    const configuration = {
      ...(account.configuration ?? {}),
      displayName: account.displayName,
      currency: account.currency,
      credentialReference: account.credentialReference,
      capabilities: account.capabilities,
    };

    const payload: Partial<DbPaymentAccount> = {
      id: account.id,
      store_id: storeId,
      provider: account.provider,
      status: account.status,
      configuration,
    };

    const inserted = await this.client.from<DbPaymentAccount>('payment_accounts').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert payment account: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<PaymentAccount | null> {
    const row = await this.client
      .from<DbPaymentAccount>('payment_accounts')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findActiveByStore(storeId: string): Promise<PaymentAccount | null> {
    const row = await this.client
      .from<DbPaymentAccount>('payment_accounts')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async list(storeId: string): Promise<readonly PaymentAccount[]> {
    const rows = await this.client
      .from<DbPaymentAccount>('payment_accounts')
      .select('*')
      .eq('store_id', storeId)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: PaymentAccountStatus,
  ): Promise<PaymentAccount> {
    const rows = await this.client
      .from<DbPaymentAccount>('payment_accounts')
      .eq('store_id', storeId)
      .eq('id', id)
      .update({
        status,
        updated_at: new Date().toISOString(),
      });
    const row = rows[0];
    if (!row) {
      throw new Error(`Payment account not found for status update: ${id}`);
    }
    return toDomain(row);
  }
}
