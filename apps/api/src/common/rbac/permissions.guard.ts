import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { resolveAccess } from './rbac.service';
import { PERMS_KEY } from './perms.decorator';

/**
 * Enforces functional permissions and attaches the resolved data scope to the
 * request so services can filter to the caller's org-unit subtree.
 * Use after JwtGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tp: TenantPrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    const req = ctx.switchToHttp().getRequest();
    const access = await resolveAccess(
      this.tp.forCurrentTenant(),
      req.user.sub,
    );
    req.access = access; // { permissions:Set, scopeUnits:string[]|null }

    const ok = required.every((p) => access.permissions.has(p));
    if (!ok) throw new ForbiddenException(`Requires: ${required.join(', ')}`);
    return true;
  }
}
