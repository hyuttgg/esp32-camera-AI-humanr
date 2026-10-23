import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { RetentionController } from './retention.controller';
import { GridFsStorageService } from '../ingestion/storage.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [RetentionController],
  providers: [RetentionService, GridFsStorageService, DatabaseService],
  exports: [RetentionService],
})
export class RetentionModule {}

