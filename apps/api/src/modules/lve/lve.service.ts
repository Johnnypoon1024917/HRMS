import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApproveLeave,
  LeaveBalance,
  LeaveRequestInput,
  LeaveRequestView,
  LeaveTypeUpsert,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere } from '../../common/effective-dating/effective';
import { workingDays } from './working-days';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class LveService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- leave types (admin) ----
  listTypes() {
    return this.tp.forCurrentTenant().leaveType.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async upsertType(input: LeaveTypeUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.leaveType.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'leave_type',
      entityId: saved.code,
      after: saved,
    });
    return saved;
  }

  // ---- helpers ----
  private async staffForUser(userId: string) {
    const staff = await this.tp
      .forCurrentTenant()
      .staff.findFirst({ where: { userId } });
    if (!staff) {
      throw new NotFoundException('No staff record linked to this user');
    }
    return staff;
  }

  // ---- balances (UR-style enquiry) ----
  async balances(userId: string): Promise<LeaveBalance[]> {
    const db = this.tp.forCurrentTenant();
    const staff = await this.staffForUser(userId);
    const year = new Date().getUTCFullYear();
    const types = await db.leaveType.findMany({ where: { active: true } });

    const result: LeaveBalance[] = [];
    for (const t of types) {
      const reqs = await db.leaveRequest.findMany({
        where: {
          staffId: staff.id,
          leaveTypeCode: t.code,
          startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
          status: { in: ['approved', 'pending'] },
        },
      });
      const taken = reqs
        .filter((r) => r.status === 'approved')
        .reduce((a, r) => a + r.days, 0);
      const pending = reqs
        .filter((r) => r.status === 'pending')
        .reduce((a, r) => a + r.days, 0);
      const ledger = await db.leaveLedger.aggregate({
        where: { staffId: staff.id, leaveTypeCode: t.code, year },
        _sum: { delta: true },
      });
      const quota = t.annualQuota + (ledger._sum.delta ?? 0);
      result.push({
        leaveTypeCode: t.code,
        leaveTypeName: t.nameEn,
        quota,
        taken,
        pending,
        remaining: quota - taken - pending,
      });
    }
    return result;
  }

  // ---- request own leave ----
  async request(input: LeaveRequestInput, userId: string) {
    const db = this.tp.forCurrentTenant();
    const staff = await this.staffForUser(userId);
    const type = await db.leaveType.findUnique({
      where: { code: input.leaveTypeCode },
    });
    if (!type || !type.active) throw new BadRequestException('Invalid leave type');
    if (type.requiresReason && !input.reason) {
      throw new BadRequestException(`${type.nameEn} requires a reason`);
    }
    const days = workingDays(
      new Date(input.startDate),
      new Date(input.endDate),
      input.halfDay,
    );
    if (days <= 0) throw new BadRequestException('Range contains no working days');

    // Quota check for capped, paid types.
    if (type.annualQuota > 0) {
      const bal = (await this.balances(userId)).find(
        (b) => b.leaveTypeCode === type.code,
      );
      if (bal && days > bal.remaining) {
        throw new BadRequestException(
          `Insufficient balance: requested ${days}, remaining ${bal.remaining}`,
        );
      }
    }

    const saved = await db.leaveRequest.create({
      data: {
        staffId: staff.id,
        leaveTypeCode: type.code,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        days,
        reason: input.reason,
        status: 'pending',
      },
    });
    await this.audit.record({
      userId,
      action: 'create',
      entity: 'leave_request',
      entityId: saved.id,
      after: saved,
    });
    return saved;
  }

  async myRequests(userId: string): Promise<LeaveRequestView[]> {
    const staff = await this.staffForUser(userId);
    const rows = await this.tp.forCurrentTenant().leaveRequest.findMany({
      where: { staffId: staff.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.view(r, staff.staffNo));
  }

  async cancel(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const staff = await this.staffForUser(userId);
    const req = await db.leaveRequest.findUnique({ where: { id } });
    if (!req || req.staffId !== staff.id) throw new NotFoundException();
    if (req.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    return db.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  // ---- approvals (manager, data-scope limited) ----
  async pendingForApprover(access: Access): Promise<LeaveRequestView[]> {
    const db = this.tp.forCurrentTenant();
    const where: any = { status: 'pending' };
    if (access.scopeUnits) {
      const staff = await db.staff.findMany({
        where: {
          appointments: {
            some: { ...currentWhere(), post: { orgUnitId: { in: access.scopeUnits } } },
          },
        },
        select: { id: true, staffNo: true },
      });
      where.staffId = { in: staff.map((s) => s.id) };
      const noMap = new Map(staff.map((s) => [s.id, s.staffNo]));
      const rows = await db.leaveRequest.findMany({ where, orderBy: { createdAt: 'asc' } });
      return rows.map((r) => this.view(r, noMap.get(r.staffId)));
    }
    const rows = await db.leaveRequest.findMany({ where, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.view(r));
  }

  async decide(id: string, input: ApproveLeave, userId: string) {
    const db = this.tp.forCurrentTenant();
    const req = await db.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is no longer pending');
    }
    const staff = await db.staff.findUnique({ where: { id: req.staffId } });
    if (staff?.userId === userId) {
      throw new ForbiddenException('You cannot approve your own leave');
    }
    const updated = await db.leaveRequest.update({
      where: { id },
      data: {
        status: input.decision,
        decidedBy: userId,
        decidedNote: input.note,
        decidedAt: new Date(),
      },
    });
    await this.audit.record({
      userId,
      action: 'update',
      entity: 'leave_request',
      entityId: id,
      before: { status: 'pending' },
      after: { status: input.decision },
    });
    return updated;
  }

  private view(r: any, staffNo?: string): LeaveRequestView {
    return {
      id: r.id,
      staffId: r.staffId,
      staffNo,
      leaveTypeCode: r.leaveTypeCode,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      days: r.days,
      status: r.status,
      reason: r.reason ?? undefined,
      decidedBy: r.decidedBy ?? undefined,
      decidedNote: r.decidedNote ?? undefined,
    };
  }
}
