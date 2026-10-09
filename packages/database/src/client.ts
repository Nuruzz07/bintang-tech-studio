import { SupabaseConfig, QueryFilter } from './types.js';
import {
  DatabaseError,
  DatabaseConnectionError,
  RecordNotFoundError,
  UniqueConstraintError,
} from './errors.js';

export class PostgrestQueryBuilder<T> {
  private readonly baseUrl: string;
  private readonly table: string;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: typeof fetch;

  private selectCols = '*';
  private readonly filters: QueryFilter[] = [];
  private orderCol?: string | undefined;
  private orderAsc = true;
  private limitCount?: number | undefined;
  private offsetCount?: number | undefined;

  constructor(
    baseUrl: string,
    table: string,
    headers: Record<string, string>,
    fetchFn: typeof fetch,
  ) {
    this.baseUrl = baseUrl;
    this.table = table;
    this.headers = headers;
    this.fetchFn = fetchFn;
  }

  select(columns = '*'): this {
    this.selectCols = columns;
    return this;
  }

  eq(column: string, value: string | number | boolean): this {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: string | number | boolean): this {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: string | number): this {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: string | number): this {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: string | number): this {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: string | number): this {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, values: readonly (string | number)[]): this {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  order(column: string, ascending = true): this {
    this.orderCol = column;
    this.orderAsc = ascending;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  private buildUrl(): string {
    const params = new URLSearchParams();
    if (this.selectCols) {
      params.set('select', this.selectCols);
    }

    for (const f of this.filters) {
      if (f.op === 'in' && Array.isArray(f.value)) {
        params.set(f.column, `in.(${f.value.join(',')})`);
      } else {
        params.set(f.column, `${f.op}.${String(f.value)}`);
      }
    }

    if (this.orderCol) {
      params.set('order', `${this.orderCol}.${this.orderAsc ? 'asc' : 'desc'}`);
    }

    if (this.limitCount !== undefined) {
      params.set('limit', String(this.limitCount));
    }

    if (this.offsetCount !== undefined) {
      params.set('offset', String(this.offsetCount));
    }

    const query = params.toString();
    return `${this.baseUrl}/${this.table}${query ? `?${query}` : ''}`;
  }

  private async executeRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<readonly T[]> {
    const url = this.buildUrl();
    const headers: Record<string, string> = {
      ...this.headers,
      Prefer: 'return=representation',
      ...(extraHeaders ?? {}),
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      const init: RequestInit = {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      };
      response = await this.fetchFn(url, init);
    } catch (err) {
      throw new DatabaseConnectionError(`Failed to connect to Supabase PostgREST at ${url}`, err);
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      if (response.status === 404) {
        throw new RecordNotFoundError(this.table, JSON.stringify(this.filters));
      }
      if (response.status === 409) {
        throw new UniqueConstraintError(`Unique constraint violated on ${this.table}`, errorBody);
      }
      throw new DatabaseError(
        `PostgREST query error on ${this.table} (${response.status}): ${JSON.stringify(errorBody)}`,
        errorBody,
      );
    }

    const data = (await response.json()) as T[];
    return Object.freeze(data);
  }

  async execute(): Promise<readonly T[]> {
    return this.executeRequest('GET');
  }

  async single(): Promise<T> {
    const results = await this.limit(1).execute();
    const first = results[0];
    if (!first) {
      throw new RecordNotFoundError(this.table, JSON.stringify(this.filters));
    }
    return first;
  }

  async maybeSingle(): Promise<T | null> {
    const results = await this.limit(1).execute();
    return results[0] ?? null;
  }

  async insert(data: Partial<T> | readonly Partial<T>[]): Promise<readonly T[]> {
    const payload = Array.isArray(data) ? data : [data];
    return this.executeRequest('POST', payload);
  }

  async update(data: Partial<T>): Promise<readonly T[]> {
    return this.executeRequest('PATCH', data);
  }

  async delete(): Promise<readonly T[]> {
    return this.executeRequest('DELETE');
  }
}

export class PostgrestClient {
  private readonly restBaseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchFn: typeof fetch;

  constructor(config: SupabaseConfig) {
    const cleanUrl = config.supabaseUrl.replace(/\/+$/, '');
    this.restBaseUrl = `${cleanUrl}/rest/v1`;
    const key = config.serviceRoleKey ?? config.supabaseKey;

    this.defaultHeaders = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    };

    if (config.currentStoreId) {
      this.defaultHeaders['X-Store-Id'] = config.currentStoreId;
    }

    this.fetchFn = config.fetch ?? fetch;
  }

  from<T>(table: string): PostgrestQueryBuilder<T> {
    return new PostgrestQueryBuilder<T>(this.restBaseUrl, table, this.defaultHeaders, this.fetchFn);
  }

  async rpc<T>(functionName: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = `${this.restBaseUrl}/rpc/${functionName}`;
    const headers = {
      ...this.defaultHeaders,
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
    } catch (err) {
      throw new DatabaseConnectionError(`Failed to call RPC ${functionName} at ${url}`, err);
    }

    if (!response.ok) {
      const errDetail = await response.text();
      throw new DatabaseError(`RPC ${functionName} failed (${response.status}): ${errDetail}`);
    }

    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      // Light query to verify connection and credentials
      const url = `${this.restBaseUrl}/stores?select=id&limit=1`;
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers: this.defaultHeaders,
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
