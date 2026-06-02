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
import { PostingActionSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { PomService } from './pom.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('pom')
export class PomController {
  constructor(private readonly pom: PomService) {}

  @Perms('pom.read')
  @Get('actions')
  list(@Query('status') status?: string) {
    return this.pom.listActions(status);
  }

  @Perms('pom.write')
  @Post('actions')
  create(@Body() body: unknown, @Req() req: any) {
    return this.pom.createAction(PostingActionSchema.parse(body), req.user.sub);
  }

  @Perms('pom.write')
  @Post('actions/:id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.pom.cancelAction(id, req.user.sub);
  }

  @Perms('pom.write')
  @Post('batch/run')
  runBatch() {
    return this.pom.runBatch();
  }

  @Perms('pom.read')
  @Get('career/:staffId')
  career(@Param('staffId') staffId: string) {
    return this.pom.careerHistory(staffId);
  }

  @Perms('pom.read')
  @Get('acting')
  acting() {
    return this.pom.actingList();
  }

  @Perms('pom.read')
  @Get('match/:staffId')
  match(@Param('staffId') staffId: string) {
    return this.pom.transferMatch(staffId);
  }
}
