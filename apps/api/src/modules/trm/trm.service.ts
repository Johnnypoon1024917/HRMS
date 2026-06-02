import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalendarEntry,
  CompletionInput,
  CourseUpsert,
  MyTrainingEntry,
  SessionUpsert,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class TrmService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- courses ----
  listCourses() {
    return this.tp.forCurrentTenant().course.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async upsertCourse(input: CourseUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.course.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId, action: 'update', entity: 'course', entityId: saved.code, after: saved,
    });
    return saved;
  }

  // ---- sessions ----
  async createSession(input: SessionUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const course = await db.course.findUnique({ where: { code: input.courseCode } });
    if (!course) throw new BadRequestException('Unknown course');
    const saved = await db.courseSession.create({
      data: {
        courseCode: input.courseCode,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        location: input.location,
        capacity: input.capacity,
      },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'course_session', entityId: saved.id, after: saved,
    });
    return saved;
  }

  /** Training calendar view (UR-TRM-004). */
  async calendar(from: string, to: string): Promise<CalendarEntry[]> {
    const db = this.tp.forCurrentTenant();
    const rows = await db.courseSession.findMany({
      where: {
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      include: { course: true, _count: { select: { enrolments: true } } },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((s) => ({
      sessionId: s.id,
      courseCode: s.courseCode,
      courseTitle: s.course.title,
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
      location: s.location ?? undefined,
      enrolled: s._count.enrolments,
      capacity: s.capacity,
    }));
  }

  /**
   * "Call list maintenance" (UR-TRM-001/005): nominate staff onto a session,
   * skipping duplicates and respecting capacity.
   */
  async nominate(sessionId: string, staffIds: string[], userId: string) {
    const db = this.tp.forCurrentTenant();
    const session = await db.courseSession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { enrolments: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    const free = session.capacity - session._count.enrolments;
    if (staffIds.length > free) {
      throw new BadRequestException(
        `Capacity exceeded: ${staffIds.length} requested, ${free} free`,
      );
    }
    let added = 0;
    for (const staffId of staffIds) {
      const exists = await db.enrolment.findUnique({
        where: { sessionId_staffId: { sessionId, staffId } },
      });
      if (exists) continue;
      await db.enrolment.create({
        data: { sessionId, staffId, status: 'nominated' },
      });
      added++;
    }
    await this.audit.record({
      userId, action: 'create', entity: 'enrolment', entityId: sessionId,
      after: { nominated: added },
    });
    return { added, skipped: staffIds.length - added };
  }

  listEnrolments(sessionId: string) {
    return this.tp.forCurrentTenant().enrolment.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Record completion (UR-TRM-006). If the course issues a certificate that
   * expires, schedule a Bring-Up to renew it.
   */
  async recordCompletion(input: CompletionInput, userId: string) {
    const db = this.tp.forCurrentTenant();
    const enrol = await db.enrolment.findUnique({
      where: { id: input.enrolmentId },
      include: { session: { include: { course: true } } },
    });
    if (!enrol) throw new NotFoundException('Enrolment not found');

    const completionDate = input.completionDate
      ? new Date(input.completionDate)
      : new Date();
    let validUntil: Date | null = null;
    const months = enrol.session.course.certificateValidMonths;
    if (input.outcome === 'attended' && months > 0) {
      validUntil = new Date(completionDate);
      validUntil.setMonth(validUntil.getMonth() + months);
    }

    const saved = await db.enrolment.update({
      where: { id: enrol.id },
      data: {
        status: input.outcome,
        score: input.score,
        completionDate,
        certificateValidUntil: validUntil,
        reason: input.reason,
      },
    });

    if (validUntil && enrol.session.course.certificateType) {
      // Bring-Up the renewal a month before expiry (UR-TRM-006).
      const dueAt = new Date(validUntil);
      dueAt.setMonth(dueAt.getMonth() - 1);
      await db.bringUp.create({
        data: {
          dueAt,
          type: 'training_cert_renewal',
          refEntity: 'enrolment',
          refId: enrol.id,
          scope: 'trm.admin',
        },
      });
    }

    await this.audit.record({
      userId, action: 'update', entity: 'enrolment', entityId: enrol.id,
      after: { status: saved.status, validUntil },
    });
    return saved;
  }

  /** My training history (self-service). */
  async myTraining(userId: string): Promise<MyTrainingEntry[]> {
    const db = this.tp.forCurrentTenant();
    const staff = await db.staff.findFirst({ where: { userId } });
    if (!staff) return [];
    const rows = await db.enrolment.findMany({
      where: { staffId: staff.id },
      include: { session: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((e) => ({
      enrolmentId: e.id,
      sessionId: e.sessionId,
      courseCode: e.session.courseCode,
      courseTitle: e.session.course.title,
      startDate: e.session.startDate.toISOString().slice(0, 10),
      endDate: e.session.endDate.toISOString().slice(0, 10),
      status: e.status as any,
      score: e.score ?? undefined,
      certificateValidUntil: e.certificateValidUntil
        ?.toISOString()
        .slice(0, 10),
    }));
  }
}
