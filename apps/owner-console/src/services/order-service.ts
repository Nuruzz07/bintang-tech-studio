/**
 * Bintang Tech Studio — Platform Order Overview Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Provides platform-level cross-store order metrics and summaries.
 * DATA PRIVACY INVARIANT: Customer personal information is strictly minimized / masked.
 */

import { PlatformOrderOverviewMetrics, PlatformOrderSummary } from '../types.js';
import { PlatformStoreRepository } from './interfaces.js';
import { OrderRepository } from '@bintang/orders';
import { formatCurrency } from '@bintang/billing';

export interface PlatformOrderServiceDeps {
  readonly orderRepository?: OrderRepository | undefined;
  readonly storeRepository?: PlatformStoreRepository | undefined;
}

export class PlatformOrderService {
  constructor(private readonly deps: PlatformOrderServiceDeps) {}

  public async getOrderMetrics(): Promise<PlatformOrderOverviewMetrics> {
    const stores = this.deps.storeRepository ? await this.deps.storeRepository.list() : [];
    let total = 0;
    let pending = 0;
    let paid = 0;
    let completed = 0;
    let cancelled = 0;
    let totalCents = 0;

    if (this.deps.orderRepository) {
      for (const s of stores) {
        const orders = await this.deps.orderRepository.list(s.id);
        total += orders.length;
        for (const o of orders) {
          if (o.status === 'PENDING_PAYMENT') pending++;
          else if (o.status === 'PAID') paid++;
          else if (o.status === 'FULFILLED') completed++;
          else if (o.status === 'CANCELLED') cancelled++;

          totalCents += Math.round(parseFloat(o.grandTotal || '0') * 100);
        }
      }
    }

    const volumeStr = (totalCents / 100).toFixed(2);

    return {
      totalOrders: total,
      pendingOrders: pending,
      paidOrders: paid,
      completedOrders: completed,
      cancelledOrders: cancelled,
      totalOrderVolume: volumeStr,
      formattedTotalVolume: formatCurrency(volumeStr),
    };
  }

  public async listRecentOrders(limit = 20): Promise<readonly PlatformOrderSummary[]> {
    const stores = this.deps.storeRepository ? await this.deps.storeRepository.list() : [];
    const result: PlatformOrderSummary[] = [];

    if (this.deps.orderRepository) {
      for (const s of stores) {
        const orders = await this.deps.orderRepository.list(s.id);
        for (const o of orders) {
          result.push({
            id: o.id,
            storeId: s.id,
            storeName: s.name,
            orderNumber: o.orderNumber,
            status: o.status,
            totalAmount: o.grandTotal,
            formattedTotalAmount: formatCurrency(o.grandTotal),
            currency: o.currency,
            customerMaskedIdentity: o.customerId
              ? `cust_***${o.customerId.slice(-4)}`
              : 'Guest Customer',
            itemCount: o.items.length,
            createdAt: o.createdAt,
          });
        }
      }
    }

    return result.slice(0, limit);
  }
}
