// Bintang Store — Tipzy.id Payment Adapter (Connected to Backend Gateway)
import { PaymentAdapter } from './payment-adapter.js';

export class TipzyPaymentAdapter extends PaymentAdapter {
  constructor(config = {}) {
    super('TipzyPaymentAdapter');
    this.endpoint = '/api/v1/tipzy/create-qris';
  }

  async createPayment({ orderId, amount, paymentMethod = 'QRIS', customer = {} }) {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          customerName: customer.name || 'Customer Bintang',
          customerEmail: customer.email || 'customer@bintang.store',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        return {
          success: true,
          data: {
            transactionId: data.providerReference || `TX-${orderId.replace('#', '')}`,
            orderId: orderId,
            amount: amount,
            refCode: data.providerReference || `TIPZY-${Date.now().toString().slice(-6)}`,
            paymentUrl: data.paymentUrl || null,
            qrImageUrl: data.qrImageUrl || null,
            qrString: data.qrString || null,
            status: data.status || 'PENDING_PAYMENT',
          },
        };
      }
    } catch (err) {
      console.warn('[TipzyPaymentAdapter] Call error, falling back to simulated QRIS:', err);
    }

    return {
      success: true,
      data: {
        transactionId: `TX-${orderId.replace('#', '')}`,
        orderId: orderId,
        amount: amount,
        refCode: `REF-QRIS-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'PENDING_PAYMENT',
      },
    };
  }

  async checkStatus(transactionId) {
    if (!transactionId || transactionId.startsWith('TX-') || transactionId.startsWith('REF-')) {
      return { success: true, status: 'PENDING_PAYMENT', paid: false };
    }
    try {
      const res = await fetch(`/api/v1/tipzy/check-status/${encodeURIComponent(transactionId)}`);
      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          transactionId,
          status: json.status,
          paid: Boolean(json.paid),
        };
      }
    } catch (err) {
      console.warn('[TipzyPaymentAdapter] Check status error:', err);
    }
    return { success: true, status: 'PENDING_PAYMENT', paid: false };
  }

  async simulateSuccess(transactionId) {
    return { success: true, status: 'PAID' };
  }
}
