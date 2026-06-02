/**
 * Locale-pluggable tax engine. Driven by TaxRuleSet rows (data, not code).
 * The HK shape is:
 *
 *   { type: 'progressive',
 *     allowances:  { basic: 132000, married: 264000, dependent: 50000 },
 *     brackets:    [[50000,0.02],[50000,0.06],[50000,0.10],[null,0.17]],
 *     standardRate: 0.15 }
 *
 * Salaries-tax is computed two ways and the LOWER is taken (HK rule):
 *   1. progressive brackets after allowances
 *   2. standard rate × net taxable income (no allowance)
 * Per-period tax is the projected annual tax / periods (with YTD true-up
 * if a recalc lands in a later period of the same year).
 */
export interface TaxRules {
  type: 'progressive' | 'flat';
  allowances?: {
    basic?: number;
    married?: number;
    dependent?: number;
  };
  brackets?: Array<[number | null, number]>;
  standardRate?: number;
  /** Flat-rate fallback for simple jurisdictions. */
  flatRate?: number;
}

export interface TaxProfile {
  maritalStatus: 'single' | 'married_separate' | 'married_joint';
  dependents: number;
}

export interface TaxComputeInput {
  /** Taxable earnings for THIS pay period (already pro-rated). */
  periodTaxable: number;
  /** YTD taxable earnings BEFORE this period. */
  ytdTaxable: number;
  /** YTD tax already withheld BEFORE this period. */
  ytdTax: number;
  /** Periods in the tax year (12 for monthly HK). */
  periodsPerYear: number;
  rules: TaxRules;
  profile: TaxProfile;
}

export interface TaxComputeResult {
  /** Tax to withhold THIS period (>= 0). */
  periodTax: number;
  /** The annual projection that drove the withholding (audit/debug aid). */
  projectedAnnualTax: number;
  /** Effective annual taxable used for the projection. */
  projectedAnnualTaxable: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function progressiveTax(
  taxable: number,
  brackets: Array<[number | null, number]>,
): number {
  let remaining = Math.max(0, taxable);
  let tax = 0;
  for (const [width, rate] of brackets) {
    if (remaining <= 0) break;
    const slice = width == null ? remaining : Math.min(width, remaining);
    tax += slice * rate;
    remaining -= slice;
  }
  return tax;
}

function allowanceTotal(rules: TaxRules, p: TaxProfile): number {
  const a = rules.allowances ?? {};
  const basic = a.basic ?? 0;
  const married = p.maritalStatus === 'married_joint' ? a.married ?? 0 : 0;
  const dep = (a.dependent ?? 0) * p.dependents;
  return basic + married + dep;
}

export function computeTax(input: TaxComputeInput): TaxComputeResult {
  const { rules } = input;

  // Flat-rate jurisdictions.
  if (rules.type === 'flat') {
    const rate = rules.flatRate ?? 0;
    const periodTax = Math.max(0, input.periodTaxable * rate);
    return {
      periodTax: round2(periodTax),
      projectedAnnualTax: round2(periodTax * input.periodsPerYear),
      projectedAnnualTaxable: input.periodTaxable * input.periodsPerYear,
    };
  }

  // Progressive — project this period to a full year, take the LOWER of
  // bracketed-after-allowance vs standard-rate.
  const projectedAnnualTaxable =
    input.ytdTaxable + input.periodTaxable * (input.periodsPerYear - periodsElapsed(input));
  const netAfterAllowance = Math.max(
    0,
    projectedAnnualTaxable - allowanceTotal(rules, input.profile),
  );
  const bracketed = progressiveTax(netAfterAllowance, rules.brackets ?? []);
  const standard = (rules.standardRate ?? Infinity) * projectedAnnualTaxable;
  const projectedAnnualTax = Math.min(bracketed, standard);

  // True-up: remaining tax for the year minus what we've already withheld,
  // spread over the remaining periods.
  const remainingPeriods = Math.max(1, input.periodsPerYear - periodsElapsed(input) + 1);
  const periodTax = Math.max(
    0,
    (projectedAnnualTax - input.ytdTax) / remainingPeriods,
  );

  return {
    periodTax: round2(periodTax),
    projectedAnnualTax: round2(projectedAnnualTax),
    projectedAnnualTaxable: round2(projectedAnnualTaxable),
  };
}

/** Approx how many periods have elapsed BEFORE this one (HK monthly → 0..11). */
function periodsElapsed(input: TaxComputeInput): number {
  // ytdTaxable is the proxy: if it's >0, at least one period elapsed.
  // Caller can override by recomputing, but for the typical monthly cadence
  // (periods 1..12) the formula collapses correctly.
  return Math.min(
    input.periodsPerYear - 1,
    input.ytdTaxable > 0 && input.periodTaxable > 0
      ? Math.round(input.ytdTaxable / input.periodTaxable)
      : 0,
  );
}

const round2 = (x: number) => Math.round(x * 100) / 100;
