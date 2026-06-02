/**
 * Pro-ration helper. Given a pay period and one staff's hire/exit dates +
 * unpaid leave days + (optionally) a public-holiday calendar + a work-week
 * pattern, returns the number of paid days and the proration factor.
 *
 * The "factor" is workedDays / standardWorkingDays so the engine can scale
 * monthly base salary. Mid-period hires and exits are handled.
 */
export interface ProrationInput {
  periodStart: Date;
  periodEnd: Date;
  hireDate: Date;
  exitDate?: Date | null;
  unpaidLeaveDays: number;
  /** Yyyy-mm-dd strings of statutory + general holidays in the period. */
  holidayDates?: Set<string>;
  /** 7 booleans for Sun..Sat. Default Mon-Fri. */
  workingDays?: boolean[];
}

export interface ProrationResult {
  /** Calendar days in the period (includes weekends). */
  calendarDays: number;
  /** Working days in the period after weekends + holidays. */
  workingDays: number;
  /** Working days the staff was actually employed AND not on unpaid leave. */
  workedDays: number;
  /** Statutory + general holiday count within the staff's employment span. */
  holidayDaysInSpan: number;
  /** workedDays / workingDays  (0..1). */
  factor: number;
  hiredMidPeriod: boolean;
  exitedMidPeriod: boolean;
}

const DAY_MS = 86_400_000;
const DEFAULT_WORKING_DAYS = [false, true, true, true, true, true, false]; // Mon-Fri

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

function daysBetween(a: Date, b: Date): Date[] {
  const out: Date[] = [];
  for (let t = a.getTime(); t <= b.getTime(); t += DAY_MS) {
    out.push(new Date(t));
  }
  return out;
}

export function proRate(input: ProrationInput): ProrationResult {
  const workingDaysPattern = input.workingDays ?? DEFAULT_WORKING_DAYS;
  const holidays = input.holidayDates ?? new Set<string>();

  const allDays = daysBetween(input.periodStart, input.periodEnd);
  const calendarDays = allDays.length;

  const isWorking = (d: Date) =>
    workingDaysPattern[d.getUTCDay()] && !holidays.has(ymd(d));

  const totalWorkingDays = allDays.filter(isWorking).length;

  const effectiveStart =
    input.hireDate > input.periodStart ? input.hireDate : input.periodStart;
  const effectiveEnd =
    input.exitDate && input.exitDate < input.periodEnd ? input.exitDate : input.periodEnd;

  if (effectiveEnd < effectiveStart) {
    return {
      calendarDays,
      workingDays: totalWorkingDays,
      workedDays: 0,
      holidayDaysInSpan: 0,
      factor: 0,
      hiredMidPeriod: input.hireDate > input.periodStart,
      exitedMidPeriod: !!(input.exitDate && input.exitDate < input.periodEnd),
    };
  }

  const spanDays = daysBetween(effectiveStart, effectiveEnd);
  const workingDaysInSpan = spanDays.filter(isWorking).length;
  const holidayDaysInSpan = spanDays.filter((d) => holidays.has(ymd(d))).length;

  const workedDays = Math.max(0, workingDaysInSpan - input.unpaidLeaveDays);
  const factor = totalWorkingDays === 0 ? 0 : workedDays / totalWorkingDays;

  return {
    calendarDays,
    workingDays: totalWorkingDays,
    workedDays: round2(workedDays),
    holidayDaysInSpan,
    factor: round4(factor),
    hiredMidPeriod: input.hireDate > input.periodStart,
    exitedMidPeriod: !!(input.exitDate && input.exitDate < input.periodEnd),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10000) / 10000;
