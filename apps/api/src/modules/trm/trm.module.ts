import { Module } from '@nestjs/common';
import { TrmController } from './trm.controller';
import { TrmService } from './trm.service';

@Module({
  controllers: [TrmController],
  providers: [TrmService],
})
export class TrmModule {}
