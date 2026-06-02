import { Injectable, NotFoundException } from '@nestjs/common';
import type { TimesheetUpsert, TimesheetView } from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';

/**
 * Timesheets for hourly / daily / OT calculation. Periods align with the
 * pay calendar; one timesheet per staff per period. The pay-run engine
 * reads APPROVED timesheets only.
 */
@Injectable()
export class TimesheetService {
  constructor(private readonly tp: TenantPrismaService) {}

  async upsert(input: TimesheetUpsert) {
    const db = this.tp.forCurrentTenant();
    const totals = sumEntries(input.entries);

    return db.timesheet.upsert({
      where: { staffId_period: { staffId: input.staffId, period: input.period } },
      create: {
        staffId: input.staffId,
        period: input.period,
        status: 'draft',
        ...totals,
        entries: {
          create: input.entries.map((e) => ({
            date: new Date(e.date),
            hours: e.hours,
            kind: e.kind,
            note: e.note,
          })),
        },
      },
      update: {
        status: 'draft',
        ...totals,
        entries: {
          deleteMany: {},
          create: input.entries.map((e) => ({
            date: new Date(e.date),
            hours: e.hours,
            kind: e.kind,
            note: e.note,
          })),
        },
      },
      include: { entries: true },
    });
  }

  async submit(id: string) {
    return this.tp.forCurrentTenant().timesheet.update({
      where: { id },
      data: { status: 'submitted', submittedAt: new Date() },
    });
  }

  async approve(id: string, userId: string) {
    return this.tp.forCurrentTenant().timesheet.update({
      where: { id },
      data: { status: 'approved', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async list(staffId?: string, period?: string): Promise<TimesheetView[]> {
    const where: any = {};
    if (staffId) where.staffId = staffId;
    if (period) where.period = period;
    const rows = await this.tp.forCurrentTenant().timesheet.findMany({
      where,
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { period: 'desc' },
    });
    return rows.map(view);
  }

  /** Used by the run engine; only approved timesheets are honoured. */
  async approvedForPeriod(period: string, staffIds: string[]) {
    return this.tp.forCurrentTenant().timesheet.findMany({
      where: { period, staffId: { in: staffIds }, status: 'approved' },
    });
  }
}

function sumEntries(entries: TimesheetUpsert['entries']) {
  const regularHours = sum(entries.filter((e) => e.kind === 'regular').map((e) => e.hours));
  const ot15Hours = sum(entries.filter((e) => e.kind === 'ot15').map((e) => e.hours));
  const ot20Hours = sum(
    entries
      .filter((e) => e.kind === 'ot20' || e.kind === 'rest_day_work' || e.kind === 'holiday_work')
      .map((e) => e.hours),
  );
  const distinctDays = new Set(entries.map((e) => e.date.slice(0, 10))).size;
  return {
    regularHours,
    ot15Hours,
    ot20Hours,
    totalHours: regularHours + ot15Hours + ot20Hours,
    daysWorked: distinctDays,
  };
}

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

function view(t: any): TimesheetView {
  return {
    id: t.id,
    staffId: t.staffId,
    period: t.period,
    status: t.status,
    totalHours: Number(t.totalHours),
    regularHours: Number(t.regularHours),
    ot15Hours: Number(t.ot15Hours),
    ot20Hours: Number(t.ot20Hours),
    daysWorked: Number(t.daysWorked),
    entries: (t.entries ?? []).map((e: any) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      hours: Number(e.hours),
      kind: e.kind,
      note: e.note ?? undefined,
    })),
  };
}
