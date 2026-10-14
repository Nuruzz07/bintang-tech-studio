import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Database Least Privilege & Migration Audit Suite', () => {
  const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');
  const migrationFile = path.join(
    migrationsDir,
    '20261010150000_least_privilege_and_service_role_grants.sql',
  );

  it('verifies that the least-privilege migration file exists and is populated', () => {
    expect(fs.existsSync(migrationFile)).toBe(true);
    const content = fs.readFileSync(migrationFile, 'utf-8');
    expect(content.length).toBeGreaterThan(500);
  });

  it('covers all 41 public domain tables in service_role DML grants', () => {
    const content = fs.readFileSync(migrationFile, 'utf-8');

    const expectedTables = [
      'stores',
      'store_members',
      'store_channels',
      'store_addons',
      'categories',
      'products',
      'inventory',
      'inventory_items',
      'customers',
      'vouchers',
      'voucher_redemptions',
      'orders',
      'order_items',
      'fulfillments',
      'fulfillment_items',
      'payment_accounts',
      'payments',
      'payment_events',
      'refunds',
      'subscriptions',
      'plans',
      'invoices',
      'invoice_items',
      'billing_payments',
      'profiles',
      'app_sessions',
      'idempotency_records',
      'jobs',
      'outbox_events',
      'activity_logs',
      'security_events',
      'security_incidents',
      'risk_decisions',
      'support_tickets',
      'templates',
      'template_versions',
      'notifications',
      'notification_deliveries',
      'notification_preferences',
      'bots',
      'addons',
    ];

    expect(expectedTables).toHaveLength(41);

    for (const table of expectedTables) {
      const grantRegex = new RegExp(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${table} TO service_role;`,
        'i',
      );
      expect(
        grantRegex.test(content),
        `Migration must grant DML on table "${table}" to service_role`,
      ).toBe(true);
    }
  });

  it('strictly revokes access on internal queue and audit tables from anon and PUBLIC', () => {
    const content = fs.readFileSync(migrationFile, 'utf-8');

    const restrictedInternalTables = [
      'jobs',
      'outbox_events',
      'security_events',
      'security_incidents',
      'risk_decisions',
      'activity_logs',
      'payment_events',
    ];

    for (const table of restrictedInternalTables) {
      const revokeRegex = new RegExp(
        `REVOKE ALL ON public\\.${table} FROM (anon, authenticated, PUBLIC|PUBLIC, anon);`,
        'i',
      );
      expect(
        revokeRegex.test(content),
        `Internal table "${table}" must be strictly revoked from anon/public`,
      ).toBe(true);
    }
  });

  it('ensures sequences and future default privileges are configured for service_role', () => {
    const content = fs.readFileSync(migrationFile, 'utf-8');

    expect(content).toContain(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;',
    );
    expect(content).toContain(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public\n    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;',
    );
    expect(content).toContain(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public\n    GRANT USAGE, SELECT ON SEQUENCES TO service_role;',
    );
  });

  it('grants function execution rights on all public schema functions to service_role', () => {
    const content = fs.readFileSync(migrationFile, 'utf-8');
    expect(content).toContain('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;');
  });
});
