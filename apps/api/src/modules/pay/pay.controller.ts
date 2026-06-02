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
  ContractUpsertSchema,
  CreatePayRunSchema,
  ExportPayRunSchema,
  GenerateCalendarSchema,
  HolidaySyncSchema,
  HolidayUpsertSchema,
  Ir56GenerateSchema,
  PayComponentInputUpsertSchema,
  PayComponentUpsertSchema,
  PayGroupUpsertSchema,
  PayrollLoanCreateSchema,
  StaffPayProfileUpsertSchema,
  TerminationCreateSchema,
  TimesheetUpsertSchema,
  WorkScheduleUpsertSchema,
} from '@hrms/contracts';
import { JwtGuard } from '../../common/auth/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { Perms } from '../../common/rbac/perms.decorator';
import { PayService } from './pay.service';
import { CalendarService } from './services/calendar.service';
import { LoansService } from './services/loans.service';
import { PayRunService } from './services/pay-run.service';
import { BankFileService } from './services/bank-file.service';
import { GlPostingService } from './services/gl-posting.service';
import { Ir56Service } from './services/ir56.service';
import { TerminationService } from './services/termination.service';
import { HolidayService } from './services/holiday.service';
import { TimesheetService } from './services/timesheet.service';
import { YtdService } from './engines/ytd.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('pay')
export class PayController {
  constructor(
    private readonly pay: PayService,
    private readonly calendar: CalendarService,
    private readonly loans: LoansService,
    private readonly runs: PayRunService,
    private readonly bankFile: BankFileService,
    private readonly gl: GlPostingService,
    private readonly ir56: Ir56Service,
    private readonly term: TerminationService,
    private readonly holidays: HolidayService,
    private readonly timesheets: TimesheetService,
    private readonly ytd: YtdService,
    private readonly tp: TenantPrismaService,
  ) {}

  // -------- components --------------------------------------------------

  @Perms('pay.read')
  @Get('components')
  components() {
    return this.pay.listComponents();
  }

  @Perms('pay.write')
  @Put('components')
  upsertComponent(@Body() body: unknown, @Req() req: any) {
    return this.pay.upsertComponent(
      PayComponentUpsertSchema.parse(body),
      req.user.sub,
    );
  }

  @Perms('pay.write')
  @Put('component-inputs')
  upsertComponentInput(@Body() body: unknown) {
    const input = PayComponentInputUpsertSchema.parse(body);
    return this.tp.forCurrentTenant().payComponentInput.create({
      data: {
        staffId: input.staffId,
        componentCode: input.componentCode,
        amount: input.amount,
        params: input.params as any,
        mode: input.mode,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });
  }

  // -------- constants ---------------------------------------------------

  @Perms('pay.read')
  @Get('constants')
  constants() {
    return this.pay.listConstants();
  }

  @Perms('pay.write')
  @Put('constants')
  upsertConstant(@Body() body: any, @Req() req: any) {
    return this.pay.upsertConstant(body.key, body.value, body.unit, body.note, req.user.sub);
  }

  // -------- pay groups + calendar --------------------------------------

  @Perms('pay.read')
  @Get('groups')
  groups() {
    return this.calendar.listGroups();
  }

  @Perms('pay.write')
  @Put('groups')
  upsertGroup(@Body() body: unknown) {
    return this.calendar.upsertGroup(PayGroupUpsertSchema.parse(body));
  }

  @Perms('pay.read')
  @Get('calendar/:groupCode')
  calendarList(@Param('groupCode') groupCode: string) {
    return this.calendar.listCalendar(groupCode);
  }

  @Perms('pay.write')
  @Post('calendar/generate')
  calendarGenerate(@Body() body: unknown) {
    return this.calendar.generate(GenerateCalendarSchema.parse(body));
  }

  // -------- staff pay profile ------------------------------------------

  @Perms('pay.read')
  @Get('profiles')
  profiles() {
    return this.pay.listProfiles();
  }

  @Perms('pay.write')
  @Put('profiles')
  upsertProfile(@Body() body: unknown, @Req() req: any) {
    return this.pay.upsertProfile(
      StaffPayProfileUpsertSchema.parse(body),
      req.user.sub,
    );
  }

  // -------- loans ------------------------------------------------------

  @Perms('pay.read')
  @Get('loans')
  listLoans(@Query('staffId') staffId?: string) {
    return this.loans.list(staffId);
  }

  @Perms('pay.write')
  @Post('loans')
  createLoan(@Body() body: unknown, @Req() req: any) {
    return this.loans.create(PayrollLoanCreateSchema.parse(body), req.user.sub);
  }

  // -------- runs -------------------------------------------------------

  @Perms('pay.read')
  @Get('runs')
  listRuns(@Query('groupCode') groupCode?: string) {
    return this.runs.listRuns(groupCode);
  }

  @Perms('pay.run')
  @Post('runs')
  createRun(@Body() body: unknown, @Req() req: any) {
    return this.runs.createRun(
      CreatePayRunSchema.parse(body),
      req.access,
      req.user.sub,
    );
  }

  @Perms('pay.approve')
  @Post('runs/:id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.runs.approveRun(id, req.user.sub);
  }

  @Perms('pay.run')
  @Post('runs/:id/pay')
  markPaid(@Param('id') id: string, @Req() req: any) {
    return this.runs.markPaid(id, req.user.sub);
  }

  @Perms('pay.run')
  @Post('runs/:id/reverse')
  reverse(@Param('id') id: string, @Req() req: any) {
    return this.runs.reverseRun(id, req.user.sub);
  }

  @Perms('pay.read')
  @Get('runs/:id/payslips')
  payslips(@Param('id') id: string, @Req() req: any) {
    return this.runs.payslips(id, req.access);
  }

  @Perms('pay.read')
  @Get('runs/:id/variance')
  variance(@Param('id') id: string) {
    return this.runs.variance(id);
  }

  // -------- exports ----------------------------------------------------

  @Perms('pay.export')
  @Post('runs/:id/exports/bank')
  exportBank(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const { format } = ExportPayRunSchema.parse(body);
    return this.bankFile.generate(id, format, req.user.sub);
  }

  @Perms('pay.read')
  @Get('runs/:id/exports')
  listExports(@Param('id') id: string) {
    return this.bankFile.list(id);
  }

  @Perms('pay.export')
  @Post('runs/:id/exports/gl')
  exportGl(@Param('id') id: string) {
    return this.gl.generate(id);
  }

  @Perms('pay.read')
  @Get('runs/:id/gl')
  listGl(@Param('id') id: string) {
    return this.gl.list(id);
  }

  // -------- YTD --------------------------------------------------------

  @Perms('pay.read')
  @Get('ytd/:staffId/:year')
  ytdGet(@Param('staffId') staffId: string, @Param('year') year: string) {
    return this.ytd.snapshot(staffId, Number(year));
  }

  // -------- IR56 -------------------------------------------------------

  @Perms('pay.read')
  @Get('ir56')
  listIr56(@Query('taxYear') taxYear?: string) {
    return this.ir56.list(taxYear ? Number(taxYear) : undefined);
  }

  @Perms('pay.export')
  @Post('ir56')
  generateIr56(@Body() body: unknown, @Req() req: any) {
    return this.ir56.generate(Ir56GenerateSchema.parse(body), req.user.sub);
  }

  // -------- termination -----------------------------------------------

  @Perms('pay.read')
  @Get('terminations')
  listTerminations(@Query('staffId') staffId?: string) {
    return this.term.list(staffId);
  }

  @Perms('pay.write')
  @Post('terminations/preview')
  previewTermination(@Body() body: unknown) {
    return this.term.preview(TerminationCreateSchema.parse(body));
  }

  @Perms('pay.write')
  @Post('terminations')
  createTermination(@Body() body: unknown, @Req() req: any) {
    return this.term.create(
      TerminationCreateSchema.parse(body),
      req.user.sub,
    );
  }

  // -------- holidays + work schedule -----------------------------------

  @Perms('pay.read')
  @Get('holidays')
  listHolidays(
    @Query('localeCode') localeCode = 'HK',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.holidays.list(localeCode, from, to);
  }

  @Perms('pay.write')
  @Post('holidays/sync')
  syncHolidays(@Body() body: unknown) {
    return this.holidays.sync(HolidaySyncSchema.parse(body));
  }

  @Perms('pay.write')
  @Put('holidays')
  upsertHoliday(@Body() body: unknown) {
    return this.holidays.upsert(HolidayUpsertSchema.parse(body));
  }

  @Perms('pay.read')
  @Get('holidays/sync-status')
  holidaySyncStatus(@Query('localeCode') localeCode = 'HK') {
    return this.holidays.lastSync(localeCode);
  }

  @Perms('pay.read')
  @Get('work-schedules')
  listWorkSchedules() {
    return this.tp.forCurrentTenant().workSchedule.findMany();
  }

  @Perms('pay.write')
  @Put('work-schedules')
  upsertWorkSchedule(@Body() body: unknown) {
    const input = WorkScheduleUpsertSchema.parse(body);
    return this.tp.forCurrentTenant().workSchedule.upsert({
      where: { groupCode: input.groupCode },
      create: input,
      update: input,
    });
  }

  // -------- contracts --------------------------------------------------

  @Perms('pay.write')
  @Put('contracts')
  upsertContract(@Body() body: unknown) {
    const input = ContractUpsertSchema.parse(body);
    return this.tp.forCurrentTenant().staffAppointment.create({
      data: {
        staffId: input.staffId,
        postId: input.postId,
        rankCode: input.rankCode,
        contractType: input.contractType,
        contractEndDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        hourlyRate: input.hourlyRate,
        dailyRate: input.dailyRate,
        weeklyHours: input.weeklyHours,
        fteFactor: input.fteFactor,
        gratuityRate: input.gratuityRate,
        effectiveFrom: new Date(input.effectiveFrom),
      },
    });
  }

  // -------- timesheets -------------------------------------------------

  @Perms('pay.read')
  @Get('timesheets')
  listTimesheets(
    @Query('staffId') staffId?: string,
    @Query('period') period?: string,
  ) {
    return this.timesheets.list(staffId, period);
  }

  @Perms('pay.write')
  @Put('timesheets')
  upsertTimesheet(@Body() body: unknown) {
    return this.timesheets.upsert(TimesheetUpsertSchema.parse(body));
  }

  @Perms('pay.write')
  @Post('timesheets/:id/submit')
  submitTimesheet(@Param('id') id: string) {
    return this.timesheets.submit(id);
  }

  @Perms('pay.approve')
  @Post('timesheets/:id/approve')
  approveTimesheet(@Param('id') id: string, @Req() req: any) {
    return this.timesheets.approve(id, req.user.sub);
  }
}
