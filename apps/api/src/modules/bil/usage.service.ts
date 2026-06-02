import { Injectable, Logger } from '@nestjs/common';
import { RegistryPrismaService } from '../../common/prisma/registry-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { tenantStore } from '../../common/tenancy/tenant-context';
import { StripeAdapter } from './stripe.adapter';

/**
 * Active-seat counter used as the metered usage signal sent to the billing
 * provider. Per-tenant, run on a schedule (BullMQ wiring in hardening
 * backlog) or on demand from the operator UI.
 */
@Injectable()
export class UsageService {
  private readonly log = new Logger(UsageService.name);

  constructor(
    private readonly registry: RegistryPrismaService,
    private readonly tp: TenantPrismaService,
    private readonly stripe: StripeAdapter,
  ) {}

  /** Count the tenant's currently active staff (the billable seat metric). */
  async activeSeats(tenantId: string): Promise<number> {
    const tenant = await this.registry.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return 0;
    return tenantStore.run(
      { tenantId, slug: tenant.slug, dbSchema: tenant.dbSchema, dbUrl: tenant.dbUrl },
      () => this.tp.forCurrentTenant().staff.count({ where: { status: 'active' } }),
    );
  }

  /** Record an event + report to Stripe metered item if configured. */
  async reportSeats(tenantId: string) {
    const seats = await this.activeSeats(tenantId);
    const ev = await this.registry.usageEvent.create({
      data: { tenantId, metric: 'active_staff', value: seats },
    });
    // If the tenant's plan has a metered Stripe price, post the usage.
    const sub = await this.registry.subscription.findUnique({
      where: { tenantId }, include: { plan: true },
    });
    if (sub?.plan.stripeMeteredPriceId && sub.stripeSubscriptionId) {
      // The subscription_item id mapping is resolved on demand from Stripe in
      // a richer impl; the dry-run adapter swallows this no-op.
      try {
        await this.stripe.reportUsage(sub.plan.stripeMeteredPriceId, seats);
        await this.registry.usageEvent.update({
          where: { id: ev.id }, data: { reportedAt: new Date() },
        });
      } catch (e) {
        this.log.warn(`Usage report failed for tenant ${tenantId}: ${String(e)}`);
      }
    }
    return { seats };
  }

  /** Operator one-shot: report seats for every active tenant. */
  async reportAll() {
    const tenants = await this.registry.tenant.findMany({
      where: { status: { not: 'suspended' } },
    });
    const results: Record<string, number> = {};
    for (const t of tenants) {
      results[t.slug] = (await this.reportSeats(t.id)).seats;
    }
    return results;
  }
}
