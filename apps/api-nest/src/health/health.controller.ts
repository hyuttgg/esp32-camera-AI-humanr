import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('api/v1')
export class HealthController {
  constructor(private db: DatabaseService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'UP',
      service: 'Ocean Vision ESP32-CAM Core API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      databases: {
        mysql: this.db.isMysqlConnected ? 'CONNECTED' : 'IN_MEMORY_FALLBACK',
        mongodb: this.db.isMongoConnected ? 'CONNECTED' : 'IN_MEMORY_FALLBACK',
        gridfs: this.db.isMongoConnected ? 'CONNECTED' : 'MEMORY_BACKED',
        redis: this.db.isRedisConnected ? 'CONNECTED' : 'IN_MEMORY_LOCK',
      },
      retentionMode: process.env.RETENTION_MODE || 'AFTER_CAPTURE',
      activeDevicesCount: this.db.mockDevices.size,
    };
  }

  @Get('ready')
  getReady() {
    return { ready: true };
  }
}

