/**
 * Safe formula sandbox for pay components. Supports +-*\/(), numbers, and a
 * fixed set of variables/functions — NO arbitrary code execution.
 *
 * Available in scope:
 *   base                    - staff base salary for the period
 *   days, workedDays        - calendar / worked days in the period
 *   unpaidLeaveDays         - days of unpaid leave in the period
 *   periodFactor            - workedDays / days (0..1)
 *   line('CODE')            - amount of an already-evaluated component
 *   ytd('BUCKET')           - year-to-date balance (e.g. ytd('MPF_EE'))
 *   const('KEY')            - tenant payroll constant (e.g. MPF_CAP_MONTHLY)
 *   min(a,b), max(a,b)      - clamps for caps/floors
 *   floor(x), ceil(x), round(x)
 */
export interface FormulaScope {
  base: number;
  days: number;
  workedDays: number;
  unpaidLeaveDays: number;
  periodFactor: number;
  line: (code: string) => number;
  ytd: (bucket: string) => number;
  const: (key: string) => number;
}

const ALLOWED = /^[\d\s+\-*/().,'a-zA-Z_]+$/;

export function evalFormula(formula: string, scope: FormulaScope): number {
  if (!ALLOWED.test(formula)) {
    throw new Error(`Illegal characters in formula: ${formula}`);
  }
  // In strict mode `eval` and `arguments` are reserved binding names — the
  // defence for those is the ALLOWED regex (no `.` or `[`, so user formula
  // can't reach `globalThis.eval`).
  const fn = new Function(
    'base',
    'days',
    'workedDays',
    'unpaidLeaveDays',
    'periodFactor',
    'line',
    'ytd',
    'const_',
    'min',
    'max',
    'floor',
    'ceil',
    'round',
    `"use strict";
     const window=undefined, globalThis=undefined, global=undefined,
           process=undefined, require=undefined, Function=undefined;
     return ( ${formula.replace(/\bconst\s*\(/g, 'const_(')} );`,
  );
  const out = fn(
    scope.base,
    scope.days,
    scope.workedDays,
    scope.unpaidLeaveDays,
    scope.periodFactor,
    scope.line,
    scope.ytd,
    scope.const,
    Math.min,
    Math.max,
    Math.floor,
    Math.ceil,
    Math.round,
  );
  if (typeof out !== 'number' || !isFinite(out)) {
    throw new Error(`Formula did not yield a finite number: ${formula}`);
  }
  return Math.round(out * 100) / 100;
}
