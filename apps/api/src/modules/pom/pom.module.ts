import { Module } from '@nestjs/common';
import { PomController } from './pom.controller';
import { PomService } from './pom.service';

@Module({
  controllers: [PomController],
  providers: [PomService],
})
export class PomModule {}
