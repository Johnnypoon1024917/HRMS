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
import { CaseNoteSchema, CaseUpsertSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { CdmService } from './cdm.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('cdm')
export class CdmController {
  constructor(private readonly cdm: CdmService) {}

  @Perms('cdm.read')
  @Get('cases')
  list(
    @Req() req: any,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
  ) {
    return this.cdm.list(req.access, { staffId, status, kind });
  }

  @Perms('cdm.write')
  @Post('cases')
  create(@Body() body: unknown, @Req() req: any) {
    return this.cdm.create(CaseUpsertSchema.parse(body), req.user.sub);
  }

  @Perms('cdm.write')
  @Post('cases/:id/close')
  close(@Param('id') id: string, @Req() req: any) {
    return this.cdm.close(id, req.user.sub);
  }

  @Perms('cdm.read')
  @Get('cases/:id/notes')
  notes(@Param('id') id: string, @Req() req: any) {
    return this.cdm.notes(id, req.access);
  }

  @Perms('cdm.write')
  @Post('cases/:id/notes')
  addNote(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.cdm.addNote(
      id,
      CaseNoteSchema.parse(body),
      req.user.sub,
      req.access,
    );
  }

  @Perms('cdm.read')
  @Get('staff/:staffId/summary')
  summary(@Param('staffId') staffId: string, @Req() req: any) {
    return this.cdm.summary(staffId, req.access);
  }
}
