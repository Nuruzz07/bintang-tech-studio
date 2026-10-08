/**
 * Bintang Tech Studio — Seller Dashboard Security & Isolation Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 *
 * Verifies all 25 critical security scenarios:
 * 1. Zero Client Trust & Context Resolution
 * 2. Strict Cross-Tenant Isolation (IDOR Resistance)
 * 3. Zero Secret Leakage Invariants
 * 4. Anti-Owner-Demotion & Privilege Escalation Protection
 * 5. Entitlement Quota Enforcement & Tier Bypass Resistance
 * 6. Session Integrity, Revocation & Expiration
 * 7. Server-Rendered HTML Escaping & XSS Resilience
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import {
  SellerUnauthenticatedError,
  StoreSwitchUnauthorizedError,
  StoreSuspendedError,
  SellerResourceNotFoundError,
  OwnerDemotionForbiddenError,
  ProductLimitExceededError,
  StaffLimitExceededError,
  ChannelFeatureDisabledError,
  VoucherFeatureDisabledError,
} from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';
import { renderProductsHtml, renderDashboardShell } from '../src/ui/dashboard-views.js';

describe('Seller Dashboard — Security, Multi-Tenant Isolation & Zero Trust', () => {
  let harness: SellerDashboardTestHarness;
  let aliceSession: string; // Store A Owner
  let bobSession: string; // Store A Admin
  let danSession: string; // Store A Staff
  let _charlieSession: string; // Store B Owner

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();

    const aliceRes = await harness.loginAs(harness.userAlice, harness.storeA.id);
    aliceSession = aliceRes.sessionToken;

    const bobRes = await harness.loginAs(harness.userBob, harness.storeA.id);
    bobSession = bobRes.sessionToken;

    const danRes = await harness.loginAs(harness.userDan, harness.storeA.id);
    danSession = danRes.sessionToken;

    const charlieRes = await harness.loginAs(harness.userCharlie, harness.storeB.id);
    _charlieSession = charlieRes.sessionToken;
  });

  // ==========================================================================
  // 1. SESSION INTEGRITY & ZERO CLIENT TRUST
  // ==========================================================================
  describe('Session Integrity & Zero Client Trust', () => {
    it('rejects forged or non-existent session tokens', async () => {
      await expect(harness.dashboardService.getOverview('fake_token_12345')).rejects.toThrow(
        SellerUnauthenticatedError,
      );

      await expect(harness.dashboardService.listProducts('')).rejects.toThrow(
        SellerUnauthenticatedError,
      );
    });

    it('rejects sessions for suspended stores', async () => {
      await expect(
        harness.sessionManager.createSession(harness.userAlice, harness.storeC.id),
      ).rejects.toThrow(StoreSuspendedError);
    });

    it('rejects unauthorized store switching attempts', async () => {
      // Bob is member only in Store A, cannot switch to Store B
      await expect(
        harness.sessionManager.switchActiveStore(bobSession, harness.storeB.id),
      ).rejects.toThrow(StoreSwitchUnauthorizedError);
    });

    it('immediately invalidates session when store member is deactivated or deleted', async () => {
      const danContext = await harness.sessionManager.resolveActiveContext(danSession);
      expect(danContext.userId).toBe(harness.userDan.id);

      // Deactivate Dan
      await harness.memberRepo.update(harness.memberDanA.id, { status: 'REVOKED' });

      // Immediate invalidation on next call
      await expect(harness.dashboardService.listOrders(danSession)).rejects.toThrow(
        'Keanggotaan Anda di toko ini sudah tidak aktif atau dicabut.',
      );
    });

    it('resolves storeId strictly from server-side session, ignoring client-supplied store identifiers', async () => {
      // Alice active context is Store A
      const products = await harness.dashboardService.listProducts(aliceSession);
      for (const p of products) {
        expect(p.storeId).toBe(harness.storeA.id);
        expect(p.storeId).not.toBe(harness.storeB.id);
      }
    });
  });

  // ==========================================================================
  // 2. CROSS-TENANT ISOLATION (IDOR RESISTANCE)
  // ==========================================================================
  describe('Cross-Tenant Isolation (Anti-IDOR)', () => {
    it('prevents Store A seller from fetching Store B product details', async () => {
      await expect(
        harness.dashboardService.getProduct(aliceSession, harness.productB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from updating or archiving Store B product', async () => {
      await expect(
        harness.dashboardService.updateProduct(aliceSession, harness.productB1.id, {
          name: 'Hacked Name',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);

      await expect(
        harness.dashboardService.archiveProduct(aliceSession, harness.productB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from updating or deleting Store B category', async () => {
      await expect(
        harness.dashboardService.updateCategory(aliceSession, harness.categoryB1.id, {
          name: 'Hacked Category',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);

      await expect(
        harness.dashboardService.deleteCategory(aliceSession, harness.categoryB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from adjusting stock of Store B product', async () => {
      await expect(
        harness.dashboardService.adjustStock(aliceSession, harness.productB1.id, {
          quantity: 10,
          adjustmentType: 'INCREASE',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from viewing or cancelling Store B order', async () => {
      await expect(
        harness.dashboardService.getOrderById(aliceSession, harness.orderB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);

      await expect(
        harness.dashboardService.cancelOrder(aliceSession, {
          orderId: harness.orderB1.id,
          reason: 'Malicious cancel',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from viewing Store B customer details', async () => {
      await expect(
        harness.dashboardService.getCustomerById(aliceSession, harness.customerB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from updating or deleting Store B voucher', async () => {
      await expect(
        harness.dashboardService.updateVoucher(aliceSession, harness.voucherB1.id, {
          discountValue: '99.00',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);

      await expect(
        harness.dashboardService.deleteVoucher(aliceSession, harness.voucherB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('prevents Store A seller from viewing Store B fulfillment details', async () => {
      await expect(
        harness.dashboardService.getFulfillmentById(aliceSession, 'ful_b1'),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });
  });

  // ==========================================================================
  // 3. ZERO SECRET LEAKAGE INVARIANTS
  // ==========================================================================
  describe('Zero Secret Leakage Invariants', () => {
    it('never exposes Telegram bot tokens, secrets, or credential references', async () => {
      const binding = await harness.dashboardService.getTelegramBotBinding(aliceSession);
      expect(binding).toBeDefined();

      const serialized = JSON.stringify(binding);
      expect(serialized).not.toContain('botToken');
      expect(serialized).not.toContain('webhookSecret');
      expect(serialized).not.toContain('secret_cred_ref_never_leaked');
      expect('credentialReference' in (binding as unknown as Record<string, unknown>)).toBe(false);
    });

    it('never exposes digital inventory credential payloads or PINs in inventory views', async () => {
      const inventoryList = await harness.dashboardService.listInventory(aliceSession);
      const serialized = JSON.stringify(inventoryList);
      expect(serialized).not.toContain('ML-KEY-ALPHA');
      expect(serialized).not.toContain('9988');

      const digitalSummary =
        await harness.dashboardService.getDigitalInventorySummary(aliceSession);
      const summarySerialized = JSON.stringify(digitalSummary);
      expect(summarySerialized).not.toContain('ML-KEY-ALPHA');
      expect(summarySerialized).not.toContain('9988');
    });

    it('never exposes payment provider API keys, webhook secrets, or signatures', async () => {
      const accounts = await harness.dashboardService.listPaymentAccounts(aliceSession);
      const serialized = JSON.stringify(accounts);
      expect(serialized).not.toContain('apiKey');
      expect(serialized).not.toContain('secretKey');
      expect(serialized).not.toContain('webhookSecret');
      expect(serialized).not.toContain('credentialsPayload');
    });

    it('never exposes raw credential payloads in fulfillment order views', async () => {
      const order = await harness.dashboardService.getOrderById(aliceSession, harness.orderA2.id);
      const serialized = JSON.stringify(order);
      expect(serialized).not.toContain('credentialPayload');
      expect(serialized).not.toContain('secretKey');
    });
  });

  // ==========================================================================
  // 4. ANTI-OWNER-DEMOTION & PRIVILEGE ESCALATION
  // ==========================================================================
  describe('Anti-Owner-Demotion & Privilege Escalation', () => {
    it('strictly forbids demoting the STORE_OWNER to any other role', async () => {
      await expect(
        harness.dashboardService.updateMemberRole(aliceSession, {
          membershipId: harness.memberAliceA.id,
          role: 'STORE_ADMIN',
        }),
      ).rejects.toThrow(OwnerDemotionForbiddenError);

      await expect(
        harness.dashboardService.updateMemberRole(aliceSession, {
          membershipId: harness.memberAliceA.id,
          role: 'STORE_STAFF',
        }),
      ).rejects.toThrow(OwnerDemotionForbiddenError);
    });

    it('strictly forbids deleting or removing the STORE_OWNER membership', async () => {
      await expect(
        harness.dashboardService.removeMember(aliceSession, harness.memberAliceA.id),
      ).rejects.toThrow(OwnerDemotionForbiddenError);
    });

    it('prevents store staff from escalating privileges or inviting admins', async () => {
      await expect(
        harness.dashboardService.inviteMember(danSession, {
          email: 'escalation@attack.com',
          name: 'Hacker',
          role: 'STORE_ADMIN',
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  // ==========================================================================
  // 5. ENTITLEMENT LIMITS & TIER BYPASS RESISTANCE
  // ==========================================================================
  describe('Entitlement Quota Enforcement & Tier Bypass Resistance', () => {
    it('enforces maximum product limit according to store subscription plan', async () => {
      // Set quota of Store A to 2 products (currently has 2)
      harness.entitlementResolver.setStoreConfig(harness.storeA.id, {
        planSlug: 'starter',
        baseEntitlements: {
          'products.max': 2,
        },
      });

      await expect(
        harness.dashboardService.createProduct(aliceSession, {
          name: 'Exceeding Product',
          slug: 'exceeding-product',
          price: 50000,
        }),
      ).rejects.toThrow(ProductLimitExceededError);
    });

    it('enforces maximum staff member limit according to store subscription plan', async () => {
      // Store A has 3 members and Starter max is 3
      await expect(
        harness.dashboardService.inviteMember(aliceSession, {
          email: 'unauthorized_staff@store.com',
          name: 'Staff Over Quota',
          role: 'STORE_STAFF',
        }),
      ).rejects.toThrow(StaffLimitExceededError);
    });

    it('blocks access to disabled features (e.g. Telegram Channel on Basic store)', async () => {
      // Store D has telegram: false
      const aliceSessionD = await harness.loginAs(harness.userAlice, harness.storeD.id);

      await expect(
        harness.dashboardService.getTelegramBotBinding(aliceSessionD.sessionToken),
      ).rejects.toThrow(ChannelFeatureDisabledError);
    });

    it('blocks voucher creation when feature is disabled on plan', async () => {
      // Store D has voucher: false
      const aliceSessionD = await harness.loginAs(harness.userAlice, harness.storeD.id);

      await expect(
        harness.dashboardService.createVoucher(aliceSessionD.sessionToken, {
          code: 'PROMOFAIL',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        }),
      ).rejects.toThrow(VoucherFeatureDisabledError);
    });
  });

  // ==========================================================================
  // 6. XSS RESILIENCE & HTML VIEW ESCAPING
  // ==========================================================================
  describe('XSS Resilience & HTML View Escaping', () => {
    it('escapes user input in rendered HTML views to prevent XSS attacks', async () => {
      // Create product with XSS payload
      await harness.dashboardService.createProduct(aliceSession, {
        name: '<script>alert("XSS")</script>',
        slug: 'xss-product',
        price: 15000,
        description: '<img src=x onerror=alert(1)>',
      });

      const session = await harness.sessionManager.resolveActiveContext(aliceSession);
      const rawSession = harness.sessionManager.getSession(aliceSession);
      const products = await harness.dashboardService.listProducts(aliceSession);

      const contentHtml = renderProductsHtml(products);
      const html = renderDashboardShell(session, rawSession!, 'products', contentHtml);

      expect(html).not.toContain('<script>alert("XSS")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
    });
  });
});
