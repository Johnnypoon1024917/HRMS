import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppraisalView,
  AppraiserAssessment,
  CycleUpsert,
  RatingDistribution,
  SelfAssessment,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere } from '../../common/effective-dating/effective';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class PemService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- cycles (admin) ----
  listCycles() {
    return this.tp
      .forCurrentTenant()
      .appraisalCycle.findMany({ orderBy: { periodYear: 'desc' } });
  }

  async upsertCycle(input: CycleUpsert, id: string | undefined, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = id
      ? await db.appraisalCycle.update({ where: { id }, data: input })
      : await db.appraisalCycle.create({ data: input });
    await this.audit.record({
      userId,
      action: id ? 'update' : 'create',
      entity: 'appraisal_cycle',
      entityId: saved.id,
      after: saved,
    });
    return saved;
  }

  /**
   * "Call appraisal report" (UR-PEM-001): create a pending appraisal for each
   * in-scope active staff member that does not already have one this cycle.
   */
  async generateReports(cycleId: string, access: Access, userId: string) {
    const db = this.tp.forCurrentTenant();
    const cycle = await db.appraisalCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const staffWhere: any = { status: 'active' };
    if (access.scopeUnits) {
      staffWhere.appointments = {
        some: { ...currentWhere(), post: { orgUnitId: { in: access.scopeUnits } } },
      };
    }
    const staff = await db.staff.findMany({
      where: staffWhere,
      select: { id: true },
    });

    let created = 0;
    for (const s of staff) {
      const exists = await db.appraisalReport.findUnique({
        where: { cycleId_staffId: { cycleId, staffId: s.id } },
      });
      if (!exists) {
        await db.appraisalReport.create({
          data: { cycleId, staffId: s.id, status: 'pending' },
        });
        created++;
      }
    }
    if (cycle.status === 'draft') {
      await db.appraisalCycle.update({
        where: { id: cycleId },
        data: { status: 'open' },
      });
    }
    await this.audit.record({
      userId,
      action: 'create',
      entity: 'appraisal_report',
      entityId: cycleId,
      after: { generated: created },
    });
    return { generated: created, total: staff.length };
  }

  // ---- helpers ----
  private async staffForUser(userId: string) {
    const s = await this.tp
      .forCurrentTenant()
      .staff.findFirst({ where: { userId } });
    if (!s) throw new NotFoundException('No staff record linked to this user');
    return s;
  }

  private async view(r: any): Promise<AppraisalView> {
    const db = this.tp.forCurrentTenant();
    const [cycle, staff] = await Promise.all([
      db.appraisalCycle.findUnique({ where: { id: r.cycleId } }),
      db.staff.findUnique({ where: { id: r.staffId } }),
    ]);
    return {
      id: r.id,
      cycleId: r.cycleId,
      cycleName: cycle?.name ?? '',
      staffId: r.staffId,
      staffNo: staff?.staffNo,
      staffName: staff?.nameEn,
      status: r.status,
      overallRating: r.overallRating ?? undefined,
      ratingMin: cycle?.ratingMin ?? 1,
      ratingMax: cycle?.ratingMax ?? 5,
      sections: cycle?.sections ?? [],
      selfComments: r.selfComments ?? undefined,
      selfScores: r.selfScores ?? undefined,
      appraiserComments: r.appraiserComments ?? undefined,
      scores: r.scores ?? undefined,
    };
  }

  // ---- employee self ----
  async myReports(userId: string): Promise<AppraisalView[]> {
    const staff = await this.staffForUser(userId);
    const rows = await this.tp.forCurrentTenant().appraisalReport.findMany({
      where: { staffId: staff.id },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async submitSelf(reportId: string, input: SelfAssessment, userId: string) {
    const db = this.tp.forCurrentTenant();
    const staff = await this.staffForUser(userId);
    const r = await db.appraisalReport.findUnique({ where: { id: reportId } });
    if (!r || r.staffId !== staff.id) throw new NotFoundException();
    if (!['pending', 'self_done'].includes(r.status)) {
      throw new BadRequestException('Self-assessment is closed for this report');
    }
    return db.appraisalReport.update({
      where: { id: reportId },
      data: {
        selfComments: input.selfComments,
        selfScores: input.selfScores,
        status: 'self_done',
      },
    });
  }

  // ---- appraiser (manager) ----
  async forAppraiser(access: Access): Promise<AppraisalView[]> {
    const db = this.tp.forCurrentTenant();
    const where: any = { status: { in: ['self_done', 'pending', 'appraised'] } };
    if (access.scopeUnits) {
      const staff = await db.staff.findMany({
        where: {
          appointments: {
            some: { ...currentWhere(), post: { orgUnitId: { in: access.scopeUnits } } },
          },
        },
        select: { id: true },
      });
      where.staffId = { in: staff.map((s) => s.id) };
    }
    const rows = await db.appraisalReport.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async submitAppraiser(
    reportId: string,
    input: AppraiserAssessment,
    userId: string,
  ) {
    const db = this.tp.forCurrentTenant();
    const r = await db.appraisalReport.findUnique({ where: { id: reportId } });
    if (!r) throw new NotFoundException('Report not found');
    const subject = await db.staff.findUnique({ where: { id: r.staffId } });
    if (subject?.userId === userId) {
      throw new ForbiddenException('You cannot appraise your own report');
    }
    const cycle = await db.appraisalCycle.findUnique({
      where: { id: r.cycleId },
    });
    if (
      cycle &&
      (input.overallRating < cycle.ratingMin ||
        input.overallRating > cycle.ratingMax)
    ) {
      throw new BadRequestException(
        `overallRating must be ${cycle.ratingMin}–${cycle.ratingMax}`,
      );
    }
    const saved = await db.appraisalReport.update({
      where: { id: reportId },
      data: {
        appraiserComments: input.appraiserComments,
        scores: input.scores,
        overallRating: input.overallRating,
        appraiserUserId: userId,
        status: 'appraised',
      },
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'appraisal_report',
      entityId: reportId,
      after: { status: 'appraised', overallRating: input.overallRating },
    });
    return saved;
  }

  async finalise(reportId: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const r = await db.appraisalReport.findUnique({ where: { id: reportId } });
    if (!r) throw new NotFoundException('Report not found');
    if (r.status !== 'appraised') {
      throw new BadRequestException('Only appraised reports can be finalised');
    }
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'appraisal_report',
      entityId: reportId,
      before: { status: 'appraised' },
      after: { status: 'finalised' },
    });
    return db.appraisalReport.update({
      where: { id: reportId },
      data: { status: 'finalised', finalisedAt: new Date() },
    });
  }

  /** Rating distribution analytics for a cycle (UR-PEM-005). */
  async distribution(cycleId: string): Promise<RatingDistribution> {
    const db = this.tp.forCurrentTenant();
    const cycle = await db.appraisalCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    const rows = await db.appraisalReport.findMany({ where: { cycleId } });
    const buckets: { rating: number; count: number }[] = [];
    for (let r = cycle.ratingMin; r <= cycle.ratingMax; r++) {
      buckets.push({
        rating: r,
        count: rows.filter((x) => Math.round(x.overallRating ?? -1) === r).length,
      });
    }
    return {
      cycleId,
      total: rows.length,
      finalised: rows.filter((x) => x.status === 'finalised').length,
      buckets,
    };
  }
}
