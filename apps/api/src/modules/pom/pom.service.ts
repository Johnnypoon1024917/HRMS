import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActingRecord,
  CareerEntry,
  PostingActionInput,
  TransferMatch,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere, supersede } from '../../common/effective-dating/effective';

@Injectable()
export class PomService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Record a pending posting action (applied by date via the batch). */
  async createAction(input: PostingActionInput, userId: string) {
    const db = this.tp.forCurrentTenant();
    const staff = await db.staff.findUnique({ where: { id: input.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
    if (input.toPostId) {
      const post = await db.post.findUnique({ where: { id: input.toPostId } });
      if (!post) throw new BadRequestException('Target post not found');
    }
    const current = await db.staffAppointment.findFirst({
      where: { staffId: input.staffId, ...currentWhere() },
      orderBy: { effectiveFrom: 'desc' },
    });
    const action = await db.postingAction.create({
      data: {
        staffId: input.staffId,
        type: input.type,
        fromPostId: current?.postId ?? null,
        toPostId: input.toPostId ?? null,
        rankCode: input.rankCode ?? null,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        reason: input.reason,
        createdBy: userId,
      },
    });
    await this.audit.record({
      userId,
      action: 'create',
      entity: 'posting_action',
      entityId: action.id,
      after: action,
    });
    return action;
  }

  listActions(status?: string) {
    return this.tp.forCurrentTenant().postingAction.findMany({
      where: status ? { status } : {},
      orderBy: { effectiveFrom: 'asc' },
    });
  }

  async cancelAction(id: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const a = await db.postingAction.findUnique({ where: { id } });
    if (!a || a.status !== 'pending') {
      throw new BadRequestException('Only pending actions can be cancelled');
    }
    await this.audit.record({
      userId, action: 'update', entity: 'posting_action', entityId: id,
      before: { status: 'pending' }, after: { status: 'cancelled' },
    });
    return db.postingAction.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  /**
   * Daily batch (UR-POM): apply due pending actions by superseding the
   * effective-dated StaffAppointment, preserving full career history.
   */
  async runBatch(today = new Date()) {
    const db = this.tp.forCurrentTenant();
    const due = await db.postingAction.findMany({
      where: { status: 'pending', effectiveFrom: { lte: today } },
      orderBy: { effectiveFrom: 'asc' },
    });

    for (const a of due) {
      // Each action performs 2–4 writes (close prior appointment, open new one,
      // flip post statuses, mark the action applied). Wrap them in a single
      // interactive transaction so a mid-action failure rolls back fully rather
      // than leaving a half-applied posting (e.g. new appointment created but
      // the source post never freed).
      await db.$transaction(async (tx) => {
        const open = await tx.staffAppointment.findFirst({
          where: { staffId: a.staffId, ...currentWhere(a.effectiveFrom) },
          orderBy: { effectiveFrom: 'desc' },
        });
        const { closePrevious, newFrom } = supersede(a.effectiveFrom);

        if (a.type === 'transfer' || a.type === 'promotion') {
          if (open) {
            await tx.staffAppointment.update({
              where: { id: open.id },
              data: closePrevious,
            });
          }
          await tx.staffAppointment.create({
            data: {
              staffId: a.staffId,
              postId: a.toPostId ?? open?.postId ?? null,
              rankCode: a.rankCode ?? open?.rankCode ?? 'UNK',
              basis: 'substantive',
              effectiveFrom: newFrom,
            },
          });
          if (a.toPostId) {
            await tx.post.update({
              where: { id: a.toPostId },
              data: { status: 'filled' },
            });
          }
          if (a.fromPostId && a.type === 'transfer') {
            await tx.post.update({
              where: { id: a.fromPostId },
              data: { status: 'vacant' },
            });
          }
        } else if (a.type === 'acting') {
          // Acting runs alongside the substantive appointment, time-boxed.
          await tx.staffAppointment.create({
            data: {
              staffId: a.staffId,
              postId: a.toPostId ?? null,
              rankCode: a.rankCode ?? open?.rankCode ?? 'UNK',
              basis: 'acting',
              effectiveFrom: a.effectiveFrom,
              effectiveTo: a.effectiveTo,
            },
          });
        } else if (a.type === 'reversion') {
          // End the SPECIFIC open acting appointment being reverted. A staff
          // member may act in several roles at once, so match on the action's
          // target post (or rank) instead of grabbing an arbitrary `findFirst`;
          // order deterministically as a final tiebreaker.
          const where: any = {
            staffId: a.staffId,
            basis: 'acting',
            effectiveTo: null,
          };
          const revertPostId = a.toPostId ?? a.fromPostId;
          if (revertPostId) where.postId = revertPostId;
          if (a.rankCode) where.rankCode = a.rankCode;
          const acting = await tx.staffAppointment.findFirst({
            where,
            orderBy: { effectiveFrom: 'desc' },
          });
          if (acting) {
            await tx.staffAppointment.update({
              where: { id: acting.id },
              data: { effectiveTo: a.effectiveFrom },
            });
          }
        }

        await tx.postingAction.update({
          where: { id: a.id },
          data: { status: 'applied', processedAt: today },
        });
      });
    }
    return { processed: due.length };
  }

  /** Combined career history: appointments + posting actions (UR-POM-003). */
  async careerHistory(staffId: string): Promise<CareerEntry[]> {
    const db = this.tp.forCurrentTenant();
    const appts = await db.staffAppointment.findMany({
      where: { staffId },
      orderBy: { effectiveFrom: 'desc' },
      include: { post: { include: { orgUnit: true } } },
    });
    const actions = await db.postingAction.findMany({
      where: { staffId, status: 'applied' },
      orderBy: { effectiveFrom: 'desc' },
    });
    const entries: CareerEntry[] = [
      ...appts.map((a) => ({
        kind: 'appointment' as const,
        date: a.effectiveFrom.toISOString().slice(0, 10),
        rankCode: a.rankCode,
        postTitle: a.post?.title,
        orgUnitName: a.post?.orgUnit?.nameEn,
        detail: `${a.basis} appointment`,
        effectiveTo: a.effectiveTo?.toISOString().slice(0, 10),
      })),
      ...actions.map((a) => ({
        kind: 'action' as const,
        date: a.effectiveFrom.toISOString().slice(0, 10),
        rankCode: a.rankCode ?? '',
        detail: `${a.type}${a.reason ? ` — ${a.reason}` : ''}`,
        effectiveTo: a.effectiveTo?.toISOString().slice(0, 10),
      })),
    ];
    return entries.sort((x, y) => (x.date < y.date ? 1 : -1));
  }

  /** Staff currently acting (UR-POM-002). */
  async actingList(): Promise<ActingRecord[]> {
    const db = this.tp.forCurrentTenant();
    const now = new Date();
    const rows = await db.staffAppointment.findMany({
      where: { basis: 'acting', ...currentWhere(now) },
      include: {
        staff: true,
        post: true,
      },
    });
    return rows.map((r) => {
      const to = r.effectiveTo ?? now;
      const endingSoon =
        (to.getTime() - now.getTime()) / 86_400_000 <= 14;
      return {
        staffId: r.staffId,
        staffNo: r.staff.staffNo,
        nameEn: r.staff.nameEn,
        actingRank: r.rankCode,
        postTitle: r.post?.title,
        effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: (r.effectiveTo ?? now).toISOString().slice(0, 10),
        endingSoon,
      };
    });
  }

  /**
   * Auto-match vacant posts for a staff transfer (UR-POM-005). Heuristic
   * scoring; production would weight competencies, location, seniority.
   */
  async transferMatch(staffId: string): Promise<TransferMatch[]> {
    const db = this.tp.forCurrentTenant();
    const current = await db.staffAppointment.findFirst({
      where: { staffId, ...currentWhere() },
      include: { post: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!current) throw new NotFoundException('Staff has no current appointment');

    const vacancies = await db.post.findMany({
      where: { status: 'vacant', ...currentWhere() },
      include: { orgUnit: true },
    });

    return vacancies
      .map((p) => {
        const reasons: string[] = [];
        let score = 0;
        if (p.rankCode === current.rankCode) {
          score += 50;
          reasons.push('same rank');
        }
        if (p.orgUnitId === current.post?.orgUnitId) {
          score += 20;
          reasons.push('same unit');
        }
        score += 10; // base: it is a genuine vacancy
        reasons.push('vacant post');
        return {
          postId: p.id,
          postTitle: p.title,
          orgUnitName: p.orgUnit.nameEn,
          rankCode: p.rankCode,
          score,
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }
}
