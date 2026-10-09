export interface SupabaseConfig {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
  readonly serviceRoleKey?: string | undefined;
  readonly currentStoreId?: string | undefined;
  readonly fetch?: typeof fetch | undefined;
}

export type QueryFilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is';

export interface QueryFilter {
  readonly column: string;
  readonly op: QueryFilterOp;
  readonly value: string | number | boolean | readonly (string | number)[];
}

export interface QueryOptions {
  readonly select?: string | undefined;
  readonly filters?: readonly QueryFilter[] | undefined;
  readonly order?:
    { readonly column: string; readonly ascending?: boolean | undefined } | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
  readonly single?: boolean | undefined;
}

// Database Row Interfaces mapping 1:1 with M02 PostgreSQL Schema

export interface DbStore {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  template_version_id: string | null;
  status: string;
  currency: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  platform_role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbStoreMember {
  id: string;
  store_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbCategory {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  product_type: string;
  price: string;
  compare_at_price: string | null;
  stock_mode: string;
  inventory_strategy: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbInventory {
  id: string;
  store_id: string;
  product_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  updated_at: string;
}

export interface DbInventoryItem {
  id: string;
  store_id: string;
  product_id: string;
  inventory_id: string | null;
  item_type: string;
  secret_reference: string;
  status: string;
  reserved_order_id: string | null;
  assigned_order_id: string | null;
  reserved_at: string | null;
  reserved_until: string | null;
  assigned_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbCustomer {
  id: string;
  store_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbOrder {
  id: string;
  store_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  currency: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  voucher_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  store_id: string;
  product_id: string;
  name_snapshot: string;
  price_snapshot: string;
  quantity: number;
  total: string;
  metadata: Record<string, unknown>;
}

export interface DbPaymentAccount {
  id: string;
  store_id: string;
  provider: string;
  status: string;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbPayment {
  id: string;
  store_id: string;
  order_id: string;
  payment_account_id: string | null;
  provider: string;
  provider_reference: string | null;
  amount: string;
  currency: string;
  status: string;
  payment_method: string | null;
  qr_code_data: string | null;
  pay_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbPaymentEvent {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  store_id: string | null;
  payment_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface DbFulfillment {
  id: string;
  store_id: string;
  order_id: string;
  status: string;
  fulfillment_type: string;
  delivery_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbFulfillmentItem {
  id: string;
  fulfillment_id: string;
  store_id: string;
  order_item_id: string;
  product_id: string;
  inventory_item_id: string | null;
  status: string;
  delivered_credential_reference: string | null;
  created_at: string;
}

export interface DbOutboxEvent {
  id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  store_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  locked_until: string | null;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface DbJob {
  id: string;
  job_type: string;
  queue_name: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  locked_until: string | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface DbSecurityEvent {
  id: string;
  store_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  severity: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DbIdempotencyRecord {
  id: string;
  store_id: string | null;
  scope: 'checkout' | 'payment_command' | 'fulfillment' | 'billing' | 'webhook' | 'job';
  idempotency_key: string;
  request_hash: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  response_payload: Record<string, unknown> | null;
  error_payload: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
}

export interface DbAppSession {
  id: string;
  session_type: 'SELLER' | 'CUSTOMER' | 'PLATFORM';
  token_hash: string;
  user_id: string | null;
  store_id: string | null;
  active_membership_id: string | null;
  role: string;
  metadata: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}
