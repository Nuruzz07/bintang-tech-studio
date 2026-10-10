import { ParsedRequest } from '../router.js';
import { ApiDependencies, ApiResponse } from '../types.js';

export interface HealthCheckData {
  readonly status: 'pass' | 'warn' | 'fail';
  readonly version: string;
  readonly timestamp: string;
  readonly latencyMs?: number | undefined;
  readonly databaseStatus: string;
}

export async function handleHealthCheck(
  _req: ParsedRequest,
  deps: ApiDependencies,
): Promise<ApiResponse<HealthCheckData>> {
  let dbStatus = 'UNKNOWN';
  let latencyMs: number | undefined;

  try {
    if (deps.database && typeof deps.database.checkHealth === 'function') {
      const health = await deps.database.checkHealth();
      dbStatus = health.status;
      latencyMs = health.latencyMs;
    } else {
      dbStatus = 'pass';
    }
  } catch (err) {
    dbStatus = 'fail';
    deps.logger.error('Database health ping failed', {
      error: err instanceof Error ? { name: err.name, message: err.message } : undefined,
    });
  }

  const overallStatus = dbStatus === 'pass' ? 'pass' : dbStatus === 'warn' ? 'warn' : 'fail';

  return {
    data: {
      status: overallStatus,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      latencyMs,
      databaseStatus: dbStatus,
    },
  };
}
