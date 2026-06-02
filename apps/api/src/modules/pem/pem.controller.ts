import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AppraiserAssessmentSchema,
  CycleUpsertSchema,
  SelfAssessmentSchema,
} from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { PemService } from './pem.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('pem')
export class PemController {
  constructor(private readonly pem: PemService) {}

  // cycles (admin)
  @Perms('pem.admin')
  @Get('cycles')
  cycles() {
    return this.pem.listCycles();
  }

  @Perms('pem.admin')
  @Put('cycles')
  upsertCycle(
    @Body() body: unknown,
    @Query('id') id: string | undefined,
    @Req() req: any,
  ) {
    return this.pem.upsertCycle(CycleUpsertSchema.parse(body), id, req.user.sub);
  }

  @Perms('pem.admin')
  @Post('cycles/:id/generate')
  generate(@Param('id') id: string, @Req() req: any) {
    return this.pem.generateReports(id, req.access, req.user.sub);
  }

  @Perms('pem.admin')
  @Get('cycles/:id/distribution')
  distribution(@Param('id') id: string) {
    return this.pem.distribution(id);
  }

  @Perms('pem.admin')
  @Post('reports/:id/finalise')
  finalise(@Param('id') id: string, @Req() req: any) {
    return this.pem.finalise(id, req.user.sub);
  }

  // employee self
  @Perms('pem.read')
  @Get('me')
  mine(@Req() req: any) {
    return this.pem.myReports(req.user.sub);
  }

  @Perms('pem.read')
  @Post('reports/:id/self')
  self(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.pem.submitSelf(id, SelfAssessmentSchema.parse(body), req.user.sub);
  }

  // appraiser (manager)
  @Perms('pem.appraise')
  @Get('appraise')
  appraiseQueue(@Req() req: any) {
    return this.pem.forAppraiser(req.access);
  }

  @Perms('pem.appraise')
  @Post('reports/:id/appraise')
  appraise(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.pem.submitAppraiser(
      id,
      AppraiserAssessmentSchema.parse(body),
      req.user.sub,
    );
  }
}
