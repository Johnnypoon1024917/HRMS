# 00 — Overview

## Product vision

A single HRMS product that a company can:

1. **Sell as SaaS** — many client companies (tenants) on shared infrastructure,
   each with isolated data and their own branding, like Odoo Online.
2. **Deliver on-premise** — the same build deployed for one customer inside
   their network (single tenant), satisfying government/enterprise isolation
   requirements such as those in the CSD HRMS document.

The differentiators the client asked for:

- **Modular** — turn modules on/off per tenant; modules are isolated and
  independently shippable.
- **Configurable** — branding (logo, colour tone, icons, fonts), feature flags,
  code tables, document templates, and workflow options are *data*, not code.
- **Google-tone UI** — Material Design 3, calm colour, strong information
  density, keyboard-friendly grids.

## Source requirements

Derived from `CSD-HRMS-SA_D-2.3-User Requirements (UR) v0.03.docx`
(Hong Kong Correctional Services Department). 12 modules, ~80 detailed
requirements, plus non-functional requirements (audit, RBAC, SSO, retention,
bilingual EN / Traditional Chinese, effective-dating, batch "Bring-Up"
notifications, Excel/Word/PDF import-export, 99% availability).

The product generalises these government-specific needs into a commercial,
market-competitive HRMS — see [05-REQUIREMENTS-MAP.md](05-REQUIREMENTS-MAP.md).

## Document index

| Doc | Contents |
|---|---|
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | System architecture, multi-tenancy, deployment topologies |
| [02-MODULES.md](02-MODULES.md) | All modules, their scope, market benchmark, build status |
| [03-DATA-MODEL.md](03-DATA-MODEL.md) | Core + flagship-module data model, effective-dating |
| [04-THEMING-AND-SAAS.md](04-THEMING-AND-SAAS.md) | White-label config model, SaaS vs on-prem packaging |
| [05-REQUIREMENTS-MAP.md](05-REQUIREMENTS-MAP.md) | CSD UR → product feature traceability |
| [06-ROADMAP.md](06-ROADMAP.md) | Delivery sequence for the remaining modules |
| [07-PAYROLL.md](07-PAYROLL.md) | Configurable payroll engine design (new requirement) |
| [08-MOBILE-PWA.md](08-MOBILE-PWA.md) | Mobile delivery via installable PWA (new requirement) |
| [09-PAYMENT-STATUS.md](09-PAYMENT-STATUS.md) | Payment: what is and is not built (payroll disbursement, invoice collection, SaaS subscription billing) |

## Guiding principles

1. **One codebase, two delivery models.** Deployment config — not forks —
   decides SaaS vs on-prem.
2. **Config over code.** If a customer-visible choice can be data, it is data.
3. **Module isolation.** A module owns its schema, API surface, and UI routes;
   the platform owns identity, tenancy, RBAC, audit, theming.
4. **Effective-dated by default.** HR data is temporal: every record that can
   change over time carries `effectiveFrom` / `effectiveTo`.
5. **Auditable by default.** Every write goes through the audit interceptor.
6. **Bilingual-ready.** All user-facing strings and code tables are i18n keys;
   English + Traditional Chinese seeded.
