import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ImportResult,
  Paged,
  StaffListItem,
  StaffSearch,
  StaffUpsert,
} from '@hrms/contracts';
import * as ExcelJS from 'exceljs';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { asOfDate, currentWhere } from '../../common/effective-dating/effective';
import { encrypt } from '../../common/crypto/crypto';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class PimService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Multi-criteria AND search with data-scope + classification masking. */
  async search(q: StaffSearch, access: Access): Promise<Paged<StaffListItem>> {
    const db = this.tp.forCurrentTenant();
    const asOf = asOfDate(q.asOf);

    const where: any = { AND: [] };
    if (q.staffNo) where.AND.push({ staffNo: { contains: q.staffNo, mode: 'insensitive' } });
    if (q.name)
      where.AND.push({
        OR: [
          { nameEn: { contains: q.name, mode: 'insensitive' } },
          { nameZh: { contains: q.name } },
        ],
      });
    if (q.sex) where.AND.push({ sex: q.sex });
    if (q.status) where.AND.push({ status: q.status });

    // Data scope (UR-GEN-004): restrict to caller's org-unit subtree via the
    // staff member's current appointment/post.
    if (access.scopeUnits) {
      where.AND.push({
        appointments: {
          some: { ...currentWhere(asOf), post: { orgUnitId: { in: access.scopeUnits } } },
        },
      });
    }
    if (q.orgUnitId) {
      where.AND.push({
        appointments: { some: { ...currentWhere(asOf), post: { orgUnitId: q.orgUnitId } } },
      });
    }

    const [rows, total] = await Promise.all([
      db.staff.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { staffNo: 'asc' },
        include: {
          appointments: {
            where: currentWhere(asOf),
            take: 1,
            include: { post: { include: { orgUnit: true } } },
          },
        },
      }),
      db.staff.count({ where }),
    ]);

    const canRestricted = access.permissions.has('pim.read.restricted');
    const items: StaffListItem[] = rows.map((s) => ({
      id: s.id,
      staffNo: s.staffNo,
      nameEn: s.nameEn,
      nameZh: s.nameZh ?? undefined,
      rankCode: s.appointments[0]?.rankCode,
      orgUnitName: s.appointments[0]?.post?.orgUnit?.nameEn,
      // Mask restricted records unless permitted (UR-GEN-004 / data class.).
      status:
        s.classification === 'restricted' && !canRestricted ? 'active' : (s.status as any),
    }));
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(id: string, access: Access) {
    const db = this.tp.forCurrentTenant();
    const staff = await db.staff.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { effectiveFrom: 'desc' } },
        appointments: { orderBy: { effectiveFrom: 'desc' } },
        salaries: { orderBy: { effectiveFrom: 'desc' } },
        qualifications: true,
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    if (staff.classification === 'restricted' && !access.permissions.has('pim.read.restricted')) {
      // Return the minimal non-restricted projection.
      return { id: staff.id, staffNo: staff.staffNo, nameEn: staff.nameEn, restricted: true };
    }
    const { idNoEnc, ...rest } = staff;
    return { ...rest, idNoMasked: '••••' };
  }

  async upsert(input: StaffUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const before = await db.staff.findUnique({ where: { staffNo: input.staffNo } });
    const data = {
      staffNo: input.staffNo,
      nameEn: input.nameEn,
      nameZh: input.nameZh,
      sex: input.sex,
      dob: new Date(input.dob),
      idType: input.idType,
      idNoEnc: encrypt(input.idNo),
      classification: input.classification,
      status: input.status,
    };
    const saved = await db.staff.upsert({
      where: { staffNo: input.staffNo },
      create: data,
      update: data,
    });
    await this.audit.record({
      userId,
      action: before ? 'update' : 'create',
      entity: 'staff',
      entityId: saved.id,
      before,
      after: { ...saved, idNoEnc: undefined },
    });
    return { id: saved.id, staffNo: saved.staffNo };
  }

  /**
   * Batch upload (UR-PIM-002). Validates every row; only commits if ALL rows
   * pass, otherwise returns an Excel exception report keyed by row + reason.
   */
  async importExcel(buffer: Buffer, userId: string): Promise<ImportResult> {
    const db = this.tp.forCurrentTenant();
    const wb = new ExcelJS.Workbook();
    // ExcelJS's .load type predates Node 22's parameterised Buffer<ArrayBuffer>;
    // runtime is identical, so cast through `any` to bypass the type widening.
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const rows: { row: number; data?: StaffUpsert; error?: string }[] = [];
    ws.eachRow((r, i) => {
      if (i === 1) return; // header
      try {
        const data = {
          staffNo: String(r.getCell(1).value ?? '').trim(),
          nameEn: String(r.getCell(2).value ?? '').trim(),
          nameZh: String(r.getCell(3).value ?? '').trim() || undefined,
          sex: String(r.getCell(4).value ?? '').trim(),
          dob: String(r.getCell(5).value ?? '').trim(),
          idType: String(r.getCell(6).value ?? '').trim(),
          idNo: String(r.getCell(7).value ?? '').trim(),
          classification: 'internal',
          status: 'active',
        } as StaffUpsert;
        if (!data.staffNo || !data.nameEn) throw new Error('staffNo and nameEn are required');
        rows.push({ row: i, data });
      } catch (e: any) {
        rows.push({ row: i, error: e.message });
      }
    });

    const errors = rows.filter((r) => r.error);
    const batch = await db.staffImportBatch.create({
      data: {
        fileKey: `import-${Date.now()}.xlsx`,
        status: errors.length ? 'failed' : 'done',
        totalRows: rows.length,
        okRows: errors.length ? 0 : rows.length,
        errorRows: errors.length,
      },
    });

    if (errors.length) {
      // Build the exception report (failed column + reason in "Remarks").
      const out = new ExcelJS.Workbook();
      const sheet = out.addWorksheet('Exceptions');
      sheet.addRow(['Row', 'Remarks']);
      errors.forEach((e) => sheet.addRow([e.row, e.error]));
      const buf = await out.xlsx.writeBuffer();
      const key = `exception-${batch.id}.xlsx`;
      // In production this is stored in object storage; key returned for download.
      (globalThis as any).__lastExceptionReport = Buffer.from(buf as any);
      await db.staffImportBatch.update({
        where: { id: batch.id },
        data: { exceptionFileKey: key },
      });
      return {
        batchId: batch.id,
        totalRows: rows.length,
        okRows: 0,
        errorRows: errors.length,
        exceptionFileKey: key,
      };
    }

    for (const r of rows) await this.upsert(r.data!, userId);
    return {
      batchId: batch.id,
      totalRows: rows.length,
      okRows: rows.length,
      errorRows: 0,
    };
  }
}
