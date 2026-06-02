import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseNoteInput,
  CaseNoteView,
  CaseSummary,
  CaseUpsert,
  CaseView,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere } from '../../common/effective-dating/effective';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class CdmService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Cases the caller may see (data scope + classification gating). */
  async list(
    access: Access,
    filters: { staffId?: string; status?: string; kind?: string },
  ): Promise<CaseView[]> {
    const db = this.tp.forCurrentTenant();
    const where: any = { AND: [] };
    if (filters.staffId) where.AND.push({ staffId: filters.staffId });
    if (filters.status) where.AND.push({ status: filters.status });
    if (filters.kind) where.AND.push({ kind: filters.kind });

    // Data scope: restrict to staff in caller's org-unit subtree.
    if (access.scopeUnits) {
      const staff = await db.staff.findMany({
        where: {
          appointments: {
            some: {
              ...currentWhere(),
              post: { orgUnitId: { in: access.scopeUnits } },
            },
          },
        },
        select: { id: true },
      });
      where.AND.push({ staffId: { in: staff.map((s) => s.id) } });
    }

    const rows = await db.cdmCase.findMany({
      where,
      orderBy: { occurredOn: 'desc' },
    });
    const staffIds = [...new Set(rows.map((r) => r.staffId))];
    const staff = await db.staff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, staffNo: true, nameEn: true },
    });
    const sMap = new Map(staff.map((s) => [s.id, s]));

    const canRestricted = access.permissions.has('cdm.read.restricted');
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffNo: sMap.get(r.staffId)?.staffNo,
      staffName: sMap.get(r.staffId)?.nameEn,
      kind: r.kind as any,
      // Restricted cases collapse to a placeholder summary unless permitted.
      summary:
        r.classification === 'restricted' && !canRestricted
          ? '(restricted)'
          : r.summary,
      occurredOn: r.occurredOn.toISOString().slice(0, 10),
      status: r.status as any,
      classification: r.classification as any,
      openedBy: r.openedBy ?? undefined,
      closedAt: r.closedAt?.toISOString(),
    }));
  }

  async create(input: CaseUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.cdmCase.create({
      data: {
        staffId: input.staffId,
        kind: input.kind,
        summary: input.summary,
        occurredOn: new Date(input.occurredOn),
        status: input.status,
        classification: input.classification,
        openedBy: userId,
      },
    });
    await this.audit.record({
      userId,
      action: 'create',
      entity: 'cdm_case',
      entityId: saved.id,
      after: { ...saved, summary: '(redacted in audit)' },
    });
    return saved;
  }

  async close(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const c = await db.cdmCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Case not found');
    if (c.status === 'closed') return c;
    const saved = await db.cdmCase.update({
      where: { id },
      data: { status: 'closed', closedBy: userId, closedAt: new Date() },
    });
    await this.audit.record({
      userId, action: 'update', entity: 'cdm_case', entityId: id,
      before: { status: 'open' }, after: { status: 'closed' },
    });
    return saved;
  }

  async addNote(id: string, input: CaseNoteInput, userId: string, access: Access) {
    const db = this.tp.forCurrentTenant();
    const c = await db.cdmCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Case not found');
    if (c.classification === 'restricted' && !access.permissions.has('cdm.read.restricted')) {
      throw new ForbiddenException('Restricted case');
    }
    const saved = await db.cdmCaseNote.create({
      data: { caseId: id, byUserId: userId, note: input.note },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'cdm_case_note', entityId: saved.id,
      after: { caseId: id },
    });
    return saved;
  }

  async notes(id: string, access: Access): Promise<CaseNoteView[]> {
    const db = this.tp.forCurrentTenant();
    const c = await db.cdmCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Case not found');
    if (c.classification === 'restricted' && !access.permissions.has('cdm.read.restricted')) {
      return []; // Hide notes for restricted unless permitted.
    }
    const rows = await db.cdmCaseNote.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((n) => ({
      id: n.id,
      at: n.createdAt.toISOString(),
      byUserId: n.byUserId,
      note: n.note,
    }));
  }

  /** Compact summary per staff (UR-CDM-002 / UR-MOI-001 indicator). */
  async summary(staffId: string, access: Access): Promise<CaseSummary> {
    const db = this.tp.forCurrentTenant();
    const rows = await db.cdmCase.findMany({ where: { staffId } });
    const canRestricted = access.permissions.has('cdm.read.restricted');
    const visible = canRestricted
      ? rows
      : rows.filter((r) => r.classification !== 'restricted');
    const byKindMap = new Map<string, number>();
    for (const r of visible) {
      byKindMap.set(r.kind, (byKindMap.get(r.kind) ?? 0) + 1);
    }
    return {
      staffId,
      total: visible.length,
      open: visible.filter((r) => r.status === 'open').length,
      byKind: [...byKindMap].map(([kind, count]) => ({ kind, count })),
      restrictedCount: rows.length - visible.length,
    };
  }
}
