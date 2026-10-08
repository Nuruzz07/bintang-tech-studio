/**
 * Bintang Tech Studio — Telegram Customer Identity Manager.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Resolves or creates store-scoped customer identities for Telegram users.
 *
 * Invariant: Logical identity is (storeId, telegramUserId).
 * telegramUserId alone is NEVER treated as a global customer identity across stores.
 */

import { CustomerRepository, Customer, CustomerContext } from '@bintang/orders';
import { TelegramCustomerIdentity, TelegramSender } from './types.js';

export class TelegramCustomerIdentityManager {
  constructor(private readonly customerRepository: CustomerRepository) {}

  public async resolveCustomer(
    storeId: string,
    telegramUserId: string,
    sender?: TelegramSender,
  ): Promise<{
    readonly identity: TelegramCustomerIdentity;
    readonly customerContext: CustomerContext;
    readonly customer: Customer;
  }> {
    const customers = await this.customerRepository.list(storeId);
    let existing = customers.find((c) => c.telegramId === telegramUserId);

    if (!existing) {
      const now = new Date().toISOString();
      const displayName =
        [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') ||
        sender?.username ||
        `Telegram User ${telegramUserId}`;

      const newCustomer: Customer = {
        id: `cust_tg_${storeId.slice(0, 8)}_${telegramUserId}`,
        storeId,
        name: displayName,
        email: null,
        phone: null,
        telegramId: telegramUserId,
        whatsappNumber: null,
        totalOrders: 0,
        totalSpent: '0.00',
        lastOrderAt: null,
        metadata: {
          telegramUsername: sender?.username ?? null,
          registeredVia: 'TELEGRAM_BOT',
        },
        createdAt: now,
        updatedAt: now,
      };

      existing = await this.customerRepository.create(storeId, newCustomer);
    }

    const identity: TelegramCustomerIdentity = {
      storeId,
      telegramUserId,
      customerId: existing.id,
      name: existing.name,
      username: sender?.username,
    };

    const customerContext: CustomerContext = {
      storeId,
      customerId: existing.id,
      name: existing.name,
    };

    return { identity, customerContext, customer: existing };
  }
}
