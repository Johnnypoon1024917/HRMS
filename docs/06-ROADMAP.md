# 06 — Roadmap

## Done (this iteration)

1. Architecture & design docs.
2. Platform foundation: tenancy (schema-per-tenant), auth/RBAC, audit,
   effective-dating, config/branding, Bring-Up & retention engines.
3. Shared `contracts` package (theming + module registry + DTOs).
4. Flagship **PIM** — end to end (API + Next.js screens).
5. Flagship **ESM/ORM** — end to end (API + Next.js screens).
6. Configurable theming + Config Studio (branding) + bilingual scaffolding.
7. **Payroll** engine (`pay`) scaffolded end-to-end (new requirement) —
   see [07-PAYROLL.md](07-PAYROLL.md).
8. **Mobile PWA** enabled (new requirement): web manifest, service worker,
   install prompt, responsive shell — see [08-MOBILE-PWA.md](08-MOBILE-PWA.md).
9. **Leave & Attendance** (`lve`) built: configurable leave types, balances
   (quota/taken/pending/ledger), self-service requests with quota + working-day
   validation, manager approvals (data-scoped, no self-approval).
10. Gap-fill: every manifest nav route now has a screen (PIM import, ESM
    posts/requests/strength, Pay components, Admin modules/audit) and the
    audit log + ESM posts/strength read APIs are live.
11. **ESS** (`ess`) built: employee my-profile (masked PII, appointment
    history, leave summary) + manager team view (data-scoped, on-leave &
    pending-approval indicators).
12. **SSO** built: OIDC with PKCE, per-tenant IdP config (env fallback),
    JIT user provisioning/linking, SPA callback; SAML/LDAP slots remain.
13. **POM** (`pom`) built: posting actions (transfer/acting/promotion/
    reversion) applied by a daily batch that **supersedes** effective-dated
    appointments (full career history kept), acting tracking with
    ending-soon flags, and transfer vacancy auto-matching.
14. **PEM** (`pem`) built: configurable appraisal cycles (rating scale +
    sections), "call appraisals" generation, employee self-assessment →
    appraiser assessment (no self-appraisal) → finalise workflow, and
    rating-distribution analytics.
15. **TRM** (`trm`) built: course catalog, sessions, call-list nomination
    with capacity & dedup, completions that auto-schedule a Bring-Up for
    certificate renewal, training calendar, my-training self-service.
16. **HAM** (`ham`) built: configurable award types
    (medal/travel/LSI/recognition), grants, and an **LSI candidates**
    endpoint that derives years-of-service from appointment history and
    filters to staff not yet awarded the matching LSI.
17. **CDM/MOI** (`cdm`) built: case management across 9 kinds (warning,
    disciplinary, complaint, integrity, injury, interdiction, bankruptcy,
    court, police), classification-gated content (restricted summary +
    notes hidden unless `cdm.read.restricted`), per-staff `CaseSummary`
    indicator, data-scoped list, append-only notes.
18. **EXM** (`exm`) built: exit records (10 reasons), daily batch that
    auto-sets `staff.status = delflag` + closes the open appointment, and
    a promotion-planning **exit forecast** joining upcoming exits with
    current rank/unit.
19. **HBM** (`hbm`) built: 6 benefit categories, effective-dated enrolments
    with per-staff overrides, **monthly invoice generation** for chargeable
    benefits (upsert per `staff×period`, due-date tracking, mark-paid), and
    a statistics + **cessation report** per period (covers UR-HBM-007/008).
20. **REC** (`rec`) built: job openings, candidate db, 7-stage application
    pipeline (Kanban) with rejection reasons, interview scheduling +
    feedback, offer lifecycle, and a **hire flow** that provisions the PIM
    `Staff` + substantive `StaffAppointment`, fills the post, and
    optionally creates an `AppUser` for ESS/SSO.
21. **Billing — Scope C (`bil`)** built: Stripe Billing adapter (hosted
    Checkout + Customer Portal, dry-run when unconfigured), signature-
    verified webhook that syncs `Subscription` and flips
    `tenant_module.enabled` to the plan's modules, suspend middleware
    (HTTP 402 → `/suspended`), metered seat reporting, **RS256 license
    keys** for on-prem entitlement verified at boot — same enforcement as
    SaaS. See [09-PAYMENT-STATUS.md](09-PAYMENT-STATUS.md).
22. **Docker** packaging: `api` + `web` Dockerfiles, compose
    `init`/`api`/`web` services, Next.js standalone output, README
    quick-starts.

## Module build pattern (repeat for each)

```
1. contracts/src/dto/<key>.ts        # DTOs + zod schema
2. api/src/modules/<key>/            # prisma models, service, controller, manifest
3. web/src/app/<key>/                # MUI list + detail + forms
4. add permissions + nav to manifest # auto-wires RBAC + sidebar
5. seed code tables (bilingual)      # api/prisma/seed
6. e2e + response-time assertion
```

Effort is small per module because import/export, effective-dating,
Bring-Up, audit, RBAC and theming are already provided by the platform.

## Suggested delivery sequence

| Phase | Modules | Rationale |
|---|---|---|
| P1 (done) | Platform, PIM, ESM/ORM | System of record + structure first |
| P2 | ~~LVE (leave)~~ ✅ · ~~ESS (self-service)~~ ✅ · ~~SSO~~ ✅ | Highest daily-active value; market table-stakes — **complete** |
| P3 | ~~POM (job change)~~ ✅ · ~~PEM (performance)~~ ✅ | Builds on PIM appointments — **complete** |
| P4 | ~~TRM (learning)~~ ✅ · ~~HAM (recognition)~~ ✅ | Engagement — **complete** |
| P5 | ~~CDM/MOI (employee relations)~~ ✅ · ~~EXM (offboarding)~~ ✅ | Sensitive — RBAC + classification carry the gating — **complete** |
| P6 | ~~HBM (benefits)~~ ✅ · ~~REC (ATS)~~ ✅ | Revenue add-ons — **complete (all roadmap phases done)** |

> Payroll (`pay`) is now built (P1, new requirement). Remaining payroll work
> = locale statutory packs + bank-file format adapters (hardening backlog).

## Hardening backlog (pre-GA)

- ~~OIDC IdP adapter~~ ✅ done. SAML/LDAP adapters (slots exist); SSO logout
  / back-channel logout; refresh-token rotation.
- Backup/DR runbooks + automated per-schema dump.
- Load test to REQ-SEC-005 budget; autoscale tuning.
- Penetration test; field-level encryption key rotation.
- License-key service for on-prem module entitlement.
- Payroll: per-country statutory packs, bank-file format adapters (ISO 20022 +
  local), GL connector library, payslip PDF templates.
- Mobile: native React Native/Expo client (biometrics, camera, geofenced
  clock-in, offline write queue); push VAPID key management.
- Tenant onboarding automation (schema create + migrate + seed).
- Accessibility (WCAG 2.1 AA) audit of MUI theme.
