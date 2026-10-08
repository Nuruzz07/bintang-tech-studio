/**
 * Bintang Tech Studio — Platform Owner Console Repository Interfaces.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import {
  PlatformUserSummary,
  UserAccountStatus,
  UserListFilter,
  PlatformSupportTicket,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
  PlatformAuditLog,
  AuditLogFilter,
  PlatformHealthReport,
  PlatformComponentHealth,
  PlatformPolicy,
  PlatformTemplateSummary,
  PlatformTemplateVersionSummary,
  TemplateVersionStatus,
  StoreListFilter,
} from '../types.js';
import { PlatformRole, Store, StoreRepository } from '@bintang/tenancy';

export interface PlatformStoreRepository extends StoreRepository {
  list(filter?: StoreListFilter): Promise<readonly Store[]>;
}

export interface PlatformUserRepository {
  list(filter?: UserListFilter): Promise<readonly PlatformUserSummary[]>;
  findById(id: string): Promise<PlatformUserSummary | null>;
  findByEmail(email: string): Promise<PlatformUserSummary | null>;
  create(user: PlatformUserSummary): Promise<PlatformUserSummary>;
  updatePlatformRole(id: string, newRole: PlatformRole): Promise<PlatformUserSummary>;
  updateStatus(id: string, newStatus: UserAccountStatus): Promise<PlatformUserSummary>;
  countByRole(role: PlatformRole): Promise<number>;
}

export interface PlatformSupportTicketRepository {
  list(filter?: {
    storeId?: string | undefined;
    status?: string | undefined;
  }): Promise<readonly PlatformSupportTicket[]>;
  findById(id: string): Promise<PlatformSupportTicket | null>;
  create(input: CreateSupportTicketInput, ticketNumber: string): Promise<PlatformSupportTicket>;
  update(id: string, updates: UpdateSupportTicketInput): Promise<PlatformSupportTicket>;
  countByStatus(status: string): Promise<number>;
}

export interface PlatformAuditLogRepository {
  /**
   * Append-only contract: Logs are permanently recorded and cannot be modified or deleted.
   */
  append(log: PlatformAuditLog): Promise<PlatformAuditLog>;
  list(filter?: AuditLogFilter): Promise<readonly PlatformAuditLog[]>;
  findById(id: string): Promise<PlatformAuditLog | null>;
}

export interface PlatformHealthRepository {
  getLatestReport(): Promise<PlatformHealthReport>;
  updateComponentStatus(
    name: string,
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'MAINTENANCE',
    message?: string,
    latencyMs?: number,
  ): Promise<PlatformComponentHealth>;
}

export interface PlatformSettingsRepository {
  listPolicies(): Promise<readonly PlatformPolicy[]>;
  getPolicyByKey(key: string): Promise<PlatformPolicy | null>;
  setPolicy(key: string, value: unknown, updatedBy: string): Promise<PlatformPolicy>;
}

export interface PlatformTemplateRepository {
  listTemplates(): Promise<readonly PlatformTemplateSummary[]>;
  listVersions(templateId?: string): Promise<readonly PlatformTemplateVersionSummary[]>;
  findById(templateId: string): Promise<PlatformTemplateSummary | null>;
  findVersionById(versionId: string): Promise<PlatformTemplateVersionSummary | null>;
  updateVersionStatus(
    versionId: string,
    status: TemplateVersionStatus,
  ): Promise<PlatformTemplateVersionSummary>;
}
