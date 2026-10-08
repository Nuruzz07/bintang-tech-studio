/**
 * Bintang Tech Studio — In-Memory Billing & Onboarding Repository Adapters.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Provides safe in-memory adapters implementing the M02 schema contracts.
 * Enforces financial immutability: Deletion of paid invoices or payments is strictly rejected.
 */

import {
  Plan,
  PlanStatus,
  Subscription,
  Invoice,
  InvoiceItem,
  InvoiceWithItems,
  InvoiceStatus,
  BillingPayment,
  BillingPaymentStatus,
  Addon,
  StoreAddon,
  OnboardingSession,
  ProvisioningRecord,
} from '../types.js';
import {
  PlanRepository,
  SubscriptionRepository,
  InvoiceRepository,
  BillingPaymentRepository,
  AddonRepository,
  StoreAddonRepository,
  OnboardingRepository,
  ProvisioningRepository,
  BillingIdempotencyRepository,
} from './interfaces.js';
import {
  PlanNotFoundError,
  SubscriptionNotFoundError,
  InvoiceNotFoundError,
  BillingPaymentNotFoundError,
  FinancialImmutabilityError,
} from '../errors.js';
import { DEFAULT_PLANS } from '../plan-catalog.js';

// ============================================================================
// 1. IN-MEMORY PLAN REPOSITORY
// ============================================================================

export class InMemoryPlanRepository implements PlanRepository {
  private plans = new Map<string, Plan>();

  constructor(initialPlans: readonly Plan[] = DEFAULT_PLANS) {
    for (const p of initialPlans) {
      this.plans.set(p.id, { ...p });
    }
  }

  public async list(filter?: { status?: PlanStatus }): Promise<readonly Plan[]> {
    const all = Array.from(this.plans.values());
    if (filter?.status) {
      return all.filter((p) => p.status === filter.status);
    }
    return all;
  }

  public async findById(id: string): Promise<Plan | null> {
    const plan = this.plans.get(id);
    return plan ? { ...plan } : null;
  }

  public async findBySlug(slug: string): Promise<Plan | null> {
    for (const p of this.plans.values()) {
      if (p.slug === slug) return { ...p };
    }
    return null;
  }

  public async create(plan: Plan): Promise<Plan> {
    const copy = { ...plan };
    this.plans.set(copy.id, copy);
    return { ...copy };
  }

  public async update(id: string, updates: Partial<Plan>): Promise<Plan> {
    const existing = this.plans.get(id);
    if (!existing) throw new PlanNotFoundError(id);
    const updated: Plan = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.plans.set(id, updated);
    return { ...updated };
  }
}

// ============================================================================
// 2. IN-MEMORY SUBSCRIPTION REPOSITORY
// ============================================================================

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private subscriptions = new Map<string, Subscription>();

  public async findByStoreId(storeId: string): Promise<Subscription | null> {
    for (const s of this.subscriptions.values()) {
      if (s.storeId === storeId) return { ...s };
    }
    return null;
  }

  public async findById(id: string): Promise<Subscription | null> {
    const sub = this.subscriptions.get(id);
    return sub ? { ...sub } : null;
  }

  public async create(subscription: Subscription): Promise<Subscription> {
    const copy = { ...subscription };
    this.subscriptions.set(copy.id, copy);
    return { ...copy };
  }

  public async update(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const existing = this.subscriptions.get(id);
    if (!existing) throw new SubscriptionNotFoundError(id);
    const updated: Subscription = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(id, updated);
    return { ...updated };
  }
}

// ============================================================================
// 3. IN-MEMORY INVOICE REPOSITORY
// ============================================================================

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private invoices = new Map<string, Invoice>();
  private items = new Map<string, InvoiceItem[]>();

  public async listByStoreId(
    storeId: string,
    filter?: { status?: InvoiceStatus },
  ): Promise<readonly InvoiceWithItems[]> {
    const result: InvoiceWithItems[] = [];
    for (const inv of this.invoices.values()) {
      if (inv.storeId === storeId) {
        if (!filter?.status || inv.status === filter.status) {
          result.push({
            ...inv,
            items: this.items.get(inv.id) || [],
          });
        }
      }
    }
    return result;
  }

  public async findById(id: string): Promise<InvoiceWithItems | null> {
    const inv = this.invoices.get(id);
    if (!inv) return null;
    return {
      ...inv,
      items: this.items.get(inv.id) || [],
    };
  }

  public async findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceWithItems | null> {
    for (const inv of this.invoices.values()) {
      if (inv.invoiceNumber === invoiceNumber) {
        return {
          ...inv,
          items: this.items.get(inv.id) || [],
        };
      }
    }
    return null;
  }

  public async create(invoice: Invoice, items: readonly InvoiceItem[]): Promise<InvoiceWithItems> {
    this.invoices.set(invoice.id, { ...invoice });
    this.items.set(
      invoice.id,
      items.map((it) => ({ ...it })),
    );
    return {
      ...invoice,
      items: [...items],
    };
  }

  public async updateStatus(
    id: string,
    status: InvoiceStatus,
    paidAt?: string | null,
  ): Promise<InvoiceWithItems> {
    const inv = this.invoices.get(id);
    if (!inv) throw new InvoiceNotFoundError(id);
    const updated: Invoice = {
      ...inv,
      status,
      paidAt: paidAt !== undefined ? paidAt : inv.paidAt,
    };
    this.invoices.set(id, updated);
    return {
      ...updated,
      items: this.items.get(id) || [],
    };
  }

  public async hasStorePaidActivationFee(storeId: string): Promise<boolean> {
    for (const inv of this.invoices.values()) {
      if (inv.storeId === storeId && inv.status === 'PAID') {
        const invItems = this.items.get(inv.id) || [];
        if (invItems.some((it) => it.type === 'ACTIVATION')) {
          return true;
        }
      }
    }
    return false;
  }

  public async delete(id: string): Promise<void> {
    const inv = this.invoices.get(id);
    if (!inv) return;
    if (inv.status === 'PAID') {
      throw new FinancialImmutabilityError(`Invoice ${inv.invoiceNumber} (PAID)`);
    }
    this.invoices.delete(id);
    this.items.delete(id);
  }
}

// ============================================================================
// 4. IN-MEMORY BILLING PAYMENT REPOSITORY
// ============================================================================

export class InMemoryBillingPaymentRepository implements BillingPaymentRepository {
  private payments = new Map<string, BillingPayment>();

  public async listByStoreId(storeId: string): Promise<readonly BillingPayment[]> {
    const result: BillingPayment[] = [];
    for (const p of this.payments.values()) {
      if (p.storeId === storeId) {
        result.push({ ...p });
      }
    }
    return result;
  }

  public async findById(id: string): Promise<BillingPayment | null> {
    const p = this.payments.get(id);
    return p ? { ...p } : null;
  }

  public async findByInvoiceId(invoiceId: string): Promise<readonly BillingPayment[]> {
    const result: BillingPayment[] = [];
    for (const p of this.payments.values()) {
      if (p.invoiceId === invoiceId) {
        result.push({ ...p });
      }
    }
    return result;
  }

  public async create(payment: BillingPayment): Promise<BillingPayment> {
    const copy = { ...payment };
    this.payments.set(copy.id, copy);
    return { ...copy };
  }

  public async updateStatus(
    id: string,
    status: BillingPaymentStatus,
    updates?: Partial<BillingPayment>,
  ): Promise<BillingPayment> {
    const existing = this.payments.get(id);
    if (!existing) throw new BillingPaymentNotFoundError(id);
    const updated: BillingPayment = {
      ...existing,
      ...updates,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.payments.set(id, updated);
    return { ...updated };
  }

  public async delete(id: string): Promise<void> {
    const p = this.payments.get(id);
    if (!p) return;
    if (p.status === 'PAID') {
      throw new FinancialImmutabilityError(`Billing Payment ${p.id} (PAID)`);
    }
    this.payments.delete(id);
  }
}

// ============================================================================
// 5. IN-MEMORY ADDON REPOSITORIES
// ============================================================================

export class InMemoryAddonRepository implements AddonRepository {
  private addons = new Map<string, Addon>();

  public async list(): Promise<readonly Addon[]> {
    return Array.from(this.addons.values()).map((a) => ({ ...a }));
  }

  public async findBySlug(slug: string): Promise<Addon | null> {
    for (const a of this.addons.values()) {
      if (a.slug === slug) return { ...a };
    }
    return null;
  }

  public async create(addon: Addon): Promise<Addon> {
    const copy = { ...addon };
    this.addons.set(copy.id, copy);
    return { ...copy };
  }
}

export class InMemoryStoreAddonRepository implements StoreAddonRepository {
  private storeAddons = new Map<string, StoreAddon>();

  public async listByStoreId(storeId: string): Promise<readonly StoreAddon[]> {
    const result: StoreAddon[] = [];
    for (const sa of this.storeAddons.values()) {
      if (sa.storeId === storeId) {
        result.push({ ...sa });
      }
    }
    return result;
  }

  public async create(storeAddon: StoreAddon): Promise<StoreAddon> {
    const copy = { ...storeAddon };
    this.storeAddons.set(copy.id, copy);
    return { ...copy };
  }

  public async update(id: string, updates: Partial<StoreAddon>): Promise<StoreAddon> {
    const existing = this.storeAddons.get(id);
    if (!existing) throw new Error(`Store addon not found: ${id}`);
    const updated: StoreAddon = { ...existing, ...updates };
    this.storeAddons.set(id, updated);
    return { ...updated };
  }
}

// ============================================================================
// 6. IN-MEMORY ONBOARDING REPOSITORY
// ============================================================================

export class InMemoryOnboardingRepository implements OnboardingRepository {
  private sessions = new Map<string, OnboardingSession>();

  public async findByUserId(userId: string): Promise<OnboardingSession | null> {
    for (const s of this.sessions.values()) {
      if (s.userId === userId) return { ...s };
    }
    return null;
  }

  public async findById(id: string): Promise<OnboardingSession | null> {
    const s = this.sessions.get(id);
    return s ? { ...s } : null;
  }

  public async create(session: OnboardingSession): Promise<OnboardingSession> {
    const copy = { ...session };
    this.sessions.set(copy.id, copy);
    return { ...copy };
  }

  public async update(id: string, updates: Partial<OnboardingSession>): Promise<OnboardingSession> {
    const existing = this.sessions.get(id);
    if (!existing) throw new Error(`Onboarding session not found: ${id}`);
    const updated: OnboardingSession = {
      ...existing,
      ...updates,
      checklist: updates.checklist
        ? { ...existing.checklist, ...updates.checklist }
        : existing.checklist,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, updated);
    return { ...updated };
  }
}

// ============================================================================
// 7. IN-MEMORY PROVISIONING REPOSITORY
// ============================================================================

export class InMemoryProvisioningRepository implements ProvisioningRepository {
  private records = new Map<string, ProvisioningRecord>();

  public async findByIdempotencyKey(key: string): Promise<ProvisioningRecord | null> {
    for (const r of this.records.values()) {
      if (r.idempotencyKey === key) return { ...r };
    }
    return null;
  }

  public async findByStoreId(storeId: string): Promise<ProvisioningRecord | null> {
    for (const r of this.records.values()) {
      if (r.storeId === storeId) return { ...r };
    }
    return null;
  }

  public async create(record: ProvisioningRecord): Promise<ProvisioningRecord> {
    const copy = { ...record };
    this.records.set(copy.id, copy);
    return { ...copy };
  }

  public async update(
    id: string,
    updates: Partial<ProvisioningRecord>,
  ): Promise<ProvisioningRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`Provisioning record not found: ${id}`);
    const updated: ProvisioningRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return { ...updated };
  }
}

// ============================================================================
// 8. IN-MEMORY IDEMPOTENCY REPOSITORY
// ============================================================================

export class InMemoryBillingIdempotencyRepository implements BillingIdempotencyRepository {
  private storage = new Map<string, { value: unknown; expiresAt?: number }>();

  public async get(key: string): Promise<unknown | null> {
    const entry = this.storage.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.storage.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: unknown, ttlMs = 86_400_000): Promise<void> {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }
}
