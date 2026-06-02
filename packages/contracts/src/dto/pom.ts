import { z } from 'zod';

/** Posting / job-change action types (UR-POM-001..003). */
export const PostingActionType = z.enum([
  'transfer', // move to a different post/unit (substantive)
  'acting', // temporary acting in a higher post (time-boxed)
  'promotion', // substantive rank change
  'reversion', // end acting / revert to substantive
]);
export const PostingActionStatus = z.enum(['pending', 'applied', 'cancelled']);

export const PostingActionSchema = z
  .object({
    staffId: z.string().min(1),
    type: PostingActionType,
    toPostId: z.string().optional(), // required for transfer/acting/promotion
    rankCode: z.string().optional(), // promotion/acting target rank
    effectiveFrom: z.string().date(),
    /** Acting only: when the acting ends (auto-reversion). */
    effectiveTo: z.string().date().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (v) => v.type === 'reversion' || !!v.toPostId || v.type === 'promotion',
    { message: 'toPostId is required for transfer/acting', path: ['toPostId'] },
  )
  .refine((v) => v.type !== 'acting' || !!v.effectiveTo, {
    message: 'acting requires an end date (effectiveTo)',
    path: ['effectiveTo'],
  });
export type PostingActionInput = z.infer<typeof PostingActionSchema>;

export interface CareerEntry {
  kind: 'appointment' | 'action';
  date: string;
  rankCode: string;
  postTitle?: string;
  orgUnitName?: string;
  detail: string; // human-readable summary
  effectiveTo?: string;
}

export interface ActingRecord {
  staffId: string;
  staffNo: string;
  nameEn: string;
  actingRank: string;
  postTitle?: string;
  effectiveFrom: string;
  effectiveTo: string;
  endingSoon: boolean; // within 14 days
}

/** Auto-matching of vacant posts for a transfer (UR-POM-005). */
export interface TransferMatch {
  postId: string;
  postTitle: string;
  orgUnitName: string;
  rankCode: string;
  score: number; // higher = better fit
  reasons: string[];
}
