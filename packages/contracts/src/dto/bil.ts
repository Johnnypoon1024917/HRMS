import { z } from 'zod';

/** Subscription state mirrored from the billing provider (Stripe et al.). */
export const SubStatus = z.enum([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
]);

export const PlanUpsertSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1),
  /** Monthly base price in the smallest currency unit (e.g. cents). */
  monthlyPrice: z.number().int().min(0),
  currency: z.string().length(3).default('USD'),
  /** Modules included in this plan; everything else is hidden/disabled. */
  includedModules: z.array(z.string()),
  /** Hard cap on active staff seats; 0 = unlimited. */
  maxSeats: z.number().int().min(0).default(0),
  /** Per-seat overage price (smallest unit). 0 = block at maxSeats. */
  perSeatOverage: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  /** Stripe Price IDs — base + (optional) per-seat metered. */
  stripePriceId: z.string().optional(),
  stripeMeteredPriceId: z.string().optional(),
});
export type PlanUpsert = z.infer<typeof PlanUpsertSchema>;

export const CheckoutSessionSchema = z.object({
  planCode: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export interface SubscriptionView {
  tenantId: string;
  tenantSlug: string;
  planCode?: string;
  planName?: string;
  status: z.infer<typeof SubStatus> | 'none';
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  activeStaff: number;
  maxSeats: number;
  /** Provider hosted-portal link for self-service management. */
  portalUrl?: string;
}

export interface PlanView {
  code: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  includedModules: string[];
  maxSeats: number;
  active: boolean;
}

/** On-prem deployment entitlement payload (carried in the signed license key). */
export interface LicenseClaims {
  tenantId: string;
  tenantSlug: string;
  modules: string[];
  maxSeats: number;
  /** ISO date. */
  expiresAt: string;
  issuedAt: string;
}
