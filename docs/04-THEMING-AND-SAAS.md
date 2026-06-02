# 04 — Theming, White-Label & SaaS Packaging

## Branding config model

Per-tenant branding is **data** (`public.tenant_branding.branding` jsonb),
typed by `TenantBranding` in `packages/contracts/src/theme.ts`. The web app
fetches it at boot and feeds it to the MUI `ThemeProvider`. No rebuild to
re-skin a tenant.

```jsonc
{
  "appName": "Acme People",
  "logoUrl": "/brand/acme/logo.svg",
  "faviconUrl": "/brand/acme/favicon.ico",
  "colorTone": {                 // Google/Material-3 tonal input
    "primary":  "#1a73e8",       // Google blue by default
    "secondary":"#5f6368",
    "mode": "light",             // light | dark | system
    "radius": 12,                // shape roundness (px)
    "density": "comfortable"     // comfortable | compact
  },
  "typography": { "fontFamily": "Roboto, system-ui, sans-serif" },
  "icons": { "set": "material-symbols", "overrides": { "pim": "badge" } },
  "loginBackgroundUrl": "/brand/acme/login.jpg",
  "supportEmail": "hr@acme.com",
  "locales": ["en", "zh-Hant"],
  "defaultLocale": "en"
}
```

What is configurable without code:

- App name, logo, favicon, login background, support contact.
- **Colour tone** — primary/secondary seed colours; Material-3 tonal palette
  is generated from the seed, so the whole UI re-tones from two hex values.
- Light / dark / follow-system; corner radius; density (comfortable/compact).
- Typography (font family/scale).
- **Icon set & per-module icon overrides** (Material Symbols default).
- Enabled modules & feature flags (`tenant_module.settings`).
- Code tables / dropdown values, document templates, locale set.

The "Google tone" default = Google blue `#1a73e8`, Roboto, generous spacing,
elevation-light surfaces, Material 3 components.

### Config Studio

An admin UI (`/admin/branding`, gated by `config.write`) edits this JSON with
live preview. Changes are versioned and audited. On-prem ships the same Studio
so the customer can self-brand.

## Multi-tenancy rationale

| Option | Isolation | Cost | Chosen |
|---|---|---|---|
| Shared schema (tenant_id) | app-level only | lowest | ✗ |
| **Schema-per-tenant** | strong (DB schema) | medium | ✅ |
| DB-per-tenant | strongest | highest ops | dedicated/on-prem variant |

Schema-per-tenant gives near-DB isolation (important for HR PII and the CSD
"Restricted" classification) while keeping one app and one Postgres instance
for SaaS economics. On-prem collapses to a single schema with the *same code*.
Premium/government clients can opt into **DB-per-tenant** by pointing their
tenant row at a dedicated connection string — no code change.

## SaaS vs on-prem from one codebase

| Aspect | SaaS | On-prem |
|---|---|---|
| Tenant resolution | sub-domain → schema | `SINGLE_TENANT` env, pinned |
| Identity | platform login / social / tenant OIDC | customer SAML/OIDC/LDAP |
| Branding | Config Studio per tenant | Config Studio (single tenant) |
| Updates | operator rolls out | versioned release + migration script |
| Licensing | subscription (modules = entitlements) | offline signed license key gating modules |
| Data | shared Postgres, isolated schema | customer-owned Postgres |
| Backups | operator PITR | customer DBA + provided runbook |

Module entitlement is enforced identically in both modes via
`tenant_module.enabled`; the only difference is the *source of truth*
(subscription record vs license key).

## Why this satisfies the brief

- "*sell as SaaS like Odoo or deliver on-prem*" → one image, deployment-config
  switch; module entitlements like Odoo apps.
- "*all functions modular*" → module manifest + per-tenant toggles.
- "*configurable e.g. icon, colour tone*" → `TenantBranding` jsonb + Config
  Studio, zero redeploy.
- "*UI similar to Google tone*" → Material 3 + Google-blue default seed.
