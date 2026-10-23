import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { RetentionService } from './retention.service';

@Controller(['retention', 'v1/retention'])
export class RetentionController {
  constructor(private retentionService: RetentionService) {}

  @Get('status')
  getStatus() {
    return this.retentionService.getRetentionStats();
  }

  @Put('policy')
  updatePolicy(@Body() body: any) {
    return this.retentionService.updatePolicy(body);
  }

  @Post('purge-now')
  triggerPurgeNow() {
    return this.retentionService.executeRetentionPurge();
  }
}

