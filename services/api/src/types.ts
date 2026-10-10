import { Server } from 'node:http';
import { StructuredLogger } from '@bintang/observability';
import { CatalogService } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import { OrderService, CustomerRepository } from '@bintang/orders';
import { StoreRepository, StoreMember } from '@bintang/tenancy';
import { SupabaseDatabase, AppSession } from '@bintang/database';

export interface SessionLookupRepository {
  findByToken(token: string): Promise<AppSession | null>;
}

export interface StoreMemberLookupRepository {
  findByStoreAndUser(storeId: string, userId: string): Promise<StoreMember | null>;
}

export interface ApiDependencies {
  readonly database?: SupabaseDatabase | undefined;
  readonly sessionRepo?: SessionLookupRepository | undefined;
  readonly storeMemberRepo?: StoreMemberLookupRepository | undefined;
  readonly storeRepo: StoreRepository;
  readonly customerRepo: CustomerRepository;
  readonly catalogService: CatalogService;
  readonly inventoryService: InventoryService;
  readonly orderService: OrderService;
  readonly logger: StructuredLogger;
}

export interface ApiServerOptions {
  readonly port?: number | undefined;
  readonly host?: string | undefined;
  readonly dependencies?: Partial<ApiDependencies> | undefined;
  readonly logger?: StructuredLogger | undefined;
}

export interface ApiServerInstance {
  readonly server: Server;
  readonly port: number;
  readonly host: string;
  readonly dependencies: ApiDependencies;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface RequestTraceContext {
  readonly requestId: string;
  readonly startTime: number;
}

export interface ApiResponse<T> {
  readonly data: T;
  readonly meta?: Record<string, unknown> | undefined;
}

export interface ApiErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly requestId?: string | undefined;
}

export interface ApiErrorResponse {
  readonly error: ApiErrorDetail;
}
