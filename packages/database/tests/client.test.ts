import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { RecordNotFoundError, UniqueConstraintError, DatabaseError } from '../src/errors.js';

describe('PostgrestClient', () => {
  it('constructs correct URL and headers for select query', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      return new Response(JSON.stringify([{ id: 'store-1', name: 'Bintang Store' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const result = await client
      .from<{ id: string; name: string }>('stores')
      .select('id,name')
      .eq('id', 'store-1')
      .order('name', true)
      .limit(10)
      .execute();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Bintang Store');
    expect(capturedUrl).toContain('https://nowyzlyruzlokiejvtne.supabase.co/rest/v1/stores');
    expect(capturedUrl).toContain('select=id%2Cname');
    expect(capturedUrl).toContain('id=eq.store-1');
    expect(capturedUrl).toContain('order=name.asc');
    expect(capturedUrl).toContain('limit=10');
    expect(capturedHeaders['apikey']).toBe('test-key');
    expect(capturedHeaders['Authorization']).toBe('Bearer test-key');
    expect(capturedHeaders['Prefer']).toBe('return=representation');
  });

  it('handles single() and throws RecordNotFoundError when not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(client.from('stores').eq('id', 'non-existent').single()).rejects.toThrow(
      RecordNotFoundError,
    );
  });

  it('maps HTTP 409 to UniqueConstraintError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'duplicate key value violates unique constraint' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(client.from('stores').insert({ slug: 'already-taken' })).rejects.toThrow(
      UniqueConstraintError,
    );
  });

  it('maps HTTP 500 to DatabaseError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(client.from('stores').select('*').execute()).rejects.toThrow(DatabaseError);
  });

  it('performs ping() and returns latency metrics', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ id: 'test' }]), { status: 200 }));

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const ping = await client.ping();
    expect(ping.ok).toBe(true);
    expect(ping.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
