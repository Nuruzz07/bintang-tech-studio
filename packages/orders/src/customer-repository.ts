import { Customer } from './types.js';

/**
 * Tenant-scoped Customer Repository contract.
 * Manages customer profiles scoped to a merchant store.
 */
export interface CustomerRepository {
  /**
   * Persists a new customer within a store.
   */
  create(storeId: string, customer: Customer): Promise<Customer>;

  /**
   * Retrieves a customer by ID within a store boundary.
   */
  findById(storeId: string, id: string): Promise<Customer | null>;

  /**
   * Retrieves a customer by email within a store boundary.
   */
  findByEmail(storeId: string, email: string): Promise<Customer | null>;

  /**
   * Lists customers within a store boundary.
   */
  list(storeId: string): Promise<readonly Customer[]>;
}
