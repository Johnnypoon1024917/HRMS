import { Module } from '@nestjs/common';
import { RecController } from './rec.controller';
import { RecService } from './rec.service';

@Module({
  controllers: [RecController],
  providers: [RecService],
})
export class RecModule {}
