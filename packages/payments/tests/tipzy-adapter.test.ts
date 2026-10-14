import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { TipzyPaymentProviderAdapter } from '../src/tipzy-provider-adapter.js';

describe('TipzyPaymentProviderAdapter Suite', () => {
  const dummyApiKey = 'tipzy_test_api_key_12345';
  const dummyCallbackSecret = 'secret_callback_98765';
  const dummyBaseUrl = 'https://api.tipzy.id';

  let adapter: TipzyPaymentProviderAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    adapter = new TipzyPaymentProviderAdapter({
      apiKey: dummyApiKey,
      callbackSecret: dummyCallbackSecret,
      baseUrl: dummyBaseUrl,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  it('declares provider code as TIPZY with correct capabilities', () => {
    expect(adapter.provider).toBe('TIPZY');
    const capabilities = adapter.getCapabilities();
    expect(capabilities.createPayment).toBe(true);
    expect(capabilities.verifyPayment).toBe(true);
    expect(capabilities.webhook).toBe(true);
    expect(capabilities.refund).toBe(false);
  });

  it('creates payment by sending POST request to /api/v1/gateway/transactions with Bearer auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          transaction_id: 'tx_tipzy_001',
          payment_url: 'https://tipzy.id/donation/transaction/tx_tipzy_001',
          status: 'pending',
          amount: 25000,
        },
      }),
    });

    const result = await adapter.createPayment({
      storeId: 'store_01',
      paymentIntentId: 'pi_01',
      attemptId: 'att_01',
      orderId: 'ord_01',
      amount: '25000.00',
      currency: 'IDR',
      customerId: 'cust_01',
      credentialReference: 'vault:tipzy',
      metadata: {
        customerName: 'Budi Santoso',
        customerEmail: 'budi@example.com',
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://api.tipzy.id/api/v1/gateway/transactions');
    expect(calledInit.method).toBe('POST');
    expect((calledInit.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${dummyApiKey}`,
    );
    expect((calledInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(calledInit.body as string);
    expect(parsedBody.amount).toBe(25000);
    expect(parsedBody.payment_channel).toBe('QRIS');
    expect(parsedBody.name).toBe('Budi Santoso');
    expect(parsedBody.email).toBe('budi@example.com');

    expect(result.providerReference).toBe('tx_tipzy_001');
    expect(result.paymentUrl).toBe('https://tipzy.id/donation/transaction/tx_tipzy_001');
    expect(result.status).toBe('PENDING');
  });

  it('verifies payment status via GET /api/v1/gateway/transactions/:transactionId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          transaction_id: 'tx_tipzy_001',
          status: 'paid',
          amount: 25000,
        },
      }),
    });

    const statusResult = await adapter.verifyPayment({
      storeId: 'store_01',
      paymentIntentId: 'pi_01',
      providerReference: 'tx_tipzy_001',
      credentialReference: 'vault:tipzy',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.tipzy.id/api/v1/gateway/transactions/tx_tipzy_001',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${dummyApiKey}`,
        }),
      }),
    );

    expect(statusResult.providerReference).toBe('tx_tipzy_001');
    expect(statusResult.status).toBe('SUCCEEDED');
    expect(statusResult.amount).toBe('25000.00');
    expect(statusResult.currency).toBe('IDR');
  });

  it('verifies webhook signature matching X-Tipzy-Signature with HMAC SHA-256', async () => {
    const rawBody = JSON.stringify({
      transaction_id: 'tx_tipzy_001',
      status: 'paid',
      amount: 25000,
    });
    const validSignature = createHmac('sha256', dummyCallbackSecret).update(rawBody).digest('hex');

    const isValid = await adapter.verifyWebhookSignature({
      payload: JSON.parse(rawBody),
      rawBody,
      headers: {
        'x-tipzy-signature': validSignature,
      },
      credentialReference: 'vault:tipzy',
    });

    expect(isValid).toBe(true);

    const isInvalid = await adapter.verifyWebhookSignature({
      payload: JSON.parse(rawBody),
      rawBody,
      headers: {
        'x-tipzy-signature': 'forged_signature_hex',
      },
      credentialReference: 'vault:tipzy',
    });

    expect(isInvalid).toBe(false);
  });

  it('parses webhook callback event into domain ParsedWebhookEvent', async () => {
    const payload = {
      event_id: 'evt_tipzy_123',
      transaction_id: 'tx_tipzy_001',
      status: 'paid',
      amount: 25000,
      payment_intent_id: 'pi_01',
      store_id: 'store_01',
    };

    const parsed = await adapter.parseWebhookEvent({
      payload,
    });

    expect(parsed.providerReference).toBe('tx_tipzy_001');
    expect(parsed.status).toBe('SUCCEEDED');
    expect(parsed.amount).toBe('25000.00');
    expect(parsed.currency).toBe('IDR');
  });
});
