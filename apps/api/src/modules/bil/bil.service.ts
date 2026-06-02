import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  LicenseClaims,
  PlanUpsert,
  PlanView,
  SubscriptionView,
} from '@hrms/contracts';

// Loose typing for Stripe payloads — the adapter wraps the SDK, the service
// treats Stripe types as opaque so it compiles cleanly across SDK versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeEvent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeSubscription = any;
import { RegistryPrismaService } from '../../common/prisma/registry-prisma.service';
import { currentTenant } from '../../common/tenancy/tenant-context';
import { AuditService } from '../../common/audit/audit.service';
import { StripeAdapter } from './stripe.adapter';
import { LicenseService } from './license.service';
import { UsageService } from './usage.service';
import { ALL_MANIFESTS } from '../../common/config/module-registry';

@Injectable()
export class BilService implements OnApplicationBootstrap {
  private readonly log = new Logger(BilService.name);

  /**
   * On-prem entitlement check at startup: if `DEPLOYMENT_MODE=onprem` and a
   * `LICENSE_KEY` JWT is set in env, verify it and sync the tenant's enabled
   * modules to what the license permits. Mirrors what the Stripe webhook
   * does for SaaS.
   */
  async onApplicationBootstrap() {
    if (process.env.DEPLOYMENT_MODE !== 'onprem') return;
    const token = process.env.LICENSE_KEY;
    const slug = process.env.SINGLE_TENANT;
    if (!token || !slug) {
      this.log.warn('On-prem mode but LICENSE_KEY/SINGLE_TENANT missing — running unlicensed (dev only).');
      return;
    }
    try {
      const claims = this.license.verify(token);
      if (claims.tenantSlug !== slug) {
        throw new Error(`License tenantSlug (${claims.tenantSlug}) != SINGLE_TENANT (${slug})`);
      }
      if (new Date(claims.expiresAt).getTime() < Date.now()) {
        throw new Error('License expired');
      }
      const tenant = await this.registry.tenant.findUnique({ where: { slug } });
      if (!tenant) {
        this.log.warn(`License valid but tenant ${slug} not yet provisioned`);
        return;
      }
      const included = new Set(claims.modules);
      for (const m of ALL_MANIFESTS) {
        if (m.core) continue;
        await this.registry.tenantModule.upsert({
          where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: m.key } },
          create: { tenantId: tenant.id, moduleKey: m.key, enabled: included.has(m.key) },
          update: { enabled: included.has(m.key) },
        });
      }
      this.log.log(`On-prem license OK — ${claims.modules.length} module(s) entitled; expires ${claims.expiresAt}`);
    } catch (e) {
      this.log.error(`On-prem license INVALID — entitlement not applied: ${String(e)}`);
    }
  }

  constructor(
    private readonly registry: RegistryPrismaService,
    private readonly stripe: StripeAdapter,
    private readonly license: LicenseService,
    private readonly usage: UsageService,
    private readonly audit: AuditService,
  ) {}

  // ---- plans (operator) ----
  async listPlans(): Promise<PlanView[]> {
    const rows = await this.registry.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
    return rows.map((p) => ({
      code: p.code,
      name: p.name,
      monthlyPrice: p.monthlyPrice,
      currency: p.currency,
      includedModules: p.includedModules,
      maxSeats: p.maxSeats,
      active: p.active,
    }));
  }

  async upsertPlan(input: PlanUpsert, userId: string) {
    const saved = await this.registry.plan.upsert({
      where: { code: input.code }, create: input, update: input,
    });
    await this.audit.record({
      userId, action: 'update', entity: 'plan', entityId: saved.code, after: saved,
    });
    return saved;
  }

  // ---- subscription (tenant-admin) ----
  async getSubscription(): Promise<SubscriptionView> {
    const { tenantId, slug } = currentTenant();
    const sub = await this.registry.subscription.findUnique({
      where: { tenantId }, include: { plan: true },
    });
    const seats = await this.usage.activeSeats(tenantId);
    return {
      tenantId,
      tenantSlug: slug,
      planCode: sub?.planCode,
      planName: sub?.plan.name,
      status: (sub?.status as any) ?? 'none',
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString(),
      trialEndsAt: sub?.trialEndsAt?.toISOString(),
      activeStaff: seats,
      maxSeats: sub?.plan.maxSeats ?? 0,
    };
  }

  async checkoutSession(planCode: string, successUrl: string, cancelUrl: string) {
    const { tenantId, slug } = currentTenant();
    const tenant = await this.registry.tenant.findUnique({ where: { id: tenantId } });
    const plan = await this.registry.plan.findUnique({ where: { code: planCode } });
    if (!tenant || !plan?.active) throw new NotFoundException('Plan or tenant');
    if (this.stripe.enabled() && !plan.stripePriceId) {
      throw new BadRequestException('Plan has no stripePriceId configured');
    }
    const customerId = await this.stripe.ensureCustomer({
      existingId: tenant.stripeCustomerId,
      name: tenant.name,
      tenantId,
    });
    if (!tenant.stripeCustomerId) {
      await this.registry.tenant.update({
        where: { id: tenantId }, data: { stripeCustomerId: customerId },
      });
    }
    return this.stripe.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId ?? `dryrun_price_${plan.code}`,
      meteredPriceId: plan.stripeMeteredPriceId ?? undefined,
      successUrl,
      cancelUrl,
      trialDays: 14,
      tenantId,
    });
  }

  async portalSession(returnUrl: string) {
    const { tenantId } = currentTenant();
    const tenant = await this.registry.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.stripeCustomerId) {
      throw new BadRequestException('No billing customer yet — start a subscription first');
    }
    return this.stripe.createPortalSession(tenant.stripeCustomerId, returnUrl);
  }

  // ---- webhook ----
  async handleWebhook(rawBody: Buffer, signature: string) {
    const event = this.stripe.verifyWebhook(rawBody, signature);
    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscriptionFromEvent(event);
        break;
      default:
        this.log.debug(`Ignoring Stripe event ${event.type}`);
    }
    return { received: true, type: event.type };
  }

  private async syncSubscriptionFromEvent(event: StripeEvent) {
    const obj = event.data.object as any;
    const tenantId: string | undefined =
      obj?.metadata?.tenantId ?? obj?.subscription_data?.metadata?.tenantId;
    if (!tenantId) {
      this.log.warn('Stripe event missing tenantId metadata; skipping');
      return;
    }
    // `customer.subscription.*` events carry the subscription as the object;
    // `checkout.session.completed` references it by id on `obj.subscription`,
    // and we retrieve the full record from Stripe.
    let stripeSub: StripeSubscription | null;
    if (event.type.startsWith('customer.subscription')) {
      stripeSub = obj as StripeSubscription;
    } else if (typeof obj?.subscription === 'string') {
      stripeSub = await this.stripe.retrieveSubscription(obj.subscription);
    } else {
      stripeSub = null;
    }
    if (!stripeSub) return;
    const priceId = stripeSub.items?.data?.[0]?.price?.id;
    const plan = priceId
      ? await this.registry.plan.findFirst({ where: { stripePriceId: priceId } })
      : null;
    const status = stripeSub.status;
    const periodEndUnix = (stripeSub.items?.data?.[0] as any)?.current_period_end ?? null;
    const trialEndUnix = stripeSub.trial_end ?? null;

    await this.registry.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode: plan?.code ?? 'unknown',
        status,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
        trialEndsAt: trialEndUnix ? new Date(trialEndUnix * 1000) : null,
      },
      update: {
        planCode: plan?.code ?? undefined,
        status,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : undefined,
        trialEndsAt: trialEndUnix ? new Date(trialEndUnix * 1000) : undefined,
      },
    });

    // Reflect status onto the tenant: active vs suspended.
    const tenantStatus =
      status === 'active' || status === 'trialing'
        ? 'active'
        : status === 'past_due'
          ? 'past_due'
          : 'suspended';
    await this.registry.tenant.update({
      where: { id: tenantId }, data: { status: tenantStatus },
    });

    // Sync module entitlement to the plan's included modules.
    if (plan) {
      const included = new Set(plan.includedModules);
      for (const m of ALL_MANIFESTS) {
        if (m.core) continue;
        await this.registry.tenantModule.upsert({
          where: { tenantId_moduleKey: { tenantId, moduleKey: m.key } },
          create: { tenantId, moduleKey: m.key, enabled: included.has(m.key) },
          update: { enabled: included.has(m.key) },
        });
      }
    }
  }

  // ---- license keys (operator → on-prem) ----
  async issueLicense(input: {
    tenantId: string;
    months: number;
    modules?: string[];
    maxSeats?: number;
  }, operatorId: string) {
    const tenant = await this.registry.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const sub = await this.registry.subscription.findUnique({
      where: { tenantId: tenant.id }, include: { plan: true },
    });
    const modules = input.modules ?? sub?.plan.includedModules ?? [];
    const maxSeats = input.maxSeats ?? sub?.plan.maxSeats ?? 0;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + input.months);

    const claims: Omit<LicenseClaims, 'issuedAt'> = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      modules,
      maxSeats,
      expiresAt: expiresAt.toISOString(),
    };
    const token = this.license.sign(claims);
    const saved = await this.registry.licenseKey.create({
      data: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        jwt: token,
        modules, maxSeats, expiresAt,
      },
    });
    await this.audit.record({
      userId: operatorId, action: 'create', entity: 'license_key', entityId: saved.id,
      after: { tenantSlug: tenant.slug, expiresAt: expiresAt.toISOString() },
    });
    return { id: saved.id, jwt: token, expiresAt: expiresAt.toISOString() };
  }

  listLicenses() {
    return this.registry.licenseKey.findMany({ orderBy: { issuedAt: 'desc' } });
  }

  async revoke(id: string, operatorId: string) {
    const saved = await this.registry.licenseKey.update({
      where: { id }, data: { revokedAt: new Date() },
    });
    await this.audit.record({
      userId: operatorId, action: 'update', entity: 'license_key', entityId: id,
      after: { revoked: true },
    });
    return saved;
  }
}
