export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED';

export interface ComponentHealth {
  readonly name: string;
  readonly status: HealthStatus;
  readonly isCritical: boolean;
  readonly message?: string | undefined;
  readonly latencyMs?: number | undefined;
  readonly timestamp: string;
  readonly details?: Record<string, unknown> | undefined;
}

export interface SystemHealthReport {
  readonly status: HealthStatus;
  readonly version: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly components: Record<string, ComponentHealth>;
}

const startTime = Date.now();

export function evaluateHealth(
  components: Record<string, ComponentHealth>,
  version = '0.1.0',
): SystemHealthReport {
  const componentValues = Object.values(components);

  let finalStatus: HealthStatus = 'UP';

  for (const comp of componentValues) {
    if (comp.status === 'DOWN') {
      if (comp.isCritical) {
        finalStatus = 'DOWN';
        break; // Critical failure guarantees DOWN
      } else {
        finalStatus = 'DEGRADED';
      }
    } else if (comp.status === 'DEGRADED') {
      finalStatus = 'DEGRADED';
    }
  }

  return {
    status: finalStatus,
    version,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    components,
  };
}
