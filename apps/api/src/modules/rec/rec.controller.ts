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
  ApplySchema,
  CandidateUpsertSchema,
  HireSchema,
  InterviewFeedbackSchema,
  JobOpeningUpsertSchema,
  MoveStageSchema,
  OfferSchema,
  ScheduleInterviewSchema,
} from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { RecService } from './rec.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('rec')
export class RecController {
  constructor(private readonly rec: RecService) {}

  // jobs
  @Perms('rec.read')
  @Get('jobs')
  jobs(@Query('status') status?: string) {
    return this.rec.listJobs(status);
  }

  @Perms('rec.write')
  @Put('jobs')
  upsertJob(@Body() body: unknown, @Req() req: any) {
    return this.rec.upsertJob(JobOpeningUpsertSchema.parse(body), req.user.sub);
  }

  // candidates
  @Perms('rec.read')
  @Get('candidates')
  candidates() {
    return this.rec.listCandidates();
  }

  @Perms('rec.write')
  @Put('candidates')
  upsertCandidate(@Body() body: unknown, @Req() req: any) {
    return this.rec.upsertCandidate(CandidateUpsertSchema.parse(body), req.user.sub);
  }

  // applications
  @Perms('rec.write')
  @Post('applications')
  apply(@Body() body: unknown, @Req() req: any) {
    const { jobCode, candidateId } = ApplySchema.parse(body);
    return this.rec.apply(jobCode, candidateId, req.user.sub);
  }

  @Perms('rec.read')
  @Get('jobs/:code/pipeline')
  pipeline(@Param('code') code: string) {
    return this.rec.pipeline(code);
  }

  @Perms('rec.write')
  @Post('applications/:id/stage')
  moveStage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const { stage, reason } = MoveStageSchema.parse(body);
    return this.rec.moveStage(id, stage, reason, req.user.sub);
  }

  // interviews
  @Perms('rec.write')
  @Post('interviews')
  schedule(@Body() body: unknown, @Req() req: any) {
    return this.rec.scheduleInterview(
      ScheduleInterviewSchema.parse(body),
      req.user.sub,
    );
  }

  @Perms('rec.write')
  @Post('interviews/:id/feedback')
  feedback(@Param('id') id: string, @Body() body: unknown) {
    const { notes, score } = InterviewFeedbackSchema.parse(body);
    return this.rec.recordFeedback(id, notes, score);
  }

  // offers
  @Perms('rec.write')
  @Post('offers')
  offer(@Body() body: unknown, @Req() req: any) {
    return this.rec.makeOffer(OfferSchema.parse(body), req.user.sub);
  }

  @Perms('rec.write')
  @Post('offers/:id/decide')
  decideOffer(
    @Param('id') id: string,
    @Body() body: { accepted: boolean },
    @Req() req: any,
  ) {
    return this.rec.decideOffer(id, body.accepted, req.user.sub);
  }

  // hire
  @Perms('rec.hire')
  @Post('hire')
  hire(@Body() body: unknown, @Req() req: any) {
    return this.rec.hire(HireSchema.parse(body), req.user.sub);
  }
}
