import { Module } from '@nestjs/common';
import { HamController } from './ham.controller';
import { HamService } from './ham.service';

@Module({
  controllers: [HamController],
  providers: [HamService],
})
export class HamModule {}
