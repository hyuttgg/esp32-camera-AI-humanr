import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GmailService } from './gmail.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly gmailService: GmailService) {}

  @Post('test-email')
  @ApiOperation({ summary: 'Gửi thử nghiệm email thông báo qua Gmail API' })
  @ApiResponse({ status: 200, description: 'Kết quả gửi email thông báo' })
  async sendTestEmail(@Body('email') email?: string) {
    const target = email || process.env.ADMIN_ALERT_EMAIL || 'test.admin@oceanvision.io';
    return this.gmailService.sendIntruderAlert('ESP32-CAM-DEV-001', 0.965, 18.4, target);
  }
}

