import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [GmailService],
  exports: [GmailService],
})
export class NotificationsModule {}

