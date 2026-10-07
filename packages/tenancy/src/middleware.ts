import { TenantResolver } from './resolver.js';
import { AuthenticatedStoreContext } from './context.js';
import { UnauthorizedError, ValidationError } from '@bintang/shared';
import { unwrap } from '@bintang/shared';

export interface TenancyRequestHeaders {
  readonly [key: string]: string | string[] | undefined;
}

/**
 * Extracts store ID from incoming HTTP headers or query/params dictionary.
 * Looks for 'x-store-id' (case-insensitive).
 */
export function extractStoreIdFromHeaders(headers: TenancyRequestHeaders): string | null {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'x-store-id') {
      if (Array.isArray(value)) return value[0] ?? null;
      return typeof value === 'string' ? value.trim() : null;
    }
  }
  return null;
}

/**
 * Generic request structure for HTTP middleware adapters.
 */
export interface HttpRequestLike {
  headers: TenancyRequestHeaders;
  user?: { id: string } | null;
  params?: Record<string, string>;
  query?: Record<string, string>;
  storeContext?: AuthenticatedStoreContext;
}

/**
 * Thin middleware / handler helper resolving StoreContext for incoming requests.
 * Connects controller layer to application service and tenancy resolver.
 */
export async function resolveStoreContextMiddleware(
  req: HttpRequestLike,
  resolver: TenantResolver,
  options?: {
    storeIdExtractor?: (req: HttpRequestLike) => string | null;
    userIdExtractor?: (req: HttpRequestLike) => string | null;
  },
): Promise<AuthenticatedStoreContext> {
  const userId = options?.userIdExtractor ? options.userIdExtractor(req) : (req.user?.id ?? null);

  if (!userId) {
    throw new UnauthorizedError('Authentication required: missing authenticated user ID');
  }

  const storeId = options?.storeIdExtractor
    ? options.storeIdExtractor(req)
    : (extractStoreIdFromHeaders(req.headers) ?? req.params?.storeId ?? req.query?.storeId ?? null);

  if (!storeId) {
    throw new ValidationError('Store identifier required (provide via x-store-id header or path)');
  }

  const result = await resolver.resolveStoreContext({
    userId,
    storeId,
    requestId:
      typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
    correlationId:
      typeof req.headers['x-correlation-id'] === 'string'
        ? req.headers['x-correlation-id']
        : undefined,
  });

  const context = unwrap(result);
  req.storeContext = context;
  return context;
}
