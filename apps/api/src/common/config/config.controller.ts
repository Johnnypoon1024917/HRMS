import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { DEFAULT_BRANDING, TenantBrandingSchema } from '@hrms/contracts';
import { RegistryPrismaService } from '../prisma/registry-prisma.service';
import { currentTenant } from '../tenancy/tenant-context';
import { JwtGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Perms } from '../rbac/perms.decorator';
import { ALL_MANIFESTS } from './module-registry';

/**
 * Tenant runtime configuration: branding (white-label) + enabled modules.
 * `/bootstrap` is public-ish (JWT only) and drives the web ThemeProvider +
 * navigation. Branding edits require `config.write` (Config Studio).
 */
@Controller('config')
export class ConfigController {
  constructor(private readonly registry: RegistryPrismaService) {}

  /** Unauthenticated: drives the PWA manifest + login screen branding so the
   *  installed app is per-tenant branded before sign-in. Non-sensitive. */
  @Get('public-branding')
  async publicBranding() {
    const { tenantId } = currentTenant();
    const row = await this.registry.tenantBranding.findUnique({ where: { tenantId } });
    return TenantBrandingSchema.parse(row?.branding ?? DEFAULT_BRANDING);
  }

  @UseGuards(JwtGuard)
  @Get('bootstrap')
  async bootstrap() {
    const { tenantId } = currentTenant();
    const [brandingRow, modules] = await Promise.all([
      this.registry.tenantBranding.findUnique({ where: { tenantId } }),
      this.registry.tenantModule.findMany({ where: { tenantId, enabled: true } }),
    ]);
    const enabled = new Set(modules.map((m) => m.moduleKey));
    return {
      branding: TenantBrandingSchema.parse(brandingRow?.branding ?? DEFAULT_BRANDING),
      modules: ALL_MANIFESTS.filter((m) => m.core || enabled.has(m.key)),
    };
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('config.write')
  @Put('branding')
  async updateBranding(@Body() body: unknown) {
    const branding = TenantBrandingSchema.parse(body);
    const { tenantId } = currentTenant();
    await this.registry.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, branding },
      update: { branding, version: { increment: 1 } },
    });
    return branding;
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('config.write')
  @Get('modules')
  async listModules() {
    const { tenantId } = currentTenant();
    const rows = await this.registry.tenantModule.findMany({ where: { tenantId } });
    const enabled = new Map(rows.map((r) => [r.moduleKey, r.enabled]));
    return ALL_MANIFESTS.map((m) => ({
      key: m.key,
      nameKey: m.nameKey,
      icon: m.icon,
      core: !!m.core,
      dependsOn: m.dependsOn ?? [],
      enabled: m.core || (enabled.get(m.key) ?? false),
    }));
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Perms('config.write')
  @Put('modules')
  async toggleModule(@Body() body: { moduleKey: string; enabled: boolean }) {
    const { tenantId } = currentTenant();
    await this.registry.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: body.moduleKey } },
      create: { tenantId, moduleKey: body.moduleKey, enabled: body.enabled },
      update: { enabled: body.enabled },
    });
    return { ok: true };
  }
}
