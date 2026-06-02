import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ExitForecastRow,
  ExitUpsert,
  ExitView,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere } from '../../common/effective-dating/effective';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class ExmService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: ExitUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const staff = await db.staff.findUnique({ where: { id: input.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
    const saved = await db.exitRecord.create({
      data: {
        staffId: input.staffId,
        reason: input.reason,
        effectiveDate: new Date(input.effectiveDate),
        interviewNotes: input.interviewNotes,
        createdBy: userId,
      },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'exit_record', entityId: saved.id, after: saved,
    });
    return saved;
  }

  async list(access: Access, status?: string): Promise<ExitView[]> {
    const db = this.tp.forCurrentTenant();
    const where: any = status ? { status } : {};
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
    const rows = await db.exitRecord.findMany({
      where,
      orderBy: { effectiveDate: 'asc' },
    });
    const staffIds = [...new Set(rows.map((r) => r.staffId))];
    const sMap = new Map(
      (
        await db.staff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, staffNo: true, nameEn: true },
        })
      ).map((s) => [s.id, s]),
    );
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffNo: sMap.get(r.staffId)?.staffNo,
      staffName: sMap.get(r.staffId)?.nameEn,
      reason: r.reason as any,
      effectiveDate: r.effectiveDate.toISOString().slice(0, 10),
      status: r.status as any,
      interviewNotes: r.interviewNotes ?? undefined,
      processedAt: r.processedAt?.toISOString(),
    }));
  }

  async cancel(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const r = await db.exitRecord.findUnique({ where: { id } });
    if (!r || r.status !== 'pending') throw new NotFoundException();
    await this.audit.record({
      userId, action: 'update', entity: 'exit_record', entityId: id,
      before: { status: 'pending' }, after: { status: 'cancelled' },
    });
    return db.exitRecord.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  /**
   * Daily batch (UR-EXM-002): apply due pending exits — set staff `delflag`,
   * close any open appointment, mark applied. Letters/memos are out of scope
   * here; the export-hook + BringUp framework handles them.
   */
  async runBatch(today = new Date()) {
    const db = this.tp.forCurrentTenant();
    const due = await db.exitRecord.findMany({
      where: { status: 'pending', effectiveDate: { lte: today } },
    });
    for (const r of due) {
      await db.staff.update({
        where: { id: r.staffId },
        data: { status: 'delflag' },
      });
      const open = await db.staffAppointment.findFirst({
        where: { staffId: r.staffId, effectiveTo: null },
      });
      if (open) {
        await db.staffAppointment.update({
          where: { id: open.id },
          data: { effectiveTo: r.effectiveDate },
        });
      }
      await db.exitRecord.update({
        where: { id: r.id },
        data: { status: 'applied', processedAt: today },
      });
    }
    return { processed: due.length };
  }

  /**
   * UR-EXM-004 promotion planning: staff with pending exits in the next
   * `windowDays`, joined with their current rank/unit for vacancy planning.
   */
  async forecast(access: Access, windowDays = 365): Promise<ExitForecastRow[]> {
    const db = this.tp.forCurrentTenant();
    const horizon = new Date(Date.now() + windowDays * 86_400_000);
    const where: any = {
      status: 'pending',
      effectiveDate: { lte: horizon },
    };
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
    const rows = await db.exitRecord.findMany({
      where,
      orderBy: { effectiveDate: 'asc' },
    });

    const out: ExitForecastRow[] = [];
    for (const r of rows) {
      const staff = await db.staff.findUnique({ where: { id: r.staffId } });
      if (!staff) continue;
      const appt = await db.staffAppointment.findFirst({
        where: { staffId: r.staffId, ...currentWhere() },
        include: { post: { include: { orgUnit: true } } },
        orderBy: { effectiveFrom: 'desc' },
      });
      out.push({
        staffId: staff.id,
        staffNo: staff.staffNo,
        staffName: staff.nameEn,
        rankCode: appt?.rankCode,
        orgUnitName: appt?.post?.orgUnit?.nameEn,
        reason: r.reason as any,
        effectiveDate: r.effectiveDate.toISOString().slice(0, 10),
        daysUntil: Math.ceil(
          (r.effectiveDate.getTime() - Date.now()) / 86_400_000,
        ),
      });
    }
    return out;
  }
}
