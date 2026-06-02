import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StaffSearchSchema, StaffUpsertSchema } from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { PimService } from './pim.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('pim/staff')
export class PimController {
  constructor(private readonly pim: PimService) {}

  @Perms('pim.read')
  @Get()
  search(@Query() query: unknown, @Req() req: any) {
    return this.pim.search(StaffSearchSchema.parse(query), req.access);
  }

  @Perms('pim.read')
  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.pim.get(id, req.access);
  }

  @Perms('pim.write')
  @Put()
  upsert(@Body() body: unknown, @Req() req: any) {
    return this.pim.upsert(StaffUpsertSchema.parse(body), req.user.sub);
  }

  @Perms('pim.import')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: { buffer: Buffer }, @Req() req: any) {
    return this.pim.importExcel(file.buffer, req.user.sub);
  }
}
