import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import {
  FulfillmentIdempotencyConflictError,
  InMemoryFulfillmentIdempotencyRepository,
} from '../src/index.js';

describe('M09 Fulfillment Idempotency Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('safely replays createFulfillment when using the same idempotency key and payload', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const key = 'idem_create_key_1';

    const first = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, idempotencyKey: key },
    );

    const second = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, idempotencyKey: key },
    );

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);

    // Verify only ONE fulfillment exists in the repository
    const all = await h.fulfillmentRepo.findByOrderId(h.storeId, order.id);
    expect(all).toHaveLength(1);
  });

  it('rejects createFulfillment if same key is used with mutated payload', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const key = 'idem_create_conflict_key';

    await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'DIGITAL_AUTO', idempotencyKey: key },
    );

    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id, strategy: 'DIGITAL_MANUAL', idempotencyKey: key },
      ),
    ).rejects.toThrow(FulfillmentIdempotencyConflictError);
  });

  it('safely replays executeFulfillment without duplicate provider calls', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const execKey = 'idem_exec_key_1';
    const firstExec = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id, idempotencyKey: execKey },
    );
    expect(firstExec.status).toBe('FULFILLED');
    expect(h.mockProvider.deliveryCalls).toHaveLength(1);

    // Second call with same idempotency key
    const secondExec = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id, idempotencyKey: execKey },
    );
    expect(secondExec.id).toBe(firstExec.id);
    expect(secondExec.status).toBe('FULFILLED');

    // Provider should NOT have been called a second time
    expect(h.mockProvider.deliveryCalls).toHaveLength(1);
  });

  it('rejects executeFulfillment if same key is used with mutated payload', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const execKey = 'idem_exec_conflict_key';
    await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id, providerName: 'MOCK_DIGITAL', idempotencyKey: execKey },
    );

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        {
          fulfillmentId: f.id,
          manualPayloads: { [order.items[0]!.id]: 'MUTATED_PAYLOAD' },
          idempotencyKey: execKey,
        },
      ),
    ).rejects.toThrow(FulfillmentIdempotencyConflictError);
  });

  it('isolates idempotency records by actor ID', async () => {
    const repo = new InMemoryFulfillmentIdempotencyRepository();
    const now = new Date().toISOString();

    await repo.set({
      storeId: 'store_1',
      actorId: 'user_A',
      key: 'shared_key',
      requestHash: 'hash_A',
      response: { data: 'response_A' },
      createdAt: now,
    });

    // Same key by user_B does not match user_A
    const userBRecord = await repo.get('store_1', 'user_B', 'shared_key');
    expect(userBRecord).toBeNull();

    const userARecord = await repo.get('store_1', 'user_A', 'shared_key');
    expect(userARecord?.requestHash).toBe('hash_A');
  });

  it('isolates idempotency records by store ID', async () => {
    const repo = new InMemoryFulfillmentIdempotencyRepository();
    const now = new Date().toISOString();

    await repo.set({
      storeId: 'store_alpha',
      actorId: 'user_A',
      key: 'key_1',
      requestHash: 'hash_alpha',
      response: { data: 'store_alpha_res' },
      createdAt: now,
    });

    const storeBetaRecord = await repo.get('store_beta', 'user_A', 'key_1');
    expect(storeBetaRecord).toBeNull();
  });
});
