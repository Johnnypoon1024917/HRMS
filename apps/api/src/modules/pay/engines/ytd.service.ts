import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';

/**
 * Year-to-date accumulators. The tax year start month is tenant-configurable
 * (HK = April, UK = April, US = January, SG = January). Defaults to April.
 *
 * Buckets:
 *   TAXABLE | TAX | MPF_EE | MPF_ER | GROSS | NET | OT_HOURS | <componentCode>
 */
@Injectable()
export class YtdService {
  constructor(private readonly tp: TenantPrismaService) {}

  async getTaxYearStartMonth(): Promise<number> {
    const db = this.tp.forCurrentTenant();
    const row = await db.payrollConstant.findUnique({
      where: { key: 'TAX_YEAR_START_MONTH' },
    });
    return row ? Number(row.value) : 4;
  }

  /** The tax year a given period belongs to. HK: 2026-04 → 2026; 2026-03 → 2025. */
  async resolveTaxYear(period: string): Promise<number> {
    const [y, m] = period.split('-').map(Number);
    const start = await this.getTaxYearStartMonth();
    return m >= start ? y : y - 1;
  }

  /** Read a single bucket; 0 if missing. */
  async balance(staffId: string, year: number, bucket: string): Promise<number> {
    const row = await this.tp
      .forCurrentTenant()
      .ytdAccumulator.findUnique({
        where: { staffId_year_bucket: { staffId, year, bucket } },
      });
    return row ? Number(row.amount) : 0;
  }

  async snapshot(staffId: string, year: number) {
    const rows = await this.tp
      .forCurrentTenant()
      .ytdAccumulator.findMany({ where: { staffId, year } });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.bucket] = Number(r.amount);
    return out;
  }

  async addMany(
    staffId: string,
    year: number,
    deltas: Record<string, number>,
  ) {
    const db = this.tp.forCurrentTenant();
    for (const [bucket, delta] of Object.entries(deltas)) {
      if (!delta) continue;
      await db.ytdAccumulator.upsert({
        where: { staffId_year_bucket: { staffId, year, bucket } },
        create: { staffId, year, bucket, amount: delta },
        update: { amount: { increment: delta } },
      });
    }
  }

  /** Used by correction/reversal runs. */
  async subtractMany(
    staffId: string,
    year: number,
    deltas: Record<string, number>,
  ) {
    const negated: Record<string, number> = {};
    for (const k of Object.keys(deltas)) negated[k] = -(deltas[k] || 0);
    await this.addMany(staffId, year, negated);
  }
}
