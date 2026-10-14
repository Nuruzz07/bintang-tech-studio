// Bintang Store — Payment Adapter Base Interface
// Reusable abstraction to isolate payment gateway logic from UI components

export class PaymentAdapter {
  constructor(name = 'base') {
    this.name = name;
  }

  /**
   * Initializes a payment transaction for an order
   * @param {Object} params - { orderId, amount, paymentMethod, customer }
   * @returns {Promise<Object>} transaction payload with QR/code details
   */
  async createPayment(params) {
    throw new Error(`createPayment() not implemented on ${this.name}`);
  }

  /**
   * Checks the status of an ongoing transaction
   * @param {string} transactionId
   * @returns {Promise<Object>} status response { status: 'PENDING'|'PAID'|'EXPIRED'|'FAILED' }
   */
  async checkStatus(transactionId) {
    throw new Error(`checkStatus() not implemented on ${this.name}`);
  }

  /**
   * Cancels a pending transaction
   * @param {string} transactionId
   * @returns {Promise<Object>}
   */
  async cancelPayment(transactionId) {
    throw new Error(`cancelPayment() not implemented on ${this.name}`);
  }

  /**
   * Simulates payment approval for sandbox/demo testing
   * @param {string} transactionId
   * @returns {Promise<Object>}
   */
  async simulateSuccess(transactionId) {
    throw new Error(`simulateSuccess() not implemented on ${this.name}`);
  }
}
