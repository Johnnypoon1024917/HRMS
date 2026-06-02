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
import { BenefitTypeUpsertSchema, EnrolBenefitSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { HbmService } from './hbm.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('hbm')
export class HbmController {
  constructor(private readonly hbm: HbmService) {}

  // types
  @Perms('hbm.read')
  @Get('types')
  types() {
    return this.hbm.listTypes();
  }

  @Perms('hbm.write')
  @Put('types')
  upsertType(@Body() body: unknown, @Req() req: any) {
    return this.hbm.upsertType(BenefitTypeUpsertSchema.parse(body), req.user.sub);
  }

  // enrolments
  @Perms('hbm.read')
  @Get('enrolments')
  enrolments(@Req() req: any, @Query('staffId') staffId?: string) {
    return this.hbm.listEnrolments(req.access, staffId);
  }

  @Perms('hbm.write')
  @Post('enrolments')
  enrol(@Body() body: unknown, @Req() req: any) {
    return this.hbm.enrol(EnrolBenefitSchema.parse(body), req.user.sub);
  }

  @Perms('hbm.write')
  @Post('enrolments/:id/terminate')
  terminate(
    @Param('id') id: string,
    @Body() body: { effectiveTo: string },
    @Req() req: any,
  ) {
    return this.hbm.terminate(id, body.effectiveTo, req.user.sub);
  }

  // invoices
  @Perms('hbm.read')
  @Get('invoices')
  invoices(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    return this.hbm.listInvoices(req.access, period, status);
  }

  @Perms('hbm.bill')
  @Post('invoices/generate')
  generate(@Body() body: { period: string }, @Req() req: any) {
    return this.hbm.generateInvoices(body.period, req.user.sub);
  }

  @Perms('hbm.bill')
  @Post('invoices/:id/paid')
  paid(@Param('id') id: string, @Req() req: any) {
    return this.hbm.markPaid(id, req.user.sub);
  }

  // stats
  @Perms('hbm.read')
  @Get('stats')
  stats(@Query('period') period: string) {
    return this.hbm.stats(period);
  }
}
