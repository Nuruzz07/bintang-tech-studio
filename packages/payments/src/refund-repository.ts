import { Refund, RefundStatus } from './types.js';

export interface RefundRepository {
  create(storeId: string, refund: Refund): Promise<Refund>;
  findById(storeId: string, id: string): Promise<Refund | null>;
  findByIntentId(storeId: string, intentId: string): Promise<readonly Refund[]>;
  findByOrderId(storeId: string, orderId: string): Promise<readonly Refund[]>;
  updateStatus(
    storeId: string,
    id: string,
    status: RefundStatus,
    providerRefundId?: string | null,
  ): Promise<Refund>;
}
