import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PostRequestSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { EsmService } from './esm.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('esm')
export class EsmController {
  constructor(private readonly esm: EsmService) {}

  @Perms('esm.read')
  @Get('org')
  org(@Query('rootId') rootId?: string) {
    return this.esm.orgChart(rootId);
  }

  @Perms('esm.read')
  @Get('posts')
  posts(@Query('orgUnitId') orgUnitId?: string) {
    return this.esm.listPosts(orgUnitId);
  }

  @Perms('esm.read')
  @Get('strength')
  strength() {
    return this.esm.strength();
  }

  @Perms('esm.read')
  @Get('requests')
  listRequests(@Query('status') status?: string) {
    return this.esm.listRequests(status);
  }

  @Perms('esm.write')
  @Post('requests')
  submitRequest(@Body() body: unknown, @Req() req: any) {
    return this.esm.submitRequest(PostRequestSchema.parse(body), req.user.sub);
  }

  /** Manual trigger of the daily batch (also wired to the scheduler). */
  @Perms('esm.write')
  @Post('batch/run')
  runBatch() {
    return this.esm.runDailyBatch();
  }
}
