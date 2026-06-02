import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BenefitStats,
  BenefitTypeUpsert,
  BenefitView,
  EnrolBenefit,
  InvoiceLine,
  InvoiceView,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere } from '../../common/effective-dating/effective';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class HbmService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- types ----
  listTypes() {
    return this.tp
      .forCurrentTenant()
      .benefitType.findMany({ orderBy: { code: 'asc' } });
  }

  async upsertType(input: BenefitTypeUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.benefitType.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId, action: 'update', entity: 'benefit_type', entityId: saved.code, after: saved,
    });
    return saved;
  }

  // ---- enrolments ----
  async enrol(input: EnrolBenefit, userId: string) {
    const db = this.tp.forCurrentTenant();
    const type = await db.benefitType.findUnique({
      where: { code: input.benefitTypeCode },
    });
    if (!type?.active) throw new BadRequestException('Benefit type inactive');
    const saved = await db.benefitEnrolment.create({
      data: {
        staffId: input.staffId,
        benefitTypeCode: input.benefitTypeCode,
        monthlyAmount: input.monthlyAmount,
        params: input.params as any,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'benefit_enrolment', entityId: saved.id, after: saved,
    });
    return saved;
  }

  async listEnrolments(access: Access, staffId?: string): Promise<BenefitView[]> {
    const db = this.tp.forCurrentTenant();
    const where: any = {};
    if (staffId) where.staffId = staffId;
    if (access.scopeUnits) {
      const staff = await db.staff.findMany({
        where: {
          appointments: {
            some: { ...currentWhere(), post: { orgUnitId: { in: access.scopeUnits } } },
          },
        },
        select: { id: true },
      });
      where.staffId = { ...(where.staffId ? { equals: where.staffId } : {}),
                        in: staff.map((s) => s.id) };
    }
    const rows = await db.benefitEnrolment.findMany({
      where, include: { benefitType: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const sMap = new Map(
      (await db.staff.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.staffId))] } },
        select: { id: true, staffNo: true, nameEn: true },
      })).map((s) => [s.id, s]),
    );
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffNo: sMap.get(r.staffId)?.staffNo,
      staffName: sMap.get(r.staffId)?.nameEn,
      benefitTypeCode: r.benefitTypeCode,
      benefitTypeName: r.benefitType.nameEn,
      category: r.benefitType.category as any,
      chargeable: r.benefitType.chargeable,
      monthlyAmount: Number(r.monthlyAmount ?? r.benefitType.monthlyAmount),
      effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: r.effectiveTo?.toISOString().slice(0, 10),
    }));
  }

  async terminate(id: string, effectiveTo: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const r = await db.benefitEnrolment.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const saved = await db.benefitEnrolment.update({
      where: { id }, data: { effectiveTo: new Date(effectiveTo) },
    });
    await this.audit.record({
      userId, action: 'update', entity: 'benefit_enrolment', entityId: id,
      before: { effectiveTo: r.effectiveTo }, after: { effectiveTo: saved.effectiveTo },
    });
    return saved;
  }

  /**
   * Generate invoices for chargeable benefits effective in the period
   * (UR-HBM-003). All-or-replace per (staff, period). Returns counts.
   */
  async generateInvoices(period: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const [y, m] = period.split('-').map(Number);
    const periodStart = new Date(Date.UTC(y, m - 1, 1));
    const due = new Date(Date.UTC(y, m, 14)); // mid-following-month
    const enrolments = await db.benefitEnrolment.findMany({
      where: {
        ...currentWhere(periodStart),
        benefitType: { chargeable: true, active: true },
      },
      include: { benefitType: true },
    });

    // Group by staff.
    const byStaff = new Map<string, typeof enrolments>();
    for (const e of enrolments) {
      const arr = byStaff.get(e.staffId) ?? [];
      arr.push(e);
      byStaff.set(e.staffId, arr);
    }

    let created = 0;
    for (const [staffId, ens] of byStaff) {
      const lines: InvoiceLine[] = ens.map((e) => ({
        benefitTypeCode: e.benefitTypeCode,
        benefitTypeName: e.benefitType.nameEn,
        amount: Number(e.monthlyAmount ?? e.benefitType.monthlyAmount),
      }));
      const total = lines.reduce((a, l) => a + l.amount, 0);
      await db.benefitInvoice.upsert({
        where: { staffId_period: { staffId, period } },
        create: {
          staffId, period, total, lines: lines as any,
          status: 'open', dueDate: due,
        },
        update: { total, lines: lines as any, status: 'open', dueDate: due },
      });
      created++;
    }
    await this.audit.record({
      userId, action: 'create', entity: 'benefit_invoice', entityId: period,
      after: { period, invoices: created },
    });
    return { period, invoices: created };
  }

  async listInvoices(access: Access, period?: string, status?: string): Promise<InvoiceView[]> {
    const db = this.tp.forCurrentTenant();
    const where: any = {};
    if (period) where.period = period;
    if (status) where.status = status;
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
    const rows = await db.benefitInvoice.findMany({
      where, orderBy: { period: 'desc' },
    });
    const sMap = new Map(
      (await db.staff.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.staffId))] } },
        select: { id: true, staffNo: true, nameEn: true },
      })).map((s) => [s.id, s]),
    );
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffNo: sMap.get(r.staffId)?.staffNo,
      staffName: sMap.get(r.staffId)?.nameEn,
      period: r.period,
      total: Number(r.total),
      status: r.status as any,
      dueDate: r.dueDate.toISOString().slice(0, 10),
      lines: r.lines as any,
    }));
  }

  async markPaid(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    await this.audit.record({
      userId, action: 'update', entity: 'benefit_invoice', entityId: id,
      before: { status: 'open' }, after: { status: 'paid' },
    });
    return db.benefitInvoice.update({ where: { id }, data: { status: 'paid' } });
  }

  /** Monthly statistics + cessation report (UR-HBM-007/008). */
  async stats(period: string): Promise<BenefitStats> {
    const db = this.tp.forCurrentTenant();
    const [y, m] = period.split('-').map(Number);
    const periodStart = new Date(Date.UTC(y, m - 1, 1));
    const periodEnd = new Date(Date.UTC(y, m, 0));

    const enrolments = await db.benefitEnrolment.findMany({
      where: { ...currentWhere(periodStart) },
      include: { benefitType: true },
    });
    const invoices = await db.benefitInvoice.findMany({ where: { period } });
    const totalsByCat = new Map<string, number>();
    for (const i of invoices) {
      for (const l of i.lines as any[]) {
        // Re-derive category from current type lookup (cheap; few categories).
        const t = enrolments.find((e) => e.benefitTypeCode === l.benefitTypeCode)
          ?.benefitType.category;
        if (!t) continue;
        totalsByCat.set(t, (totalsByCat.get(t) ?? 0) + Number(l.amount));
      }
    }
    const countsByCat = new Map<string, number>();
    for (const e of enrolments) {
      countsByCat.set(
        e.benefitType.category,
        (countsByCat.get(e.benefitType.category) ?? 0) + 1,
      );
    }
    const byCategory = [...new Set([...countsByCat.keys(), ...totalsByCat.keys()])].map(
      (c) => ({
        category: c,
        enrolments: countsByCat.get(c) ?? 0,
        invoicedTotal: totalsByCat.get(c) ?? 0,
      }),
    );

    // Cessations: enrolments that ended within the period (e.g. furniture allowance).
    const cessations = await db.benefitEnrolment.findMany({
      where: { effectiveTo: { gte: periodStart, lte: periodEnd } },
    });
    const staff = await db.staff.findMany({
      where: { id: { in: cessations.map((c) => c.staffId) } },
      select: { id: true, staffNo: true },
    });
    const sMap = new Map(staff.map((s) => [s.id, s.staffNo]));
    return {
      period,
      byCategory,
      cessationsThisMonth: cessations.map((c) => ({
        staffId: c.staffId,
        staffNo: sMap.get(c.staffId) ?? '',
        benefitTypeCode: c.benefitTypeCode,
        endedOn: c.effectiveTo!.toISOString().slice(0, 10),
      })),
    };
  }
}
