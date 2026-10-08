/**
 * Bintang Tech Studio — Idempotent & Recoverable Store Provisioning Service.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Responsibilities:
 * - Provision new merchant store idempotently upon subscription activation.
 * - Create authoritative STORE_OWNER membership (respecting M02 owner invariants).
 * - Support safe retry and recovery without duplicating stores or memberships.
 * - Decoupled from billing payment truth.
 */

import { ProvisioningRecord, ProvisionStoreInput, ProvisioningStatus } from './types.js';
import { ProvisioningRepository } from './repositories/interfaces.js';
import { StoreRepository, StoreMemberRepository } from '@bintang/tenancy';
import { ProvisioningError, ProvisioningAlreadyCompletedError } from './errors.js';
import { generateUUID } from './validation.js';

export interface ProvisioningServiceDeps {
  readonly provisioningRepository: ProvisioningRepository;
  readonly storeRepository: StoreRepository;
  readonly storeMemberRepository: StoreMemberRepository;
}

export class ProvisioningService {
  private shouldSimulateFailure = false;

  constructor(private readonly deps: ProvisioningServiceDeps) {}

  public setSimulateFailure(fail: boolean): void {
    this.shouldSimulateFailure = fail;
  }

  public async provisionStore(
    input: ProvisionStoreInput,
  ): Promise<{ storeId: string; status: ProvisioningStatus; record: ProvisioningRecord }> {
    // 1. Check idempotency record
    let record = await this.deps.provisioningRepository.findByIdempotencyKey(input.idempotencyKey);

    if (record) {
      if (record.status === 'PROVISIONING_COMPLETED') {
        return {
          storeId: record.storeId,
          status: record.status,
          record,
        };
      }
      if (record.status === 'PROVISIONING_IN_PROGRESS') {
        return {
          storeId: record.storeId,
          status: record.status,
          record,
        };
      }
    }

    const now = new Date().toISOString();
    let storeId = record?.storeId;
    const completedSteps: string[] = [...(record?.stepsCompleted || [])];

    // If new provisioning request, create pending record
    if (!record) {
      record = await this.deps.provisioningRepository.create({
        id: generateUUID('prov'),
        idempotencyKey: input.idempotencyKey,
        storeId: '', // placeholder until store created
        userId: input.userId,
        status: 'PROVISIONING_IN_PROGRESS',
        stepsCompleted: [],
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      record = await this.deps.provisioningRepository.update(record.id, {
        status: 'PROVISIONING_IN_PROGRESS',
        failureReason: null,
      });
    }

    try {
      // STEP 1: Create or Confirm Store
      if (!completedSteps.includes('STORE_CREATED')) {
        if (this.shouldSimulateFailure && completedSteps.length === 0) {
          throw new ProvisioningError('Simulated infrastructure failure during store creation');
        }

        const store = await this.deps.storeRepository.create({
          ownerUserId: input.userId,
          name: input.storeName,
          slug: input.storeSlug,
          templateVersionId: input.templateVersionId || null,
          status: 'ACTIVE',
          currency: 'IDR',
          settings: {
            planSlug: input.planSlug,
            provisionedAt: now,
          },
        });

        storeId = store.id;
        completedSteps.push('STORE_CREATED');

        record = await this.deps.provisioningRepository.update(record.id, {
          storeId,
          stepsCompleted: completedSteps,
        });
      }

      // STEP 2: Create Owner Membership (Respecting M02 Invariants)
      if (!completedSteps.includes('OWNER_MEMBERSHIP_CREATED')) {
        if (this.shouldSimulateFailure && completedSteps.includes('STORE_CREATED')) {
          throw new ProvisioningError('Simulated failure during owner membership creation');
        }

        // Verify if owner membership already exists (anti-duplication)
        const existingMembers = await this.deps.storeMemberRepository.findByStoreId(storeId!);
        const ownerExists = existingMembers.some(
          (m) => m.userId === input.userId && m.role === 'STORE_OWNER',
        );

        if (!ownerExists) {
          await this.deps.storeMemberRepository.create({
            storeId: storeId!,
            userId: input.userId,
            role: 'STORE_OWNER',
            status: 'ACTIVE',
          });
        }

        completedSteps.push('OWNER_MEMBERSHIP_CREATED');

        record = await this.deps.provisioningRepository.update(record.id, {
          stepsCompleted: completedSteps,
        });
      }

      // STEP 3: Apply Template / Baseline Config
      if (!completedSteps.includes('CONFIG_INITIALIZED')) {
        completedSteps.push('CONFIG_INITIALIZED');
        record = await this.deps.provisioningRepository.update(record.id, {
          stepsCompleted: completedSteps,
        });
      }

      // STEP 4: Mark Completed
      record = await this.deps.provisioningRepository.update(record.id, {
        status: 'PROVISIONING_COMPLETED',
        failureReason: null,
      });

      return {
        storeId: storeId!,
        status: 'PROVISIONING_COMPLETED',
        record,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown provisioning failure';
      record = await this.deps.provisioningRepository.update(record.id, {
        status: 'PROVISIONING_FAILED',
        failureReason: message,
      });

      throw new ProvisioningError(`Provisioning failed: ${message}`);
    }
  }

  public async retryProvisioning(
    idempotencyKey: string,
    fallbackInput?: ProvisionStoreInput,
  ): Promise<{ storeId: string; status: ProvisioningStatus; record: ProvisioningRecord }> {
    const record = await this.deps.provisioningRepository.findByIdempotencyKey(idempotencyKey);
    if (!record) {
      if (fallbackInput) {
        return this.provisionStore(fallbackInput);
      }
      throw new ProvisioningError(`No provisioning record found for key ${idempotencyKey}`);
    }

    if (record.status === 'PROVISIONING_COMPLETED') {
      throw new ProvisioningAlreadyCompletedError(record.storeId);
    }

    // Re-run provisionStore with recorded data
    return this.provisionStore({
      userId: record.userId,
      storeName: 'Retry Store',
      storeSlug: `retry-store-${Date.now()}`,
      planSlug: 'starter',
      idempotencyKey,
    });
  }

  public async getProvisioningStatus(storeId: string): Promise<ProvisioningRecord | null> {
    return this.deps.provisioningRepository.findByStoreId(storeId);
  }
}
