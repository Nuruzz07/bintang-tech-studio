/**
 * Bintang Tech Studio — Platform Support Ticket Management Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements minimal support ticket management mapped to M02 public.support_tickets schema.
 */

import {
  PlatformSupportTicket,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
  PlatformCaller,
} from '../types.js';
import { PlatformSupportTicketRepository } from './interfaces.js';
import { PlatformAuditService } from './audit-service.js';

export interface PlatformSupportServiceDeps {
  readonly ticketRepository: PlatformSupportTicketRepository;
  readonly auditService: PlatformAuditService;
}

export class PlatformSupportService {
  constructor(private readonly deps: PlatformSupportServiceDeps) {}

  public async listTickets(filter?: {
    storeId?: string | undefined;
    status?: string | undefined;
  }): Promise<readonly PlatformSupportTicket[]> {
    return this.deps.ticketRepository.list(filter);
  }

  public async getTicket(ticketId: string): Promise<PlatformSupportTicket | null> {
    return this.deps.ticketRepository.findById(ticketId);
  }

  public async createTicket(
    caller: PlatformCaller,
    input: CreateSupportTicketInput,
  ): Promise<PlatformSupportTicket> {
    const ticketNumber = `TICK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const created = await this.deps.ticketRepository.create(input, ticketNumber);

    await this.deps.auditService.logAction({
      caller,
      action: 'SUPPORT_TICKET_CREATED',
      resourceType: 'support_ticket',
      resourceId: created.id,
      storeId: input.storeId,
      details: { subject: input.subject, ticketNumber },
      result: 'SUCCESS',
    });

    return created;
  }

  public async updateTicket(
    caller: PlatformCaller,
    ticketId: string,
    updates: UpdateSupportTicketInput,
  ): Promise<PlatformSupportTicket> {
    const updated = await this.deps.ticketRepository.update(ticketId, updates);

    await this.deps.auditService.logAction({
      caller,
      action: 'SUPPORT_TICKET_UPDATED',
      resourceType: 'support_ticket',
      resourceId: ticketId,
      storeId: updated.storeId,
      details: { updates },
      result: 'SUCCESS',
    });

    return updated;
  }
}
