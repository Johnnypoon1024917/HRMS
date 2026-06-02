import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationView,
  CandidateUpsert,
  CandidateView,
  JobOpeningUpsert,
  JobOpeningView,
  PipelineColumn,
} from '@hrms/contracts';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { encrypt } from '../../common/crypto/crypto';

const STAGES = [
  'applied', 'screened', 'interview', 'offer', 'hired', 'rejected', 'withdrawn',
] as const;

@Injectable()
export class RecService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- jobs ----
  async listJobs(status?: string): Promise<JobOpeningView[]> {
    const db = this.tp.forCurrentTenant();
    const rows = await db.jobOpening.findMany({
      where: status ? { status } : {},
      include: {
        applications: { select: { id: true, stage: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((j) => ({
      id: j.code,
      code: j.code,
      title: j.title,
      status: j.status as any,
      openings: j.openings,
      applicants: j.applications.length,
      hired: j.applications.filter((a) => a.stage === 'hired').length,
    }));
  }

  async upsertJob(input: JobOpeningUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.jobOpening.upsert({
      where: { code: input.code },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId, action: 'update', entity: 'job_opening', entityId: saved.code, after: saved,
    });
    return saved;
  }

  // ---- candidates ----
  async upsertCandidate(input: CandidateUpsert, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.candidate.upsert({
      where: { email: input.email },
      create: input,
      update: input,
    });
    await this.audit.record({
      userId, action: 'update', entity: 'candidate', entityId: saved.id, after: saved,
    });
    return saved;
  }

  async listCandidates(): Promise<CandidateView[]> {
    const rows = await this.tp.forCurrentTenant().candidate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone ?? undefined,
      source: c.source ?? undefined,
    }));
  }

  // ---- applications & pipeline ----
  async apply(jobCode: string, candidateId: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const job = await db.jobOpening.findUnique({ where: { code: jobCode } });
    if (!job || job.status !== 'open') {
      throw new BadRequestException('Job is not open for applications');
    }
    const existing = await db.application.findUnique({
      where: { jobCode_candidateId: { jobCode, candidateId } },
    });
    if (existing) return existing;
    const saved = await db.application.create({
      data: { jobCode, candidateId, stage: 'applied' },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'application', entityId: saved.id, after: saved,
    });
    return saved;
  }

  async pipeline(jobCode: string): Promise<PipelineColumn[]> {
    const db = this.tp.forCurrentTenant();
    const apps = await db.application.findMany({
      where: { jobCode },
      include: { candidate: true, job: { select: { title: true } } },
      orderBy: { appliedAt: 'asc' },
    });
    const views: ApplicationView[] = apps.map((a) => ({
      id: a.id,
      jobCode: a.jobCode,
      jobTitle: a.job.title,
      candidateId: a.candidateId,
      candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`,
      candidateEmail: a.candidate.email,
      stage: a.stage as any,
      appliedAt: a.appliedAt.toISOString(),
      rejectionReason: a.rejectionReason ?? undefined,
    }));
    return STAGES.map((stage) => {
      const items = views.filter((v) => v.stage === stage);
      return { stage: stage as any, count: items.length, items };
    });
  }

  async moveStage(
    applicationId: string,
    stage: string, // zod-parsed by the controller; values from ApplicationStage
    reason: string | undefined,
    userId: string,
  ) {
    const db = this.tp.forCurrentTenant();
    const a = await db.application.findUnique({ where: { id: applicationId } });
    if (!a) throw new NotFoundException();
    if (a.stage === 'hired' || a.stage === 'rejected' || a.stage === 'withdrawn') {
      throw new BadRequestException(`Application is in terminal stage ${a.stage}`);
    }
    if (stage === 'hired') {
      throw new BadRequestException(
        'Use POST /rec/hire to record a hire (creates the PIM staff record).',
      );
    }
    const saved = await db.application.update({
      where: { id: applicationId },
      data: { stage, rejectionReason: stage === 'rejected' ? reason : null },
    });
    await this.audit.record({
      userId, action: 'update', entity: 'application', entityId: applicationId,
      before: { stage: a.stage }, after: { stage },
    });
    return saved;
  }

  // ---- interviews ----
  async scheduleInterview(input: {
    applicationId: string;
    scheduledAt: string;
    interviewerUserId: string;
    mode: 'onsite' | 'video' | 'phone';
  }, userId: string) {
    const db = this.tp.forCurrentTenant();
    const a = await db.application.findUnique({ where: { id: input.applicationId } });
    if (!a) throw new NotFoundException('Application not found');
    const saved = await db.interview.create({
      data: {
        applicationId: input.applicationId,
        scheduledAt: new Date(input.scheduledAt),
        interviewerUserId: input.interviewerUserId,
        mode: input.mode,
      },
    });
    if (a.stage === 'applied' || a.stage === 'screened') {
      await db.application.update({
        where: { id: input.applicationId }, data: { stage: 'interview' },
      });
    }
    await this.audit.record({
      userId, action: 'create', entity: 'interview', entityId: saved.id, after: saved,
    });
    return saved;
  }

  recordFeedback(interviewId: string, notes: string, score: number) {
    return this.tp.forCurrentTenant().interview.update({
      where: { id: interviewId },
      data: { notes, score },
    });
  }

  // ---- offers ----
  async makeOffer(input: {
    applicationId: string;
    salaryAmount: number;
    startDate: string;
  }, userId: string) {
    const db = this.tp.forCurrentTenant();
    const a = await db.application.findUnique({ where: { id: input.applicationId } });
    if (!a) throw new NotFoundException();
    const saved = await db.offer.create({
      data: {
        applicationId: input.applicationId,
        salaryAmount: input.salaryAmount,
        startDate: new Date(input.startDate),
      },
    });
    await db.application.update({
      where: { id: input.applicationId }, data: { stage: 'offer' },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'offer', entityId: saved.id, after: saved,
    });
    return saved;
  }

  async decideOffer(offerId: string, accepted: boolean, userId: string) {
    const db = this.tp.forCurrentTenant();
    const saved = await db.offer.update({
      where: { id: offerId },
      data: { status: accepted ? 'accepted' : 'declined', decidedAt: new Date() },
    });
    if (!accepted) {
      await db.application.update({
        where: { id: saved.applicationId },
        data: { stage: 'rejected', rejectionReason: 'Offer declined' },
      });
    }
    await this.audit.record({
      userId, action: 'update', entity: 'offer', entityId: offerId,
      after: { status: saved.status },
    });
    return saved;
  }

  /**
   * Hire: turns an accepted application into a PIM `Staff` + opening
   * substantive `StaffAppointment` on the chosen post, fills the post, moves
   * application to `hired`. Optionally provisions an `AppUser` for SSO/ESS.
   */
  async hire(input: {
    applicationId: string;
    staffNo: string;
    postId: string;
    email?: string;
  }, userId: string) {
    const db = this.tp.forCurrentTenant();
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      include: { candidate: true, offers: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    const offer = app.offers.find((o) => o.status === 'accepted');
    if (!offer) throw new BadRequestException('No accepted offer for this application');
    const post = await db.post.findUnique({ where: { id: input.postId } });
    if (!post) throw new BadRequestException('Post not found');

    const appUser = input.email
      ? await db.appUser.upsert({
          where: { email: input.email },
          create: { email: input.email, displayName: `${app.candidate.firstName} ${app.candidate.lastName}` },
          update: {},
        })
      : null;

    const staff = await db.staff.create({
      data: {
        staffNo: input.staffNo,
        userId: appUser?.id,
        nameEn: `${app.candidate.firstName} ${app.candidate.lastName}`,
        sex: 'X',
        dob: new Date('1990-01-01'), // placeholder; collected onboarding
        idType: 'TBD',
        idNoEnc: encrypt('PENDING'),
        appointments: {
          create: {
            postId: post.id,
            rankCode: post.rankCode,
            basis: 'substantive',
            effectiveFrom: offer.startDate,
          },
        },
      },
    });
    await db.post.update({ where: { id: post.id }, data: { status: 'filled' } });
    await db.application.update({
      where: { id: input.applicationId },
      data: { stage: 'hired', hiredStaffId: staff.id },
    });
    await this.audit.record({
      userId, action: 'create', entity: 'staff', entityId: staff.id,
      after: { staffNo: staff.staffNo, hiredFrom: input.applicationId },
    });
    return { staffId: staff.id, staffNo: staff.staffNo };
  }
}
