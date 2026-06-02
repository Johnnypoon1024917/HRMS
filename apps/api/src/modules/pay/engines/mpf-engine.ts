/**
 * Hong Kong MPF engine. Generalises to other defined-contribution schemes
 * (Singapore CPF, UK NI Class 1) via PayrollConstant overrides — the rate /
 * cap / floor are all data-driven.
 *
 * HK reference (Mandatory Provident Fund Schemes Ordinance):
 *   - 18 ≤ age ≤ 64           → mandatory: 5% EE + 5% ER
 *   - 65 ≤ age                → voluntary (treated as 0 unless opt-in)
 *   - age < 18                → exempt
 *   - employee rate 5%, employer rate 5%
 *   - relevant-income MIN (no EE contribution if below)   → MPF_FLOOR_MONTHLY
 *   - relevant-income CAP (contributions capped above)    → MPF_CAP_MONTHLY
 *
 * Defaults (Jan 2026): floor = HKD 7,100/month; cap = HKD 30,000/month.
 * Override via PayrollConstant rows.
 */
export interface MpfRates {
  rateEmployee: number;
  rateEmployer: number;
  floorMonthly: number;
  capMonthly: number;
}

export interface MpfComputeInput {
  /** Relevant income for THIS period (post-proration). */
  relevantIncome: number;
  /** mandatory | exempt | voluntary_only */
  mpfClass: 'mandatory' | 'exempt' | 'voluntary_only';
  /** Whether the employee has opted in to voluntary contributions. */
  voluntaryOptIn: boolean;
  rates: MpfRates;
}

export interface MpfComputeResult {
  /** Employee contribution (deduction). */
  employee: number;
  /** Employer contribution (employer cost). */
  employer: number;
  /** Income actually subject to MPF for the period (after floor/cap). */
  contributableIncome: number;
}

export function computeMpf(input: MpfComputeInput): MpfComputeResult {
  const { rates, mpfClass, voluntaryOptIn, relevantIncome } = input;

  if (mpfClass === 'exempt') {
    return { employee: 0, employer: 0, contributableIncome: 0 };
  }

  // Below floor → no EE contribution, but ER still pays on actual income.
  const eeContributable =
    relevantIncome < rates.floorMonthly
      ? 0
      : Math.min(relevantIncome, rates.capMonthly);

  const erContributable = Math.min(relevantIncome, rates.capMonthly);

  // For 65+ class, contributions are voluntary; if no opt-in, zero out EE.
  // Employer still has no obligation (HK rule), so employer = 0 too.
  if (mpfClass === 'voluntary_only' && !voluntaryOptIn) {
    return { employee: 0, employer: 0, contributableIncome: erContributable };
  }

  const employee = round2(eeContributable * rates.rateEmployee);
  const employer = round2(erContributable * rates.rateEmployer);

  return { employee, employer, contributableIncome: erContributable };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
