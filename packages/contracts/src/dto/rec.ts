import { z } from 'zod';

export const JobStatus = z.enum(['draft', 'open', 'on_hold', 'closed']);
export const ApplicationStage = z.enum([
  'applied',
  'screened',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
]);
export const OfferStatus = z.enum(['pending', 'accepted', 'declined']);
export const InterviewMode = z.enum(['onsite', 'video', 'phone']);

export const JobOpeningUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(160),
  orgUnitId: z.string().optional(),
  rankCode: z.string().optional(),
  /** Number of vacant headcount this requisition covers. */
  openings: z.number().int().min(1).default(1),
  description: z.string().max(8000).optional(),
  status: JobStatus.default('draft'),
});
export type JobOpeningUpsert = z.infer<typeof JobOpeningUpsertSchema>;

export const CandidateUpsertSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string().max(80).optional(), // referral, agency, careers-site …
});
export type CandidateUpsert = z.infer<typeof CandidateUpsertSchema>;

export const ApplySchema = z.object({
  jobCode: z.string().min(1),
  candidateId: z.string().min(1),
});

export const MoveStageSchema = z.object({
  stage: ApplicationStage,
  reason: z.string().max(500).optional(),
});

export const ScheduleInterviewSchema = z.object({
  applicationId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  interviewerUserId: z.string().min(1),
  mode: InterviewMode.default('onsite'),
});

export const InterviewFeedbackSchema = z.object({
  notes: z.string().max(4000),
  score: z.number().min(1).max(5),
});

export const OfferSchema = z.object({
  applicationId: z.string().min(1),
  salaryAmount: z.number().min(0),
  startDate: z.string().date(),
});

export const HireSchema = z.object({
  applicationId: z.string().min(1),
  staffNo: z.string().min(1),
  /** Substantive post for the new hire (existing vacant post). */
  postId: z.string().min(1),
  /** Optional: also create + link an AppUser for SSO/self-service. */
  email: z.string().email().optional(),
});

export interface JobOpeningView {
  id: string;
  code: string;
  title: string;
  status: z.infer<typeof JobStatus>;
  openings: number;
  applicants: number;
  hired: number;
}

export interface CandidateView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: string;
}

export interface ApplicationView {
  id: string;
  jobCode: string;
  jobTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  stage: z.infer<typeof ApplicationStage>;
  appliedAt: string;
  rejectionReason?: string;
}

export interface PipelineColumn {
  stage: z.infer<typeof ApplicationStage>;
  count: number;
  items: ApplicationView[];
}
