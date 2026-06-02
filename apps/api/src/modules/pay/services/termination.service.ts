import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TerminationCreate, TerminationView } from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../../common/audit/audit.service';

/**
 * Final-pay calculator. Hong Kong rules baked in (configurable via
 * PayrollConstant overrides for other jurisdictions):
 *
 *  - SP (Severance Pay):    redundancy, ≥24 months service.
 *  - LSP (Long Service):    other dismissal / resignation, ≥5 years service.
 *  - SP and LSP are MUTUALLY EXCLUSIVE — never both for the same staff.
 *  - Both = (2/3 × last month wages, capped at HKD 22,500) × years of service,
 *    overall cap HKD 390,000.
 *  - PILN (Payment in Lieu of Notice): noticeMonths × last month wages.
 *  - Accrued leave payout: accruedDays × dailyRate (= monthlyBase / 30).
 *  - Pro-rated salary for the exit month.
 *  - Outstanding loans (scheduled installments still pending) → deducted.
 */
@Injectable()
export class TerminationService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(input: TerminationCreate): Promise<TerminationView> {
    return this.compute(input, /*persist*/ false, null);
  }

  async create(input: TerminationCreate, userId: string): Promise<TerminationView> {
    return this.compute(input, true, userId);
  }

  private async compute(
    input: TerminationCreate,
    persist: boolean,
    userId: string | null,
  ): Promise<TerminationView> {
    const db = this.tp.forCurrentTenant();
    const staff = await db.staff.findUnique({
      where: { id: input.staffId },
      include: {
        salaries: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
        appointments: { orderBy: { effectiveFrom: 'asc' }, take: 1 },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const exitDate = new Date(input.exitDate);
    const firstAppt = staff.appointments[0]?.effectiveFrom ?? staff.createdAt;
    const monthsOfService =
      input.monthsOfServiceOverride ??
      round2((exitDate.getTime() - new Date(firstAppt).getTime()) / (30.44 * 86_400_000));
    if (monthsOfService < 0) {
      throw new BadRequestException('Exit date precedes hire date');
    }

    const lastMonthBase = Number(staff.salaries[0]?.amount ?? 0);

    // Statutory caps (HK default; override via PayrollConstant).
    const cap = await this.constant('SEVERANCE_CAP_MONTHLY', 22500);
    const overallCap = await this.constant('SEVERANCE_CAP_OVERALL', 390000);

    const yearsOfService = monthsOfService / 12;
    const cappedMonthly = Math.min(lastMonthBase, cap);
    const baseSettlement = Math.min((2 / 3) * cappedMonthly * yearsOfService, overallCap);

    let severancePay = 0;
    let longServicePay = 0;
    if (input.reason === 'redundancy' && monthsOfService >= 24) {
      severancePay = round2(baseSettlement);
    } else if (
      ['resignation', 'dismissal', 'retirement'].includes(input.reason) &&
      monthsOfService >= 60
    ) {
      longServicePay = round2(baseSettlement);
    }

    const paymentInLieuNotice = round2(input.noticeMonths * lastMonthBase);

    // Accrued leave: pull from LeaveLedger snapshot if caller didn't override.
    const accruedDays =
      input.accruedLeaveDays ?? (await this.accruedLeaveDays(input.staffId));
    const accruedLeavePay = round2(accruedDays * (lastMonthBase / 30));

    // Pro-rated final-month salary based on day-of-month.
    const dom = exitDate.getUTCDate();
    const totalDom = new Date(
      Date.UTC(exitDate.getUTCFullYear(), exitDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const proratedSalary = round2((lastMonthBase * dom) / totalDom);

    // Outstanding loans → deduct from settlement.
    const loans = await db.payrollLoan.findMany({
      where: { staffId: input.staffId, status: 'active' },
      include: { schedule: { where: { status: 'scheduled' } } },
    });
    const outstandingLoans = round2(
      loans.flatMap((l) => l.schedule).reduce((a, s) => a + Number(s.amount), 0),
    );

    const extra = input.extraPayments.reduce((a, p) => a + p.amount, 0);

    const totalGross = round2(
      severancePay +
        longServicePay +
        paymentInLieuNotice +
        accruedLeavePay +
        proratedSalary +
        extra,
    );
    const totalDeductions = round2(outstandingLoans);
    const net = round2(totalGross - totalDeductions);

    const view: TerminationView = {
      id: 'preview',
      staffId: input.staffId,
      exitDate: exitDate.toISOString(),
      reason: input.reason,
      monthsOfService: round2(monthsOfService),
      lastMonthBase,
      severancePay,
      longServicePay,
      paymentInLieuNotice,
      accruedLeavePay,
      proratedSalary,
      outstandingLoans,
      totalGross,
      totalDeductions,
      net,
      status: 'draft',
    };

    if (!persist) return view;

    const saved = await db.terminationSettlement.create({
      data: {
        staffId: input.staffId,
        exitDate,
        reason: input.reason,
        monthsOfService: round2(monthsOfService),
        lastMonthBase,
        severancePay,
        longServicePay,
        paymentInLieuNotice,
        accruedLeavePay,
        proratedSalary,
        outstandingLoans,
        totalGross,
        totalDeductions,
        net,
        createdBy: userId,
      },
    });
    if (userId) {
      await this.audit.record({
        userId,
        action: 'create',
        entity: 'termination_settlement',
        entityId: saved.id,
        after: { staffId: input.staffId, net, reason: input.reason },
      });
    }
    return { ...view, id: saved.id };
  }

  async list(staffId?: string) {
    return this.tp.forCurrentTenant().terminationSettlement.findMany({
      where: staffId ? { staffId } : {},
      orderBy: { exitDate: 'desc' },
    });
  }

  // --- helpers ---

  private async constant(key: string, fallback: number) {
    const row = await this.tp
      .forCurrentTenant()
      .payrollConstant.findUnique({ where: { key } });
    return row ? Number(row.value) : fallback;
  }

  private async accruedLeaveDays(staffId: string): Promise<number> {
    const db = this.tp.forCurrentTenant();
    const year = new Date().getUTCFullYear();
    const ledger = await db.leaveLedger.findMany({
      where: { staffId, year },
    });
    return ledger.reduce((a, l) => a + Number(l.delta), 0);
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100;
