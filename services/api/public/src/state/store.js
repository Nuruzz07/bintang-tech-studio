// Bintang Store — Central Reactive State Store
// Brand: Bintang Store — "Produk digital, langsung beres."

import { DEFAULT_PRODUCTS, CATEGORIES } from '../data/products.js';
import { DEFAULT_ORDERS } from '../data/orders.js';
import { DEFAULT_CUSTOMERS } from '../data/customers.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { validateVoucher, PROMOTIONAL_VOUCHERS } from '../data/vouchers.js';
import { loadFromStorage, saveToStorage, clearAllStorage } from '../utils/storage.js';
import { generateOrderId } from '../utils/helpers.js';

class Store {
  constructor() {
    this.listeners = new Set();
    this.init();
  }

  init() {
    // If stored products are from previous demo (less than 20), re-seed with 36 expanded products
    let storedProds = loadFromStorage('products', null);
    if (!storedProds || storedProds.length < 20) {
      storedProds = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      saveToStorage('products', storedProds);
    }
    this.products = storedProds;

    this.orders = loadFromStorage('orders', JSON.parse(JSON.stringify(DEFAULT_ORDERS)));
    this.customers = loadFromStorage('customers', JSON.parse(JSON.stringify(DEFAULT_CUSTOMERS)));

    // Ensure settings reflects Bintang Store
    let storedSettings = loadFromStorage('settings', null);
    if (!storedSettings || storedSettings.storeName !== 'Bintang Store') {
      storedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      saveToStorage('settings', storedSettings);
    }
    this.settings = storedSettings;

    this.cart = loadFromStorage('cart', {
      items: [],
      voucherCode: null,
      discountPercent: 0,
    });
    this.currentView = 'webapp';
    this.selectedProductId = null;
    this.selectedOrderId = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, payload = {}) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, payload);
      } catch (err) {
        console.error('[Store] Listener error:', err);
      }
    });
  }

  // ==========================================
  // PRODUCTS METHODS
  // ==========================================
  getProducts() {
    return this.products;
  }

  getActiveProducts() {
    return this.products.filter((p) => p.active);
  }

  getProduct(id) {
    return this.products.find((p) => p.id === id);
  }

  getProductById(id) {
    return this.getProduct(id);
  }

  getProductsByCategory(category = 'Semua') {
    if (!category || category === 'Semua') {
      return this.getActiveProducts();
    }
    return this.getActiveProducts().filter(
      (p) => p.category.toLowerCase() === category.toLowerCase(),
    );
  }

  getBestSellers(limit = 6) {
    return this.getActiveProducts()
      .filter((p) => p.badge === 'BEST SELLER' || p.soldCount >= 900)
      .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
      .slice(0, limit);
  }

  getRecommendedProducts(limit = 6) {
    return this.getActiveProducts()
      .filter((p) => p.badge === 'HOT' || p.badge === 'POPULAR' || p.rating >= 4.9)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
  }

  getNewProducts(limit = 6) {
    return this.getActiveProducts()
      .filter((p) => p.badge === 'NEW' || p.badge === 'BEST DEAL')
      .slice(0, limit);
  }

  getPromotionalProducts(limit = 6) {
    return this.getActiveProducts()
      .filter((p) => p.originalPrice && p.originalPrice > p.price)
      .sort((a, b) => {
        const discA = (a.originalPrice - a.price) / a.originalPrice;
        const discB = (b.originalPrice - b.price) / b.originalPrice;
        return discB - discA;
      })
      .slice(0, limit);
  }

  searchProducts(query = '', category = 'Semua', sortBy = 'popular') {
    const cleanQuery = (query || '').trim().toLowerCase();
    let results = this.getActiveProducts();

    if (category && category !== 'Semua') {
      results = results.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (cleanQuery) {
      results = results.filter((p) => {
        const inName = p.name.toLowerCase().includes(cleanQuery);
        const inDesc = (p.description || '').toLowerCase().includes(cleanQuery);
        const inShort = (p.shortDescription || '').toLowerCase().includes(cleanQuery);
        const inCat = p.category.toLowerCase().includes(cleanQuery);
        return inName || inDesc || inShort || inCat;
      });
    }

    if (sortBy === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'discount') {
      results.sort((a, b) => {
        const discA = (a.originalPrice || a.price) - a.price;
        const discB = (b.originalPrice || b.price) - b.price;
        return discB - discA;
      });
    } else {
      // Default: Popular (soldCount)
      results.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    }

    return results;
  }

  addProduct(newProd) {
    const product = {
      ...newProd,
      id: newProd.id || `prod_${Date.now()}`,
      soldCount: 0,
      rating: 5.0,
      active: true,
    };
    this.products.unshift(product);
    saveToStorage('products', this.products);
    this.notify('products:updated', { action: 'add', product });
    return product;
  }

  updateProduct(id, updates) {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.products[idx] = { ...this.products[idx], ...updates };
      saveToStorage('products', this.products);
      this.notify('products:updated', { action: 'update', product: this.products[idx] });
      return this.products[idx];
    }
    return null;
  }

  toggleProductActive(id) {
    const prod = this.getProduct(id);
    if (prod) {
      prod.active = !prod.active;
      saveToStorage('products', this.products);
      this.notify('products:updated', { action: 'toggle', product: prod });
      return prod.active;
    }
    return false;
  }

  // ==========================================
  // CART METHODS
  // ==========================================
  getCart() {
    return this.cart;
  }

  getCartItems() {
    return this.cart.items.map((item) => {
      const product = this.getProduct(item.productId);
      return {
        ...item,
        product: product || {
          id: item.productId,
          name: 'Produk Tidak Tersedia',
          price: 0,
          stock: 0,
          duration: '-',
        },
      };
    });
  }

  getCartSubtotal() {
    return this.cart.items.reduce((total, item) => {
      const product = this.getProduct(item.productId);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  }

  getUsedVouchers() {
    // Collect vouchers that have been completed by this user
    return this.orders
      .filter((o) => o.voucherApplied && o.paymentStatus === 'PAID')
      .map((o) => o.voucherApplied);
  }

  getCartDiscount() {
    const subtotal = this.getCartSubtotal();
    if (!this.cart.voucherCode) return 0;
    const result = validateVoucher(this.cart.voucherCode, subtotal, []);
    return result.valid ? result.discount : 0;
  }

  getCartTotal() {
    const subtotal = this.getCartSubtotal();
    const discount = this.getCartDiscount();
    return Math.max(0, subtotal - discount);
  }

  getCartTotals() {
    const subtotal = this.getCartSubtotal();
    const discount = this.getCartDiscount();
    return {
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
    };
  }

  getCartCount() {
    return this.cart.items.reduce((count, item) => count + item.quantity, 0);
  }

  addToCart(productId, quantity = 1) {
    const product = this.getProduct(productId);
    if (!product || !product.active || product.stock <= 0) {
      return { success: false, message: 'Produk tidak tersedia atau stok habis' };
    }

    const existingIndex = this.cart.items.findIndex((item) => item.productId === productId);
    if (existingIndex !== -1) {
      const newQty = this.cart.items[existingIndex].quantity + quantity;
      if (newQty > product.stock) {
        return { success: false, message: `Maksimal stok tercapai (${product.stock} item)` };
      }
      this.cart.items[existingIndex].quantity = newQty;
    } else {
      this.cart.items.push({
        productId,
        quantity: Math.min(quantity, product.stock),
      });
    }

    saveToStorage('cart', this.cart);
    this.notify('cart:updated', { action: 'add', productId, quantity });
    return { success: true, message: `${product.name} ditambahkan ke keranjang` };
  }

  removeFromCart(productId) {
    this.cart.items = this.cart.items.filter((item) => item.productId !== productId);
    saveToStorage('cart', this.cart);
    this.notify('cart:updated', { action: 'remove', productId });
  }

  updateQuantity(productId, quantity) {
    const product = this.getProduct(productId);
    if (!product) return;

    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    const item = this.cart.items.find((item) => item.productId === productId);
    if (item) {
      item.quantity = Math.min(quantity, product.stock);
      saveToStorage('cart', this.cart);
      this.notify('cart:updated', { action: 'updateQuantity', productId, quantity: item.quantity });
    }
  }

  applyVoucher(code) {
    const subtotal = this.getCartSubtotal();
    const result = validateVoucher(code, subtotal, this.getUsedVouchers());

    if (result.valid) {
      this.cart.voucherCode = result.voucher.code;
      this.cart.discountPercent = result.voucher.type === 'percentage' ? result.voucher.value : 0;
      saveToStorage('cart', this.cart);
      this.notify('cart:updated', { action: 'applyVoucher', code: result.voucher.code, result });
      return {
        success: true,
        message: result.message,
        discount: result.discount,
        state: result.state,
        voucher: result.voucher,
      };
    } else {
      return {
        success: false,
        message: result.message,
        state: result.state,
      };
    }
  }

  applyCoupon(code) {
    return this.applyVoucher(code);
  }

  removeVoucher() {
    this.cart.voucherCode = null;
    this.cart.discountPercent = 0;
    saveToStorage('cart', this.cart);
    this.notify('cart:updated', { action: 'removeVoucher' });
  }

  clearCart() {
    this.cart = {
      items: [],
      voucherCode: null,
      discountPercent: 0,
    };
    saveToStorage('cart', this.cart);
    this.notify('cart:updated', { action: 'clear' });
  }

  // ==========================================
  // ORDERS METHODS
  // ==========================================
  getOrders(filterStatus = 'Semua') {
    if (!filterStatus || filterStatus === 'Semua') {
      return this.orders;
    }
    if (filterStatus === 'menunggu') {
      return this.orders.filter(
        (o) => o.paymentStatus === 'PENDING_PAYMENT' || o.paymentStatus === 'UNPAID',
      );
    }
    if (filterStatus === 'proses') {
      return this.orders.filter(
        (o) => o.paymentStatus === 'PAID' && o.fulfillmentStatus === 'PROCESSING',
      );
    }
    if (filterStatus === 'selesai') {
      return this.orders.filter(
        (o) => o.fulfillmentStatus === 'FULFILLED' || o.fulfillmentStatus === 'COMPLETED',
      );
    }
    if (filterStatus === 'batal') {
      return this.orders.filter(
        (o) => o.paymentStatus === 'CANCELLED' || o.paymentStatus === 'EXPIRED',
      );
    }
    return this.orders;
  }

  getOrder(id) {
    return this.orders.find((o) => o.id === id);
  }

  getOrderById(id) {
    return this.getOrder(id);
  }

  createOrder({
    customer = {
      name: 'Pelanggan Bintang',
      telegram: '@bintang_buyer',
      email: 'buyer@bintang.store',
    },
    paymentMethod = 'QRIS',
    singleProduct = null,
    items = null,
    paymentStatus = 'PAID',
    fulfillmentStatus = 'PROCESSING',
  }) {
    let orderItems = [];
    let subtotal = 0;
    let discount = 0;
    let total = 0;
    let voucher = null;

    if (singleProduct) {
      const prod = this.getProduct(singleProduct.id);
      const qty = singleProduct.quantity || 1;
      orderItems.push({
        product: prod,
        quantity: qty,
      });
      subtotal = prod.price * qty;
      total = subtotal;
    } else if (items) {
      orderItems = items.map((i) => ({
        product: this.getProduct(i.productId),
        quantity: i.quantity,
      }));
      subtotal = orderItems.reduce(
        (acc, i) => acc + (i.product ? i.product.price * i.quantity : 0),
        0,
      );
      total = subtotal;
    } else {
      orderItems = this.getCartItems().filter((item) => item.product && item.product.price > 0);
      subtotal = this.getCartSubtotal();
      discount = this.getCartDiscount();
      total = this.getCartTotal();
      voucher = this.cart.voucherCode;
    }

    if (orderItems.length === 0) {
      throw new Error('Keranjang belanja kosong!');
    }

    const orderId = generateOrderId();
    const primaryItem = orderItems[0];
    const prod = primaryItem.product;

    // Generate realistic fulfillment payload based on product template or type
    let fulfillmentData = {};
    if (prod.fulfillmentTemplate) {
      fulfillmentData = { ...prod.fulfillmentTemplate };
    } else if (prod.type === 'code') {
      fulfillmentData = {
        format: 'code',
        code: `BTS-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-REDEEM`,
        note: 'Tukarkan kode voucher pada situs atau portal resmi yang ditentukan.',
      };
    } else if (prod.type === 'account') {
      fulfillmentData = {
        format: 'account',
        email: `vip.acc.${Math.floor(100 + Math.random() * 900)}@bintang.store`,
        password: `BintangPass#${Math.floor(1000 + Math.random() * 9000)}`,
        note: 'Gunakan kredensial akun di atas untuk login. Garansi resmi 30 hari aktif.',
      };
    } else if (prod.type === 'link') {
      fulfillmentData = {
        format: 'link',
        link: 'https://drive.google.com/drive/folders/bintang-store-digital-access-vip',
        note: 'Buka link Google Drive di atas untuk mengunduh template atau aset digital Anda.',
      };
    } else {
      fulfillmentData = {
        format: 'license',
        licenseKey: `BTS-LIC-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        note: 'Masukkan serial license key pada aplikasi Anda untuk aktivasi instan.',
      };
    }

    const nowStr =
      'Hari ini, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const newOrder = {
      id: orderId,
      customer: {
        name: customer.name || 'Pelanggan Bintang',
        telegram: customer.telegram || '@bintang_buyer',
        email: customer.email || 'buyer@bintang.store',
        phone: customer.phone || '08123456789',
      },
      product: {
        id: prod.id,
        name:
          orderItems.length > 1
            ? `${prod.name} (+${orderItems.length - 1} item lainnya)`
            : prod.name,
        category: prod.category,
        type: prod.type,
        duration: prod.duration,
      },
      items: orderItems.map((i) => ({
        id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        duration: i.product.duration,
        type: i.product.type,
      })),
      quantity: primaryItem.quantity,
      amount: subtotal,
      voucherApplied: voucher,
      discountAmount: discount,
      total: total,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      fulfillmentStatus: fulfillmentStatus,
      date: nowStr,
      rawDate: new Date().toISOString(),
      fulfillmentData: fulfillmentData,
      timeline: [
        { step: 'Pesanan Dibuat', time: nowStr.split(', ')[1] || '12:00', status: 'completed' },
        {
          step: `Pembayaran (${paymentMethod})`,
          time: nowStr.split(', ')[1] || '12:00',
          status: paymentStatus === 'PAID' ? 'completed' : 'active',
        },
        {
          step: 'Pesanan Diproses',
          time: nowStr.split(', ')[1] || '12:00',
          status:
            fulfillmentStatus === 'PROCESSING'
              ? 'active'
              : fulfillmentStatus === 'FULFILLED'
                ? 'completed'
                : 'pending',
        },
        {
          step: 'Produk Terkirim',
          time: fulfillmentStatus === 'FULFILLED' ? nowStr.split(', ')[1] || '12:01' : '-',
          status: fulfillmentStatus === 'FULFILLED' ? 'completed' : 'pending',
        },
      ],
    };

    // Deduct stock for ordered items
    orderItems.forEach((i) => {
      const p = this.getProduct(i.product.id);
      if (p) {
        p.stock = Math.max(0, p.stock - i.quantity);
        p.soldCount = (p.soldCount || 0) + i.quantity;
      }
    });
    saveToStorage('products', this.products);

    // Save order
    this.orders.unshift(newOrder);
    saveToStorage('orders', this.orders);

    // Clear cart if ordered from cart
    if (!singleProduct) {
      this.clearCart();
    }

    this.notify('orders:updated', { action: 'create', order: newOrder });
    return newOrder;
  }

  updateOrderStatus(orderId, paymentStatus, fulfillmentStatus) {
    const order = this.getOrder(orderId);
    if (order) {
      const nowTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });

      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
        if (paymentStatus === 'PAID') {
          order.timeline = order.timeline.map((step) => {
            if (step.step.startsWith('Pembayaran'))
              return { ...step, status: 'completed', time: nowTime };
            if (step.step === 'Pesanan Diproses') return { ...step, status: 'active' };
            return step;
          });
        }
      }

      if (fulfillmentStatus) {
        order.fulfillmentStatus = fulfillmentStatus;
        if (fulfillmentStatus === 'FULFILLED' || fulfillmentStatus === 'COMPLETED') {
          order.timeline = order.timeline.map((step) => {
            if (step.step === 'Pesanan Diproses') return { ...step, status: 'completed' };
            if (step.step === 'Produk Terkirim')
              return { ...step, status: 'completed', time: nowTime };
            return step;
          });
        }
      }

      saveToStorage('orders', this.orders);
      this.notify('orders:updated', { action: 'updateStatus', order });
      return order;
    }
    return null;
  }

  cancelOrder(orderId) {
    const order = this.getOrder(orderId);
    if (order && order.paymentStatus === 'PENDING_PAYMENT') {
      order.paymentStatus = 'CANCELLED';
      order.fulfillmentStatus = 'CANCELLED';
      saveToStorage('orders', this.orders);
      this.notify('orders:updated', { action: 'cancel', order });
      return { success: true, message: 'Pesanan berhasil dibatalkan' };
    }
    return { success: false, message: 'Pesanan tidak dapat dibatalkan' };
  }

  // ==========================================
  // SETTINGS & METRICS
  // ==========================================
  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    saveToStorage('settings', this.settings);
    this.notify('settings:updated', { settings: this.settings });
    return this.settings;
  }

  // Reset demo state back to defaults
  resetToDefaults() {
    clearAllStorage();
    this.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    this.orders = JSON.parse(JSON.stringify(DEFAULT_ORDERS));
    this.customers = JSON.parse(JSON.stringify(DEFAULT_CUSTOMERS));
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.cart = {
      items: [],
      voucherCode: null,
      discountPercent: 0,
    };
    saveToStorage('products', this.products);
    saveToStorage('orders', this.orders);
    saveToStorage('customers', this.customers);
    saveToStorage('settings', this.settings);
    saveToStorage('cart', this.cart);
    this.notify('store:reset');
  }
}

export const store = new Store();
