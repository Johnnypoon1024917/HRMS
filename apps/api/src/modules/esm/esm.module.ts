import { Module } from '@nestjs/common';
import { EsmController } from './esm.controller';
import { EsmService } from './esm.service';

@Module({
  controllers: [EsmController],
  providers: [EsmService],
})
export class EsmModule {}
