# 09 — Payment: what's built, what isn't

> **Honest status:** the platform computes amounts and tracks invoices, but
> **no money actually moves**. There is no payment-gateway integration, no
> bank-file emission, and no SaaS subscription billing for tenants. This
> document spells out the gap and the recommended build for each scope.

There are three distinct "payment" scopes the product could cover. Pick the
ones that matter to you.

---

## Scope A — Payroll disbursement (employee net pay)

**What's built**

- `pay` module: configurable pay components, formula sandbox, tax/statutory
  rules, pay runs with dual-control approval, payslips with restricted-class
  masking on net amounts.
- `PayExport` Prisma model with `format` (`bank_iso20022 | bank_local |
  gl_journal`) and `fileKey` — **a record that an export happened**.

**What's missing**

- The **format adapters** that actually serialise a pay run into a payable
  file (ISO 20022 pain.001, HK FPS batch, ACH/NACHA, BACS, GL CSV/IIF…).
- Object storage for the generated files (`fileKey` is a placeholder).
- Disbursement status reconciliation (acknowledgements / returns from the
  bank).
- Employee bank-account capture & encryption (currently only ID number is
  encrypted; bank details would join the `restricted` classification).

**Recommended build (1–2 weeks for one country)**

1. Add `staff_bank_account` (encrypted IBAN/account, sort code) — `restricted`.
2. `PayExportService.generateBankFile(payRunId, format)` per locale adapter.
3. Wire object storage (S3-compatible) for `fileKey`.
4. Optional reconciliation endpoint that ingests bank ACK files and flips
   payslip status `paid` / `returned`.

---

## Scope B — In-app invoice collection (HBM and similar)

**What's built**

- `hbm` module: chargeable benefit enrolments, monthly invoice generation
  (`BenefitInvoice` per `staff×period`), due dates, **manual** `mark paid`,
  cessation/statistics reports.

**What's missing**

- **Payment gateway integration** to actually capture money (Stripe / Adyen
  / local rails / payroll deduction).
- Reminder workflow (overdue → email via the Bring-Up engine — engine
  exists, no template/sender wired).
- Refunds, partial payments, payment plans.

**Recommended build (≈1 week for Stripe)**

1. New `payments` core service abstracting a `PaymentProvider` interface
   (methods: `intent`, `capture`, `refund`, `webhook`).
2. Stripe adapter (`@stripe/stripe-node`); credentials per tenant in
   `tenant_branding`-style config or a new `tenant_payment` row.
3. `POST /hbm/invoices/:id/pay` → creates a PaymentIntent, returns the
   `client_secret` for an MUI checkout component on the web side.
4. Webhook `/payments/webhook/stripe` → flips `BenefitInvoice.status` to
   `paid` (idempotent via Stripe event id).
5. Many tenants will prefer **payroll deduction** instead of a card — add a
   `payroll_deduction` provider that simply enqueues a `PayComponentInput`
   on the next payroll run. Reuses everything already built.

---

## Scope C — SaaS subscription billing ✅ BUILT

The `bil` core module is now in the codebase (`apps/api/src/modules/bil/` +
`apps/web/src/app/(app)/{admin/subscription,platform/plans,platform/licenses}/`).

**What ships**

- Registry: `Plan`, `Subscription`, `UsageEvent`, `LicenseKey`, plus
  `Tenant.stripeCustomerId`.
- `StripeAdapter` (Stripe Billing): customer creation, hosted **Checkout**
  with 14-day trial, hosted **Customer Portal**, metered usage. Runs in
  **dry-run** mode when `STRIPE_SECRET_KEY` is blank — flows still work.
- Signature-verified webhook `POST /api/bil/webhook/stripe` (`rawBody`
  enabled in `main.ts`) handles `checkout.session.completed` and
  `customer.subscription.*`. Syncs `Subscription` and **flips
  `tenant_module.enabled` to match the plan's `includedModules`** —
  upgrading/downgrading turns features on/off live.
- `SuspendMiddleware` short-circuits suspended tenants with HTTP **402**;
  web client redirects to `/suspended`. Login, billing self-service,
  webhooks, and the public-branding endpoint stay reachable.
- `UsageService.reportSeats` counts active staff per tenant and posts to
  Stripe metered prices; `POST /bil/usage/report-all` is the manual
  trigger (BullMQ schedule = hardening backlog).
- **License-key service** (RS256 JWT) for on-prem entitlement: operator
  signs `{tenantId, modules[], maxSeats, expiresAt}`, customer drops the
  JWT into `LICENSE_KEY` env. `BilService.onApplicationBootstrap` verifies
  on startup and syncs `tenant_module` to the licensed modules. Same
  enforcement as SaaS — no separate code path.
- Three demo plans seeded (Starter free / Pro $49 / Enterprise $199); Acme
  starts on Enterprise in trial.
- UI: tenant **/admin/subscription** (plan cards, Checkout, Manage-billing
  portal, seat usage bar); operator **/platform/plans** (catalog editor +
  Stripe Price IDs); operator **/platform/licenses** (issue + revoke +
  copy-paste JWT); **/suspended** dead-end for past-due tenants.

**Still needed (operator hardening)**

- Cross-tenant operator console (`/platform/tenants` listing every
  subscription) — current operator views are scoped to the current tenant.
- Automated dunning emails (Bring-Up engine + Stripe
  `invoice.payment_failed` templates).
- Tax handling (toggle Stripe Tax on prices).
- BullMQ schedule for the nightly seat-count job.

---

## My recommendation

If you want to **sell as SaaS like Odoo**, scope C is the priority — it's
the one that turns the product into a revenue engine. Scopes A and B can
ship later per customer demand. The work in this repo (modules, RBAC,
audit, tenancy) is ready for any of the three; what's needed is the
provider integration and the operator UI.

Tell me which scope to build next and I'll add it the same way the other
modules were added.
