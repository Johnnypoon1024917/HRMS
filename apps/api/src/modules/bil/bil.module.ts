import { Module } from '@nestjs/common';
import { BilController } from './bil.controller';
import { BilService } from './bil.service';
import { StripeAdapter } from './stripe.adapter';
import { LicenseService } from './license.service';
import { UsageService } from './usage.service';

@Module({
  controllers: [BilController],
  providers: [BilService, StripeAdapter, LicenseService, UsageService],
  exports: [LicenseService],
})
export class BilModule {}
