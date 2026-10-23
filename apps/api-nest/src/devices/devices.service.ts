import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DevicesService {
  constructor(private db: DatabaseService) {}

  getAllDevices() {
    return Array.from(this.db.mockDevices.values());
  }

  getDeviceById(id: string) {
    const dev = this.db.mockDevices.get(id);
    if (!dev) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return dev;
  }

  queueCaptureCommand(deviceId: string, requestedBy: string, flashLed = false) {
    const dev = this.getDeviceById(deviceId);
    const commandId = `cmd-${Date.now()}`;
    const cmd = {
      id: commandId,
      deviceId,
      commandType: 'CAPTURE_NOW',
      payload: { flashLed, flashLevel: 45, resolution: 'HVGA' },
      requestedBy,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };

    this.db.mockCommands.set(commandId, cmd);

    // Audit log
    this.db.mockAuditLogs.unshift({
      id: Date.now(),
      actorType: 'USER',
      actorId: requestedBy,
      action: 'CAPTURE_NOW',
      targetType: 'DEVICE',
      targetId: deviceId,
      result: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });

    return cmd;
  }

  updateSchedule(deviceId: string, scheduleData: any) {
    const dev = this.getDeviceById(deviceId);
    dev.schedule = {
      ...scheduleData,
      updatedAt: new Date().toISOString(),
    };
    this.db.mockDevices.set(deviceId, dev);
    return dev.schedule;
  }
}

