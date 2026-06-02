import { Injectable, NotFoundException } from '@nestjs/common';
import { MyProfile, TeamMember } from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { currentWhere } from '../../common/effective-dating/effective';
import { LveService } from '../lve/lve.service';

interface Access {
  permissions: Set<string>;
  scopeUnits: string[] | null;
}

@Injectable()
export class EssService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly lve: LveService,
  ) {}

  /** The signed-in employee's own record — sensitive IDs always masked. */
  async myProfile(userId: string): Promise<MyProfile> {
    const db = this.tp.forCurrentTenant();
    const staff = await db.staff.findFirst({
      where: { userId },
      include: {
        appointments: {
          orderBy: { effectiveFrom: 'desc' },
          include: { post: { include: { orgUnit: true } } },
        },
      },
    });
    if (!staff) throw new NotFoundException('No staff record linked to this user');

    const current = staff.appointments.find(
      (a) => !a.effectiveTo || a.effectiveTo >= new Date(),
    );
    const leave = await this.lve
      .balances(userId)
      .catch(() => []); // leave module may be disabled for the tenant

    return {
      staffId: staff.id,
      staffNo: staff.staffNo,
      nameEn: staff.nameEn,
      nameZh: staff.nameZh ?? undefined,
      sex: staff.sex,
      dob: staff.dob.toISOString().slice(0, 10),
      idType: staff.idType,
      idNoMasked: '••••',
      currentRank: current?.rankCode,
      currentUnit: current?.post?.orgUnit?.nameEn,
      appointments: staff.appointments.map((a) => ({
        rankCode: a.rankCode,
        basis: a.basis,
        postTitle: a.post?.title,
        orgUnitName: a.post?.orgUnit?.nameEn,
        effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: a.effectiveTo?.toISOString().slice(0, 10),
      })),
      leaveSummary: leave.map((b) => ({
        leaveTypeCode: b.leaveTypeCode,
        remaining: b.remaining,
      })),
    };
  }

  /** Manager view: direct + matrix reports within RBAC data scope. */
  async myTeam(access: Access): Promise<TeamMember[]> {
    const db = this.tp.forCurrentTenant();
    if (!access.scopeUnits || access.scopeUnits.length === 0) {
      // Unrestricted scope would be the whole org — keep team view focused.
      return [];
    }
    const staff = await db.staff.findMany({
      where: {
        status: 'active',
        appointments: {
          some: {
            ...currentWhere(),
            post: { orgUnitId: { in: access.scopeUnits } },
          },
        },
      },
      include: {
        appointments: {
          where: currentWhere(),
          take: 1,
          include: { post: { include: { orgUnit: true } } },
        },
      },
    });

    const today = new Date();
    const out: TeamMember[] = [];
    for (const s of staff) {
      const onLeave = await db.leaveRequest.count({
        where: {
          staffId: s.id,
          status: 'approved',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });
      const pending = await db.leaveRequest.count({
        where: { staffId: s.id, status: 'pending' },
      });
      out.push({
        staffId: s.id,
        staffNo: s.staffNo,
        nameEn: s.nameEn,
        rankCode: s.appointments[0]?.rankCode,
        orgUnitName: s.appointments[0]?.post?.orgUnit?.nameEn,
        onLeaveToday: onLeave > 0,
        pendingLeaveRequests: pending,
      });
    }
    return out;
  }
}
