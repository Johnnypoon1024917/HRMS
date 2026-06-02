import { Module } from '@nestjs/common';
import { PemController } from './pem.controller';
import { PemService } from './pem.service';

@Module({
  controllers: [PemController],
  providers: [PemService],
})
export class PemModule {}
