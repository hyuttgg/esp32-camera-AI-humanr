import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller(['audit', 'audit-events', 'v1/audit-events'])
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  getEvents(@Query('page') page?: string, @Query('limit') limit?: string, @Query('action') action?: string) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '50', 10);
    return this.auditService.getAuditEvents(pageNum, limitNum, action);
  }
}

