/**
 * Bintang Tech Studio — Platform System Health Monitoring Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements system health telemetry abstractions.
 * EXPLICIT CLASSIFICATION: Categorized as FOUNDATION_ABSTRACTION / SIMULATION;
 * never claims live VPS bare-metal metrics without live infra daemon integration.
 */

import { PlatformHealthReport, PlatformComponentHealth, ComponentHealthStatus } from '../types.js';
import { PlatformHealthRepository } from './interfaces.js';

export class PlatformHealthService {
  constructor(private readonly repository: PlatformHealthRepository) {}

  public async getHealthReport(): Promise<PlatformHealthReport> {
    return this.repository.getLatestReport();
  }

  public async recordHeartbeat(
    componentName: string,
    status: ComponentHealthStatus,
    message?: string,
    latencyMs?: number,
  ): Promise<PlatformComponentHealth> {
    return this.repository.updateComponentStatus(componentName, status, message, latencyMs);
  }
}
