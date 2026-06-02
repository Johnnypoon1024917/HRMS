# 02 — Modules

Every row is a self-contained module (own schema area, API namespace, UI
routes, RBAC permissions, manifest). Tenants toggle modules individually.

## Core platform (always on)

| Module | Scope |
|---|---|
| Identity & Tenancy | Tenants, users, multi-post assignment, active-post switch, **OIDC SSO** (PKCE, per-tenant IdP, JIT provisioning) + password login |
| RBAC | Roles, functional scope (view/edit), data scope (unit/post) |
| Audit & Compliance | Immutable audit log, retention/purge, data-classification |
| Config Studio | Branding, feature flags, code tables, document templates, workflow options |
| Notifications / Bring-Up | Tickler engine, in-app + email, scheduled batch |
| Reporting & Export | Saved queries, scheduled reports, Excel/Word/PDF, exception reports |
| Billing (`bil`) | Plans, Stripe Billing checkout + portal, webhook-driven entitlement, suspend gate, on-prem RS256 license keys |

## Functional modules

| Key | Module | CSD ref | Market benchmark | Status |
|---|---|---|---|---|
| **pim** | Personnel Information Management | UR-PIM | Workday Core HR, BambooHR Employee DB | ✅ flagship — built |
| **esm** | Establishment & Strength + **orm** Org Chart | UR-ESM/ORM | Workday Position Mgmt, SAP Org Mgmt | ✅ flagship — built |
| **hbm** | **Benefits (Housing + Medical + …)** | UR-HBM | SAP Benefits, Odoo | ✅ built — 6 categories, effective-dated enrolments, monthly invoice generation for chargeable benefits, cessation report + statistics |
| **pem** | **Performance Management** | UR-PEM | Lattice, 15Five, SuccessFactors PM | ✅ built — configurable cycles, call/generate, self + appraiser assessment (no self-appraise), finalise, rating distribution |
| **cdm** | **Conduct & Discipline + MOI (Case Mgmt)** | UR-CDM/MOI | HR Acuity, Workday ER | ✅ built — 9 case kinds, classification-gated content & notes, per-staff summary, data-scoped list |
| **ham** | **Honours & Awards / Recognition** | UR-HAM | Bonusly, Workday | ✅ built — award types (medal/travel/LSI/recognition), grants, LSI auto-candidates by years of service |
| **trm** | **Training & Learning (LMS-lite)** | UR-TRM | Cornerstone, Odoo eLearning | ✅ built — courses, sessions, call list nomination with capacity, completions with cert renewal Bring-Up, training calendar, my-training |
| **pom** | **Posting / Assignment & Career History** | UR-POM | Workday Job Change | ✅ built — transfer/acting/promotion/reversion, effective-dated supersede, career history, acting tracking, transfer auto-match |
| **exm** | **Exit / Offboarding** | UR-EXM | BambooHR Offboarding | ✅ built — exit records (10 reasons), daily batch auto-delflag + closes open appointment, exit forecast for promotion planning |
| **lve** | **Leave & Attendance** *(market add-on)* | — | Odoo Time Off, BambooHR | ✅ built — types, balances, requests, dual-approval |
| **rec** | **Recruitment / ATS** *(market add-on)* | — | Greenhouse, Odoo Recruitment | ✅ built — jobs, candidates, applications, stage pipeline (kanban), interviews, offers, **hire → PIM staff + post-fill** |
| **pay** | **Payroll (configurable engine)** *(new req.)* | — | ADP, Odoo Payroll, SuccessFactors | ✅ scaffolded — see [07-PAYROLL.md](07-PAYROLL.md) |
| **ess** | **Employee / Manager Self-Service** | implicit | Every modern HRMS | ✅ built — my profile, leave summary, manager team view |

**Cross-cutting delivery requirement — Mobile:** the product is delivered to
mobile as an installable, per-tenant-branded **PWA** on the shared API (native
React Native client on the roadmap). See [08-MOBILE-PWA.md](08-MOBILE-PWA.md).

> CSD-specific scope was generalised: government "Housing Benefit" → generic
> **Benefits**; "Conduct & Discipline" + "Matter of Importance" → **Employee
> Relations / Case Management**; "Honours & Awards" → **Recognition**;
> "Establishment & Strength" → **Position Management**. Market add-ons (Leave,
> ATS, Payroll, Self-Service) make it competitive with Odoo/BambooHR.

## Flagship module 1 — PIM (built)

Personnel Information Management — the employee system of record.

- Staff master record (multilingual name, IDs, contacts, photo).
- Effective-dated sub-records: appointments, salary, qualifications,
  emergency contacts, documents.
- Bulk upload (Excel) with validating **exception report** (UR-PIM-002).
- Search with multi-criteria AND filters + saved searches (UR-GEN-003).
- Field-level **data classification** & access control (UR-GEN-004).
- Letters/memos generation hooks (UR-PIM-010).
- Full audit + effective-date history viewer.

## Flagship module 2 — ESM / ORM (built)

Establishment, Strength & Organisation.

- Org units hierarchy (institution → section → unit) — code-table driven.
- **Posts** (establishment) with rank, effective-dated create/update/delete
  via **Post Requests** processed by a daily batch job (UR-ESM-001).
- Strength = filled posts (joins PIM appointments).
- Daily **Establishment & Strength snapshot** for historical enquiry
  (UR-ESM-002).
- Org-chart API (tree + E&S figures) for view/print/export (UR-ESM-003/ORM-001).

Each remaining module follows the **same pattern**: `contracts` DTOs →
`api/src/modules/<key>` (controller/service/prisma models + manifest) →
`web/src/app/<key>` (MUI screens) → RBAC perms + nav in manifest.
See [06-ROADMAP.md](06-ROADMAP.md).
