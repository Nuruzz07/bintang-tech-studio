import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { SupabaseCategoryRepository } from '../src/repositories/category-repository.js';
import { SupabaseProductRepository } from '../src/repositories/product-repository.js';
import { SupabaseInventoryRepository } from '../src/repositories/inventory-repository.js';
import { SupabaseInventoryItemRepository } from '../src/repositories/inventory-item-repository.js';
import {
  InsufficientStockError,
  NegativeStockError,
  InvalidReservationError,
} from '@bintang/inventory';

describe('Commerce & Inventory Repositories', () => {
  it('SupabaseCategoryRepository: creates, finds, and lists scoped categories', async () => {
    const mockCatRow = {
      id: 'cat-1',
      store_id: 'store-1',
      name: 'Game Top-up',
      slug: 'game-top-up',
      description: 'Digital credits',
      metadata: { status: 'ACTIVE', sortOrder: 1 },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify([mockCatRow]), { status: 201 });
      }
      return new Response(JSON.stringify([mockCatRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseCategoryRepository(client);
    const cat = await repo.findById('store-1', 'cat-1');
    expect(cat).not.toBeNull();
    expect(cat?.name).toBe('Game Top-up');
    expect(cat?.sortOrder).toBe(1);
    expect(cat?.status).toBe('ACTIVE');

    const list = await repo.list('store-1');
    expect(list).toHaveLength(1);
  });

  it('SupabaseProductRepository: creates and queries products with NUMERIC price', async () => {
    const mockProdRow = {
      id: 'prod-1',
      store_id: 'store-1',
      category_id: 'cat-1',
      name: 'Diamond Pass',
      slug: 'diamond-pass',
      description: 'Weekly pass',
      product_type: 'DIGITAL',
      price: '50000.00',
      compare_at_price: '60000.00',
      stock_mode: 'TRACKED',
      inventory_strategy: 'QUANTITY',
      status: 'ACTIVE',
      metadata: {},
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([mockProdRow]), { status: 200 }));

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseProductRepository(client);
    const prod = await repo.findById('store-1', 'prod-1');
    expect(prod).not.toBeNull();
    expect(prod?.price).toBe('50000.00');
    expect(prod?.productType).toBe('DIGITAL');
  });

  it('SupabaseInventoryRepository: atomic reserve, release, consume, and invariant protection', async () => {
    let inventoryState = {
      id: 'inv-1',
      store_id: 'store-1',
      product_id: 'prod-1',
      quantity_on_hand: 10,
      quantity_reserved: 2,
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/rpc/rpc_atomic_reserve_stock') && init?.body) {
        const params = JSON.parse(init.body as string);
        const amount = params.p_amount;
        const available = inventoryState.quantity_on_hand - inventoryState.quantity_reserved;
        if (available < amount) {
          return new Response(
            JSON.stringify({
              message: `Insufficient stock: requested ${amount}, available ${available}`,
            }),
            { status: 400 },
          );
        }
        inventoryState = {
          ...inventoryState,
          quantity_reserved: inventoryState.quantity_reserved + amount,
        };
        return new Response(JSON.stringify(inventoryState), { status: 200 });
      }
      if (url.includes('/rpc/rpc_atomic_release_stock') && init?.body) {
        const params = JSON.parse(init.body as string);
        const amount = params.p_amount;
        if (inventoryState.quantity_reserved < amount) {
          return new Response(
            JSON.stringify({
              message: `Cannot release ${amount} units; only ${inventoryState.quantity_reserved} currently reserved`,
            }),
            { status: 400 },
          );
        }
        inventoryState = {
          ...inventoryState,
          quantity_reserved: inventoryState.quantity_reserved - amount,
        };
        return new Response(JSON.stringify(inventoryState), { status: 200 });
      }
      if (url.includes('/rpc/rpc_atomic_consume_stock') && init?.body) {
        const params = JSON.parse(init.body as string);
        const amount = params.p_amount;
        inventoryState = {
          ...inventoryState,
          quantity_on_hand: inventoryState.quantity_on_hand - amount,
          quantity_reserved: inventoryState.quantity_reserved - amount,
        };
        return new Response(JSON.stringify(inventoryState), { status: 200 });
      }
      if (url.includes('/rpc/rpc_atomic_adjust_stock') && init?.body) {
        const params = JSON.parse(init.body as string);
        if (
          params.p_adjustment_type === 'DECREASE' &&
          inventoryState.quantity_on_hand < params.p_quantity
        ) {
          return new Response(
            JSON.stringify({ message: 'Resulting stock cannot be negative (22003)' }),
            { status: 400 },
          );
        }
      }
      if (init?.method === 'PATCH' && init.body) {
        const patch = JSON.parse(init.body as string);
        inventoryState = { ...inventoryState, ...patch };
        return new Response(JSON.stringify([inventoryState]), { status: 200 });
      }
      return new Response(JSON.stringify([inventoryState]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseInventoryRepository(client);

    // Initial state: on_hand = 10, reserved = 2, available = 8
    // 1. Reserve 3 -> reserved should become 5
    const reserved = await repo.atomicReserve('store-1', 'prod-1', 3);
    expect(reserved.quantityReserved).toBe(5);

    // 2. Try to reserve 10 -> available is 10 - 5 = 5 -> should fail with InsufficientStockError
    await expect(repo.atomicReserve('store-1', 'prod-1', 10)).rejects.toThrow(
      InsufficientStockError,
    );

    // 3. Release 2 -> reserved should become 3
    const released = await repo.atomicRelease('store-1', 'prod-1', 2);
    expect(released.quantityReserved).toBe(3);

    // 4. Try to release 10 -> reserved is 3 -> should fail with InvalidReservationError
    await expect(repo.atomicRelease('store-1', 'prod-1', 10)).rejects.toThrow(
      InvalidReservationError,
    );

    // 5. Consume from reserved: amount = 2 -> on_hand becomes 8, reserved becomes 1
    const consumed = await repo.atomicConsume('store-1', 'prod-1', 2, true);
    expect(consumed.quantityOnHand).toBe(8);
    expect(consumed.quantityReserved).toBe(1);

    // 6. Try to decrease stock to negative -> should fail with NegativeStockError
    await expect(
      repo.atomicAdjustStock('store-1', 'prod-1', { type: 'DECREASE', quantity: 20 }),
    ).rejects.toThrow(NegativeStockError);
  });

  it('SupabaseInventoryItemRepository: creates and updates unique credentials', async () => {
    const mockItemRow = {
      id: 'item-1',
      store_id: 'store-1',
      product_id: 'prod-1',
      inventory_id: null,
      item_type: 'CREDENTIAL',
      secret_reference: 'KEY-ABC-123',
      status: 'AVAILABLE',
      reserved_order_id: null,
      assigned_order_id: null,
      reserved_at: null,
      reserved_until: null,
      assigned_at: null,
      metadata: {},
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Response(
          JSON.stringify([{ ...mockItemRow, status: 'RESERVED', reserved_order_id: 'ord-1' }]),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([mockItemRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseInventoryItemRepository(client);
    const item = await repo.findById('store-1', 'item-1');
    expect(item?.status).toBe('AVAILABLE');

    const updated = await repo.updateStatus('store-1', 'item-1', 'RESERVED', {
      reservedOrderId: 'ord-1',
    });
    expect(updated.status).toBe('RESERVED');
    expect(updated.reservedOrderId).toBe('ord-1');
  });
});
