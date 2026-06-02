import { Module } from '@nestjs/common';
import { LveController } from './lve.controller';
import { LveService } from './lve.service';

@Module({
  controllers: [LveController],
  providers: [LveService],
  exports: [LveService], // consumed by ESS for the leave summary
})
export class LveModule {}
