# 08 — Mobile (PWA)

> **New requirement.** The system must support a mobile application. Decision:
> deliver mobile as an **installable PWA on the shared API** (one codebase,
> reuses white-label theming), with a native React Native client kept on the
> roadmap for later.

## Why PWA first

- One codebase (the existing Next.js app) → no separate mobile team/build.
- Inherits per-tenant **white-label theming** automatically — the installed
  app is branded per tenant (name, icon, colour tone).
- Installable (Add to Home Screen), offline shell, push notifications — enough
  for the high-frequency mobile use-cases: **Employee/Manager Self-Service,
  leave/approvals, payslip view, org/people lookup, Bring-Up alerts**.
- Same auth, RBAC, audit, tenancy — nothing new server-side.

## What was added

| Item | File |
|---|---|
| Web app manifest (per-tenant name/icon/colour injected) | `apps/web/public/manifest.webmanifest` + dynamic route |
| Service worker (app-shell + offline + push handler) | `apps/web/public/sw.js` |
| SW registration + install prompt | `apps/web/src/lib/pwa.ts` |
| Mobile meta + manifest link | `apps/web/src/app/layout.tsx` |
| Responsive shell (drawer collapses on small screens) | `apps/web/src/components/AppShell.tsx` |

The manifest's `name`, `theme_color` and icons are driven by the same
`TenantBranding` config, so each tenant's installed PWA is its own branded
app — consistent with the SaaS white-label model.

## Mobile UX scope (phase)

- **Now (PWA)**: responsive layouts, install, offline read of cached
  screens, push for Bring-Up/approvals, self-service (profile, leave request,
  payslip), people/org lookup.
- **Roadmap (native, React Native/Expo on the same API)**: biometric login,
  camera document capture, geofenced attendance/clock-in, offline write
  queue. Tracked in [06-ROADMAP.md](06-ROADMAP.md).

## Notes

- Service worker uses a conservative cache strategy: network-first for `/api`,
  cache-first for static shell — payroll/PII responses are **not** persisted
  offline (security).
- Push requires VAPID keys per environment (backlog; handler is wired).
