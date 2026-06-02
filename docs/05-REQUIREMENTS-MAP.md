# 05 — Requirements Traceability (CSD UR → Product)

Selected mapping of CSD HRMS user requirements to product features. Full
catalogue lives in the source `.docx`; this records design intent & coverage.

## Cross-cutting (GEN / SEC)

| CSD ref | Requirement | Product feature | Status |
|---|---|---|---|
| UR-GEN-001 | GUI, bilingual EN/zh-Hant, validation, dropdowns, effective dates | MUI shell + i18n + code tables + effective-dating framework | ✅ |
| UR-GEN-002 | Bring-Up notification | `common/bring-up` + BullMQ | ✅ engine |
| UR-GEN-003 | Search staff | PIM multi-criteria search + saved searches | ✅ |
| UR-GEN-004 | Access control to sensitive info | RBAC data scope + data-classification masking | ✅ |
| REQ-SEC-001 | Audit logging | `common/audit` append-only log | ✅ |
| REQ-SEC-002 | AuthN/AuthZ + DPP SSO + multi-post | JWT + **OIDC SSO built** (PKCE, per-tenant IdP, JIT provisioning); SAML/LDAP slot; multi-post active-post switch | ✅ |
| REQ-SEC-003/4 | Backup & DR | per-schema dump + PITR; runbook | 🧭 ops |
| REQ-SEC-005 | Response time (10 concurrent) | pagination, indexes, e2e budget | ✅ design |
| REQ-SEC-006 | 99% availability | stateless api, probes, HA topology | 🧭 ops |
| REQ-SEC-007 | Retention 3y online / 7y archive | `common/retention` purge job | ✅ engine |

## PIM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-PIM-001 | Upload Staff Record Form | Staff create + document upload | ✅ |
| UR-PIM-002 | Batch upload from GF340 | Excel import + exception report | ✅ |
| UR-PIM-003/4/5/6 | Search/enquire personal info | Search API + saved searches + data scope | ✅ |
| UR-PIM-008 | Additional info for disciplined staff | Classification-gated fields | ✅ field model |
| UR-PIM-010 | Letters/reports/memos | Report/Export service hooks | ✅ hook |
| UR-PIM-011 | Migrate PIM | Import batch framework | ✅ pattern |

## ESM / ORM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-ESM-001 | Maintain posts via post requests + daily batch | `post_request` + `PostRequestProcessor` job | ✅ |
| UR-ESM-002 | Establishment & Strength reports + daily snapshot | `es_snapshot` job + enquiry API | ✅ |
| UR-ESM-003 / ORM-001 | Org charts view/print/export | Org-chart tree + E&S figures API | ✅ |
| UR-ESM-004 | Letters/reports/memos | Export service hook | ✅ hook |

## POM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-POM-001 | Manage staff posting information | `PostingAction` (transfer) → effective-dated supersede of `StaffAppointment` via daily batch | ✅ |
| UR-POM-002 | Manage staff acting information | Time-boxed `acting` action + reversion; acting list with ending-soon flags | ✅ |
| UR-POM-003 | Manage staff career history | Combined appointment + applied-action career timeline API | ✅ |
| UR-POM-004 | Reports and reminders | Acting ending-soon indicators; export hook | ✅ hook |
| UR-POM-005 | Staff transfer auto-matching | `GET /pom/match/:staffId` vacancy scoring (rank/unit heuristic) | ✅ |

## PEM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-PEM-001 | Call appraisal report | `POST /pem/cycles/:id/generate` creates pending reports for in-scope staff | ✅ |
| UR-PEM-003 | Receive appraisal report | Self-assessment → appraiser assessment workflow | ✅ |
| UR-PEM-004 | Search appraisal for review/update | Appraiser queue (data-scoped) + my-reports | ✅ |
| UR-PEM-005 | Generate appraisal & PEM reports | Rating distribution analytics endpoint | ✅ |
| UR-PEM-002 | Sync with external IPMS | Integration hook (pattern: import batch) | 🧭 hook |

## TRM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-TRM-001 / 005 | Call list maintenance, nominate staff | `POST /trm/nominate` with capacity check + dedup | ✅ |
| UR-TRM-002 | Upload call list / courses | Excel import pattern (reuse PIM import framework) | 🧭 hook |
| UR-TRM-004 | Training calendar | `GET /trm/calendar` range query | ✅ |
| UR-TRM-006 | Bring-Up for certificate renewal | Completion records `certificateValidUntil` + writes `BringUp` row 1 month before expiry | ✅ |
| UR-TRM-007 | Migrate TCMS | Course/Session/Enrolment models cover the data shape | ✅ data model |
| UR-TRM-008 | Letters/reports/memos | Export service hook | ✅ hook |

## HAM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-HAM-001 | Travel award | `AwardType.kind = travel` + grant API | ✅ |
| UR-HAM-002 | Medals & clasps | `AwardType.kind = medal` + grant API | ✅ |
| UR-HAM-003 | Long Service Increment | `GET /ham/lsi` candidate list (years-of-service threshold, not-yet-awarded filter) + one-click grant | ✅ |
| UR-HAM-004 | Letters/reports/memos | Export hook | ✅ hook |
| UR-HAM-005 | Migrate awards | `Award` + `AwardType` models cover migration shape | ✅ data model |

## CDM / MOI

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-CDM-001 | Provision of CDM messages | Indicator endpoint `GET /cdm/staff/:id/summary` + Bring-Up engine for follow-up | ✅ |
| UR-CDM-002 | Case summary on staff | Per-staff `CaseSummary` (totals, byKind, restrictedCount) | ✅ |
| UR-CDM-003 | Maintain CDM records | `CdmCase` + `CdmCaseNote` CRUD, classification-gated reads & note writes | ✅ |
| UR-CDM-004 | Reports | Data-scoped list with kind/status filters; export hook | ✅ hook |
| UR-MOI-001 | Indicator on warning/disciplinary | Counted in `CaseSummary.byKind` | ✅ |
| UR-MOI-003 | Generate report/form/memo | Export hook | ✅ hook |
| UR-MOI-004 | Injury leave maintenance | `kind = injury` case + notes | ✅ |
| UR-MOI-005 | Interdiction info | `kind = interdiction` case | ✅ |
| UR-MOI-006/007 | Leave-reserve / leave info enquiry | Cross-link to LVE balances | 🧭 hook |
| UR-MOI-008 | Bankruptcy / police / ICAC / imprisonment | `kind = bankruptcy` / `police` / `court` cases | ✅ |
| UR-MOI-009 | Integrity record | `kind = integrity` case | ✅ |

## EXM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-EXM-001 | Upload staff interview info | `interviewNotes` on `ExitRecord` (Word/Excel upload reuses import pattern) | ✅ data model |
| UR-EXM-002 | Delflag maintenance | Daily batch: pending → applied, sets `staff.status = delflag`, closes open appointment | ✅ |
| UR-EXM-003 | Letters/reports/memos | Export hook | ✅ hook |
| UR-EXM-004 | Planning report on promotion | `GET /exm/forecast?windowDays` joins upcoming exits with current rank/unit | ✅ |

## HBM

| CSD ref | Requirement | Feature | Status |
|---|---|---|---|
| UR-HBM-001 | Batch upload for public housing application | Excel import (reuse PIM import framework) | 🧭 hook |
| UR-HBM-002 | Generate memo form & letter | Export service hook | ✅ hook |
| UR-HBM-003 | Generate invoice & reminder | `POST /hbm/invoices/generate` builds per-staff `BenefitInvoice` (upsert per period); overdue derived from `dueDate` | ✅ |
| UR-HBM-004 | Maintain benefit entitlement | `BenefitType` catalog + effective-dated `BenefitEnrolment` | ✅ |
| UR-HBM-005 | Enquire benefits / quarters | `GET /hbm/enrolments?staffId` with quarter info in `params` | ✅ |
| UR-HBM-006 | Maintain housing benefits | Enrol, terminate, override monthly amount | ✅ |
| UR-HBM-007 | Monthly statistics | `GET /hbm/stats?period` with category-aggregated enrolments + invoiced totals | ✅ |
| UR-HBM-008 | Monthly cessation report on furniture allowance | `BenefitStats.cessationsThisMonth` per period | ✅ |

## REC (market add-on)

| Capability | Feature |
|---|---|
| Job openings & vacancies | `JobOpening` (draft/open/on_hold/closed) + applicant counts |
| Candidate database | `Candidate` (unique email) + source tracking |
| Application pipeline | 7-stage Kanban (applied → screened → interview → offer → hired / rejected / withdrawn) with `moveStage` and rejection reasons |
| Interview scheduling & feedback | `Interview` + `recordFeedback` (score + notes) |
| Offers | `Offer` lifecycle (pending → accepted/declined) auto-advances application stage |
| **Hire → onboarding** | `POST /rec/hire` creates a PIM `Staff`, opens a substantive `StaffAppointment`, fills the target post, optionally provisions an `AppUser` for ESS/SSO |

## Added requirements (client, post-baseline)

| Req | Requirement | Feature | Status |
|---|---|---|---|
| ADD-001 | System must handle payroll | `pay` configurable engine: formula components, locale tax packs, pay runs, dual-control approval, payslips, bank/GL export | ✅ scaffolded — [07-PAYROLL.md](07-PAYROLL.md) |
| ADD-002 | System must support a mobile application | Installable, per-tenant-branded **PWA** on shared API (offline shell, push, responsive); native client on roadmap | ✅ enabled — [08-MOBILE-PWA.md](08-MOBILE-PWA.md) |

## Generalised modules (spec'd, roadmap)

HBM→Benefits, PEM→Performance, CDM/MOI→Employee Relations & Case Mgmt,
HAM→Recognition, TRM→Learning, POM→Job Change/Assignment, EXM→Offboarding —
each retains its CSD requirement IDs in the module spec and follows the
flagship build pattern. Common patterns already built and reused by all:
import+exception-report, effective-dating, Bring-Up, report/export,
audit, RBAC, bilingual code tables.
