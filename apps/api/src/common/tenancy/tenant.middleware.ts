import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RegistryPrismaService } from '../prisma/registry-prisma.service';
import { tenantStore } from './tenant-context';

/**
 * Resolves the tenant for every request and binds it to AsyncLocalStorage.
 *
 *  - SaaS:    sub-domain  acme.app.com  -> tenant slug "acme"
 *  - On-prem: env SINGLE_TENANT pins the single tenant (same code path)
 *
 * Switching SaaS <-> on-prem is configuration, not a fork.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly registry: RegistryPrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Explicit signals win over host inference so dev/docker setups (where the
    // host is the api service name) and proxied calls don't get fooled into
    // resolving the wrong tenant. SaaS production still works because clients
    // talking to acme.app.com don't send an X-Tenant header.
    const slug =
      process.env.DEPLOYMENT_MODE === 'onprem'
        ? process.env.SINGLE_TENANT
        : (req.headers['x-tenant'] as string | undefined) ??
          (req.query.tenant as string | undefined) ??
          this.cookie(req.headers.cookie, 'tenant_hint') ??
          // Last resort: derive from sub-domain (acme.app.com -> "acme").
          this.slugFromHost(req.headers.host);

    if (!slug) throw new NotFoundException('Tenant could not be resolved');

    const tenant = await this.registry.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.status !== 'active') {
      throw new NotFoundException(`Unknown tenant: ${slug}`);
    }

    tenantStore.run(
      {
        tenantId: tenant.id,
        slug: tenant.slug,
        dbSchema: tenant.dbSchema,
        dbUrl: tenant.dbUrl,
      },
      () => next(),
    );
  }

  private cookie(header: string | undefined, name: string) {
    return header
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  }

  private slugFromHost(host?: string): string | undefined {
    if (!host) return undefined;
    const [name] = host.split(':')[0].split('.');
    if (!name || ['www', 'app', 'localhost'].includes(name)) return undefined;
    return name;
  }
}
