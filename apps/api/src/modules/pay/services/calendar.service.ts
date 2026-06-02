import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { GenerateCalendar, PayCalendarEntry, PayGroupUpsert } from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';

/**
 * Pay groups + the materialised pay calendar. The calendar is generated up
 * front so HR can see cutoff/payment dates in advance and the run UI can
 * default to the right period.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly tp: TenantPrismaService) {}

  listGroups() {
    return this.tp.forCurrentTenant().payGroup.findMany({ orderBy: { code: 'asc' } });
  }

  upsertGroup(input: PayGroupUpsert) {
    return this.tp.forCurrentTenant().payGroup.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
  }

  async listCalendar(groupCode: string): Promise<PayCalendarEntry[]> {
    const rows = await this.tp.forCurrentTenant().payCalendar.findMany({
      where: { groupCode },
      orderBy: { periodStart: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      groupCode: r.groupCode,
      period: r.period,
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      cutoffAt: r.cutoffAt.toISOString(),
      paymentDate: r.paymentDate.toISOString(),
      status: r.status as PayCalendarEntry['status'],
    }));
  }

  async generate(input: GenerateCalendar) {
    const db = this.tp.forCurrentTenant();
    const group = await db.payGroup.findUnique({ where: { code: input.groupCode } });
    if (!group) throw new NotFoundException(`Pay group ${input.groupCode}`);

    const periods = enumeratePeriods(input.fromPeriod, input.toPeriod, group.frequency);
    if (periods.length > 60) {
      throw new BadRequestException('Refusing to generate more than 60 periods at once');
    }

    const out = [];
    for (const p of periods) {
      const { periodStart, periodEnd, cutoffAt, paymentDate } = periodWindow(
        p.period,
        group.cutoffDay,
        group.paymentDay,
      );
      const saved = await db.payCalendar.upsert({
        where: { groupCode_period: { groupCode: group.code, period: p.period } },
        create: {
          groupCode: group.code,
          period: p.period,
          periodStart,
          periodEnd,
          cutoffAt,
          paymentDate,
        },
        update: { periodStart, periodEnd, cutoffAt, paymentDate },
      });
      out.push(saved);
    }
    return out;
  }

  async lock(groupCode: string, period: string) {
    return this.tp.forCurrentTenant().payCalendar.update({
      where: { groupCode_period: { groupCode, period } },
      data: { status: 'locked' },
    });
  }
}

function enumeratePeriods(from: string, to: string, frequency: string) {
  // Monthly is the only one we materialise fully today; semi-monthly / weekly
  // emit one row per period and the period string is `YYYY-MM[-1|-2]` etc.
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const out: { period: string }[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const period = `${y}-${String(m).padStart(2, '0')}`;
    if (frequency === 'semimonthly') {
      out.push({ period: `${period}-1` }, { period: `${period}-2` });
    } else {
      out.push({ period });
    }
    m += 1;
    if (m > 12) { y += 1; m = 1; }
  }
  return out;
}

function clampDay(year: number, monthIdx: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIdx, Math.min(day, lastDay)));
}

function periodWindow(period: string, cutoffDay: number, paymentDay: number) {
  const base = period.slice(0, 7); // strip semimonthly suffix if any
  const [year, month] = base.split('-').map(Number);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  const cutoffAt = clampDay(year, month - 1, cutoffDay);
  // Payment day usually lands in the *next* month after period close.
  const paymentDate = clampDay(year, month - 1, paymentDay);
  return { periodStart, periodEnd, cutoffAt, paymentDate };
}
