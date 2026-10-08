/**
 * Bintang Tech Studio — Telegram Caller Context Classifier.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Distinguishes between CUSTOMER, SELLER, and PLATFORM caller contexts.
 *
 * Golden Rules:
 * 1. Do NOT automatically grant seller permissions because a Telegram user knows a bot command.
 * 2. Role is NOT permission. Permission is NOT entitlement.
 * 3. Enforces M04 AuthorizationService checks.
 */

import { StoreMember, createAuthenticatedStoreContext } from '@bintang/tenancy';
import { TelegramCallerContext, TelegramSender } from './types.js';
import { TelegramCustomerIdentityManager } from './customer-identity.js';

export interface TelegramSellerMapping {
  readonly storeId: string;
  readonly telegramUserId: string;
  readonly userId: string;
  readonly member: StoreMember;
  readonly tenantSlug: string;
}

export class TelegramContextClassifier {
  private readonly sellerMappings = new Map<string, TelegramSellerMapping>();

  constructor(private readonly customerIdentityManager: TelegramCustomerIdentityManager) {}

  private toSellerKey(storeId: string, telegramUserId: string): string {
    return `${storeId}:${telegramUserId}`;
  }

  /**
   * Registers a seller user mapping for a specific store and Telegram user ID.
   * In production, this binding is managed via authenticated OTP or account linking.
   */
  public registerSellerMapping(mapping: TelegramSellerMapping): void {
    const key = this.toSellerKey(mapping.storeId, mapping.telegramUserId);
    this.sellerMappings.set(key, mapping);
  }

  public removeSellerMapping(storeId: string, telegramUserId: string): void {
    const key = this.toSellerKey(storeId, telegramUserId);
    this.sellerMappings.delete(key);
  }

  public getSellerMapping(storeId: string, telegramUserId: string): TelegramSellerMapping | null {
    const key = this.toSellerKey(storeId, telegramUserId);
    return this.sellerMappings.get(key) ?? null;
  }

  /**
   * Classifies the Telegram caller into CUSTOMER, SELLER, or PLATFORM context.
   */
  public async classifyCaller(
    storeId: string,
    telegramUserId: string,
    sender?: TelegramSender,
    options?: { readonly tenantSlug?: string | undefined },
  ): Promise<TelegramCallerContext> {
    const seller = this.sellerMappings.get(this.toSellerKey(storeId, telegramUserId));

    if (seller && seller.member.status === 'ACTIVE') {
      const authContext = createAuthenticatedStoreContext({
        storeId,
        tenantSlug: seller.tenantSlug || options?.tenantSlug || 'store',
        userId: seller.userId,
        membershipId: seller.member.id,
        role: seller.member.role,
      });

      return {
        type: 'SELLER',
        storeId,
        userId: seller.userId,
        telegramUserId,
        context: authContext,
      };
    }

    // Default to CUSTOMER context
    const { customerContext } = await this.customerIdentityManager.resolveCustomer(
      storeId,
      telegramUserId,
      sender,
    );

    return {
      type: 'CUSTOMER',
      storeId,
      customerId: customerContext.customerId,
      telegramUserId,
      context: customerContext,
    };
  }
}
