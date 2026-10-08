/**
 * Bintang Tech Studio — Billing & Onboarding Repository Interfaces.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Mapped 1:1 with M02 PostgreSQL schema tables:
 * public.plans, public.subscriptions, public.invoices, public.invoice_items,
 * public.billing_payments, public.addons, public.store_addons.
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

export interface PlanRepository {
  list(filter?: { status?: PlanStatus }): Promise<readonly Plan[]>;
  findById(id: string): Promise<Plan | null>;
  findBySlug(slug: string): Promise<Plan | null>;
  create(plan: Plan): Promise<Plan>;
  update(id: string, updates: Partial<Plan>): Promise<Plan>;
}

export interface SubscriptionRepository {
  findByStoreId(storeId: string): Promise<Subscription | null>;
  findById(id: string): Promise<Subscription | null>;
  create(subscription: Subscription): Promise<Subscription>;
  update(id: string, updates: Partial<Subscription>): Promise<Subscription>;
}

export interface InvoiceRepository {
  listByStoreId(
    storeId: string,
    filter?: { status?: InvoiceStatus },
  ): Promise<readonly InvoiceWithItems[]>;
  findById(id: string): Promise<InvoiceWithItems | null>;
  findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceWithItems | null>;
  create(invoice: Invoice, items: readonly InvoiceItem[]): Promise<InvoiceWithItems>;
  updateStatus(
    id: string,
    status: InvoiceStatus,
    paidAt?: string | null,
  ): Promise<InvoiceWithItems>;
  hasStorePaidActivationFee(storeId: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}

export interface BillingPaymentRepository {
  listByStoreId(storeId: string): Promise<readonly BillingPayment[]>;
  findById(id: string): Promise<BillingPayment | null>;
  findByInvoiceId(invoiceId: string): Promise<readonly BillingPayment[]>;
  create(payment: BillingPayment): Promise<BillingPayment>;
  updateStatus(
    id: string,
    status: BillingPaymentStatus,
    updates?: Partial<BillingPayment>,
  ): Promise<BillingPayment>;
  delete(id: string): Promise<void>;
}

export interface AddonRepository {
  list(): Promise<readonly Addon[]>;
  findBySlug(slug: string): Promise<Addon | null>;
  create(addon: Addon): Promise<Addon>;
}

export interface StoreAddonRepository {
  listByStoreId(storeId: string): Promise<readonly StoreAddon[]>;
  create(storeAddon: StoreAddon): Promise<StoreAddon>;
  update(id: string, updates: Partial<StoreAddon>): Promise<StoreAddon>;
}

export interface OnboardingRepository {
  findByUserId(userId: string): Promise<OnboardingSession | null>;
  findById(id: string): Promise<OnboardingSession | null>;
  create(session: OnboardingSession): Promise<OnboardingSession>;
  update(id: string, updates: Partial<OnboardingSession>): Promise<OnboardingSession>;
}

export interface ProvisioningRepository {
  findByIdempotencyKey(key: string): Promise<ProvisioningRecord | null>;
  findByStoreId(storeId: string): Promise<ProvisioningRecord | null>;
  create(record: ProvisioningRecord): Promise<ProvisioningRecord>;
  update(id: string, updates: Partial<ProvisioningRecord>): Promise<ProvisioningRecord>;
}

export interface BillingIdempotencyRepository {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
}
