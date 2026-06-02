import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExitUpsertSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { ExmService } from './exm.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('exm')
export class ExmController {
  constructor(private readonly exm: ExmService) {}

  @Perms('exm.read')
  @Get('exits')
  list(@Req() req: any, @Query('status') status?: string) {
    return this.exm.list(req.access, status);
  }

  @Perms('exm.write')
  @Post('exits')
  create(@Body() body: unknown, @Req() req: any) {
    return this.exm.create(ExitUpsertSchema.parse(body), req.user.sub);
  }

  @Perms('exm.write')
  @Post('exits/:id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.exm.cancel(id, req.user.sub);
  }

  @Perms('exm.write')
  @Post('batch/run')
  runBatch() {
    return this.exm.runBatch();
  }

  @Perms('exm.read')
  @Get('forecast')
  forecast(@Req() req: any, @Query('windowDays') w?: string) {
    return this.exm.forecast(req.access, w ? Number(w) : 365);
  }
}
