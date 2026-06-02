import { Module } from '@nestjs/common';
import { HbmController } from './hbm.controller';
import { HbmService } from './hbm.service';

@Module({
  controllers: [HbmController],
  providers: [HbmService],
})
export class HbmModule {}
