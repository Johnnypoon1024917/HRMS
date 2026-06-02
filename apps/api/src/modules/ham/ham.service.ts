import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AwardTypeUpsert,
  AwardView,
  GrantAward,
  LsiCandidate,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class HamService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- types ----
  listTypes() {
    return this.tp.forCurrentTenant().awardType.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async upsertType(input: AwardTypeUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.awardType.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId, action: 'update', entity: 'award_type', entityId: saved.code, after: saved,
    });
    return saved;
  }

  // ---- awards ----
  async grant(input: GrantAward, userId: string) {
    const db = this.tp.forCurrentTenant();
    const [staff, type] = await Promise.all([
      db.staff.findUnique({ where: { id: input.staffId } }),
      db.awardType.findUnique({ where: { code: input.awardTypeCode } }),
    ]);
    if (!staff) throw new NotFoundException('Staff not found');
    if (!type || !type.active) throw new NotFoundException('Award type unknown');
    const saved = await db.award.create({
      data: {
        staffId: input.staffId,
        awardTypeCode: input.awardTypeCode,
        awardedOn: new Date(input.awardedOn),
        citation: input.citation,
        createdBy: userId,
      },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'award', entityId: saved.id, after: saved,
    });
    return saved;
  }

  async list(staffId?: string): Promise<AwardView[]> {
    const db = this.tp.forCurrentTenant();
    const rows = await db.award.findMany({
      where: staffId ? { staffId } : {},
      orderBy: { awardedOn: 'desc' },
      include: { awardType: true },
    });
    const staffIds = [...new Set(rows.map((r) => r.staffId))];
    const staff = await db.staff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, staffNo: true, nameEn: true },
    });
    const sMap = new Map(staff.map((s) => [s.id, s]));
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffNo: sMap.get(r.staffId)?.staffNo ?? '',
      staffName: sMap.get(r.staffId)?.nameEn ?? '',
      awardTypeCode: r.awardTypeCode,
      awardTypeName: r.awardType.nameEn,
      kind: r.awardType.kind as any,
      awardedOn: r.awardedOn.toISOString().slice(0, 10),
      citation: r.citation ?? undefined,
    }));
  }

  /**
   * UR-HAM-003 Long Service Increment: candidates who have crossed an LSI
   * threshold (years of service from the earliest substantive appointment)
   * and have not yet received that specific LSI award.
   */
  async lsiCandidates(access: Access): Promise<LsiCandidate[]> {
    const db = this.tp.forCurrentTenant();
    const lsiTypes = await db.awardType.findMany({
      where: { kind: 'lsi', active: true, lsiYears: { not: null } },
    });
    if (lsiTypes.length === 0) return [];

    const staffWhere: any = { status: 'active' };
    if (access.scopeUnits) {
      staffWhere.appointments = {
        some: { post: { orgUnitId: { in: access.scopeUnits } } },
      };
    }
    const staff = await db.staff.findMany({
      where: staffWhere,
      include: {
        appointments: {
          orderBy: { effectiveFrom: 'asc' },
          take: 1,
        },
        // For "already received" check.
      },
    });

    const out: LsiCandidate[] = [];
    const now = Date.now();
    for (const s of staff) {
      const first = s.appointments[0];
      if (!first) continue;
      const years = (now - first.effectiveFrom.getTime()) / 31_557_600_000;
      for (const t of lsiTypes) {
        if (years < (t.lsiYears ?? Infinity)) continue;
        const already = await db.award.findFirst({
          where: { staffId: s.id, awardTypeCode: t.code },
        });
        if (already) continue;
        out.push({
          staffId: s.id,
          staffNo: s.staffNo,
          staffName: s.nameEn,
          yearsOfService: Math.floor(years * 10) / 10,
          thresholdYears: t.lsiYears!,
          awardTypeCode: t.code,
        });
      }
    }
    return out.sort((a, b) => b.yearsOfService - a.yearsOfService);
  }
}
