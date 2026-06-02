import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AwardTypeUpsertSchema, GrantAwardSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { HamService } from './ham.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('ham')
export class HamController {
  constructor(private readonly ham: HamService) {}

  // types
  @Perms('ham.read')
  @Get('types')
  types() {
    return this.ham.listTypes();
  }

  @Perms('ham.write')
  @Put('types')
  upsertType(@Body() body: unknown, @Req() req: any) {
    return this.ham.upsertType(AwardTypeUpsertSchema.parse(body), req.user.sub);
  }

  // awards
  @Perms('ham.read')
  @Get('awards')
  awards(@Query('staffId') staffId?: string) {
    return this.ham.list(staffId);
  }

  @Perms('ham.write')
  @Post('awards')
  grant(@Body() body: unknown, @Req() req: any) {
    return this.ham.grant(GrantAwardSchema.parse(body), req.user.sub);
  }

  // LSI
  @Perms('ham.write')
  @Get('lsi')
  lsi(@Req() req: any) {
    return this.ham.lsiCandidates(req.access);
  }
}
