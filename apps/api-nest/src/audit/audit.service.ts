import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private db: DatabaseService) {}

  getAuditEvents(page = 1, limit = 50, action?: string) {
    let logs = this.db.mockAuditLogs;
    if (action) {
      logs = logs.filter((l) => l.action === action);
    }

    const total = logs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = logs.slice(startIndex, startIndex + limit);

    return {
      page,
      limit,
      total,
      totalPages,
      data,
    };
  }
}

