import { PaymentEvent, PaymentEventProcessingStatus } from './types.js';

export interface PaymentEventRepository {
  create(event: PaymentEvent): Promise<PaymentEvent>;
  findById(id: string): Promise<PaymentEvent | null>;
  findByProviderEventId(provider: string, eventId: string): Promise<PaymentEvent | null>;
  updateProcessingStatus(
    id: string,
    status: PaymentEventProcessingStatus,
    processedAt?: string,
  ): Promise<PaymentEvent>;
}
