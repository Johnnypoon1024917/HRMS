import { z } from 'zod';

export const AwardKind = z.enum([
  'medal', // medals & clasps
  'travel', // travel award
  'lsi', // long service increment
  'recognition', // general recognition / commendation
]);

export const AwardTypeUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  kind: AwardKind,
  /** For LSI: years of service threshold. */
  lsiYears: z.number().int().min(1).optional(),
  active: z.boolean().default(true),
});
export type AwardTypeUpsert = z.infer<typeof AwardTypeUpsertSchema>;

export const GrantAwardSchema = z.object({
  staffId: z.string().min(1),
  awardTypeCode: z.string().min(1),
  awardedOn: z.string().date(),
  citation: z.string().max(2000).optional(),
});
export type GrantAward = z.infer<typeof GrantAwardSchema>;

export interface AwardView {
  id: string;
  staffId: string;
  staffNo: string;
  staffName: string;
  awardTypeCode: string;
  awardTypeName: string;
  kind: z.infer<typeof AwardKind>;
  awardedOn: string;
  citation?: string;
}

/** Staff suggested for an LSI based on years of service. */
export interface LsiCandidate {
  staffId: string;
  staffNo: string;
  staffName: string;
  yearsOfService: number;
  thresholdYears: number;
  awardTypeCode: string;
}
