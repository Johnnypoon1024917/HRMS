import { z } from 'zod';

export const CycleStatus = z.enum(['draft', 'open', 'closed']);
export const AppraisalStatus = z.enum([
  'pending', // report created, awaiting employee self-assessment
  'self_done', // employee submitted self-assessment
  'appraised', // appraiser submitted rating + comments
  'finalised', // signed off / locked
]);

/** A cycle defines the period + the (configurable) rating scale & sections. */
export const CycleUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  periodYear: z.number().int().min(2000).max(2100),
  ratingMin: z.number().int().default(1),
  ratingMax: z.number().int().default(5),
  /** Competency/section keys assessed in this cycle (tenant-configurable). */
  sections: z.array(z.string()).default(['delivery', 'teamwork', 'leadership']),
  status: CycleStatus.default('draft'),
});
export type CycleUpsert = z.infer<typeof CycleUpsertSchema>;

export const SelfAssessmentSchema = z.object({
  selfComments: z.string().max(4000),
  /** sectionKey -> self score. */
  selfScores: z.record(z.number()),
});
export type SelfAssessment = z.infer<typeof SelfAssessmentSchema>;

export const AppraiserAssessmentSchema = z.object({
  appraiserComments: z.string().max(4000),
  scores: z.record(z.number()),
  overallRating: z.number(),
});
export type AppraiserAssessment = z.infer<typeof AppraiserAssessmentSchema>;

export interface AppraisalView {
  id: string;
  cycleId: string;
  cycleName: string;
  staffId: string;
  staffNo?: string;
  staffName?: string;
  status: z.infer<typeof AppraisalStatus>;
  overallRating?: number;
  ratingMin: number;
  ratingMax: number;
  sections: string[];
  selfComments?: string;
  selfScores?: Record<string, number>;
  appraiserComments?: string;
  scores?: Record<string, number>;
}

export interface RatingDistribution {
  cycleId: string;
  total: number;
  finalised: number;
  buckets: { rating: number; count: number }[];
}
