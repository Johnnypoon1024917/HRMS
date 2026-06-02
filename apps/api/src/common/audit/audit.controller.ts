import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { JwtGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Perms } from '../rbac/perms.decorator';

/** Read access to the append-only audit log (REQ-SEC-001). Write-gated. */
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly tp: TenantPrismaService) {}

  @Perms('audit.read')
  @Get()
  async list(
    @Query('entity') entity?: string,
    @Query('take') take = '100',
  ) {
    return this.tp.forCurrentTenant().auditLog.findMany({
      where: entity ? { entity } : {},
      orderBy: { at: 'desc' },
      take: Math.min(Number(take) || 100, 500),
    });
  }
}
