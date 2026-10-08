/**
 * Bintang Tech Studio — Client Cart State Manager.
 * Baseline: Milestone M10 Customer Store Migration.
 *
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * "localStorage is UI state only and is NOT business truth."
 *
 * Client cart maintains draft items for UX convenience (item selection, draft count).
 * At checkout, server-side product, price, stock, and order logic becomes authoritative.
 */

import { CartItemInput } from '../types.js';

export interface ClientCartItem {
  readonly productId: string;
  readonly name: string;
  readonly priceDisplay: string;
  readonly quantity: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as unknown as { localStorage: StorageLike }).localStorage;
    }
  } catch {
    // Ignore access error
  }
  return null;
}

export class ClientCartManager {
  private items: Map<string, ClientCartItem> = new Map();
  private storageKey: string;

  constructor(storeId: string) {
    this.storageKey = `bintang_cart_${storeId}`;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const storage = getBrowserStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ClientCartItem[];
        for (const item of parsed) {
          if (item && item.productId && item.quantity > 0) {
            this.items.set(item.productId, item);
          }
        }
      }
    } catch {
      // Local storage read error; fallback to memory
    }
  }

  private persistToStorage(): void {
    const storage = getBrowserStorage();
    if (!storage) return;
    try {
      const arr = Array.from(this.items.values());
      storage.setItem(this.storageKey, JSON.stringify(arr));
    } catch {
      // Best-effort storage persistence
    }
  }

  /**
   * Adds or increments an item in the client draft cart.
   */
  public addItem(
    item: { productId: string; name: string; priceDisplay: string },
    quantity: number = 1,
  ): void {
    const existing = this.items.get(item.productId);
    const newQty = (existing?.quantity ?? 0) + quantity;
    this.items.set(item.productId, {
      productId: item.productId,
      name: item.name,
      priceDisplay: item.priceDisplay,
      quantity: newQty,
    });
    this.persistToStorage();
  }

  /**
   * Updates the quantity of an item in the draft cart.
   */
  public updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.items.delete(productId);
    } else {
      const existing = this.items.get(productId);
      if (existing) {
        this.items.set(productId, { ...existing, quantity });
      }
    }
    this.persistToStorage();
  }

  /**
   * Removes an item from the draft cart.
   */
  public removeItem(productId: string): void {
    this.items.delete(productId);
    this.persistToStorage();
  }

  /**
   * Clears the draft cart.
   */
  public clear(): void {
    this.items.clear();
    this.persistToStorage();
  }

  /**
   * Returns current items in the draft cart.
   */
  public getItems(): readonly ClientCartItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Converts draft items into server CartItemInput payload for authoritative valuation / checkout.
   */
  public toServerPayload(): readonly CartItemInput[] {
    return Array.from(this.items.values()).map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
  }

  /**
   * Returns total number of draft items.
   */
  public getTotalCount(): number {
    let count = 0;
    for (const item of this.items.values()) {
      count += item.quantity;
    }
    return count;
  }
}
