import { PaymentAccount, PaymentAccountStatus } from './types.js';

export interface PaymentAccountRepository {
  create(storeId: string, account: PaymentAccount): Promise<PaymentAccount>;
  findById(storeId: string, id: string): Promise<PaymentAccount | null>;
  findActiveByStore(storeId: string): Promise<PaymentAccount | null>;
  list(storeId: string): Promise<readonly PaymentAccount[]>;
  updateStatus(storeId: string, id: string, status: PaymentAccountStatus): Promise<PaymentAccount>;
}
