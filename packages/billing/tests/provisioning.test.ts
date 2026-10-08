/**
 * Bintang Tech Studio — Idempotent Store Provisioning Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness } from './test-helpers.js';
import { ProvisioningError, ProvisioningAlreadyCompletedError } from '../src/errors.js';

describe('M13 Store Provisioning Lifecycle & Invariants Suite', () => {
  it('successfully provisions a store and assigns authoritative STORE_OWNER membership', async () => {
    const harness = createTestBillingHarness();

    const result = await harness.provisioningService.provisionStore({
      userId: 'user-merchant-1',
      storeName: 'Bintang Gadget',
      storeSlug: 'bintang-gadget',
      planSlug: 'starter',
      idempotencyKey: 'prov-key-1',
    });

    expect(result.status).toBe('PROVISIONING_COMPLETED');
    expect(result.storeId).toBeDefined();

    // Verify store exists in store repository
    const store = await harness.storeRepo.findById(result.storeId);
    expect(store).not.toBeNull();
    expect(store?.name).toBe('Bintang Gadget');
    expect(store?.slug).toBe('bintang-gadget');
    expect(store?.ownerUserId).toBe('user-merchant-1');

    // Verify STORE_OWNER membership exists
    const members = await harness.storeMemberRepo.findByStoreId(result.storeId);
    expect(members.length).toBe(1);
    expect(members[0].userId).toBe('user-merchant-1');
    expect(members[0].role).toBe('STORE_OWNER');
    expect(members[0].status).toBe('ACTIVE');

    // Verify provisioning record steps
    expect(result.record.stepsCompleted).toContain('STORE_CREATED');
    expect(result.record.stepsCompleted).toContain('OWNER_MEMBERSHIP_CREATED');
    expect(result.record.stepsCompleted).toContain('CONFIG_INITIALIZED');
  });

  it('IDEMPOTENCY: returns existing provisioned store on duplicate idempotency key without duplicate resources', async () => {
    const harness = createTestBillingHarness();

    const firstRun = await harness.provisioningService.provisionStore({
      userId: 'user-merchant-2',
      storeName: 'Toko Dua',
      storeSlug: 'toko-dua',
      planSlug: 'starter',
      idempotencyKey: 'prov-key-idempotent-unique',
    });

    const secondRun = await harness.provisioningService.provisionStore({
      userId: 'user-merchant-2',
      storeName: 'Toko Dua',
      storeSlug: 'toko-dua',
      planSlug: 'starter',
      idempotencyKey: 'prov-key-idempotent-unique',
    });

    expect(secondRun.storeId).toBe(firstRun.storeId);
    expect(secondRun.status).toBe('PROVISIONING_COMPLETED');

    // Verify no duplicate store was created
    const stores = await harness.storeRepo.findByOwnerUserId('user-merchant-2');
    expect(stores.length).toBe(1);

    // Verify no duplicate membership was created
    const members = await harness.storeMemberRepo.findByStoreId(firstRun.storeId);
    expect(members.length).toBe(1);
  });

  it('FAILURE RECOVERY: records failure state when simulated error occurs, and allows clean retry', async () => {
    const harness = createTestBillingHarness();

    // 1. Simulate failure during initial store creation
    harness.provisioningService.setSimulateFailure(true);

    await expect(
      harness.provisioningService.provisionStore({
        userId: 'user-merchant-3',
        storeName: 'Toko Tiga',
        storeSlug: 'toko-tiga',
        planSlug: 'starter',
        idempotencyKey: 'prov-fail-key-1',
      }),
    ).rejects.toThrow(ProvisioningError);

    // Verify record was marked failed
    const record = await harness.provisioningRepo.findByIdempotencyKey('prov-fail-key-1');
    expect(record).not.toBeNull();
    expect(record?.status).toBe('PROVISIONING_FAILED');
    expect(record?.failureReason).toContain('Simulated infrastructure failure');

    // 2. Disable failure simulation and retry
    harness.provisioningService.setSimulateFailure(false);

    const recovered = await harness.provisioningService.retryProvisioning('prov-fail-key-1', {
      userId: 'user-merchant-3',
      storeName: 'Toko Tiga',
      storeSlug: 'toko-tiga',
      planSlug: 'starter',
      idempotencyKey: 'prov-fail-key-1',
    });

    expect(recovered.status).toBe('PROVISIONING_COMPLETED');
    expect(recovered.storeId).toBeDefined();

    const recoveredRecord = await harness.provisioningRepo.findByIdempotencyKey('prov-fail-key-1');
    expect(recoveredRecord?.status).toBe('PROVISIONING_COMPLETED');
    expect(recoveredRecord?.failureReason).toBeNull();
  });

  it('rejects retrying an already completed provisioning record', async () => {
    const harness = createTestBillingHarness();

    await harness.provisioningService.provisionStore({
      userId: 'user-merchant-4',
      storeName: 'Toko Empat',
      storeSlug: 'toko-empat',
      planSlug: 'starter',
      idempotencyKey: 'prov-completed-key',
    });

    await expect(
      harness.provisioningService.retryProvisioning('prov-completed-key'),
    ).rejects.toThrow(ProvisioningAlreadyCompletedError);
  });
});
