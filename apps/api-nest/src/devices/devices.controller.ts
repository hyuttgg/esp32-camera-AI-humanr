import { Controller, Get, Post, Put, Param, Body, Request } from '@nestjs/common';
import { DevicesService } from './devices.service';

@Controller(['devices', 'v1/devices'])
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Get()
  getAll() {
    return this.devicesService.getAllDevices();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.devicesService.getDeviceById(id);
  }

  @Post(':id/commands/capture')
  triggerCapture(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const flashLed = body.flashLed || false;
    const requestedBy = req.user ? req.user.email : 'admin';
    return this.devicesService.queueCaptureCommand(id, requestedBy, flashLed);
  }

  @Put(':id/schedule')
  updateSchedule(@Param('id') id: string, @Body() body: any) {
    return this.devicesService.updateSchedule(id, body);
  }
}

