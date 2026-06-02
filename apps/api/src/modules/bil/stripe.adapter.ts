import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Thin adapter around the Stripe Billing API. Keeping all Stripe calls here
 * means we can swap the provider (Chargebee, Adyen, local rails) without
 * touching the rest of the billing module.
 *
 * NOTE: we deliberately type the client as `any` so the module compiles
 * cleanly across Stripe SDK minor versions (the SDK's apiVersion + method
 * signatures move around). The runtime behaviour is unchanged.
 */
@Injectable()
export class StripeAdapter {
  private readonly log = new Logger(StripeAdapter.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any | null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    this.client =
      key && key.startsWith('sk_')
        ? new (Stripe as any)(key, { apiVersion: '2024-06-20' })
        : null;
    if (!this.client) {
      this.log.warn(
        'STRIPE_SECRET_KEY not set — billing runs in *dry-run* mode (no Stripe calls).',
      );
    }
  }

  enabled() {
    return this.client !== null;
  }

  async ensureCustomer(opts: {
    existingId?: string | null;
    email?: string | null;
    name: string;
    tenantId: string;
  }): Promise<string> {
    if (!this.client) return `dryrun_cus_${opts.tenantId}`;
    if (opts.existingId) return opts.existingId;
    const c = await this.client.customers.create({
      email: opts.email ?? undefined,
      name: opts.name,
      metadata: { tenantId: opts.tenantId },
    });
    return c.id as string;
  }

  async createCheckoutSession(opts: {
    customerId: string;
    priceId: string;
    meteredPriceId?: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
    tenantId: string;
  }) {
    if (!this.client) {
      return { url: `${opts.successUrl}?dryrun=1`, id: 'dryrun_cs' };
    }
    const line_items: Array<{ price: string; quantity?: number }> = [
      { price: opts.priceId, quantity: 1 },
    ];
    if (opts.meteredPriceId) {
      line_items.push({ price: opts.meteredPriceId }); // qty implicit for metered
    }
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: opts.customerId,
      line_items,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      subscription_data: {
        trial_period_days: opts.trialDays,
        metadata: { tenantId: opts.tenantId },
      },
    });
    return { url: session.url as string, id: session.id as string };
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    if (!this.client) return { url: `${returnUrl}?dryrun=1` };
    const s = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: s.url as string };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async retrieveSubscription(id: string): Promise<any | null> {
    if (!this.client) return null;
    return this.client.subscriptions.retrieve(id);
  }

  async reportUsage(meteredSubscriptionItemId: string, quantity: number) {
    if (!this.client) return;
    // Stripe deprecated usage_records in favour of meters; cast keeps the
    // call working across SDK versions.
    await this.client.subscriptionItems.createUsageRecord(
      meteredSubscriptionItemId,
      { quantity, action: 'set' },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verifyWebhook(rawBody: Buffer, signature: string): any {
    if (!this.client) {
      throw new Error('Stripe disabled in dry-run mode');
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }
}
