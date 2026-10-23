import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { DevicesModule } from './devices/devices.module';
import { ImagesModule } from './images/images.module';
import { RetentionModule } from './retention/retention.module';
import { AuditModule } from './audit/audit.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    IngestionModule,
    DevicesModule,
    ImagesModule,
    RetentionModule,
    AuditModule,
    RealtimeModule,
    HealthModule,
    NotificationsModule,
  ],
})
export class AppModule {}

