import { describe, it, expect } from 'vitest';
import {
  StructuredLogger,
  StructuredLogEntry,
  evaluateHealth,
  ComponentHealth,
} from '../src/index.js';

describe('StructuredLogger', () => {
  it('formats structured log entries and masks sensitive data', () => {
    const logs: unknown[] = [];
    const logger = new StructuredLogger({ requestId: 'req-123', storeId: 'store-abc' }, (entry) =>
      logs.push(entry),
    );

    logger.info('Test message', {
      username: 'alice',
      password: 'supersecretpassword',
      credit_card: '1234-5678-9012-3456',
    });

    expect(logs).toHaveLength(1);
    const entry = logs[0] as StructuredLogEntry;
    expect(entry.level).toBe('INFO');
    expect(entry.message).toBe('Test message');
    expect(entry.requestId).toBe('req-123');
    expect(entry.storeId).toBe('store-abc');
    expect(entry.payload?.['username']).toBe('alice');
    expect(entry.payload?.['password']).toBe('[REDACTED]');
    expect(entry.payload?.['credit_card']).toBe('[REDACTED]');
  });

  it('records security events with severity and type', () => {
    const logs: unknown[] = [];
    const logger = new StructuredLogger(undefined, (entry) => logs.push(entry));

    logger.security('UNAUTHORIZED_ACCESS_ATTEMPT', 'HIGH', {
      targetResource: '/api/v1/stores/store-xyz',
      ip: '192.168.1.1',
    });

    expect(logs).toHaveLength(1);
    const entry = logs[0] as StructuredLogEntry;
    expect(entry.level).toBe('WARN');
    expect(entry.eventType).toBe('UNAUTHORIZED_ACCESS_ATTEMPT');
    expect(entry.severity).toBe('HIGH');
  });

  it('records business events with entity metadata', () => {
    const logs: unknown[] = [];
    const logger = new StructuredLogger(undefined, (entry) => logs.push(entry));

    logger.business('ORDER_PLACED', 'Order', 'ord-999', { amount: 50000 });

    expect(logs).toHaveLength(1);
    const entry = logs[0] as StructuredLogEntry;
    expect(entry.message).toContain('ORDER_PLACED');
    expect(entry.payload?.['entityType']).toBe('Order');
    expect(entry.payload?.['entityId']).toBe('ord-999');
    expect(entry.payload?.['amount']).toBe(50000);
  });
});

describe('evaluateHealth', () => {
  it('reports UP when all critical components are UP', () => {
    const components: Record<string, ComponentHealth> = {
      database: {
        name: 'database',
        status: 'UP',
        isCritical: true,
        latencyMs: 15,
        timestamp: new Date().toISOString(),
      },
    };

    const report = evaluateHealth(components);
    expect(report.status).toBe('UP');
    expect(report.components.database?.status).toBe('UP');
  });

  it('reports DOWN when a critical component fails', () => {
    const components: Record<string, ComponentHealth> = {
      database: {
        name: 'database',
        status: 'DOWN',
        isCritical: true,
        message: 'Connection timeout',
        timestamp: new Date().toISOString(),
      },
      cache: {
        name: 'cache',
        status: 'UP',
        isCritical: false,
        timestamp: new Date().toISOString(),
      },
    };

    const report = evaluateHealth(components);
    expect(report.status).toBe('DOWN');
  });

  it('reports DEGRADED when a non-critical component fails', () => {
    const components: Record<string, ComponentHealth> = {
      database: {
        name: 'database',
        status: 'UP',
        isCritical: true,
        timestamp: new Date().toISOString(),
      },
      botNotifier: {
        name: 'botNotifier',
        status: 'DOWN',
        isCritical: false,
        message: 'Telegram API rate limited',
        timestamp: new Date().toISOString(),
      },
    };

    const report = evaluateHealth(components);
    expect(report.status).toBe('DEGRADED');
  });
});
