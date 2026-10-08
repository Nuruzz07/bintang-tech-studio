import { PaymentIntent, PaymentIntentStatus, PaymentIntentFilter } from './types.js';

export interface PaymentIntentRepository {
  create(storeId: string, intent: PaymentIntent): Promise<PaymentIntent>;
  findById(storeId: string, id: string): Promise<PaymentIntent | null>;
  findByOrderId(storeId: string, orderId: string): Promise<readonly PaymentIntent[]>;
  list(storeId: string, filter?: PaymentIntentFilter): Promise<readonly PaymentIntent[]>;
  updateStatus(
    storeId: string,
    id: string,
    status: PaymentIntentStatus,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<PaymentIntent>;
}
