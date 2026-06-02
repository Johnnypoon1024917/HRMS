import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { EssService } from './ess.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('ess')
export class EssController {
  constructor(private readonly ess: EssService) {}

  @Perms('ess.self')
  @Get('me')
  me(@Req() req: any) {
    return this.ess.myProfile(req.user.sub);
  }

  @Perms('ess.team')
  @Get('team')
  team(@Req() req: any) {
    return this.ess.myTeam(req.access);
  }
}
