declare const process:
  | {
      readonly env: Record<string, string | undefined>;
    }
  | undefined;

import { PaymentAttemptStatus, PaymentProviderCapabilities } from './types.js';
import {
  PaymentProviderAdapter,
  CreateProviderPaymentInput,
  ProviderPaymentResult,
  VerifyProviderPaymentInput,
  ProviderPaymentStatusResult,
  VerifyWebhookSignatureInput,
  ParseWebhookEventInput,
  ParsedWebhookEvent,
  CreateProviderRefundInput,
  ProviderRefundResult,
} from './provider-adapter.js';
import { PaymentCapabilityUnsupportedError, PaymentError } from './errors.js';
import { normalizeMoney } from './money.js';

export interface TipzyCredentials {
  readonly apiKey?: string | undefined;
  readonly callbackSecret?: string | undefined;
  readonly merchantCode?: string | undefined;
}

export interface TipzyPaymentProviderAdapterOptions {
  readonly apiKey?: string | undefined;
  readonly callbackSecret?: string | undefined;
  readonly merchantCode?: string | undefined;
  readonly baseUrl?: string | undefined;
  readonly fetchFn?: typeof fetch | undefined;
  readonly credentialResolver?: (
    credentialReference: string,
  ) => Promise<TipzyCredentials> | TipzyCredentials;
}

/**
 * Constant-time string equality comparison to resist timing attacks on webhook signatures.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Computes HMAC-SHA256 digest using standard Web Crypto API.
 */
async function computeHmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(signatureBuffer), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export class TipzyPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly provider = 'TIPZY';
  readonly name = 'TIPZY';

  private readonly defaultApiKey?: string | undefined;
  private readonly defaultCallbackSecret?: string | undefined;
  private readonly defaultMerchantCode?: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly credentialResolver?:
    ((credentialReference: string) => Promise<TipzyCredentials> | TipzyCredentials) | undefined;

  private readonly capabilities: PaymentProviderCapabilities = {
    createPayment: true,
    verifyPayment: true,
    webhook: true,
    refund: false,
  };

  constructor(options: TipzyPaymentProviderAdapterOptions = {}) {
    this.defaultApiKey =
      options.apiKey ??
      (typeof process !== 'undefined' ? process.env?.['TIPZY_API_KEY'] : undefined);
    this.defaultCallbackSecret =
      options.callbackSecret ??
      (typeof process !== 'undefined' ? process.env?.['TIPZY_CALLBACK_SECRET'] : undefined);
    this.defaultMerchantCode =
      options.merchantCode ??
      (typeof process !== 'undefined' ? process.env?.['TIPZY_MERCHANT_CODE'] : undefined);
    this.baseUrl = (options.baseUrl ?? 'https://api.tipzy.id').replace(/\/+$/, '');
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.credentialResolver = options.credentialResolver;
  }

  getCapabilities(): PaymentProviderCapabilities {
    return { ...this.capabilities };
  }

  private async resolveCredentials(credentialReference: string): Promise<TipzyCredentials> {
    if (this.credentialResolver) {
      const resolved = await this.credentialResolver(credentialReference);
      if (resolved.apiKey || resolved.callbackSecret) {
        return resolved;
      }
    }

    if (credentialReference.startsWith('tipzy_')) {
      return {
        apiKey: credentialReference,
        callbackSecret: this.defaultCallbackSecret,
        merchantCode: this.defaultMerchantCode,
      };
    }

    if (typeof process !== 'undefined' && process.env) {
      if (credentialReference.startsWith('env:')) {
        const envVar = credentialReference.slice(4).trim();
        const key = process.env[envVar];
        if (key) {
          return {
            apiKey: key,
            callbackSecret: this.defaultCallbackSecret,
            merchantCode: this.defaultMerchantCode,
          };
        }
      }
    }

    return {
      apiKey: this.defaultApiKey,
      callbackSecret: this.defaultCallbackSecret,
      merchantCode: this.defaultMerchantCode,
    };
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult> {
    const creds = await this.resolveCredentials(input.credentialReference);
    const apiKey = creds.apiKey;
    if (!apiKey) {
      throw new PaymentError(
        'Tipzy API key is not configured for payment creation',
        'PAYMENT_CREDENTIALS_MISSING',
        500,
      );
    }

    const metadata = (input.metadata ?? {}) as Record<string, unknown>;
    const customerName =
      (typeof metadata['customerName'] === 'string' && metadata['customerName'].trim()) ||
      'Customer';
    let customerEmail =
      (typeof metadata['customerEmail'] === 'string' && metadata['customerEmail'].trim()) || '';
    if (!customerEmail || !customerEmail.includes('@') || !customerEmail.includes('.')) {
      customerEmail = `${input.customerId.replace(/[^a-zA-Z0-9]/g, '') || 'buyer'}@bintang.store`;
    }
    const message =
      (typeof metadata['description'] === 'string' && metadata['description'].trim()) ||
      `Order ${input.orderId}`;

    const numericAmount = Math.round(parseFloat(input.amount));

    const payload = {
      name: customerName,
      email: customerEmail,
      amount: numericAmount,
      payment_channel: 'QRIS',
      message,
    };

    const endpoint = `${this.baseUrl}/api/v1/gateway/transactions`;
    let response: Response;
    try {
      response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'Bintang-Tech-Studio/1.0',
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      throw new PaymentError(
        `Failed to reach Tipzy API at ${endpoint}: ${err instanceof Error ? err.message : String(err)}`,
        'PAYMENT_PROVIDER_UNREACHABLE',
        502,
      );
    }

    let rawText = '';
    let body: Record<string, unknown> = {};
    if (typeof response.text === 'function') {
      rawText = await response.text();
      try {
        body = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        body = { raw: rawText };
      }
    } else if (typeof response.json === 'function') {
      body = (await response.json()) as Record<string, unknown>;
    }

    if (!response.ok) {
      const msg =
        (body['message'] as string) ||
        (body['error'] as string) ||
        `HTTP status ${response.status}`;
      throw new PaymentError(`Tipzy error creating payment: ${msg}`, 'PAYMENT_PROVIDER_ERROR', 502);
    }

    const resultData = (body['result'] ?? body) as Record<string, unknown>;
    const providerReference = String(
      resultData['transaction_id'] ?? resultData['id'] ?? resultData['reference'] ?? '',
    );
    if (!providerReference) {
      throw new PaymentError(
        'Tipzy response missing transaction_id',
        'PAYMENT_PROVIDER_MALFORMED_RESPONSE',
        502,
      );
    }

    const paymentUrl =
      (resultData['payment_url'] as string) ?? (resultData['status_page_url'] as string) ?? null;

    return {
      providerReference,
      paymentUrl,
      status: 'PENDING',
      rawResponse: body,
    };
  }

  async verifyPayment(input: VerifyProviderPaymentInput): Promise<ProviderPaymentStatusResult> {
    const creds = await this.resolveCredentials(input.credentialReference);
    const apiKey = creds.apiKey;
    if (!apiKey) {
      throw new PaymentError(
        'Tipzy API key is not configured for payment verification',
        'PAYMENT_CREDENTIALS_MISSING',
        500,
      );
    }

    const endpoint = `${this.baseUrl}/api/v1/gateway/transactions/${encodeURIComponent(input.providerReference)}`;
    let response: Response;
    try {
      response = await this.fetchFn(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'Bintang-Tech-Studio/1.0',
        },
      });
    } catch (err: unknown) {
      throw new PaymentError(
        `Failed to reach Tipzy verification endpoint: ${err instanceof Error ? err.message : String(err)}`,
        'PAYMENT_PROVIDER_UNREACHABLE',
        502,
      );
    }

    if (!response.ok) {
      throw new PaymentError(
        `Tipzy verification returned HTTP ${response.status}`,
        'PAYMENT_PROVIDER_ERROR',
        502,
      );
    }

    const body = (await response.json()) as Record<string, unknown>;
    const resultData = (body['result'] ?? body) as Record<string, unknown>;

    const rawStatus = String(resultData['status'] ?? '').toLowerCase();
    let status: PaymentAttemptStatus = 'PENDING';
    if (rawStatus === 'paid' || rawStatus === 'settled' || rawStatus === 'succeeded') {
      status = 'SUCCEEDED';
    } else if (rawStatus === 'failed') {
      status = 'FAILED';
    } else if (rawStatus === 'expired') {
      status = 'EXPIRED';
    } else if (rawStatus === 'processing') {
      status = 'PROCESSING';
    }

    const rawAmount = resultData['amount'] !== undefined ? String(resultData['amount']) : '0';
    const amount = normalizeMoney(rawAmount, 'tipzy transaction amount');

    return {
      providerReference: input.providerReference,
      status,
      amount,
      currency: 'IDR',
      rawResponse: body,
    };
  }

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
    const creds = await this.resolveCredentials(input.credentialReference);
    const secret = creds.callbackSecret;
    if (!secret) {
      return false;
    }

    const headers = input.headers ?? {};
    const signature =
      input.signature ??
      headers['x-tipzy-signature'] ??
      headers['X-Tipzy-Signature'] ??
      headers['x-signature'];

    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const rawPayload =
      input.rawBody ??
      (typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload));

    const computed = await computeHmacSha256(secret, rawPayload);
    return constantTimeEqual(computed.toLowerCase(), signature.toLowerCase().trim());
  }

  async parseWebhookEvent(input: ParseWebhookEventInput): Promise<ParsedWebhookEvent> {
    const p = input.payload;

    const eventId = String(p['event_id'] ?? p['eventId'] ?? p['id'] ?? `evt_tipzy_${Date.now()}`);
    const eventType = String(p['event_type'] ?? p['eventType'] ?? p['type'] ?? 'payment.settled');
    const providerReference = String(
      p['transaction_id'] ?? p['transactionId'] ?? p['providerReference'] ?? p['reference'] ?? '',
    );

    const paymentIntentId =
      p['payment_intent_id'] !== undefined
        ? String(p['payment_intent_id'])
        : p['paymentIntentId'] !== undefined
          ? String(p['paymentIntentId'])
          : undefined;

    const storeId =
      p['store_id'] !== undefined
        ? String(p['store_id'])
        : p['storeId'] !== undefined
          ? String(p['storeId'])
          : undefined;

    const rawAmount = p['amount'] !== undefined ? String(p['amount']) : undefined;
    const amount = rawAmount ? normalizeMoney(rawAmount, 'tipzy webhook amount') : undefined;
    const currency = p['currency'] !== undefined ? String(p['currency']).toUpperCase() : 'IDR';

    const rawStatus = String(p['status'] ?? '').toLowerCase();
    let status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'PROCESSING' = 'SUCCEEDED';
    if (rawStatus === 'paid' || rawStatus === 'settled' || rawStatus === 'succeeded') {
      status = 'SUCCEEDED';
    } else if (rawStatus === 'failed') {
      status = 'FAILED';
    } else if (rawStatus === 'expired') {
      status = 'EXPIRED';
    } else if (rawStatus === 'processing' || rawStatus === 'pending') {
      status = 'PROCESSING';
    }

    const failureReason =
      p['failure_reason'] !== undefined
        ? String(p['failure_reason'])
        : p['failureReason'] !== undefined
          ? String(p['failureReason'])
          : undefined;

    return {
      eventId,
      eventType,
      providerReference,
      paymentIntentId,
      storeId,
      amount,
      currency,
      status,
      failureReason,
    };
  }

  async createRefund(_input: CreateProviderRefundInput): Promise<ProviderRefundResult> {
    throw new PaymentCapabilityUnsupportedError('TIPZY', 'refund');
  }
}
