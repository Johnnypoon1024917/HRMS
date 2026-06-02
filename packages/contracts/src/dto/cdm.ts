import { z } from 'zod';

/** Combined Conduct & Discipline + Matter-of-Importance case kinds. */
export const CaseKind = z.enum([
  'warning',
  'disciplinary',
  'complaint',
  'integrity',
  'injury',
  'interdiction',
  'bankruptcy',
  'court',
  'police',
]);
export const CaseStatus = z.enum(['open', 'closed']);
export const CaseClassification = z.enum(['internal', 'restricted']);

export const CaseUpsertSchema = z.object({
  staffId: z.string().min(1),
  kind: CaseKind,
  summary: z.string().min(1).max(500),
  occurredOn: z.string().date(),
  status: CaseStatus.default('open'),
  classification: CaseClassification.default('restricted'),
});
export type CaseUpsert = z.infer<typeof CaseUpsertSchema>;

export const CaseNoteSchema = z.object({
  note: z.string().min(1).max(4000),
});
export type CaseNoteInput = z.infer<typeof CaseNoteSchema>;

export interface CaseView {
  id: string;
  staffId: string;
  staffNo?: string;
  staffName?: string;
  kind: z.infer<typeof CaseKind>;
  summary: string;
  occurredOn: string;
  status: z.infer<typeof CaseStatus>;
  classification: z.infer<typeof CaseClassification>;
  openedBy?: string;
  closedAt?: string;
}

export interface CaseNoteView {
  id: string;
  at: string;
  byUserId: string;
  note: string;
}

/** Compact case summary for the indicator strip (UR-CDM-002 / UR-MOI-001). */
export interface CaseSummary {
  staffId: string;
  total: number;
  open: number;
  byKind: { kind: string; count: number }[];
  /** Restricted entries that the caller may not view in detail. */
  restrictedCount: number;
}
