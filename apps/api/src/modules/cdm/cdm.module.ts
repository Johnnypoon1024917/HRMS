import { Module } from '@nestjs/common';
import { CdmController } from './cdm.controller';
import { CdmService } from './cdm.service';

@Module({
  controllers: [CdmController],
  providers: [CdmService],
})
export class CdmModule {}
