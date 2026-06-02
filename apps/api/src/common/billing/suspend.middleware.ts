import { HttpException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RegistryPrismaService } from '../prisma/registry-prisma.service';
import { currentTenant } from '../tenancy/tenant-context';

/**
 * Short-circuits requests to suspended tenants with 402 Payment Required
 * unless the route is one that should still work while suspended (auth,
 * billing self-service, webhooks, health). Runs *after* TenantMiddleware.
 */
@Injectable()
export class SuspendMiddleware implements NestMiddleware {
  constructor(private readonly registry: RegistryPrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Allow the user to log in, manage billing, and Stripe to call us back.
    const path = req.path;
    if (
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/bil/') ||
      path.startsWith('/api/config/public-branding') ||
      path === '/api/health'
    ) {
      return next();
    }

    let tenantId: string | undefined;
    try {
      tenantId = currentTenant().tenantId;
    } catch {
      return next(); // no tenant in context yet — leave it to TenantMiddleware
    }

    const t = await this.registry.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (t?.status === 'suspended') {
      throw new HttpException(
        {
          message:
            'This workspace is suspended for non-payment. Manage billing at /admin/subscription.',
          code: 'TENANT_SUSPENDED',
        },
        402,
      );
    }
    next();
  }
}
