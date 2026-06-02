# 01 — Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + MUI (Material 3), **PWA** | Google-tone UI; runtime-themable; installable per-tenant-branded mobile app on the same codebase |
| Backend | NestJS (TypeScript) | First-class modules, DI, interceptors/guards for cross-cutting concerns |
| ORM/DB | Prisma + PostgreSQL | Strong typing; schema-per-tenant supported via dynamic connections |
| Auth | JWT + **OIDC SSO** (PKCE, JIT provisioning); SAML/LDAP slots | SaaS password login *or* tenant/on-prem SSO (CSD "DPP" requirement) — built |
| Shared | `packages/contracts` | One source of truth for DTOs & theming config across web/api |
| Jobs | BullMQ (Redis) | Batch "Bring-Up" notifications, snapshots, retention purge, **payroll runs** |
| Payroll | In-house configurable engine (`pay` module) | Formula-driven components, locale statutory packs, dual-control, bank/GL export |
| Mobile | Installable PWA (service worker + web manifest) | One codebase; per-tenant branded; offline shell + push |

## High-level diagram

```
                 ┌───────────────────────────────────────────┐
   Browser  ───▶  │ Next.js (web)                              │
                 │  ThemeProvider ← /api/tenant/branding      │
                 │  Module routes (lazy, gated by feature flag)│
                 └──────────────┬────────────────────────────┘
                                │ REST/JSON (Bearer JWT, X-Tenant)
                 ┌──────────────▼────────────────────────────┐
                 │ NestJS (api)                               │
                 │  ┌─────────────── Platform core ─────────┐ │
                 │  │ Tenancy │ Auth │ RBAC │ Audit │ Config│ │
                 │  └───────────────────────────────────────┘ │
                 │  ┌──── Feature modules (pluggable) ───────┐ │
                 │  │ PIM │ ESM/ORM │ HBM │ PEM │ TRM │ ...   │ │
                 │  └───────────────────────────────────────┘ │
                 └──────────────┬───────────────┬────────────┘
                                │               │
                     ┌──────────▼───┐   ┌───────▼────────┐
                     │ PostgreSQL    │   │ Redis (jobs)   │
                     │ public schema │   │                │
                     │ tenant_acme   │   └────────────────┘
                     │ tenant_globex │
                     └───────────────┘
```

## Multi-tenancy — shared DB, schema-per-tenant

Chosen for the best isolation/cost balance and clean white-labeling.

- **`public` schema** — global registry: `tenants`, `tenant_modules`,
  `tenant_branding`, platform admins.
- **`tenant_<slug>` schema** — all HR data for one customer. Identical table
  layout per tenant (migrations applied to every schema).
- **Tenant resolution** — `TenantMiddleware` resolves the tenant from the
  sub-domain (`acme.app.com`) in SaaS, or from a fixed env var
  (`SINGLE_TENANT=acme`) on-prem.
- **Connection routing** — `TenantPrismaService` keeps a small LRU of Prisma
  clients, one per tenant schema (`?schema=tenant_acme`), created on demand.
- **On-prem = one tenant.** Same code path; the registry simply has a single
  row and tenant resolution is pinned. No fork.

Trade-off vs alternatives is documented in
[04-THEMING-AND-SAAS.md](04-THEMING-AND-SAAS.md#multi-tenancy-rationale).

## Cross-cutting platform services

| Concern | Implementation | CSD requirement satisfied |
|---|---|---|
| Tenancy | `common/tenancy` middleware + per-schema Prisma | on-prem isolation |
| AuthN | `common/auth` JWT + OIDC (PKCE, per-tenant IdP, JIT user provisioning); SAML/LDAP slots | REQ-SEC-002 (DPP SSO) — built |
| AuthZ | `common/rbac` — permission = `module.action`; **data scope** by unit/post; **multi-post** active-post switching | REQ-SEC-002, UR-GEN-004 |
| Audit | `common/audit` interceptor → `audit_log` (who/what/when/before/after) | REQ-SEC-001 |
| Effective-dating | `common/effective-dating` base entity + query helpers | UR-GEN-001 (effective dates) |
| Bring-Up (tickler) | `common/bring-up` + BullMQ scheduler | UR-GEN-002 |
| Config/code tables | `common/config` service; code tables per tenant | UR-GEN-001 dropdowns |
| i18n | i18n keys; EN + zh-Hant seed | UR-GEN-001 bilingual |
| Import/Export | `common/io` Excel/Word/PDF helpers, exception report | many UR `Upload`/`Generate` reqs |
| Retention | `common/retention` purge job (3y online / 7y archive) | REQ-SEC-007 |

## Module contract

Every feature module exports a `ModuleManifest` (see
`packages/contracts/src/modules.ts`):

```ts
{ key: 'pim', name: 'Personnel Information', icon: 'badge',
  permissions: ['pim.read','pim.write', ...],
  nav: [{ path:'/pim/staff', labelKey:'pim.nav.staff', perm:'pim.read' }],
  dependsOn: ['esm'] }
```

The platform reads manifests to: build the nav, register RBAC permissions,
and enforce per-tenant on/off via `tenant_modules`. A disabled module's API
routes return 404 and its nav entries never render.

## SSO (OIDC) flow

1. `GET /api/auth/oidc/login` — resolves the tenant's IdP config
   (`registry tenant.idp`, else env fallback), generates PKCE
   verifier+state, stores them in a short-lived **signed HttpOnly cookie**,
   sets a `tenant_hint` cookie (so the callback can resolve the tenant
   without an `X-Tenant` header), redirects to the IdP.
2. IdP authenticates the user and redirects to
   `GET /api/auth/oidc/callback`.
3. Callback validates the signed tx cookie, exchanges the code (PKCE),
   reads userinfo, then **JIT-provisions / links** an `AppUser` by
   `idpSubject` (falls back to email match), issues the platform JWT, and
   redirects to the SPA `/auth/callback#token=…`.
4. SPA stores the token and continues — identical session model as
   password login (RBAC, multi-post, audit unchanged).

SAML/LDAP adapters slot in behind the same controller by implementing the
same `{sub,email,name}` claim shape. Per-tenant IdP config means SaaS can
offer a shared IdP while each enterprise/on-prem tenant points at its own —
no code change, satisfying CSD REQ-SEC-002 ("DPP single sign-on").

## Deployment topologies

| Topology | Tenancy | IdP | Notes |
|---|---|---|---|
| **SaaS multi-tenant** | sub-domain → schema | platform password / social / tenant OIDC | autoscale web+api; shared Postgres+Redis |
| **SaaS dedicated** | one tenant, dedicated DB | tenant OIDC/SAML | same image, isolated infra for premium clients |
| **On-prem** | `SINGLE_TENANT` pinned | customer SSO (SAML/OIDC/LDAP) | docker-compose / k8s in customer network; offline license key |

## Non-functional posture

- **Performance** (REQ-SEC-005): server pagination, indexed effective-date
  queries, response-time budget asserted in e2e.
- **Availability** (REQ-SEC-006): stateless api, horizontal scale, health/readiness probes.
- **Backup/DR** (REQ-SEC-003/004): logical + PITR backups; per-schema dump for on-prem.
- **Security**: TLS everywhere, encrypted secrets, column encryption for
  sensitive PII, full audit, least-privilege RBAC, data classification flag
  on fields (mirrors CSD "Restricted").
