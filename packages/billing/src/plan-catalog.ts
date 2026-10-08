/**
 * Bintang Tech Studio — Authoritative SaaS Plan Catalog.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Implements authoritative server-side plan definitions:
 * - Starter: Rp50.000 / month, max 20 products, Telegram-first, Rp100.000 setup fee.
 * - Pro & Business: Configurable placeholder metadata without fabricated final pricing.
 */

import { Plan, PublicPlanView } from './types.js';
import { formatCurrency } from './money.js';

export const STANDARD_PLAN_SLUGS = {
  STARTER: 'starter',
  PRO: 'pro',
  BUSINESS: 'business',
} as const;

export const DEFAULT_PLANS: readonly Plan[] = [
  {
    id: 'plan_starter_default',
    name: 'Starter Merchant',
    slug: STANDARD_PLAN_SLUGS.STARTER,
    monthlyPrice: '50000.00',
    activationFee: '100000.00',
    maxProducts: 20,
    status: 'ACTIVE',
    features: {
      telegram: true,
      whatsapp: false,
      vouchers: true,
      broadcast: true,
      analytics: 'basic',
      staffMax: 3,
      salesReports: true,
      transactionHistory: true,
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'plan_pro_default',
    name: 'Pro Growth',
    slug: STANDARD_PLAN_SLUGS.PRO,
    monthlyPrice: '150000.00', // Configurable placeholder
    activationFee: '100000.00',
    maxProducts: 100,
    status: 'ACTIVE',
    features: {
      telegram: true,
      whatsapp: true,
      vouchers: true,
      broadcast: true,
      analytics: 'advanced',
      staffMax: 10,
      salesReports: true,
      transactionHistory: true,
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'plan_business_default',
    name: 'Business Enterprise',
    slug: STANDARD_PLAN_SLUGS.BUSINESS,
    monthlyPrice: '500000.00', // Configurable placeholder
    activationFee: '100000.00',
    maxProducts: 1000,
    status: 'ACTIVE',
    features: {
      telegram: true,
      whatsapp: true,
      vouchers: true,
      broadcast: true,
      analytics: 'advanced',
      staffMax: 50,
      salesReports: true,
      transactionHistory: true,
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

export const STARTER_PLAN_BASELINE: Plan = DEFAULT_PLANS[0]!;
export const PRO_PLAN_BASELINE: Plan = DEFAULT_PLANS[1]!;
export const BUSINESS_PLAN_BASELINE: Plan = DEFAULT_PLANS[2]!;

export function toPublicPlanView(plan: Plan): PublicPlanView {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: plan.monthlyPrice,
    formattedMonthlyPrice: formatCurrency(plan.monthlyPrice),
    activationFee: plan.activationFee,
    formattedActivationFee: formatCurrency(plan.activationFee),
    maxProducts: plan.maxProducts,
    status: plan.status,
    features: plan.features,
  };
}
