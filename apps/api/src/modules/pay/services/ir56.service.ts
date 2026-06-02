import { Injectable } from '@nestjs/common';
import type { Ir56FilingView, Ir56Generate } from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';
import { YtdService } from '../engines/ytd.service';

/**
 * Hong Kong IR56 series — employer's tax return forms.
 *   IR56B  annual return of remuneration & pensions (everyone)
 *   IR56E  notification of new employee
 *   IR56F  notification of departing employee (general)
 *   IR56G  notification of employee about to leave Hong Kong
 *
 * Output is structured JSON; a downstream service can pipe this into
 * the IRD's iXBRL or the IR56 paper template.
 */
@Injectable()
export class Ir56Service {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly ytd: YtdService,
  ) {}

  async generate(input: Ir56Generate, userId: string): Promise<Ir56FilingView> {
    const db = this.tp.forCurrentTenant();
    let payload: any = {};

    if (input.formType === 'IR56B') {
      const staffIds = input.staffId
        ? [input.staffId]
        : (await db.staff.findMany({ select: { id: true } })).map((s) => s.id);
      const records = [];
      for (const sid of staffIds) {
        const ytd = await this.ytd.snapshot(sid, input.taxYear);
        const staff = await db.staff.findUnique({ where: { id: sid } });
        const profile = await db.staffPayProfile.findUnique({ where: { staffId: sid } });
        if (!staff) continue;
        records.push({
          staffNo: staff.staffNo,
          nameEn: staff.nameEn,
          nameZh: staff.nameZh,
          hkid: '****', // restricted; pulled via /restricted endpoint if needed
          taxFileNo: profile?.taxFileNo ?? null,
          taxableIncome: ytd.TAXABLE ?? 0,
          mpfEmployee: ytd.MPF_EE ?? 0,
          mpfEmployer: ytd.MPF_ER ?? 0,
          taxWithheld: ytd.TAX ?? 0,
        });
      }
      payload = { taxYear: input.taxYear, records };
    } else if (input.formType === 'IR56F' || input.formType === 'IR56G') {
      const term = await db.terminationSettlement.findFirst({
        where: { staffId: input.staffId ?? undefined },
        orderBy: { exitDate: 'desc' },
      });
      payload = { taxYear: input.taxYear, termination: term };
    } else if (input.formType === 'IR56E') {
      const staff = input.staffId
        ? await db.staff.findUnique({ where: { id: input.staffId } })
        : null;
      payload = { taxYear: input.taxYear, staff };
    }

    const saved = await db.iR56Filing.create({
      data: {
        formType: input.formType,
        taxYear: input.taxYear,
        staffId: input.staffId,
        payload,
      },
    });
    void userId;
    return {
      id: saved.id,
      formType: saved.formType as any,
      taxYear: saved.taxYear,
      staffId: saved.staffId,
      status: saved.status as any,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  list(taxYear?: number) {
    return this.tp.forCurrentTenant().iR56Filing.findMany({
      where: taxYear ? { taxYear } : {},
      orderBy: { createdAt: 'desc' },
    });
  }
}
