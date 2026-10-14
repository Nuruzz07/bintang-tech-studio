import { describe, expect, it } from 'vitest';
import { resolveRuntimeSupabaseConfig } from '../src/index.js';

describe('API runtime configuration safety', () => {
  it('fails closed in production when the database URL is missing instead of using a local mock', () => {
    expect(() => resolveRuntimeSupabaseConfig({ NODE_ENV: 'production' })).toThrow(
      /SUPABASE_STAGING_URL or SUPABASE_URL/,
    );
  });

  it('refuses a local mock database target in production', () => {
    expect(() =>
      resolveRuntimeSupabaseConfig({
        NODE_ENV: 'production',
        SUPABASE_STAGING_URL: 'http://127.0.0.1:54321',
        SUPABASE_STAGING_SERVICE_ROLE_KEY: 'test-only-key',
      }),
    ).toThrow(/Local mock Supabase URL is not permitted/);
  });

  it('requires a service-role key for production service startup', () => {
    expect(() =>
      resolveRuntimeSupabaseConfig({
        NODE_ENV: 'production',
        SUPABASE_STAGING_URL: 'https://vaaixneyotrilqfkulqw.supabase.co',
        SUPABASE_STAGING_SERVICE_ROLE_KEY: '',
        SUPABASE_STAGING_ANON_KEY: 'test-only-anon',
      }),
    ).toThrow(/requires a server-side Supabase service-role key/);
  });

  it('refuses production database targets even when credentials are present', () => {
    expect(() =>
      resolveRuntimeSupabaseConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://nowyzlyruzlokiejvtne.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
      }),
    ).toThrow(/Production Supabase project ref/);
  });

  it('continues to permit the explicit local development mock', () => {
    expect(resolveRuntimeSupabaseConfig({ NODE_ENV: 'development' })).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseKey: 'mock_key',
      serviceRoleKey: undefined,
    });
  });

  it('requires exact staging Supabase target for configured remote runtimes', () => {
    expect(() =>
      resolveRuntimeSupabaseConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://otherproject123.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
      }),
    ).toThrow(/UNAUTHORIZED PROJECT TARGET/);
  });
});
