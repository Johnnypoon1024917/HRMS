import { z } from 'zod';

export const Sex = z.enum(['M', 'F', 'X']);
export const Classification = z.enum(['public', 'internal', 'restricted']);
export const StaffStatus = z.enum(['active', 'delflag']);

export const StaffUpsertSchema = z.object({
  staffNo: z.string().min(1).max(20),
  nameEn: z.string().min(1).max(120),
  nameZh: z.string().max(120).optional(),
  sex: Sex,
  dob: z.string().date(),
  idType: z.string().min(1).max(20),
  /** Encrypted at rest; plaintext only in transit over TLS. */
  idNo: z.string().min(1).max(40),
  classification: Classification.default('internal'),
  status: StaffStatus.default('active'),
});
export type StaffUpsert = z.infer<typeof StaffUpsertSchema>;

export const StaffSearchSchema = z.object({
  // Multi-criteria; all provided fields combine with AND (UR-GEN-003).
  staffNo: z.string().optional(),
  name: z.string().optional(),
  sex: Sex.optional(),
  rankCode: z.string().optional(),
  orgUnitId: z.string().optional(),
  status: StaffStatus.optional(),
  /** Effective-date "as of" for point-in-time view (UR-GEN-001). */
  asOf: z.string().date().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(25),
});
export type StaffSearch = z.infer<typeof StaffSearchSchema>;

export interface StaffListItem {
  id: string;
  staffNo: string;
  nameEn: string;
  nameZh?: string;
  rankCode?: string;
  orgUnitName?: string;
  status: z.infer<typeof StaffStatus>;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  okRows: number;
  errorRows: number;
  /** Download key for the Excel exception report (blank if no errors). */
  exceptionFileKey?: string;
}
