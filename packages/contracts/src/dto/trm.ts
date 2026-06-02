import { z } from 'zod';

export const EnrolmentStatus = z.enum([
  'nominated', // on the call list (UR-TRM-001)
  'confirmed',
  'attended',
  'absent', // failed to attend (with reason)
  'failed',
  'cancelled',
]);

export const CourseUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  durationDays: z.number().min(0.5).default(1),
  organiser: z.string().max(120).optional(),
  /** Tracks certificate type (e.g. INTEGRITY) for renewal Bring-Ups. */
  certificateType: z.string().max(40).optional(),
  /** Months a completion certificate is valid for (0 = never expires). */
  certificateValidMonths: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
export type CourseUpsert = z.infer<typeof CourseUpsertSchema>;

export const SessionUpsertSchema = z.object({
  courseCode: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
  location: z.string().max(120).optional(),
  capacity: z.number().int().min(1).default(20),
});
export type SessionUpsert = z.infer<typeof SessionUpsertSchema>;

export const NominateSchema = z.object({
  sessionId: z.string().min(1),
  staffIds: z.array(z.string().min(1)).min(1),
});

export const CompletionSchema = z.object({
  enrolmentId: z.string().min(1),
  outcome: z.enum(['attended', 'absent', 'failed']),
  score: z.number().min(0).max(100).optional(),
  /** Date the course was completed (defaults to today). */
  completionDate: z.string().date().optional(),
  reason: z.string().max(500).optional(),
});
export type CompletionInput = z.infer<typeof CompletionSchema>;

export interface CalendarEntry {
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  startDate: string;
  endDate: string;
  location?: string;
  enrolled: number;
  capacity: number;
}

export interface MyTrainingEntry {
  enrolmentId: string;
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  startDate: string;
  endDate: string;
  status: z.infer<typeof EnrolmentStatus>;
  score?: number;
  certificateValidUntil?: string;
}
