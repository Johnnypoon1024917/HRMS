import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export interface AuditEntry {
  userId?: string;
  activePostId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** Append-only audit log (REQ-SEC-001). No update/delete API is exposed. */
@Injectable()
export class AuditService {
  constructor(private readonly tp: TenantPrismaService) {}

  async record(e: AuditEntry) {
    await this.tp.forCurrentTenant().auditLog.create({
      data: {
        userId: e.userId,
        activePostId: e.activePostId,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        before: e.before as any,
        after: e.after as any,
        ip: e.ip,
      },
    });
  }
}
