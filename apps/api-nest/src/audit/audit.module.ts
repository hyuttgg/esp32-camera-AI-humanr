import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, DatabaseService],
  exports: [AuditService],
})
export class AuditModule {}

