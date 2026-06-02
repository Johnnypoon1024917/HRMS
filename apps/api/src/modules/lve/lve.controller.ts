import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApproveLeaveSchema,
  LeaveRequestSchema,
  LeaveTypeUpsertSchema,
} from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { LveService } from './lve.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('lve')
export class LveController {
  constructor(private readonly lve: LveService) {}

  @Perms('lve.read')
  @Get('balances')
  balances(@Req() req: any) {
    return this.lve.balances(req.user.sub);
  }

  @Perms('lve.read')
  @Get('me')
  myRequests(@Req() req: any) {
    return this.lve.myRequests(req.user.sub);
  }

  @Perms('lve.request')
  @Post('requests')
  request(@Body() body: unknown, @Req() req: any) {
    return this.lve.request(LeaveRequestSchema.parse(body), req.user.sub);
  }

  @Perms('lve.request')
  @Post('requests/:id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.lve.cancel(id, req.user.sub);
  }

  @Perms('lve.approve')
  @Get('approvals')
  pending(@Req() req: any) {
    return this.lve.pendingForApprover(req.access);
  }

  @Perms('lve.approve')
  @Post('approvals/:id')
  decide(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.lve.decide(id, ApproveLeaveSchema.parse(body), req.user.sub);
  }

  @Perms('lve.admin')
  @Get('types')
  types() {
    return this.lve.listTypes();
  }

  @Perms('lve.admin')
  @Put('types')
  upsertType(@Body() body: unknown, @Req() req: any) {
    return this.lve.upsertType(LeaveTypeUpsertSchema.parse(body), req.user.sub);
  }
}
