import { Injectable, NotFoundException } from '@nestjs/common';
import type { PayrollLoanCreate, PayrollLoanView } from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';

/**
 * Payroll loans. Generates an installment schedule on creation; the run
 * engine deducts the scheduled installment for each period (if any) by
 * inserting a `oneoff` PayComponentInput for the LOAN_REPAY component.
 */
@Injectable()
export class LoansService {
  constructor(private readonly tp: TenantPrismaService) {}

  async create(input: PayrollLoanCreate, userId: string): Promise<PayrollLoanView> {
    const db = this.tp.forCurrentTenant();
    const schedule = amortize(
      input.principal,
      input.interestRate,
      input.installments,
      input.startPeriod,
    );
    const installmentAmount = schedule[0]?.amount ?? 0;
    const loan = await db.payrollLoan.create({
      data: {
        staffId: input.staffId,
        principal: input.principal,
        interestRate: input.interestRate,
        installments: input.installments,
        installmentAmount,
        startPeriod: input.startPeriod,
        componentCode: input.componentCode,
        reason: input.reason,
        schedule: {
          create: schedule.map((s) => ({
            sequence: s.sequence,
            period: s.period,
            amount: s.amount,
            principalPart: s.principalPart,
            interestPart: s.interestPart,
          })),
        },
      },
      include: { schedule: true },
    });
    void userId;
    return view(loan);
  }

  async list(staffId?: string) {
    const where = staffId ? { staffId } : {};
    const rows = await this.tp.forCurrentTenant().payrollLoan.findMany({
      where,
      include: { schedule: { orderBy: { sequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(view);
  }

  /** Scheduled installments for a given period across all active loans. */
  async dueForPeriod(period: string) {
    return this.tp.forCurrentTenant().payrollLoanInstallment.findMany({
      where: { period, status: 'scheduled' },
      include: { loan: true },
    });
  }

  async markDeducted(installmentId: string, payslipId: string) {
    return this.tp.forCurrentTenant().payrollLoanInstallment.update({
      where: { id: installmentId },
      data: { status: 'deducted', payslipId },
    });
  }

  async settleIfComplete(loanId: string) {
    const db = this.tp.forCurrentTenant();
    const remaining = await db.payrollLoanInstallment.count({
      where: { loanId, status: 'scheduled' },
    });
    if (remaining === 0) {
      await db.payrollLoan.update({ where: { id: loanId }, data: { status: 'paid' } });
    }
  }
}

function amortize(
  principal: number,
  annualRate: number,
  n: number,
  startPeriod: string,
) {
  // Equal-installment amortization (mortgage style). Zero-rate falls back to
  // straight-line.
  const monthlyRate = annualRate / 12;
  const installment =
    monthlyRate === 0
      ? principal / n
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

  const [y0, m0] = startPeriod.split('-').map(Number);
  let balance = principal;
  let y = y0;
  let m = m0;
  const rows: Array<{
    sequence: number;
    period: string;
    amount: number;
    principalPart: number;
    interestPart: number;
  }> = [];

  for (let i = 1; i <= n; i++) {
    const interestPart = round2(balance * monthlyRate);
    const amount = i === n ? round2(balance + interestPart) : round2(installment);
    const principalPart = round2(amount - interestPart);
    balance = round2(balance - principalPart);
    rows.push({
      sequence: i,
      period: `${y}-${String(m).padStart(2, '0')}`,
      amount,
      principalPart,
      interestPart,
    });
    m += 1;
    if (m > 12) { y += 1; m = 1; }
  }
  return rows;
}

function view(loan: any): PayrollLoanView {
  const scheduled = (loan.schedule ?? []).filter((s: any) => s.status === 'scheduled');
  const outstanding = scheduled.reduce(
    (a: number, s: any) => a + Number(s.amount),
    0,
  );
  return {
    id: loan.id,
    staffId: loan.staffId,
    principal: Number(loan.principal),
    outstanding: round2(outstanding),
    installments: loan.installments,
    installmentAmount: Number(loan.installmentAmount),
    status: loan.status,
    startPeriod: loan.startPeriod,
    schedule: (loan.schedule ?? []).map((s: any) => ({
      sequence: s.sequence,
      period: s.period,
      amount: Number(s.amount),
      principalPart: Number(s.principalPart),
      interestPart: Number(s.interestPart),
      status: s.status,
    })),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
