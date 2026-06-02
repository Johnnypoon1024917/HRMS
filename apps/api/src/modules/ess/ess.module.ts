import { Module } from '@nestjs/common';
import { LveModule } from '../lve/lve.module';
import { EssController } from './ess.controller';
import { EssService } from './ess.service';

@Module({
  imports: [LveModule], // reuses LveService for the leave summary
  controllers: [EssController],
  providers: [EssService],
})
export class EssModule {}
