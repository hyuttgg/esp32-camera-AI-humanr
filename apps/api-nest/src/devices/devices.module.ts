import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, DatabaseService],
  exports: [DevicesService],
})
export class DevicesModule {}

