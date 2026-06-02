import { z } from 'zod';

export const OrgUnitType = z.enum(['institution', 'section', 'unit']);
export const PostStatus = z.enum(['vacant', 'filled', 'frozen']);
export const PostRequestAction = z.enum(['create', 'update', 'delete']);
export const PostRequestStatus = z.enum(['pending', 'applied', 'rejected']);

export const OrgUnitUpsertSchema = z.object({
  parentId: z.string().nullable().optional(),
  type: OrgUnitType,
  code: z.string().min(1).max(20),
  nameEn: z.string().min(1).max(120),
  nameZh: z.string().max(120).optional(),
});
export type OrgUnitUpsert = z.infer<typeof OrgUnitUpsertSchema>;

/** Post changes flow through requests applied by a daily batch (UR-ESM-001). */
export const PostRequestSchema = z.object({
  action: PostRequestAction,
  /** Required for update/delete. */
  postId: z.string().optional(),
  effectiveDate: z.string().date(),
  payload: z
    .object({
      orgUnitId: z.string(),
      rankCode: z.string(),
      title: z.string(),
      establishmentType: z.string().default('permanent'),
    })
    .partial()
    .optional(),
});
export type PostRequestInput = z.infer<typeof PostRequestSchema>;

export interface OrgChartNode {
  id: string;
  code: string;
  name: string;
  type: z.infer<typeof OrgUnitType>;
  establishment: number;
  strength: number;
  children: OrgChartNode[];
}

export interface EsFigure {
  orgUnitId: string;
  orgUnitName: string;
  rankCode: string;
  establishment: number;
  strength: number;
  vacancies: number;
}
