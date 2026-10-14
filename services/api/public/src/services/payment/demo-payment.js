// Bintang Store — Demo Payment Adapter
// Simulated digital payment provider with realistic QRIS & auto-verification behavior

import { PaymentAdapter } from './payment-adapter.js';

export class DemoPaymentAdapter extends PaymentAdapter {
  constructor() {
    super('DemoPaymentAdapter');
    this.transactions = new Map();
  }

  /**
   * Creates a simulated transaction
   */
  async createPayment({ orderId, amount, paymentMethod = 'QRIS', customer = {} }) {
    const transactionId = `TX-${orderId ? orderId.replace('#', '') : Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    const refCode = `REF-${paymentMethod}-${Math.floor(100000 + Math.random() * 900000)}`;

    const tx = {
      transactionId,
      orderId,
      amount,
      paymentMethod,
      customer,
      refCode,
      status: 'PENDING_PAYMENT',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      qrString: `00020101021226600016ID.CO.QRIS.WWW01189360099900000000010215${refCode}520458125303360540${amount}5802ID5913BINTANG STORE6007JAKARTA62190115${orderId}63047A2B`,
      payCode: refCode,
    };

    this.transactions.set(transactionId, tx);

    return {
      success: true,
      data: tx,
    };
  }

  /**
   * Checks transaction status
   */
  async checkStatus(transactionId) {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      return { success: false, message: 'Transaksi tidak ditemukan', status: 'NOT_FOUND' };
    }

    const now = new Date();
    if (tx.status === 'PENDING_PAYMENT' && now > new Date(tx.expiresAt)) {
      tx.status = 'EXPIRED';
    }

    return {
      success: true,
      status: tx.status,
      data: tx,
    };
  }

  /**
   * Cancels transaction
   */
  async cancelPayment(transactionId) {
    const tx = this.transactions.get(transactionId);
    if (tx) {
      tx.status = 'CANCELLED';
      return { success: true, status: 'CANCELLED' };
    }
    return { success: false, message: 'Transaksi tidak ditemukan' };
  }

  /**
   * Simulates payment success (customer completed transfer / payment)
   */
  async simulateSuccess(transactionId) {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      return { success: false, message: 'Transaksi tidak ditemukan' };
    }

    tx.status = 'PAID';
    tx.paidAt = new Date().toISOString();

    return {
      success: true,
      status: 'PAID',
      data: tx,
    };
  }
}
