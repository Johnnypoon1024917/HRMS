import { z } from 'zod';

export const ExitReason = z.enum([
  'retirement',
  'compulsory_retirement',
  'dismissal',
  'invaliding',
  'resignation',
  'death',
  'end_of_contract',
  'posting_out',
  'reversion',
  'termination',
]);
export const ExitStatus = z.enum(['pending', 'applied', 'cancelled']);

export const ExitUpsertSchema = z.object({
  staffId: z.string().min(1),
  reason: ExitReason,
  /** Effective date the staff record should be del-flagged. */
  effectiveDate: z.string().date(),
  interviewNotes: z.string().max(4000).optional(),
});
export type ExitUpsert = z.infer<typeof ExitUpsertSchema>;

export interface ExitView {
  id: string;
  staffId: string;
  staffNo?: string;
  staffName?: string;
  reason: z.infer<typeof ExitReason>;
  effectiveDate: string;
  status: z.infer<typeof ExitStatus>;
  interviewNotes?: string;
  processedAt?: string;
}

/** Forecast of staff exiting within a window (UR-EXM-004 promotion planning). */
export interface ExitForecastRow {
  staffId: string;
  staffNo: string;
  staffName: string;
  rankCode?: string;
  orgUnitName?: string;
  reason: z.infer<typeof ExitReason>;
  effectiveDate: string;
  daysUntil: number;
}
