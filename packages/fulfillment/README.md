# @bintang/fulfillment

Architectural domain and application service boundary for fulfillment lifecycle, digital product delivery, inventory credential assignment, and cross-milestone coordination.

## Milestone M09: Fulfillment Foundation

Milestone M09 establishes the canonical fulfillment layer connecting:
`ORDER` → `PAYMENT` → `FULFILLMENT` → `INVENTORY` → `DIGITAL DELIVERY`.

### Classification

Domain & Service Foundation with in-memory persistence adapter (`InMemoryFulfillmentRepository`, `InMemoryFulfillmentItemRepository`, `InMemoryFulfillmentIdempotencyRepository`).

### Core Domain Entities

- **Fulfillment**: Represents a fulfillment aggregate mapped to PostgreSQL `public.fulfillments` table (`id`, `storeId`, `orderId`, `strategy`, `status`, `trackingInfo`, `failureReason`, `metadata`, `createdAt`, `updatedAt`).
- **FulfillmentItem**: Line item mapped to PostgreSQL `public.fulfillment_items` table (`id`, `storeId`, `fulfillmentId`, `orderItemId`, `inventoryItemId`, `itemType`, `status`, `payloadReference`, `createdAt`).
- **PublicFulfillment** & **PublicFulfillmentItem**: Customer-safe projections that sanitize internal store identifiers and inventory IDs while exposing delivery payloads and statuses.

### Strategies & Statuses

- **Strategies**: `DIGITAL_AUTO`, `DIGITAL_MANUAL`, `SERVICE`, `PHYSICAL`.
- **Fulfillment Lifecycle**: `PENDING` → `PROCESSING` → `FULFILLED` | `FAILED` | `MANUAL_REVIEW` | `CANCELLED`.
  - `FULFILLED` and `CANCELLED` are terminal immutable states.
  - Retries permitted strictly from `FAILED` or `MANUAL_REVIEW` back to `PROCESSING`.
- **Fulfillment Item Lifecycle**: `PENDING` → `DELIVERED` | `FAILED` | `REVOKED`.

### Critical Invariants & Cross-Milestone Consistency

1. **Payment Prerequisite**: Order must be in `PAID` or `PROCESSING` status prior to fulfillment creation or execution. Orders in `PENDING_PAYMENT` are strictly rejected with `FulfillmentOrderNotPayableError`.
2. **Single Active Fulfillment**: An order can only have at most one active or completed fulfillment (`PENDING`, `PROCESSING`, `FULFILLED`, `MANUAL_REVIEW`). Duplicate creation attempts are rejected with `FulfillmentAlreadyExistsError`.
3. **Inventory Reservation & Consumption Semantics**:
   - Order creation (M07) reserves stock.
   - Payment `PAID` (M08) preserves inventory reservation without consuming.
   - Fulfillment creation (`PENDING`) and execution start (`PROCESSING`) preserve inventory reservation without consuming.
   - Successful fulfillment delivery transitions order to `FULFILLED` via `orderService.transitionStatus(sellerContext, order.id, 'FULFILLED')`, which triggers `inventoryService.consumeReserved()` according to M06/M07 contracts.
   - Failed fulfillment does NOT double-consume or release inventory prematurely.
   - Cancellation revokes items and releases assigned digital inventory items back to `AVAILABLE`.
4. **Tenant Isolation & Zero Client Trust**: All mutations and reads are strictly partitioned by `storeId`. Cross-tenant fulfillment access is strictly rejected.
5. **Caller Authorization**:
   - Sellers require `fulfillment.process` permission for creation, execution, retries, and cancellations.
   - Sellers require `fulfillment.read` for reading and listing fulfillments.
   - Customers can strictly view sanitized `PublicFulfillment` projections for their own orders (`order.customerId === caller.context.customerId`).
6. **Idempotency**: Concurrent or retried operations with the same idempotency key are safely deduplicated. Mutated payloads trigger `FulfillmentIdempotencyConflictError`.

### Provider Adapters

- `FulfillmentProviderAdapter`: Contract defining provider capabilities (`autoDelivery`, `retryable`, `verification`) and delivery method `deliver(input)`.
- `MockFulfillmentProviderAdapter`: Configurable in-memory adapter supporting simulated deliveries, failure modes, error codes, and manual payload overrides.

### Explicit Non-Goals (Deferred to Later Milestones)

- NO PostgreSQL/Supabase fulfillment persistence adapter (deferred to Supabase adapter milestone).
- NO external provider networks (Telegram, WhatsApp, email).
- NO frontend seller dashboard or customer store UI components.
- NO background workers, BullMQ queues, or cron schedulers.
- NO production secrets or live credentials.
