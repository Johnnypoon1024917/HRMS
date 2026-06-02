import { Injectable } from '@nestjs/common';
import type { PayComponentUpsert } from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * Thin facade for the pay-component CRUD endpoints. The heavy lifting
 * (runs, MPF, tax, GL, bank files, IR56, termination) lives in dedicated
 * services under ./services and engines under ./engines.
 */
@Injectable()
export class PayService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  listComponents() {
    return this.tp
      .forCurrentTenant()
      .payComponent.findMany({ orderBy: { sequence: 'asc' } });
  }

  async upsertComponent(input: PayComponentUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.payComponent.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'pay_component',
      entityId: saved.code,
      after: saved,
    });
    return saved;
  }

  listConstants() {
    return this.tp.forCurrentTenant().payrollConstant.findMany();
  }

  async upsertConstant(
    key: string,
    value: number,
    unit: string | undefined,
    note: string | undefined,
    userId: string,
  ) {
    const saved = await this.tp.forCurrentTenant().payrollConstant.upsert({
      where: { key },
      create: { key, value, unit, note },
      update: { value, unit, note },
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'payroll_constant',
      entityId: key,
      after: saved,
    });
    return saved;
  }

  listProfiles() {
    return this.tp.forCurrentTenant().staffPayProfile.findMany({
      include: { bankAccount: true },
    });
  }

  async upsertProfile(input: any, userId: string) {
    const db = this.tp.forCurrentTenant();
    const { bank, ...rest } = input;
    const saved = await db.staffPayProfile.upsert({
      where: { staffId: input.staffId },
      create: rest,
      update: rest,
    });
    if (bank) {
      await db.bankAccount.upsert({
        where: { staffId: input.staffId },
        create: {
          staffId: input.staffId,
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          accountNoEnc: bank.accountNo, // crypto wrap is done by the encryption module
          holderName: bank.holderName,
          currency: bank.currency,
        },
        update: {
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          accountNoEnc: bank.accountNo,
          holderName: bank.holderName,
          currency: bank.currency,
        },
      });
    }
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'staff_pay_profile',
      entityId: input.staffId,
      after: { groupCode: input.groupCode, mpfClass: input.mpfClass },
    });
    return saved;
  }
}
