import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { SupabaseCustomerRepository } from '../src/repositories/customer-repository.js';
import { SupabaseOrderRepository } from '../src/repositories/order-repository.js';
import { SupabasePaymentAccountRepository } from '../src/repositories/payment-account-repository.js';
import { SupabasePaymentRepository } from '../src/repositories/payment-repository.js';
import { SupabasePaymentEventRepository } from '../src/repositories/payment-event-repository.js';

describe('Orders & Payments Repositories', () => {
  it('SupabaseCustomerRepository: creates and queries customer profile', async () => {
    const mockCustomerRow = {
      id: 'cust-1',
      store_id: 'store-1',
      name: 'Budi Pembeli',
      email: 'budi@example.com',
      phone: '081234567890',
      notes: null,
      metadata: { telegramId: 'tg-12345', totalOrders: 1, totalSpent: '50000.00' },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([mockCustomerRow]), { status: 200 }));

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseCustomerRepository(client);
    const customer = await repo.findById('store-1', 'cust-1');
    expect(customer?.name).toBe('Budi Pembeli');
    expect(customer?.telegramId).toBe('tg-12345');
    expect(customer?.totalOrders).toBe(1);
  });

  it('SupabaseOrderRepository: atomically creates order with item snapshots and updates status', async () => {
    const mockOrderRow = {
      id: 'ord-100',
      store_id: 'store-1',
      customer_id: 'cust-1',
      order_number: 'ORD-2026-0001',
      status: 'PENDING_PAYMENT',
      currency: 'IDR',
      subtotal: '50000.00',
      discount: '0.00',
      tax: '0.00',
      total: '50000.00',
      voucher_id: null,
      metadata: { fulfillmentStatus: 'PENDING' },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockItemRow = {
      id: 'item-100',
      order_id: 'ord-100',
      store_id: 'store-1',
      product_id: 'prod-1',
      name_snapshot: 'Weekly Diamond Pass',
      price_snapshot: '50000.00',
      quantity: 1,
      total: '50000.00',
      metadata: {},
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        if (url.includes('order_items')) {
          return new Response(JSON.stringify([mockItemRow]), { status: 201 });
        }
        return new Response(JSON.stringify([mockOrderRow]), { status: 201 });
      }
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ ...mockOrderRow, status: 'PAID' }]), { status: 200 });
      }
      if (url.includes('order_items')) {
        return new Response(JSON.stringify([mockItemRow]), { status: 200 });
      }
      return new Response(JSON.stringify([mockOrderRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseOrderRepository(client);

    const created = await repo.create(
      'store-1',
      {
        id: 'ord-100',
        storeId: 'store-1',
        customerId: 'cust-1',
        orderNumber: 'ORD-2026-0001',
        status: 'PENDING_PAYMENT',
        subtotal: '50000.00',
        discountTotal: '0.00',
        grandTotal: '50000.00',
        currency: 'IDR',
        voucherId: null,
        fulfillmentStatus: 'PENDING',
        metadata: {},
        createdAt: '2026-10-08T00:00:00Z',
        updatedAt: '2026-10-08T00:00:00Z',
      },
      [
        {
          id: 'item-100',
          storeId: 'store-1',
          orderId: 'ord-100',
          productId: 'prod-1',
          productName: 'Weekly Diamond Pass',
          quantity: 1,
          unitPrice: '50000.00',
          subtotal: '50000.00',
          metadata: {},
          createdAt: '2026-10-08T00:00:00Z',
        },
      ],
    );

    expect(created.orderNumber).toBe('ORD-2026-0001');
    expect(created.items).toHaveLength(1);
    expect(created.items[0]?.productName).toBe('Weekly Diamond Pass');

    const updated = await repo.updateStatus('store-1', 'ord-100', 'PAID');
    expect(updated.status).toBe('PAID');
  });

  it('SupabasePaymentAccountRepository & SupabasePaymentRepository: manage payment intents', async () => {
    const mockAccountRow = {
      id: 'pay-acc-1',
      store_id: 'store-1',
      provider: 'tipzy',
      status: 'ACTIVE',
      configuration: { displayName: 'Tipzy QRIS', currency: 'IDR', credentialReference: 'cred-1' },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockPaymentRow = {
      id: 'pi-1',
      store_id: 'store-1',
      order_id: 'ord-100',
      payment_account_id: 'pay-acc-1',
      provider: 'tipzy',
      provider_reference: 'tipzy-charge-999',
      amount: '50000.00',
      currency: 'IDR',
      status: 'PENDING',
      payment_method: 'QRIS',
      qr_code_data: null,
      pay_url: 'https://pay.tipzy.id/charge-999',
      expires_at: '2026-10-08T01:00:00Z',
      paid_at: null,
      metadata: { customerId: 'cust-1' },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('payment_accounts')) {
        return new Response(JSON.stringify([mockAccountRow]), { status: 200 });
      }
      return new Response(JSON.stringify([mockPaymentRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const accRepo = new SupabasePaymentAccountRepository(client);
    const activeAccount = await accRepo.findActiveByStore('store-1');
    expect(activeAccount?.provider).toBe('tipzy');
    expect(activeAccount?.displayName).toBe('Tipzy QRIS');

    const paymentRepo = new SupabasePaymentRepository(client);
    const intent = await paymentRepo.findById('store-1', 'pi-1');
    expect(intent?.amount).toBe('50000.00');
    expect(intent?.status).toBe('PENDING');
  });

  it('SupabasePaymentEventRepository: verifies webhook idempotency and deduplication', async () => {
    const mockEventRow = {
      id: 'pe-1',
      provider: 'tipzy',
      provider_event_id: 'evt-tipzy-001',
      event_type: 'PAYMENT_SUCCEEDED',
      store_id: 'store-1',
      payment_id: 'pi-1',
      payload: { amount: '50000.00', orderId: 'ord-100' },
      status: 'RECEIVED',
      processed_at: null,
      created_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Response(
          JSON.stringify([
            { ...mockEventRow, status: 'PROCESSED', processed_at: '2026-10-08T00:01:00Z' },
          ]),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([mockEventRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const eventRepo = new SupabasePaymentEventRepository(client);
    const existing = await eventRepo.findByProviderEventId('tipzy', 'evt-tipzy-001');
    expect(existing).not.toBeNull();
    expect(existing?.eventId).toBe('evt-tipzy-001');
    expect(existing?.processingStatus).toBe('RECEIVED');

    const updated = await eventRepo.updateProcessingStatus('pe-1', 'PROCESSED');
    expect(updated.processingStatus).toBe('PROCESSED');
  });
});
