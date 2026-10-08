/**
 * Bintang Tech Studio — Platform Overview & Aggregations Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Aggregates high-level platform telemetry across tenants.
 * EXPLICIT CLASSIFICATION: Metrics sourced from in-memory foundations are labeled
 * FOUNDATION_IN_MEMORY to prevent misleading claims of persisted production MRR.
 */

import { PlatformOverviewMetrics } from '../types.js';
import { SubscriptionRepository, InvoiceRepository, formatCurrency } from '@bintang/billing';
import {
  PlatformStoreRepository,
  PlatformUserRepository,
  PlatformSupportTicketRepository,
  PlatformHealthRepository,
} from './interfaces.js';

export interface PlatformOverviewServiceDeps {
  readonly storeRepository?: PlatformStoreRepository | undefined;
  readonly userRepository?: PlatformUserRepository | undefined;
  readonly subscriptionRepository?: SubscriptionRepository | undefined;
  readonly invoiceRepository?: InvoiceRepository | undefined;
  readonly ticketRepository?: PlatformSupportTicketRepository | undefined;
  readonly healthRepository?: PlatformHealthRepository | undefined;
}

export class PlatformOverviewService {
  constructor(private readonly deps: PlatformOverviewServiceDeps) {}

  public async getOverviewMetrics(): Promise<PlatformOverviewMetrics> {
    const stores = this.deps.storeRepository ? await this.deps.storeRepository.list() : [];

    let activeStores = 0;
    let setupStores = 0;
    let suspendedStores = 0;
    let archivedStores = 0;

    for (const s of stores) {
      if (s.status === 'ACTIVE') activeStores++;
      else if (s.status === 'SETUP') setupStores++;
      else if (s.status === 'SUSPENDED') suspendedStores++;
      else if (s.status === 'ARCHIVED') archivedStores++;
    }

    let owners = 0;
    let admins = 0;
    let regularUsers = 0;

    if (this.deps.userRepository) {
      owners = await this.deps.userRepository.countByRole('PLATFORM_OWNER');
      admins = await this.deps.userRepository.countByRole('PLATFORM_ADMIN');
      regularUsers = await this.deps.userRepository.countByRole('USER');
    }

    let subTotal = 0;
    let subActive = 0;
    let subTrial = 0;
    let subPastDue = 0;
    let subSuspended = 0;
    let subCancelled = 0;
    let subExpired = 0;

    if (this.deps.subscriptionRepository) {
      for (const s of stores) {
        const sub = await this.deps.subscriptionRepository.findByStoreId(s.id);
        if (sub) {
          subTotal++;
          if (sub.status === 'ACTIVE') subActive++;
          else if (sub.status === 'TRIAL') subTrial++;
          else if (sub.status === 'PAST_DUE') subPastDue++;
          else if (sub.status === 'SUSPENDED') subSuspended++;
          else if (sub.status === 'CANCELLED') subCancelled++;
          else if (sub.status === 'EXPIRED') subExpired++;
        }
      }
    }

    let totalInvoices = 0;
    let paidInvoices = 0;
    let pendingInvoices = 0;
    let totalBilledCents = 0;
    let totalCollectedCents = 0;

    if (this.deps.invoiceRepository) {
      for (const s of stores) {
        const invs = await this.deps.invoiceRepository.listByStoreId(s.id);
        for (const inv of invs) {
          totalInvoices++;
          const cents = Math.round(parseFloat(inv.total) * 100);
          totalBilledCents += cents;
          if (inv.status === 'PAID') {
            paidInvoices++;
            totalCollectedCents += cents;
          } else if (inv.status === 'PENDING') {
            pendingInvoices++;
          }
        }
      }
    }

    const health = this.deps.healthRepository
      ? await this.deps.healthRepository.getLatestReport()
      : null;

    let ticketsOpen = 0;
    let ticketsInProgress = 0;
    let ticketsResolved = 0;

    if (this.deps.ticketRepository) {
      ticketsOpen = await this.deps.ticketRepository.countByStatus('OPEN');
      ticketsInProgress = await this.deps.ticketRepository.countByStatus('IN_PROGRESS');
      ticketsResolved = await this.deps.ticketRepository.countByStatus('RESOLVED');
    }

    const totalCollectedDecimal = (totalCollectedCents / 100).toFixed(2);

    return {
      stores: {
        total: stores.length,
        active: activeStores,
        setup: setupStores,
        suspended: suspendedStores,
        archived: archivedStores,
      },
      users: {
        total: owners + admins + regularUsers,
        owners,
        admins,
        regularUsers,
      },
      subscriptions: {
        total: subTotal,
        active: subActive,
        trial: subTrial,
        pastDue: subPastDue,
        suspended: subSuspended,
        cancelled: subCancelled,
        expired: subExpired,
      },
      billing: {
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        totalBilledAmount: (totalBilledCents / 100).toFixed(2),
        totalCollectedAmount: totalCollectedDecimal,
        formattedTotalCollected: formatCurrency(totalCollectedDecimal),
      },
      bots: {
        total: stores.length,
        connected: stores.length,
        disconnected: 0,
        error: 0,
      },
      supportTickets: {
        total: ticketsOpen + ticketsInProgress + ticketsResolved,
        open: ticketsOpen,
        inProgress: ticketsInProgress,
        resolved: ticketsResolved,
      },
      systemHealthStatus: health?.overallStatus || 'HEALTHY',
      classification: 'FOUNDATION_IN_MEMORY',
      generatedAt: new Date().toISOString(),
    };
  }
}
