import { z } from 'zod';

// ----- enums --------------------------------------------------------------

export const ComponentKind = z.enum([
  'earning',
  'deduction',
  'employer',
  'informational',
]);
export const PayRunType = z.enum([
  'regular',
  'offcycle',
  'bonus',
  'correction',
  'termination',
]);
export const PayRunStatus = z.enum([
  'draft',
  'calculated',
  'approved',
  'paid',
  'reversed',
]);
export const PayFrequency = z.enum([
  'monthly',
  'semimonthly',
  'biweekly',
  'weekly',
]);
export const PaymentStatus = z.enum(['pending', 'sent', 'settled', 'failed']);
export const TerminationReason = z.enum([
  'resignation',
  'dismissal',
  'redundancy',
  'retirement',
  'death',
]);
export const Ir56FormType = z.enum(['IR56B', 'IR56E', 'IR56F', 'IR56G']);
export const MpfClass = z.enum(['mandatory', 'exempt', 'voluntary_only']);
export const ContractType = z.enum([
  'permanent',
  'fixed_term',
  'hourly',
  'daily',
  'part_time',
]);
export type ContractTypeT = z.infer<typeof ContractType>;

export const HolidayType = z.enum(['statutory', 'general', 'company']);
export type HolidayTypeT = z.infer<typeof HolidayType>;

export const TimesheetEntryKind = z.enum([
  'regular',
  'ot15',
  'ot20',
  'rest_day_work',
  'holiday_work',
]);

export const BankFileFormat = z.enum([
  'iso20022_pain001',
  'hsbc_csv',
  'bank_local',
  'gl_journal',
  'payslip_pdf',
]);

// ----- pay components -----------------------------------------------------

export const PayComponentUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  kind: ComponentKind,
  taxable: z.boolean().default(true),
  mpfable: z.boolean().default(true),
  /** Safe formula expression. Built-ins: base, days, workedDays,
   *  line(code), ytd(bucket), const(key). */
  formula: z.string().min(1),
  sequence: z.number().int().default(100),
  active: z.boolean().default(true),
  glAccount: z.string().optional(),
});
export type PayComponentUpsert = z.infer<typeof PayComponentUpsertSchema>;

export const PayComponentInputUpsertSchema = z.object({
  staffId: z.string(),
  componentCode: z.string(),
  amount: z.number().optional(),
  params: z.record(z.unknown()).optional(),
  mode: z.enum(['recurring', 'oneoff']).default('recurring'),
  effectiveFrom: z.string(), // ISO date
  effectiveTo: z.string().optional(),
});
export type PayComponentInputUpsert = z.infer<
  typeof PayComponentInputUpsertSchema
>;

// ----- pay groups & calendar ---------------------------------------------

export const PayGroupUpsertSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1),
  frequency: PayFrequency.default('monthly'),
  currency: z.string().length(3).default('HKD'),
  localeCode: z.string().min(2).default('HK'),
  cutoffDay: z.number().int().min(1).max(31).default(25),
  paymentDay: z.number().int().min(1).max(31).default(28),
  bankFileFormat: BankFileFormat.default('iso20022_pain001'),
  active: z.boolean().default(true),
});
export type PayGroupUpsert = z.infer<typeof PayGroupUpsertSchema>;

export const GenerateCalendarSchema = z.object({
  groupCode: z.string(),
  /** Inclusive start period. */
  fromPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  /** Inclusive end period. */
  toPeriod: z.string().regex(/^\d{4}-\d{2}$/),
});
export type GenerateCalendar = z.infer<typeof GenerateCalendarSchema>;

export interface PayCalendarEntry {
  id: string;
  groupCode: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  cutoffAt: string;
  paymentDate: string;
  status: 'open' | 'locked' | 'paid';
}

// ----- staff pay profile --------------------------------------------------

export const StaffPayProfileUpsertSchema = z.object({
  staffId: z.string(),
  groupCode: z.string(),
  taxMaritalStatus: z
    .enum(['single', 'married_separate', 'married_joint'])
    .default('single'),
  dependents: z.number().int().min(0).max(20).default(0),
  mpfClass: MpfClass.default('mandatory'),
  mpfVoluntary: z.boolean().default(false),
  taxFileNo: z.string().optional(),
  costCenter: z.string().optional(),
  bank: z
    .object({
      bankCode: z.string(),
      bankName: z.string(),
      accountNo: z.string().min(4),
      holderName: z.string(),
      currency: z.string().length(3).default('HKD'),
    })
    .optional(),
});
export type StaffPayProfileUpsert = z.infer<typeof StaffPayProfileUpsertSchema>;

// ----- loans --------------------------------------------------------------

export const PayrollLoanCreateSchema = z.object({
  staffId: z.string(),
  principal: z.number().positive(),
  interestRate: z.number().min(0).max(1).default(0),
  installments: z.number().int().min(1).max(120),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  componentCode: z.string().default('LOAN_REPAY'),
  reason: z.string().optional(),
});
export type PayrollLoanCreate = z.infer<typeof PayrollLoanCreateSchema>;

export interface LoanScheduleRow {
  sequence: number;
  period: string;
  amount: number;
  principalPart: number;
  interestPart: number;
  status: 'scheduled' | 'deducted' | 'skipped';
}
export interface PayrollLoanView {
  id: string;
  staffId: string;
  principal: number;
  outstanding: number;
  installments: number;
  installmentAmount: number;
  status: 'active' | 'paid' | 'written_off' | 'suspended';
  startPeriod: string;
  schedule: LoanScheduleRow[];
}

// ----- pay run ------------------------------------------------------------

export const CreatePayRunSchema = z.object({
  /** Pay group; defaults to MONTHLY-HK if the tenant has no other group. */
  groupCode: z.string().default('MONTHLY-HK'),
  /** Pay period, YYYY-MM. */
  period: z.string().regex(/^\d{4}-\d{2}$/),
  type: PayRunType.default('regular'),
  /** Optional org-unit filter; RBAC data scope is always also applied. */
  orgUnitId: z.string().optional(),
  /** For correction/offcycle: reference the original run. */
  parentRunId: z.string().optional(),
});
export type CreatePayRun = z.infer<typeof CreatePayRunSchema>;

// ----- termination -------------------------------------------------------

export const TerminationCreateSchema = z.object({
  staffId: z.string(),
  exitDate: z.string(),
  reason: TerminationReason,
  /** Override months of service (auto otherwise). */
  monthsOfServiceOverride: z.number().optional(),
  /** Notice period months (drives payment-in-lieu calc). 0 if notice served. */
  noticeMonths: z.number().min(0).max(12).default(0),
  /** Accrued leave days to be paid out (defaults from leave ledger). */
  accruedLeaveDays: z.number().min(0).optional(),
  /** Manually add additional payments. */
  extraPayments: z
    .array(z.object({ code: z.string(), amount: z.number(), note: z.string().optional() }))
    .default([]),
});
export type TerminationCreate = z.infer<typeof TerminationCreateSchema>;

export interface TerminationView {
  id: string;
  staffId: string;
  exitDate: string;
  reason: z.infer<typeof TerminationReason>;
  monthsOfService: number;
  lastMonthBase: number;
  severancePay: number;
  longServicePay: number;
  paymentInLieuNotice: number;
  accruedLeavePay: number;
  proratedSalary: number;
  outstandingLoans: number;
  totalGross: number;
  totalDeductions: number;
  net: number;
  status: 'draft' | 'approved' | 'paid';
}

// ----- payslip ------------------------------------------------------------

export interface PayslipLine {
  componentCode: string;
  componentName: string;
  kind: z.infer<typeof ComponentKind>;
  amount: number;
  taxable: boolean;
  mpfable: boolean;
  glAccount?: string;
}

export interface YtdSnapshot {
  taxable: number;
  tax: number;
  mpfEe: number;
  mpfEr: number;
  gross: number;
  net: number;
}

export interface Payslip {
  staffId: string;
  staffNo: string;
  staffNameEn?: string;
  staffNameZh?: string;
  payRunId: string;
  period: string;
  gross: number;
  taxableEarnings: number;
  totalDeductions: number;
  tax: number;
  mpfEmployee: number;
  mpfEmployer: number;
  employerCost: number;
  net: number;
  currency: string;
  calendarDays: number;
  workedDays: number;
  unpaidLeaveDays: number;
  lines: PayslipLine[];
  ytd: YtdSnapshot | null;
  variance: Record<string, number> | null;
  paymentStatus: z.infer<typeof PaymentStatus>;
}

export interface PayRunResult {
  id: string;
  groupCode: string;
  period: string;
  type: z.infer<typeof PayRunType>;
  status: z.infer<typeof PayRunStatus>;
  headcount: number;
  totalGross: number;
  totalDeductions: number;
  totalEmployerCost: number;
  totalNet: number;
  totalTax: number;
  paymentDate?: string | null;
}

// ----- exports ------------------------------------------------------------

export const ExportPayRunSchema = z.object({
  format: BankFileFormat,
});
export type ExportPayRun = z.infer<typeof ExportPayRunSchema>;

export interface PayExportView {
  id: string;
  format: z.infer<typeof BankFileFormat>;
  fileKey: string;
  totalAmount: number;
  itemCount: number;
  generatedAt: string;
}

// ----- IR56 --------------------------------------------------------------

export const Ir56GenerateSchema = z.object({
  formType: Ir56FormType,
  taxYear: z.number().int(),
  staffId: z.string().optional(),
});
export type Ir56Generate = z.infer<typeof Ir56GenerateSchema>;

export interface Ir56FilingView {
  id: string;
  formType: z.infer<typeof Ir56FormType>;
  taxYear: number;
  staffId?: string | null;
  status: 'draft' | 'submitted';
  createdAt: string;
}

// ----- holidays + work schedule ------------------------------------------

export const HolidaySyncSchema = z.object({
  localeCode: z.string().min(2).default('HK'),
  /** Override iCal source; defaults to data.gov.hk for HK. */
  sourceUrl: z.string().url().optional(),
});
export type HolidaySync = z.infer<typeof HolidaySyncSchema>;

export const HolidayUpsertSchema = z.object({
  date: z.string(),
  localeCode: z.string().default('HK'),
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  type: HolidayType.default('general'),
  source: z.string().default('manual'),
});
export type HolidayUpsert = z.infer<typeof HolidayUpsertSchema>;

export interface PublicHolidayView {
  id: string;
  date: string;
  localeCode: string;
  nameEn: string;
  nameZh?: string;
  type: HolidayTypeT;
  source: string;
}

export const WorkScheduleUpsertSchema = z.object({
  groupCode: z.string(),
  workingDays: z.array(z.boolean()).length(7),
  hoursPerDay: z.number().positive().default(8),
  payStatutoryHolidays: z.boolean().default(true),
  otMultiplier: z.number().positive().default(1.5),
  restDayMultiplier: z.number().positive().default(2.0),
});
export type WorkScheduleUpsert = z.infer<typeof WorkScheduleUpsertSchema>;

// ----- contracts ----------------------------------------------------------

export const ContractUpsertSchema = z.object({
  staffId: z.string(),
  contractType: ContractType,
  contractEndDate: z.string().optional(),
  rankCode: z.string(),
  postId: z.string().optional(),
  effectiveFrom: z.string(),
  hourlyRate: z.number().min(0).default(0),
  dailyRate: z.number().min(0).default(0),
  weeklyHours: z.number().min(0).default(40),
  fteFactor: z.number().min(0).max(1).default(1),
  gratuityRate: z.number().min(0).max(1).default(0),
});
export type ContractUpsert = z.infer<typeof ContractUpsertSchema>;

// ----- timesheets ---------------------------------------------------------

export const TimesheetEntryUpsertSchema = z.object({
  date: z.string(),
  hours: z.number().positive(),
  kind: TimesheetEntryKind.default('regular'),
  note: z.string().optional(),
});
export const TimesheetUpsertSchema = z.object({
  staffId: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  entries: z.array(TimesheetEntryUpsertSchema).min(0),
});
export type TimesheetUpsert = z.infer<typeof TimesheetUpsertSchema>;

export interface TimesheetView {
  id: string;
  staffId: string;
  period: string;
  status: 'draft' | 'submitted' | 'approved';
  totalHours: number;
  regularHours: number;
  ot15Hours: number;
  ot20Hours: number;
  daysWorked: number;
  entries: Array<{
    id: string;
    date: string;
    hours: number;
    kind: z.infer<typeof TimesheetEntryKind>;
    note?: string;
  }>;
}

// ----- variance ----------------------------------------------------------

export interface PayRunVarianceRow {
  staffId: string;
  staffNo: string;
  current: number;
  previous: number;
  delta: number;
  pctChange: number;
}
export interface PayRunVariance {
  currentRunId: string;
  previousRunId: string | null;
  totalDelta: number;
  rows: PayRunVarianceRow[];
}
