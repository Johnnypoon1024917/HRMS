# 07 — Payroll Engine (module `pay`)

> **New requirement.** The platform must handle payroll. Decision: a **full,
> configurable in-house payroll engine** (not just an integration layer),
> multi-tenant and locale-aware, with provider/bank/GL export.

## Goals

- Configurable **pay components** (earnings, deductions, employer costs) with
  formula-driven amounts — no code change to add a component.
- Locale-pluggable **statutory rules** (tax, social/MPF-style, levies) per
  country, versioned by effective date.
- **Pay runs** with full audit, off-cycle/correction runs, retro-pay.
- **Payslips** (bilingual, branded), **bank payment file** + **GL journal**
  export. Sits behind the same RBAC, audit, effective-dating, theming and
  schema-per-tenant foundation as every other module.

## Data model (added to `tenant.prisma`)

| Table | Key columns |
|---|---|
| `pay_component` | code, name(En/Zh), kind(`earning`/`deduction`/`employer`), taxable, formula(string), sequence, active |
| `pay_component_input` | staffId, componentCode, amount?, params(jsonb), **effectiveFrom/To** — recurring or one-off inputs |
| `salary_structure` | code, name, componentCodes[] — assignable per grade/staff |
| `tax_rule_set` | localeCode, version, **effectiveFrom/To**, rules(jsonb: brackets, rates, caps) |
| `pay_run` | id, period (YYYY-MM), type(`regular`/`offcycle`/`correction`), status(`draft`/`calculated`/`approved`/`paid`), runBy, approvedBy |
| `payslip` | payRunId, staffId, gross, totalDeductions, employerCost, net, currency, lines(jsonb), status |
| `payslip_line` *(jsonb in payslip, or table)* | componentCode, kind, base, amount, taxable |
| `pay_bank_file` / `pay_gl_export` | payRunId, fileKey, format, generatedAt |

All money is `Decimal`; rounding policy per tenant config. Salary base reuses
PIM `staff_salary` (effective-dated) — payroll does not duplicate comp data.

## Calculation pipeline

```
PayRun(period)
  └─ for each in-scope staff (RBAC data-scope honoured):
       1. resolve salary_structure → ordered pay_component[]
       2. gather pay_component_input (recurring + one-off, effective in period)
       3. evaluate each component formula in sequence
            (formula sandbox: base salary, prorations, prior-line refs,
             attendance/leave hooks, FX)
       4. apply tax_rule_set for staff locale (brackets/caps, YTD aware)
       5. sum gross / deductions / employer cost / net → Payslip
  └─ status: draft → calculated → (approve, dual-control) → paid
  └─ exports: bank payment file (ISO 20022 / local), GL journal
```

- **Formula sandbox**: a small, safe expression evaluator (no arbitrary code).
  Variables: `base`, `days`, `workedDays`, `line('CODE')`, `ytd('CODE')`,
  tenant constants. Keeps payroll *configurable*, not hard-coded.
- **Retro & corrections**: a correction run recomputes a closed period and
  posts only the delta; fully audited.
- **Statutory packs**: `tax_rule_set` rows are data; a locale pack (e.g.
  HK MPF + salaries tax) is seedable per tenant and version-dated — meets the
  multi-country SaaS need and on-prem single-country installs alike.

## Security / compliance

- Payroll permissions: `pay.read`, `pay.write`, `pay.run`, `pay.approve`,
  `pay.export`. **Dual control**: the approver must differ from the runner
  (enforced in service + audited).
- Net pay / bank details are `restricted` classification → masked unless
  `pay.read.restricted`, encrypted at rest.
- Every state transition and export written to the append-only `audit_log`.
- Retention follows the platform policy (payroll records typically 7y).

## API surface (`/api/pay/...`)

| Method | Path | Perm | Purpose |
|---|---|---|---|
| GET | `/pay/components` | `pay.read` | list/maintain pay components |
| PUT | `/pay/components` | `pay.write` | upsert component (formula) |
| POST | `/pay/runs` | `pay.run` | create + calculate a pay run |
| POST | `/pay/runs/:id/approve` | `pay.approve` | dual-control approval |
| GET | `/pay/runs/:id/payslips` | `pay.read` | results |
| POST | `/pay/runs/:id/export` | `pay.export` | bank file / GL journal |

## Status

✅ Module scaffolded end-to-end following the flagship pattern: contracts
DTOs, Prisma models, NestJS engine (`PayService` with the pipeline + formula
sandbox + dual-control), controller, manifest, registry + app wiring, seed
pay components. Locale statutory packs and bank-file format adapters are the
hardening backlog (one HK sample pack seeded as reference).
