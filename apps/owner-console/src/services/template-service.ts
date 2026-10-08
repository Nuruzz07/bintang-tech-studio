/**
 * Bintang Tech Studio — Platform Template Management Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements storefront template catalog inspection and version governance.
 * Prohibits dangerous bulk store mutations.
 */

import {
  PlatformTemplateSummary,
  PlatformTemplateVersionSummary,
  TemplateVersionStatus,
  PlatformCaller,
} from '../types.js';
import { PlatformTemplateRepository } from './interfaces.js';
import { PlatformAuditService } from './audit-service.js';

export interface PlatformTemplateServiceDeps {
  readonly templateRepository: PlatformTemplateRepository;
  readonly auditService: PlatformAuditService;
}

export class PlatformTemplateService {
  constructor(private readonly deps: PlatformTemplateServiceDeps) {}

  public async listTemplates(): Promise<readonly PlatformTemplateSummary[]> {
    return this.deps.templateRepository.listTemplates();
  }

  public async listVersions(
    templateId?: string,
  ): Promise<readonly PlatformTemplateVersionSummary[]> {
    return this.deps.templateRepository.listVersions(templateId);
  }

  public async updateVersionStatus(
    caller: PlatformCaller,
    versionId: string,
    newStatus: TemplateVersionStatus,
    reason: string,
  ): Promise<PlatformTemplateVersionSummary> {
    const version = await this.deps.templateRepository.findVersionById(versionId);
    if (!version) {
      throw new Error(`Template version not found: ${versionId}`);
    }

    const previousStatus = version.status;
    const updated = await this.deps.templateRepository.updateVersionStatus(versionId, newStatus);

    await this.deps.auditService.logAction({
      caller,
      action: newStatus === 'PUBLISHED' ? 'TEMPLATE_PUBLISHED' : 'TEMPLATE_SUSPENDED',
      resourceType: 'template_version',
      resourceId: versionId,
      details: {
        templateId: version.templateId,
        version: version.version,
        previousStatus,
        newStatus,
        reason,
      },
      result: 'SUCCESS',
    });

    return updated;
  }
}
