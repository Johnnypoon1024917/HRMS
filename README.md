# People HRMS — Modular, White-Label HRMS Platform

A market-benchmarked Human Resources Management System designed to be sold as
**multi-tenant SaaS** (Odoo-style) **or deployed on-premise** from a single codebase.

- **Modular** — every functional area is an independently togglable module.
- **Configurable** — per-tenant branding (logo, colour tone, icons, typography),
  feature flags, code tables, and workflow options without code changes.
- **Google-tone UI** — Material Design 3 look & feel, clean and information-dense.
- **Benchmarked** — feature scope mapped against Odoo HR, BambooHR, Workday, SAP
  SuccessFactors, plus the full CSD HRMS government requirements set.

## Repository layout

```
HRMS/
├── docs/                 # Architecture & design (start here → docs/00-OVERVIEW.md)
├── packages/
│   └── contracts/        # Shared TS types: theming config, module registry, DTOs
├── apps/
│   ├── api/              # NestJS backend — modular, schema-per-tenant Postgres
│   └── web/              # Next.js + MUI frontend — configurable theming
├── docker-compose.yml    # Local Postgres
└── package.json          # npm workspaces
```

## What is built in this iteration

Per the agreed scope — **architecture + platform foundation + 2 flagship modules**:

| Layer | Status |
|---|---|
| Architecture & design docs | ✅ `docs/` |
| Multi-tenant foundation (schema-per-tenant) | ✅ `apps/api/src/common/tenancy` |
| RBAC (functional + data scope, multi-post) | ✅ `apps/api/src/common/rbac` |
| Audit logging | ✅ `apps/api/src/common/audit` |
| SSO — OIDC (PKCE, per-tenant IdP, JIT provisioning) | ✅ `apps/api/src/common/auth` |
| Effective-dated records | ✅ `apps/api/src/common/effective-dating` |
| Configurable theming / white-label | ✅ `packages/contracts` + `apps/web/src/theme` |
| **PIM** — Personnel Information Management (flagship) | ✅ end-to-end |
| **ESM/ORM** — Establishment, Strength & Org (flagship) | ✅ end-to-end |
| **Payroll** — configurable engine (new requirement) | ✅ scaffolded — `docs/07-PAYROLL.md` |
| **Mobile** — installable per-tenant PWA (new requirement) | ✅ enabled — `docs/08-MOBILE-PWA.md` |
| **LVE** — Leave & Attendance (self-service + approvals) | ✅ end-to-end |
| **ESS** — Employee/Manager Self-Service | ✅ end-to-end |
| **POM** — Posting / Job Change & Career History | ✅ end-to-end |
| **PEM** — Performance Management (appraisal cycles) | ✅ end-to-end |
| **TRM** — Training & Learning (LMS-lite) | ✅ end-to-end |
| **HAM** — Honours & Awards / Recognition (incl. LSI) | ✅ end-to-end |
| **CDM/MOI** — Conduct & Discipline + Matter-of-Importance (Case Mgmt) | ✅ end-to-end |
| **EXM** — Exit / Offboarding (delflag batch + forecast) | ✅ end-to-end |
| **HBM** — Benefits (housing/medical/…) + invoice generation | ✅ end-to-end |
| **REC** — Recruitment / ATS (pipeline + hire → PIM) | ✅ end-to-end |
| **Billing** — Stripe Checkout/Portal + webhook entitlement + on-prem license keys (Scope C) | ✅ end-to-end (Scope B + A pending) |
| **Docker** packaging | ✅ `apps/api` + `apps/web` Dockerfiles + compose `init`/`api`/`web` |
| Admin — module entitlement + audit log viewers | ✅ |
| Remaining modules | 🧭 specified in `docs/02-MODULES.md`, scaffold pattern set |

## Quick start (local Node)

```powershell
docker compose up -d db redis             # just the datastores
npm install                               # install workspaces
npm run db:setup --workspace apps/api     # migrate + seed demo tenant
npm run dev                               # api :4000, web :5000
```

## Quick start (all-in-Docker)

```powershell
docker compose up -d --build              # builds + starts db, redis, init, api, web
docker compose logs -f api web            # tail
```

`init` is a one-shot service that runs the registry schema + tenant seed,
then exits. The `api` service waits on `init: service_completed_successfully`,
and `web` waits on `api: service_healthy` — so a single `up -d` brings the
whole stack up in the right order. Seed is idempotent; safe to re-run.

To stop and wipe the database:

```powershell
docker compose down -v
```

Demo tenant: `acme` — open <http://localhost:5000>, log in `admin@acme.test` /
`Passw0rd!`. (In dev the tenant is resolved from the `NEXT_PUBLIC_TENANT`
env var because there's no sub-domain; production uses `acme.app.com`.)

For on-prem: set `DEPLOYMENT_MODE=onprem` and `SINGLE_TENANT=<slug>` on the
`api` service; the rest of the stack is unchanged.

See [docs/00-OVERVIEW.md](docs/00-OVERVIEW.md) for the full picture, and
[docs/09-PAYMENT-STATUS.md](docs/09-PAYMENT-STATUS.md) for what is and is
not built around payment.
