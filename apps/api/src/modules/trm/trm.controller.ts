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
  CompletionSchema,
  CourseUpsertSchema,
  NominateSchema,
  SessionUpsertSchema,
} from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { TrmService } from './trm.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('trm')
export class TrmController {
  constructor(private readonly trm: TrmService) {}

  // courses
  @Perms('trm.read')
  @Get('courses')
  courses() {
    return this.trm.listCourses();
  }

  @Perms('trm.admin')
  @Put('courses')
  upsertCourse(@Body() body: unknown, @Req() req: any) {
    return this.trm.upsertCourse(CourseUpsertSchema.parse(body), req.user.sub);
  }

  // sessions
  @Perms('trm.admin')
  @Post('sessions')
  createSession(@Body() body: unknown, @Req() req: any) {
    return this.trm.createSession(SessionUpsertSchema.parse(body), req.user.sub);
  }

  @Perms('trm.read')
  @Get('calendar')
  calendar(@Query('from') from: string, @Query('to') to: string) {
    return this.trm.calendar(from, to);
  }

  // call list
  @Perms('trm.admin')
  @Post('nominate')
  nominate(@Body() body: unknown, @Req() req: any) {
    const { sessionId, staffIds } = NominateSchema.parse(body);
    return this.trm.nominate(sessionId, staffIds, req.user.sub);
  }

  @Perms('trm.admin')
  @Get('sessions/:id/enrolments')
  enrolments(@Param('id') id: string) {
    return this.trm.listEnrolments(id);
  }

  // completion
  @Perms('trm.admin')
  @Post('completion')
  complete(@Body() body: unknown, @Req() req: any) {
    return this.trm.recordCompletion(CompletionSchema.parse(body), req.user.sub);
  }

  // self
  @Perms('trm.read')
  @Get('me')
  me(@Req() req: any) {
    return this.trm.myTraining(req.user.sub);
  }
}
