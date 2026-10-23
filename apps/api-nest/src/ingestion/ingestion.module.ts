import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { GridFsStorageService } from './storage.service';
import { DeduplicationService } from './dedup.service';
import { DatabaseService } from '../database/database.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [IngestionController],
  providers: [GridFsStorageService, DeduplicationService, DatabaseService],
  exports: [GridFsStorageService, DeduplicationService],
})
export class IngestionModule {}
