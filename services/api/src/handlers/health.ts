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
  let dbStatus = 'NOT_CONFIGURED';
  let latencyMs: number | undefined;

  if (deps.database && typeof deps.database.checkHealth === 'function') {
    try {
      const health = await deps.database.checkHealth();
      dbStatus = health.status;
      latencyMs = health.latencyMs;
    } catch (err) {
      dbStatus = 'DOWN';
      deps.logger.error('Database health ping failed', {
        error: err instanceof Error ? { name: err.name, message: err.message } : undefined,
      });
    }
  }

  const isDbHealthy = dbStatus === 'UP' || dbStatus === 'pass';
  const overallStatus: 'pass' | 'warn' | 'fail' = isDbHealthy
    ? 'pass'
    : dbStatus === 'DEGRADED' || dbStatus === 'warn'
      ? 'warn'
      : dbStatus === 'DOWN' || dbStatus === 'fail'
        ? 'fail'
        : 'pass';

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
