import { Injectable } from '@nestjs/common';
import { OrgChartNode, PostRequestInput } from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { currentWhere } from '../../common/effective-dating/effective';

@Injectable()
export class EsmService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Submit a post create/update/delete request (UR-ESM-001). */
  async submitRequest(input: PostRequestInput, userId: string) {
    const db = this.tp.forCurrentTenant();
    const req = await db.postRequest.create({
      data: {
        action: input.action,
        postId: input.postId,
        payload: input.payload as any,
        effectiveDate: new Date(input.effectiveDate),
        status: 'pending',
      },
    });
    await this.audit.record({
      userId,
      action: 'create',
      entity: 'post_request',
      entityId: req.id,
      after: req,
    });
    return req;
  }

  listPosts(orgUnitId?: string) {
    return this.tp.forCurrentTenant().post.findMany({
      where: orgUnitId ? { orgUnitId } : {},
      include: { orgUnit: true },
      orderBy: { title: 'asc' },
    });
  }

  /** Latest Establishment & Strength figures per org unit / rank. */
  async strength() {
    const db = this.tp.forCurrentTenant();
    const latest = await db.esSnapshot.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });
    if (!latest) return [];
    const units = await db.orgUnit.findMany();
    const nameMap = new Map(units.map((u) => [u.id, u.nameEn]));
    const rows = await db.esSnapshot.findMany({
      where: { snapshotDate: latest.snapshotDate },
      orderBy: [{ orgUnitId: 'asc' }, { rankCode: 'asc' }],
    });
    return rows.map((r) => ({
      orgUnitId: r.orgUnitId,
      orgUnitName: nameMap.get(r.orgUnitId) ?? r.orgUnitId,
      rankCode: r.rankCode,
      establishment: r.establishment,
      strength: r.strength,
      vacancies: r.establishment - r.strength,
      snapshotDate: r.snapshotDate.toISOString().slice(0, 10),
    }));
  }

  listRequests(status?: string) {
    return this.tp.forCurrentTenant().postRequest.findMany({
      where: status ? { status } : {},
      orderBy: { effectiveDate: 'asc' },
    });
  }

  /**
   * Daily batch (UR-ESM-001): apply due post requests, then snapshot E&S.
   * Delete requests are honoured only if the post is a vacancy; otherwise a
   * Bring-Up is raised for an authorised user to action.
   */
  async runDailyBatch(today = new Date()) {
    const db = this.tp.forCurrentTenant();
    const due = await db.postRequest.findMany({
      where: { status: 'pending', effectiveDate: { lte: today } },
    });

    for (const r of due) {
      if (r.action === 'create') {
        await db.post.create({
          data: {
            ...(r.payload as any),
            status: 'vacant',
            effectiveFrom: r.effectiveDate,
          },
        });
      } else if (r.action === 'update' && r.postId) {
        await db.post.update({
          where: { id: r.postId },
          data: { ...(r.payload as any) },
        });
      } else if (r.action === 'delete' && r.postId) {
        const post = await db.post.findUnique({ where: { id: r.postId } });
        if (post && post.status === 'vacant') {
          await db.post.update({
            where: { id: r.postId },
            data: { effectiveTo: r.effectiveDate, status: 'frozen' },
          });
        } else {
          await db.bringUp.create({
            data: {
              dueAt: today,
              type: 'post_delete_blocked',
              refEntity: 'post',
              refId: r.postId,
              scope: 'esm.write',
            },
          });
          continue; // leave request pending for follow-up
        }
      }
      await db.postRequest.update({
        where: { id: r.id },
        data: { status: 'applied', processedAt: today },
      });
    }

    await this.snapshotEs(today);
    return { processed: due.length };
  }

  /** Daily Establishment & Strength snapshot for historical enquiry. */
  async snapshotEs(date = new Date()) {
    const db = this.tp.forCurrentTenant();
    // Single query for every current post, aggregated in memory. The previous
    // implementation issued 1 + units + (units x ranks) sequential queries
    // (10k+ for a large establishment), making the daily batch time out.
    const posts = await db.post.findMany({ where: { ...currentWhere(date) } });

    const agg = new Map<
      string,
      { orgUnitId: string; rankCode: string; est: number; str: number }
    >();
    for (const p of posts) {
      const key = `${p.orgUnitId} ${p.rankCode}`;
      const acc =
        agg.get(key) ?? { orgUnitId: p.orgUnitId, rankCode: p.rankCode, est: 0, str: 0 };
      acc.est += 1;
      if (p.status === 'filled') acc.str += 1;
      agg.set(key, acc);
    }
    const data = [...agg.values()].map((v) => ({
      snapshotDate: date,
      orgUnitId: v.orgUnitId,
      rankCode: v.rankCode,
      establishment: v.est,
      strength: v.str,
    }));

    // Replace the day's snapshot atomically: delete + bulk insert (Prisma has
    // no bulk upsert). Idempotent, so re-running for the same date is safe.
    await db.$transaction([
      db.esSnapshot.deleteMany({ where: { snapshotDate: date } }),
      db.esSnapshot.createMany({ data }),
    ]);
  }

  /** Org chart tree with E&S figures (UR-ESM-003 / UR-ORM-001). */
  async orgChart(rootId?: string): Promise<OrgChartNode[]> {
    const db = this.tp.forCurrentTenant();
    const units = await db.orgUnit.findMany({ include: { posts: true } });
    // Posts directly attached to a single unit node.
    const ownFigure = (uid: string) => {
      const posts = units.find((u) => u.id === uid)?.posts ?? [];
      return {
        establishment: posts.length,
        strength: posts.filter((p) => p.status === 'filled').length,
      };
    };
    // Each node's figures roll up its own posts PLUS every descendant's, so a
    // parent (e.g. Headquarters) shows the total establishment/strength of the
    // whole subtree, not just posts pinned directly to that node.
    const build = (parentId: string | null): OrgChartNode[] =>
      units
        .filter((u) => u.parentId === parentId)
        .map((u) => {
          const children = build(u.id);
          const self = ownFigure(u.id);
          return {
            id: u.id,
            code: u.code,
            name: u.nameEn,
            type: u.type as any,
            establishment:
              self.establishment +
              children.reduce((s, c) => s + c.establishment, 0),
            strength:
              self.strength + children.reduce((s, c) => s + c.strength, 0),
            children,
          };
        });
    return build(rootId ?? null);
  }
}
