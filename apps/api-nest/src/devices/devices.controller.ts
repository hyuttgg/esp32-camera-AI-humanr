import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevicesService } from './devices.service';

@Controller('api/v1/devices')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Get()
  @Roles('VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
  getAll() {
    return this.devicesService.getAllDevices();
  }

  @Get(':id')
  @Roles('VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
  getOne(@Param('id') id: string) {
    return this.devicesService.getDeviceById(id);
  }

  @Post(':id/commands/capture')
  @Roles('OPERATOR', 'ADMIN', 'SUPER_ADMIN')
  triggerCapture(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const flashLed = body.flashLed || false;
    const requestedBy = req.user ? req.user.email : 'admin';
    return this.devicesService.queueCaptureCommand(id, requestedBy, flashLed);
  }

  @Put(':id/schedule')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateSchedule(@Param('id') id: string, @Body() body: any) {
    return this.devicesService.updateSchedule(id, body);
  }
}

