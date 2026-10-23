import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RetentionService } from './retention.service';

@Controller('api/v1/retention')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RetentionController {
  constructor(private retentionService: RetentionService) {}

  @Get('status')
  @Roles('VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
  getStatus() {
    return this.retentionService.getRetentionStats();
  }

  @Put('policy')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updatePolicy(@Body() body: any) {
    return this.retentionService.updatePolicy(body);
  }

  @Post('purge-now')
  @Roles('ADMIN', 'SUPER_ADMIN')
  triggerPurgeNow() {
    return this.retentionService.executeRetentionPurge();
  }
}

