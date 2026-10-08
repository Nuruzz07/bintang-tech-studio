import { PaymentAttempt, PaymentAttemptStatus } from './types.js';

export interface PaymentAttemptRepository {
  create(storeId: string, attempt: PaymentAttempt): Promise<PaymentAttempt>;
  findById(storeId: string, id: string): Promise<PaymentAttempt | null>;
  findByIntentId(storeId: string, intentId: string): Promise<readonly PaymentAttempt[]>;
  findByProviderReference(provider: string, reference: string): Promise<PaymentAttempt | null>;
  updateStatus(
    storeId: string,
    id: string,
    status: PaymentAttemptStatus,
    patch?: {
      providerReference?: string | null;
      paymentUrl?: string | null;
      failureCode?: string | null;
      failureReason?: string | null;
    },
  ): Promise<PaymentAttempt>;
}
