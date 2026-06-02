import { Module } from '@nestjs/common';
import { ExmController } from './exm.controller';
import { ExmService } from './exm.service';

@Module({
  controllers: [ExmController],
  providers: [ExmService],
})
export class ExmModule {}
