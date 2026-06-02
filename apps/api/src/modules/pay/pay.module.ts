import { Module } from '@nestjs/common';
import { PayController } from './pay.controller';
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

@Module({
  controllers: [PayController],
  providers: [
    PayService,
    CalendarService,
    LoansService,
    PayRunService,
    BankFileService,
    GlPostingService,
    Ir56Service,
    TerminationService,
    HolidayService,
    TimesheetService,
    YtdService,
  ],
})
export class PayModule {}
