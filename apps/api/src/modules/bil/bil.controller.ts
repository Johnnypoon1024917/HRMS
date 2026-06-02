import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CheckoutSessionSchema,
  PlanUpsertSchema,
} from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { BilService } from './bil.service';
import { UsageService } from './usage.service';

@Controller('bil')
export class BilController {
  constructor(
    private readonly bil: BilService,
    private readonly usage: UsageService,
  ) {}

  // ---- plans (operator) ----
  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.read')
  @Get('plans')
  plans() {
    return this.bil.listPlans();
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.operate')
  @Put('plans')
  upsertPlan(@Body() body: unknown, @Req() req: any) {
    return this.bil.upsertPlan(PlanUpsertSchema.parse(body), req.user.sub);
  }

  // ---- tenant subscription ----
  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.read')
  @Get('subscription')
  subscription() {
    return this.bil.getSubscription();
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.manage')
  @Post('checkout')
  checkout(@Body() body: unknown) {
    const { planCode, successUrl, cancelUrl } = CheckoutSessionSchema.parse(body);
    return this.bil.checkoutSession(planCode, successUrl, cancelUrl);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.manage')
  @Post('portal')
  portal(@Body() body: { returnUrl: string }) {
    return this.bil.portalSession(body.returnUrl);
  }

  // ---- usage (operator) ----
  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.operate')
  @Post('usage/report-all')
  reportAllUsage() {
    return this.usage.reportAll();
  }

  // ---- license keys (operator) ----
  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.operate')
  @Get('licenses')
  licenses() {
    return this.bil.listLicenses();
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.operate')
  @Post('licenses')
  issueLicense(
    @Body() body: {
      tenantId: string; months: number;
      modules?: string[]; maxSeats?: number;
    },
    @Req() req: any,
  ) {
    return this.bil.issueLicense(body, req.user.sub);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('bil.operate')
  @Post('licenses/:id/revoke')
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.bil.revoke(id, req.user.sub);
  }

  // ---- webhook (unauthenticated; signature-verified) ----
  /**
   * Stripe webhook. Bypasses JwtGuard; signature on the raw request body is
   * the auth. Tenant is resolved from event metadata (set at checkout time),
   * NOT from the request — the host that Stripe POSTs to is the platform
   * domain.
   */
  @Post('webhook/stripe')
  async webhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') sig: string,
  ) {
    try {
      const raw = (req as any).rawBody as Buffer | undefined;
      if (!raw) throw new Error('Raw body unavailable; enable rawBody on NestFactory');
      const out = await this.bil.handleWebhook(raw, sig);
      res.json(out);
    } catch (e: any) {
      res.status(400).send(`Webhook Error: ${e.message}`);
    }
  }
}
