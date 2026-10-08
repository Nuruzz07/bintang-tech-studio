import {
  FulfillmentDeliveryInput,
  FulfillmentDeliveryResult,
  FulfillmentProviderCapabilities,
} from './types.js';
import { FulfillmentProviderAdapter } from './provider-adapter.js';

export interface MockProviderOptions {
  readonly providerName?: string | undefined;
  readonly capabilities?: Partial<FulfillmentProviderCapabilities> | undefined;
  readonly shouldFail?: boolean | undefined;
  readonly failureCode?: string | undefined;
  readonly failureReason?: string | undefined;
  readonly retryable?: boolean | undefined;
  readonly payloadPrefix?: string | undefined;
}

export class MockFulfillmentProviderAdapter implements FulfillmentProviderAdapter {
  readonly providerName: string;
  readonly capabilities: FulfillmentProviderCapabilities;

  private shouldFail: boolean;
  private shouldThrow = false;
  private throwError: Error = new Error('Network socket hang up');
  private failureCode: string;
  private failureReason: string;
  private retryable: boolean;
  private payloadPrefix: string;

  readonly deliveryCalls: FulfillmentDeliveryInput[] = [];

  constructor(options: MockProviderOptions = {}) {
    this.providerName = options.providerName ?? 'MOCK_DIGITAL';
    this.capabilities = {
      autoDelivery: options.capabilities?.autoDelivery ?? true,
      retryable: options.capabilities?.retryable ?? true,
      verification: options.capabilities?.verification ?? true,
    };
    this.shouldFail = options.shouldFail ?? false;
    this.failureCode = options.failureCode ?? 'PROVIDER_ERROR';
    this.failureReason = options.failureReason ?? 'Simulated delivery failure';
    this.retryable = options.retryable ?? true;
    this.payloadPrefix = options.payloadPrefix ?? 'mock_delivery_payload_';
  }

  setShouldFail(
    fail: boolean,
    opts?: { failureCode?: string; failureReason?: string; retryable?: boolean },
  ): void {
    this.shouldFail = fail;
    if (opts?.failureCode) this.failureCode = opts.failureCode;
    if (opts?.failureReason) this.failureReason = opts.failureReason;
    if (opts?.retryable !== undefined) this.retryable = opts.retryable;
  }

  setShouldThrow(shouldThrow: boolean, error?: Error): void {
    this.shouldThrow = shouldThrow;
    if (error) this.throwError = error;
  }

  async deliver(input: FulfillmentDeliveryInput): Promise<FulfillmentDeliveryResult> {
    this.deliveryCalls.push(input);

    if (this.shouldThrow) {
      throw this.throwError;
    }

    if (this.shouldFail) {
      return {
        success: false,
        failureCode: this.failureCode,
        failureReason: this.failureReason,
        retryable: this.retryable,
      };
    }

    const deliveryPayloads: Record<string, string> = {};

    for (const item of input.items) {
      const manual = input.manualPayloads?.[item.orderItemId];
      if (manual !== undefined) {
        deliveryPayloads[item.orderItemId] = manual;
      } else if (item.inventoryItemId) {
        // If assigned from inventory items, construct reference
        deliveryPayloads[item.orderItemId] = `inventory_item_ref_${item.inventoryItemId}`;
      } else {
        // Default generated mock payload
        deliveryPayloads[item.orderItemId] = `${this.payloadPrefix}${item.orderItemId}`;
      }
    }

    return {
      success: true,
      providerReference: `prov_ref_${Date.now()}_${input.fulfillment.id.slice(0, 8)}`,
      deliveryPayloads,
      trackingInfo: {
        provider: this.providerName,
        deliveredItemCount: input.items.length,
      },
      deliveredAt: new Date().toISOString(),
    };
  }
}
