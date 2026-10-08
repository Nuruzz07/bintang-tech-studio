/**
 * Bintang Tech Studio — Seller Dashboard Voucher Repository & In-Memory Adapter.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { Voucher } from './types.js';

export interface VoucherRepository {
  findById(storeId: string, id: string): Promise<Voucher | null>;
  findByCode(storeId: string, code: string): Promise<Voucher | null>;
  listByStore(storeId: string): Promise<readonly Voucher[]>;
  create(storeId: string, voucher: Voucher): Promise<Voucher>;
  update(storeId: string, id: string, updates: Partial<Voucher>): Promise<Voucher>;
  delete(storeId: string, id: string): Promise<boolean>;
}

export class InMemoryVoucherRepository implements VoucherRepository {
  private readonly vouchers = new Map<string, Voucher>();

  private toKey(storeId: string, id: string): string {
    return `${storeId}:${id}`;
  }

  public async findById(storeId: string, id: string): Promise<Voucher | null> {
    const voucher = this.vouchers.get(this.toKey(storeId, id));
    if (!voucher || voucher.storeId !== storeId) {
      return null;
    }
    return voucher;
  }

  public async findByCode(storeId: string, code: string): Promise<Voucher | null> {
    const normalizedCode = code.trim().toUpperCase();
    for (const v of this.vouchers.values()) {
      if (v.storeId === storeId && v.code.toUpperCase() === normalizedCode) {
        return v;
      }
    }
    return null;
  }

  public async listByStore(storeId: string): Promise<readonly Voucher[]> {
    const list: Voucher[] = [];
    for (const v of this.vouchers.values()) {
      if (v.storeId === storeId) {
        list.push(v);
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async create(storeId: string, voucher: Voucher): Promise<Voucher> {
    const existing = await this.findByCode(storeId, voucher.code);
    if (existing) {
      throw new Error(`Voucher dengan kode '${voucher.code}' sudah ada pada toko ini.`);
    }

    const key = this.toKey(storeId, voucher.id);
    this.vouchers.set(key, voucher);
    return voucher;
  }

  public async update(storeId: string, id: string, updates: Partial<Voucher>): Promise<Voucher> {
    const key = this.toKey(storeId, id);
    const existing = this.vouchers.get(key);
    if (!existing || existing.storeId !== storeId) {
      throw new Error(`Voucher '${id}' tidak ditemukan pada toko ini.`);
    }

    const updated: Voucher = {
      ...existing,
      ...updates,
      id: existing.id,
      storeId: existing.storeId,
      updatedAt: new Date().toISOString(),
    };

    this.vouchers.set(key, updated);
    return updated;
  }

  public async delete(storeId: string, id: string): Promise<boolean> {
    const key = this.toKey(storeId, id);
    const existing = this.vouchers.get(key);
    if (!existing || existing.storeId !== storeId) {
      return false;
    }
    return this.vouchers.delete(key);
  }
}
