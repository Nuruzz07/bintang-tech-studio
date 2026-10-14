// Bintang Store — Payment Service Entrypoint
// Provides active payment adapter instance and switcher factory

import { DemoPaymentAdapter } from './demo-payment.js';
import { TipzyPaymentAdapter } from './tipzy-payment.js';

// Active singleton instance (default to DemoPaymentAdapter for zero-dependency operation)
export const demoPaymentAdapter = new DemoPaymentAdapter();
export const tipzyPaymentAdapter = new TipzyPaymentAdapter();

let activeAdapter = tipzyPaymentAdapter;

export function getPaymentService() {
  return activeAdapter;
}

export function setPaymentProvider(providerName = 'demo', config = {}) {
  if (providerName === 'tipzy') {
    if (config.apiKey) tipzyPaymentAdapter.configure(config);
    activeAdapter = tipzyPaymentAdapter;
  } else {
    activeAdapter = demoPaymentAdapter;
  }
  return activeAdapter;
}

export const paymentService = {
  createPayment: (params) => activeAdapter.createPayment(params),
  checkStatus: (txId) => activeAdapter.checkStatus(txId),
  cancelPayment: (txId) => activeAdapter.cancelPayment(txId),
  simulateSuccess: (txId) => activeAdapter.simulateSuccess(txId),
  getProviderName: () => activeAdapter.name,
};
