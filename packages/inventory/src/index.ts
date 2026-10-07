/**
 * Bintang Tech Studio — Inventory Foundation Package.
 * Milestone M06: Domain & Service Foundation.
 */

// Types & Models
export {
  type Inventory,
  type InventoryItem,
  type InventoryItemStatus,
  type InventoryAvailability,
  type StockAdjustmentType,
  type AdjustStockInput,
  type ReserveStockInput,
  type ReleaseStockInput,
  type ConsumeStockInput,
  INVENTORY_ITEM_STATUSES,
} from './types.js';

// Errors
export {
  InventoryError,
  InventoryNotFoundError,
  InsufficientStockError,
  InvalidQuantityError,
  NegativeStockError,
  ReservationNotFoundError,
  InvalidReservationError,
  CrossTenantInventoryError,
  UnsupportedStockModeError,
  InventoryInvariantError,
} from './errors.js';

// Validation & Helpers
export {
  validateQuantity,
  validatePositiveAmount,
  validateInventoryInvariants,
  generateUUID,
} from './validation.js';

// Repositories
export { type InventoryRepository } from './inventory-repository.js';
export {
  type InventoryItemRepository,
  type CreateInventoryItemInput,
} from './inventory-item-repository.js';
export {
  InMemoryInventoryRepository,
  InMemoryInventoryItemRepository,
} from './memory-repository.js';

// Service
export { InventoryService, type InventoryServiceOptions } from './inventory-service.js';
