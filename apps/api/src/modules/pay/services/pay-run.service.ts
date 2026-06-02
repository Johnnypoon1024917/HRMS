import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePayRun,
  Payslip,
  PayslipLine,
  PayRunResult,
  PayRunVariance,
  YtdSnapshot,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { currentWhere } from '../../../common/effective-dating/effective';
import { evalFormula } from '../formula';
import { computeMpf, MpfRates } from '../engines/mpf-engine';
import { computeTax, TaxRules } from '../engines/tax-engine';
import { proRate } from '../engines/proration-engine';
import { YtdService } from '../engines/ytd.service';
import { LoansService } from './loans.service';
import { HolidayService } from './holiday.service';
import { TimesheetService } from './timesheet.service';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

/**
 * The full payroll pipeline. Per staff:
 *
 *   1. Resolve hire/exit + base salary as of period start.
 *   2. Compute pro-ration (worked days / calendar days, mid-period hires).
 *   3. Evaluate pay components in `sequence` order — formula sandbox sees
 *      `base`, `days`, `workedDays`, `line('CODE')`, `ytd('BUCKET')`,
 *      `const('KEY')`.
 *   4. Sum gross / taxable / mpfable / employer / deductions.
 *   5. Compute MPF (HK rules; data-driven via PayrollConstant).
 *   6. Compute tax (TaxRuleSet for the group locale; progressive vs standard).
 *   7. Apply scheduled loan installments (if any).
 *   8. Persist Payslip + PayslipLine; update YTD.
 *   9. Compute period-over-period variance vs the prior approved run.
 *  10. Aggregate run totals.
 *
 * The run is created in `draft`, transitions to `calculated`. Approval is
 * a separate dual-control step (a different user must approve).
 */
@Injectable()
export class PayRunService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly ytdSvc: YtdService,
    private readonly loans: LoansService,
    private readonly holidays: HolidayService,
    private readonly timesheets: TimesheetService,
  ) {}

  async createRun(
    input: CreatePayRun,
    access: Access,
    userId: string,
  ): Promise<PayRunResult> {
    const db = this.tp.forCurrentTenant();

    const group = await db.payGroup.findUnique({ where: { code: input.groupCode } });
    if (!group) throw new NotFoundException(`Pay group ${input.groupCode} not found`);

    const calendar = await db.payCalendar.findUnique({
      where: { groupCode_period: { groupCode: input.groupCode, period: input.period } },
    });
    if (calendar?.status === 'paid') {
      throw new BadRequestException(`Period ${input.period} is already paid`);
    }

    const [year, month] = input.period.split('-').map(Number);
    const periodStart = calendar?.periodStart ?? new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = calendar?.periodEnd ?? new Date(Date.UTC(year, month, 0));
    const calendarDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;

    const components = await db.payComponent.findMany({
      where: { active: true },
      orderBy: { sequence: 'asc' },
    });

    // In-scope staff: members of this pay group, active, within RBAC scope.
    const profiles = await db.staffPayProfile.findMany({
      where: { groupCode: group.code },
    });
    const staffIds = profiles.map((p) => p.staffId);
    if (staffIds.length === 0) {
      throw new BadRequestException(
        `No staff are assigned to pay group ${group.code}. Set their pay profile first.`,
      );
    }

    const staffWhere: any = {
      id: { in: staffIds },
      AND: [{ status: 'active' }],
    };
    const unitFilter = access.scopeUnits ?? (input.orgUnitId ? [input.orgUnitId] : null);
    if (unitFilter) {
      staffWhere.AND.push({
        appointments: {
          some: { ...currentWhere(periodStart), post: { orgUnitId: { in: unitFilter } } },
        },
      });
    }
    const staff = await db.staff.findMany({
      where: staffWhere,
      include: {
        salaries: { where: currentWhere(periodStart), take: 1 },
        appointments: { where: currentWhere(periodStart), take: 1 },
      },
    });
    const profileByStaff = new Map(profiles.map((p) => [p.staffId, p]));

    // Holiday calendar + work schedule for this group.
    const { allHolidayDates, statutoryDates } = await this.holidays.classify(
      group.localeCode,
      periodStart,
      periodEnd,
    );
    const workSchedule = await db.workSchedule.findUnique({ where: { groupCode: group.code } });
    const workingDays = workSchedule?.workingDays ??
      [false, true, true, true, true, true, false]; // default Mon-Fri
    const hoursPerDay = Number(workSchedule?.hoursPerDay ?? 8);
    const otMultiplier = Number(workSchedule?.otMultiplier ?? 1.5);
    const restDayMultiplier = Number(workSchedule?.restDayMultiplier ?? 2);
    const payStatutory = workSchedule?.payStatutoryHolidays ?? true;

    // Approved timesheets for hourly/daily staff.
    const timesheets = await this.timesheets.approvedForPeriod(
      input.period,
      staff.map((s) => s.id),
    );
    const tsByStaff = new Map(timesheets.map((t) => [t.staffId, t]));

    // Tax rule set: best match by localeCode + effectiveFrom.
    const taxRuleSet = await db.taxRuleSet.findFirst({
      where: { localeCode: group.localeCode, effectiveFrom: { lte: periodStart } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const taxRules: TaxRules = (taxRuleSet?.rules ?? { type: 'flat', flatRate: 0 }) as any;

    const mpfRates = await this.loadMpfRates();
    const periodsPerYear = periodsPerYearForFreq(group.frequency);
    const taxYear = await this.ytdSvc.resolveTaxYear(input.period);

    // Prior approved run for the same group (for variance).
    const previousRun = await db.payRun.findFirst({
      where: { groupCode: group.code, status: { in: ['approved', 'paid'] }, period: { lt: input.period } },
      orderBy: { period: 'desc' },
    });
    const priorByStaff = new Map<string, number>();
    if (previousRun) {
      const prior = await db.payslip.findMany({ where: { payRunId: previousRun.id } });
      for (const p of prior) priorByStaff.set(p.staffId, Number(p.gross));
    }

    const run = await db.payRun.create({
      data: {
        groupCode: group.code,
        period: input.period,
        type: input.type,
        status: 'draft',
        runBy: userId,
        paymentDate: calendar?.paymentDate,
        parentRunId: input.parentRunId,
      },
    });

    // Scheduled loan installments for this period — bucket by staff.
    const loanInstallments = await this.loans.dueForPeriod(input.period);
    const loanByStaff = new Map<string, { id: string; amount: number; loanId: string }[]>();
    for (const inst of loanInstallments) {
      const arr = loanByStaff.get(inst.loan.staffId) ?? [];
      arr.push({ id: inst.id, amount: Number(inst.amount), loanId: inst.loanId });
      loanByStaff.set(inst.loan.staffId, arr);
    }

    let totalGross = 0;
    let totalDeductions = 0;
    let totalEmployerCost = 0;
    let totalNet = 0;
    let totalTax = 0;

    for (const s of staff) {
      const profile = profileByStaff.get(s.id)!;
      const base = Number(s.salaries[0]?.amount ?? 0);
      const hireDate = s.appointments?.[0]?.effectiveFrom ?? s.createdAt;
      const unpaidLeaveDays = await this.unpaidLeaveDaysFor(s.id, periodStart, periodEnd);

      const appt = s.appointments?.[0];
      const contractType = (appt?.contractType ?? 'permanent') as
        | 'permanent' | 'fixed_term' | 'hourly' | 'daily' | 'part_time';
      const exitDate = appt?.effectiveTo ?? null;
      const pror = proRate({
        periodStart,
        periodEnd,
        hireDate: new Date(hireDate),
        exitDate,
        unpaidLeaveDays,
        holidayDates: allHolidayDates,
        workingDays,
      });

      // Statutory holiday count within the staff's span — only material for
      // non-monthly contracts.
      const statutoryInSpan = countStatutoryInSpan(
        new Date(hireDate) > periodStart ? new Date(hireDate) : periodStart,
        exitDate && exitDate < periodEnd ? exitDate : periodEnd,
        statutoryDates,
      );

      // Hourly / daily branch: replace BASIC with timesheet-derived earnings.
      const ts = tsByStaff.get(s.id);
      const hourlyRate = Number(appt?.hourlyRate ?? 0);
      const dailyRate = Number(appt?.dailyRate ?? 0);
      const fteFactor = Number(appt?.fteFactor ?? 1);

      const hourly = contractType === 'hourly' ? {
        regularHours: Number(ts?.regularHours ?? 0),
        ot15Hours: Number(ts?.ot15Hours ?? 0),
        ot20Hours: Number(ts?.ot20Hours ?? 0),
        rate: hourlyRate,
        otMultiplier,
        restDayMultiplier,
      } : null;
      const daily = contractType === 'daily' ? {
        daysWorked: Number(ts?.daysWorked ?? 0),
        rate: dailyRate,
      } : null;

      const inputs = await db.payComponentInput.findMany({
        where: { staffId: s.id, ...currentWhere(periodStart) },
      });
      const inputByCode = new Map(inputs.map((i) => [i.componentCode, i]));

      // Inject scheduled loan installment as a one-off component input.
      const loanDue = (loanByStaff.get(s.id) ?? []).reduce((a, x) => a + x.amount, 0);
      if (loanDue > 0) {
        inputByCode.set('LOAN_REPAY', { amount: loanDue, mode: 'oneoff' } as any);
      }

      const ytdSnap = await this.ytdSvc.snapshot(s.id, taxYear);

      const lineMap = new Map<string, number>();
      const lines: PayslipLine[] = [];
      for (const c of components) {
        const override = inputByCode.get(c.code);
        let amount: number;
        if (override?.amount != null) {
          amount = Number(override.amount);
          if ((override as any).mode === 'oneoff') {
            amount = amount;
          } else if (contractType === 'permanent' || contractType === 'fixed_term' || contractType === 'part_time') {
            amount = round2(amount * pror.factor);
          }
        } else if (c.code === 'BASIC' && hourly) {
          // Hourly: regular + OT @ multipliers. SH/RD already in ot20Hours.
          const regular = hourly.regularHours * hourly.rate;
          const ot15 = hourly.ot15Hours * hourly.rate * hourly.otMultiplier;
          const ot20 = hourly.ot20Hours * hourly.rate * hourly.restDayMultiplier;
          amount = round2(regular + ot15 + ot20);
        } else if (c.code === 'BASIC' && daily) {
          const shPay = payStatutory ? statutoryInSpan * daily.rate : 0;
          amount = round2(daily.daysWorked * daily.rate + shPay);
        } else if (c.code === 'BASIC' && contractType === 'part_time') {
          // Part-time monthly: base × FTE × proration factor.
          amount = round2(base * fteFactor * pror.factor);
        } else {
          try {
            amount = evalFormula(c.formula, {
              base: contractType === 'part_time' ? base * fteFactor : base,
              days: pror.calendarDays,
              workedDays: pror.workedDays,
              unpaidLeaveDays,
              periodFactor: pror.factor,
              line: (code) => lineMap.get(code) ?? 0,
              ytd: (bucket) => ytdSnap[bucket] ?? 0,
              const: () => 0,
            });
          } catch (e) {
            throw new BadRequestException(
              `Formula error in component ${c.code}: ${(e as Error).message}`,
            );
          }
        }
        lineMap.set(c.code, amount);
        lines.push({
          componentCode: c.code,
          componentName: c.nameEn,
          kind: c.kind as any,
          amount,
          taxable: c.taxable,
          mpfable: c.mpfable,
          glAccount: c.glAccount ?? undefined,
        });
      }

      // Fixed-term contract gratuity accrual line — informational; cashed
      // out on contract end via the termination service.
      const gratuityRate = Number(appt?.gratuityRate ?? 0);
      if (contractType === 'fixed_term' && gratuityRate > 0) {
        const accrual = round2(base * gratuityRate * pror.factor);
        lines.push({
          componentCode: 'GRATUITY_ACCRUAL',
          componentName: 'Contract gratuity (accrual)',
          kind: 'informational',
          amount: accrual,
          taxable: false,
          mpfable: false,
          glAccount: '2240',
        });
      }

      const earnings = lines.filter((l) => l.kind === 'earning');
      const deductions = lines.filter((l) => l.kind === 'deduction');
      const employer = lines.filter((l) => l.kind === 'employer');

      const gross = round2(earnings.reduce((a, l) => a + l.amount, 0));
      const taxableEarnings = round2(
        earnings.filter((l) => l.taxable).reduce((a, l) => a + l.amount, 0),
      );
      const mpfRelevant = round2(
        earnings.filter((l) => l.mpfable).reduce((a, l) => a + l.amount, 0),
      );

      // ---- MPF ----
      const mpf = computeMpf({
        relevantIncome: mpfRelevant,
        mpfClass: profile.mpfClass as any,
        voluntaryOptIn: profile.mpfVoluntary,
        rates: mpfRates,
      });

      // Inject MPF lines (auto, not in components table — schemes change too
      // often; we keep them as authoritative engine output).
      lines.push({
        componentCode: 'MPF_EE',
        componentName: 'MPF (Employee)',
        kind: 'deduction',
        amount: mpf.employee,
        taxable: false,
        mpfable: false,
        glAccount: '2220',
      });
      lines.push({
        componentCode: 'MPF_ER',
        componentName: 'MPF (Employer)',
        kind: 'employer',
        amount: mpf.employer,
        taxable: false,
        mpfable: false,
        glAccount: '2230',
      });

      // ---- Tax ----
      const taxRes = computeTax({
        periodTaxable: taxableEarnings,
        ytdTaxable: ytdSnap.TAXABLE ?? 0,
        ytdTax: ytdSnap.TAX ?? 0,
        periodsPerYear,
        rules: taxRules,
        profile: {
          maritalStatus: profile.taxMaritalStatus as any,
          dependents: profile.dependents,
        },
      });
      lines.push({
        componentCode: 'TAX_WHT',
        componentName: 'Tax (withheld)',
        kind: 'deduction',
        amount: taxRes.periodTax,
        taxable: false,
        mpfable: false,
        glAccount: '2210',
      });

      const sumDeductions = round2(
        [...deductions, { amount: mpf.employee }, { amount: taxRes.periodTax }].reduce(
          (a, l) => a + l.amount,
          0,
        ),
      );
      const sumEmployer = round2(employer.reduce((a, l) => a + l.amount, 0) + mpf.employer);
      const net = round2(gross - sumDeductions);
      const employerCost = round2(gross + sumEmployer);

      // YTD snapshot for the slip (snapshot BEFORE applying this period).
      const ytdSnapshotForSlip: YtdSnapshot = {
        taxable: round2(ytdSnap.TAXABLE ?? 0),
        tax: round2(ytdSnap.TAX ?? 0),
        mpfEe: round2(ytdSnap.MPF_EE ?? 0),
        mpfEr: round2(ytdSnap.MPF_ER ?? 0),
        gross: round2(ytdSnap.GROSS ?? 0),
        net: round2(ytdSnap.NET ?? 0),
      };

      const prior = priorByStaff.get(s.id);
      const variance =
        prior != null
          ? { gross_delta: round2(gross - prior), gross_prior: round2(prior) }
          : null;

      const slip = await db.payslip.create({
        data: {
          payRunId: run.id,
          staffId: s.id,
          gross,
          taxableEarnings,
          totalDeductions: sumDeductions,
          tax: taxRes.periodTax,
          mpfEmployee: mpf.employee,
          mpfEmployer: mpf.employer,
          employerCost,
          net,
          calendarDays: pror.calendarDays,
          workedDays: pror.workedDays,
          unpaidLeaveDays,
          contractType,
          regularHours: hourly?.regularHours ?? 0,
          otHours: (hourly?.ot15Hours ?? 0) + (hourly?.ot20Hours ?? 0),
          statutoryHolidayDays: statutoryInSpan,
          ytdSnapshot: ytdSnapshotForSlip as any,
          variance: variance as any,
          lines: {
            create: lines.map((l, i) => ({
              componentCode: l.componentCode,
              componentName: l.componentName,
              kind: l.kind,
              amount: l.amount,
              taxable: l.taxable,
              mpfable: l.mpfable,
              glAccount: l.glAccount,
              sequence: (i + 1) * 10,
            })),
          },
        },
      });

      // Mark loan installments as deducted.
      for (const inst of loanByStaff.get(s.id) ?? []) {
        await this.loans.markDeducted(inst.id, slip.id);
        await this.loans.settleIfComplete(inst.loanId);
      }

      // Update YTD accumulators.
      await this.ytdSvc.addMany(s.id, taxYear, {
        GROSS: gross,
        TAXABLE: taxableEarnings,
        TAX: taxRes.periodTax,
        MPF_EE: mpf.employee,
        MPF_ER: mpf.employer,
        NET: net,
      });

      totalGross += gross;
      totalDeductions += sumDeductions;
      totalEmployerCost += sumEmployer;
      totalNet += net;
      totalTax += taxRes.periodTax;
    }

    const result = await db.payRun.update({
      where: { id: run.id },
      data: {
        status: 'calculated',
        headcount: staff.length,
        totalGross: round2(totalGross),
        totalDeductions: round2(totalDeductions),
        totalEmployerCost: round2(totalEmployerCost),
        totalNet: round2(totalNet),
        totalTax: round2(totalTax),
      },
    });
    await this.audit.record({
      userId,
      action: 'create',
      entity: 'pay_run',
      entityId: run.id,
      after: {
        groupCode: group.code,
        period: input.period,
        headcount: staff.length,
        totalNet: round2(totalNet),
      },
    });

    return this.toResult(result);
  }

  async approveRun(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Pay run not found');
    if (run.status !== 'calculated') {
      throw new BadRequestException(`Cannot approve a run in status ${run.status}`);
    }
    if (run.runBy === userId) {
      throw new ForbiddenException(
        'Dual control: the pay run must be approved by a different user',
      );
    }
    const updated = await db.payRun.update({
      where: { id },
      data: { status: 'approved', approvedBy: userId, approvedAt: new Date() },
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'pay_run',
      entityId: id,
      before: { status: 'calculated' },
      after: { status: 'approved' },
    });
    return this.toResult(updated);
  }

  async markPaid(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Pay run not found');
    if (run.status !== 'approved') {
      throw new BadRequestException(`Cannot mark paid: status ${run.status}`);
    }
    const updated = await db.payRun.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() },
    });
    await db.payCalendar.updateMany({
      where: { groupCode: run.groupCode, period: run.period },
      data: { status: 'paid' },
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'pay_run',
      entityId: id,
      after: { status: 'paid' },
    });
    return this.toResult(updated);
  }

  /** Reverse an approved run: subtract its YTD impact and mark `reversed`. */
  async reverseRun(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({
      where: { id },
      include: { payslips: true },
    });
    if (!run) throw new NotFoundException('Pay run not found');
    if (!['approved', 'paid'].includes(run.status)) {
      throw new BadRequestException(`Cannot reverse a run in status ${run.status}`);
    }
    const taxYear = await this.ytdSvc.resolveTaxYear(run.period);
    for (const slip of run.payslips) {
      await this.ytdSvc.subtractMany(slip.staffId, taxYear, {
        GROSS: Number(slip.gross),
        TAXABLE: Number(slip.taxableEarnings),
        TAX: Number(slip.tax),
        MPF_EE: Number(slip.mpfEmployee),
        MPF_ER: Number(slip.mpfEmployer),
        NET: Number(slip.net),
      });
    }
    const updated = await db.payRun.update({
      where: { id },
      data: { status: 'reversed' },
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'pay_run',
      entityId: id,
      after: { status: 'reversed' },
    });
    return this.toResult(updated);
  }

  async listRuns(groupCode?: string) {
    return this.tp
      .forCurrentTenant()
      .payRun.findMany({
        where: groupCode ? { groupCode } : {},
        orderBy: { period: 'desc' },
      });
  }

  async payslips(runId: string, access: Access): Promise<Payslip[]> {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Pay run');
    const rows = await db.payslip.findMany({
      where: { payRunId: runId },
      include: { lines: { orderBy: { sequence: 'asc' } } },
    });
    const canRestricted = access.permissions.has('pay.read.restricted');
    const numbers = await db.staff.findMany({
      where: { id: { in: rows.map((r) => r.staffId) } },
      select: { id: true, staffNo: true, nameEn: true, nameZh: true },
    });
    const map = new Map(numbers.map((n) => [n.id, n]));
    return rows.map((r) => {
      const s = map.get(r.staffId);
      return {
        staffId: r.staffId,
        staffNo: s?.staffNo ?? '',
        staffNameEn: s?.nameEn,
        staffNameZh: s?.nameZh ?? undefined,
        payRunId: r.payRunId,
        period: run.period,
        gross: Number(r.gross),
        taxableEarnings: Number(r.taxableEarnings),
        totalDeductions: Number(r.totalDeductions),
        tax: Number(r.tax),
        mpfEmployee: Number(r.mpfEmployee),
        mpfEmployer: Number(r.mpfEmployer),
        employerCost: Number(r.employerCost),
        net: canRestricted ? Number(r.net) : -1,
        currency: r.currency,
        calendarDays: r.calendarDays,
        workedDays: Number(r.workedDays),
        unpaidLeaveDays: Number(r.unpaidLeaveDays),
        lines: canRestricted
          ? r.lines.map((l) => ({
              componentCode: l.componentCode,
              componentName: l.componentName,
              kind: l.kind as any,
              amount: Number(l.amount),
              taxable: l.taxable,
              mpfable: l.mpfable,
              glAccount: l.glAccount ?? undefined,
            }))
          : [],
        ytd: r.ytdSnapshot as any,
        variance: r.variance as any,
        paymentStatus: r.paymentStatus as any,
      };
    });
  }

  async variance(runId: string): Promise<PayRunVariance> {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Pay run');
    const prior = await db.payRun.findFirst({
      where: {
        groupCode: run.groupCode,
        status: { in: ['approved', 'paid'] },
        period: { lt: run.period },
      },
      orderBy: { period: 'desc' },
    });
    const current = await db.payslip.findMany({ where: { payRunId: runId } });
    const previous = prior
      ? await db.payslip.findMany({ where: { payRunId: prior.id } })
      : [];
    const prevByStaff = new Map(previous.map((p) => [p.staffId, Number(p.gross)]));
    const numbers = await db.staff.findMany({
      where: { id: { in: current.map((c) => c.staffId) } },
      select: { id: true, staffNo: true },
    });
    const noMap = new Map(numbers.map((n) => [n.id, n.staffNo]));
    const rows = current.map((c) => {
      const previousGross = prevByStaff.get(c.staffId) ?? 0;
      const currentGross = Number(c.gross);
      const delta = round2(currentGross - previousGross);
      const pctChange = previousGross
        ? round2((delta / previousGross) * 100)
        : 0;
      return {
        staffId: c.staffId,
        staffNo: noMap.get(c.staffId) ?? '',
        current: currentGross,
        previous: previousGross,
        delta,
        pctChange,
      };
    });
    return {
      currentRunId: runId,
      previousRunId: prior?.id ?? null,
      totalDelta: round2(rows.reduce((a, r) => a + r.delta, 0)),
      rows,
    };
  }

  // ---- helpers ----

  private toResult(r: any): PayRunResult {
    return {
      id: r.id,
      groupCode: r.groupCode,
      period: r.period,
      type: r.type,
      status: r.status,
      headcount: r.headcount,
      totalGross: Number(r.totalGross),
      totalDeductions: Number(r.totalDeductions),
      totalEmployerCost: Number(r.totalEmployerCost),
      totalNet: Number(r.totalNet),
      totalTax: Number(r.totalTax),
      paymentDate: r.paymentDate?.toISOString?.() ?? null,
    };
  }

  private async loadMpfRates(): Promise<MpfRates> {
    const db = this.tp.forCurrentTenant();
    const rows = await db.payrollConstant.findMany({
      where: {
        key: {
          in: ['MPF_RATE_EE', 'MPF_RATE_ER', 'MPF_FLOOR_MONTHLY', 'MPF_CAP_MONTHLY'],
        },
      },
    });
    const v = (key: string, fallback: number) => {
      const row = rows.find((r) => r.key === key);
      return row ? Number(row.value) : fallback;
    };
    return {
      rateEmployee: v('MPF_RATE_EE', 0.05),
      rateEmployer: v('MPF_RATE_ER', 0.05),
      floorMonthly: v('MPF_FLOOR_MONTHLY', 7100),
      capMonthly: v('MPF_CAP_MONTHLY', 30000),
    };
  }

  private async unpaidLeaveDaysFor(
    staffId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const db = this.tp.forCurrentTenant();
    const reqs = await db.leaveRequest.findMany({
      where: {
        staffId,
        status: 'approved',
        leaveTypeCode: 'NPL',
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
    });
    return reqs.reduce((a, r) => a + Number(r.days), 0);
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function countStatutoryInSpan(start: Date, end: Date, dates: Set<string>): number {
  let n = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    if (dates.has(new Date(t).toISOString().slice(0, 10))) n++;
  }
  return n;
}

function periodsPerYearForFreq(freq: string): number {
  switch (freq) {
    case 'weekly': return 52;
    case 'biweekly': return 26;
    case 'semimonthly': return 24;
    case 'monthly':
    default: return 12;
  }
}
