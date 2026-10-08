import {
  FulfillmentDeliveryInput,
  FulfillmentDeliveryResult,
  FulfillmentProviderCapabilities,
} from './types.js';

export interface FulfillmentProviderAdapter {
  readonly providerName: string;
  readonly capabilities: FulfillmentProviderCapabilities;

  /**
   * Executes digital delivery through the provider adapter.
   */
  deliver(input: FulfillmentDeliveryInput): Promise<FulfillmentDeliveryResult>;
}
