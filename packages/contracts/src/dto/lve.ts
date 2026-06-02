import { z } from 'zod';

export const LeaveRequestStatus = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

/** A leave type is tenant-configurable (code table-like) — no code change. */
export const LeaveTypeUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  /** Days accrued per year; 0 = unlimited/unpaid. */
  annualQuota: z.number().min(0).default(0),
  paid: z.boolean().default(true),
  /** Requires a reason/attachment (e.g. sick). */
  requiresReason: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type LeaveTypeUpsert = z.infer<typeof LeaveTypeUpsertSchema>;

export const LeaveRequestSchema = z
  .object({
    leaveTypeCode: z.string().min(1),
    startDate: z.string().date(),
    endDate: z.string().date(),
    halfDay: z.boolean().default(false),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });
export type LeaveRequestInput = z.infer<typeof LeaveRequestSchema>;

export const ApproveLeaveSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
});
export type ApproveLeave = z.infer<typeof ApproveLeaveSchema>;

export interface LeaveBalance {
  leaveTypeCode: string;
  leaveTypeName: string;
  quota: number;
  taken: number;
  pending: number;
  remaining: number;
}

export interface LeaveRequestView {
  id: string;
  staffId: string;
  staffNo?: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  days: number;
  status: z.infer<typeof LeaveRequestStatus>;
  reason?: string;
  decidedBy?: string;
  decidedNote?: string;
}
