import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';

/**
 * GL posting. Generates double-entry journal lines per pay run, grouped by
 * GL account on the component (with a sensible fallback chart of accounts).
 *
 * Convention (HK Generally Accepted):
 *   Dr  6xxx Payroll expense      (earnings + employer contributions)
 *   Cr  2200 Wages payable        (net pay clearing — released on bank file)
 *   Cr  2210 Tax withheld payable
 *   Cr  2220 MPF EE payable
 *   Cr  2230 MPF ER payable
 */
@Injectable()
export class GlPostingService {
  constructor(private readonly tp: TenantPrismaService) {}

  async generate(runId: string) {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({
      where: { id: runId },
      include: { payslips: { include: { lines: true } } },
    });
    if (!run) throw new NotFoundException('Pay run');

    // Aggregate lines by GL account.
    const acc: Record<string, { account: string; debit: number; credit: number; memo: string }> = {};
    const push = (account: string, side: 'D' | 'C', amount: number, memo: string) => {
      const k = account;
      acc[k] ??= { account, debit: 0, credit: 0, memo };
      if (side === 'D') acc[k].debit = round2(acc[k].debit + amount);
      else acc[k].credit = round2(acc[k].credit + amount);
    };

    let totalEarn = 0;
    let totalEmployer = 0;
    let totalTax = 0;
    let totalMpfEe = 0;
    let totalMpfEr = 0;
    let totalNet = 0;

    for (const slip of run.payslips) {
      totalTax += Number(slip.tax);
      totalMpfEe += Number(slip.mpfEmployee);
      totalMpfEr += Number(slip.mpfEmployer);
      totalNet += Number(slip.net);
      for (const l of slip.lines) {
        const amount = Number(l.amount);
        if (l.kind === 'earning') {
          totalEarn += amount;
          push(l.glAccount ?? '6100', 'D', amount, `${l.componentCode} earnings`);
        } else if (l.kind === 'employer') {
          totalEmployer += amount;
          push(l.glAccount ?? '6200', 'D', amount, `${l.componentCode} employer`);
        }
        // deductions are tracked specifically below to keep the model simple
      }
    }

    push('2210', 'C', round2(totalTax), 'Tax withheld payable');
    push('2220', 'C', round2(totalMpfEe), 'MPF (employee) payable');
    push('2230', 'C', round2(totalMpfEr), 'MPF (employer) payable');
    push('2200', 'C', round2(totalNet), 'Wages payable (net)');

    // Clear and re-insert (idempotent re-runs).
    await db.glPosting.deleteMany({ where: { payRunId: runId } });
    await db.glPosting.createMany({
      data: Object.values(acc).map((e) => ({
        payRunId: runId,
        account: e.account,
        debit: e.debit,
        credit: e.credit,
        memo: e.memo,
      })),
    });
    return {
      totalEarnings: round2(totalEarn),
      totalEmployer: round2(totalEmployer),
      totalNet: round2(totalNet),
      totalTax: round2(totalTax),
      totalMpfEe: round2(totalMpfEe),
      totalMpfEr: round2(totalMpfEr),
    };
  }

  list(runId: string) {
    return this.tp
      .forCurrentTenant()
      .glPosting.findMany({ where: { payRunId: runId }, orderBy: { account: 'asc' } });
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100;
