import { z } from 'zod';

export const BenefitCategory = z.enum([
  'housing',
  'medical',
  'transport',
  'allowance',
  'loan',
  'insurance',
]);
export const InvoiceStatus = z.enum(['open', 'paid', 'overdue', 'cancelled']);

export const BenefitTypeUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  category: BenefitCategory,
  /** True = the staff pays (e.g. quarters rent); generates invoices. */
  chargeable: z.boolean().default(false),
  /** Default monthly amount; can be overridden per enrolment. */
  monthlyAmount: z.number().min(0).default(0),
  active: z.boolean().default(true),
});
export type BenefitTypeUpsert = z.infer<typeof BenefitTypeUpsertSchema>;

export const EnrolBenefitSchema = z.object({
  staffId: z.string().min(1),
  benefitTypeCode: z.string().min(1),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().optional(),
  monthlyAmount: z.number().min(0).optional(),
  /** Free-form params, e.g. { quarterCode, addressLine }. */
  params: z.record(z.any()).optional(),
});
export type EnrolBenefit = z.infer<typeof EnrolBenefitSchema>;

export interface BenefitView {
  id: string;
  staffId: string;
  staffNo?: string;
  staffName?: string;
  benefitTypeCode: string;
  benefitTypeName: string;
  category: z.infer<typeof BenefitCategory>;
  chargeable: boolean;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface InvoiceLine {
  benefitTypeCode: string;
  benefitTypeName: string;
  amount: number;
}

export interface InvoiceView {
  id: string;
  staffId: string;
  staffNo?: string;
  staffName?: string;
  period: string; // YYYY-MM
  total: number;
  status: z.infer<typeof InvoiceStatus>;
  dueDate: string;
  lines: InvoiceLine[];
}

export interface BenefitStats {
  period: string;
  byCategory: { category: string; enrolments: number; invoicedTotal: number }[];
  cessationsThisMonth: { staffId: string; staffNo: string; benefitTypeCode: string; endedOn: string }[];
}
