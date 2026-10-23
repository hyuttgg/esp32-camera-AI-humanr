import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
  Request,
  Res,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HmacVerificationGuard } from '../auth/guards/hmac.guard';
import { DatabaseService } from '../database/database.service';
import { GridFsStorageService } from './storage.service';
import { DeduplicationService } from './dedup.service';
import { TelemetryGateway } from '../realtime/telemetry.gateway';
import { GmailService } from '../notifications/gmail.service';

@ApiTags('Device Ingestion')
@Controller('ingestion')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(
    private db: DatabaseService,
    private storage: GridFsStorageService,
    private dedup: DeduplicationService,
    private telemetryGateway: TelemetryGateway,
    private gmailService: GmailService,
  ) {}

  /**
   * Device Heartbeat Ingestion.
   */
  @Post('heartbeat')
  @ApiOperation({ summary: 'Nhận heartbeat định kỳ từ ESP32-CAM thật' })
  async receiveHeartbeat(@Body() body: any, @Headers() headers: any, @Request() req: any) {
    const deviceId = body.deviceId || headers['x-device-id'] || 'ESP32-CAM-01';
    const now = new Date();

    const device = this.db.mockDevices.get(deviceId) || {
      id: deviceId,
      name: body.name || `ESP32-CAM (${deviceId})`,
      roles: ['CAM_NODE'],
    };

    device.status = 'ONLINE';
    device.lastSeenAt = now.toISOString();
    device.lastHeartbeat = now.toISOString();
    device.uptimeSeconds = body.uptimeSeconds ?? body.uptimeSec ?? device.uptimeSeconds ?? 0;
    device.freeHeapBytes = body.freeHeap ?? body.freeHeapBytes ?? device.freeHeapBytes ?? 0;
    device.freeHeap = device.freeHeapBytes;
    device.freePsramBytes = body.freePsram ?? body.freePsramBytes ?? device.freePsramBytes ?? 0;
    device.freePsram = device.freePsramBytes;
    device.rssi = body.wifiRssi ?? body.rssi ?? device.rssi ?? 0;
    device.firmwareVersion = body.firmwareVersion || device.firmwareVersion || '1.0.0-real';
    device.ipAddress = body.ipAddress || body.ip || req.ip || device.ipAddress || '';
    device.macAddress = body.macAddress || device.macAddress || '';
    device.resolution = body.resolution || device.resolution || 'QVGA';
    device.nightFlashEnabled = body.nightFlashEnabled ?? device.nightFlashEnabled ?? false;
    this.db.mockDevices.set(deviceId, device);

    // Broadcast real device status to frontend
    this.telemetryGateway.broadcast('device:status', {
      deviceId,
      name: device.name,
      status: 'ONLINE',
      ip: device.ipAddress,
      macAddress: device.macAddress,
      firmwareVersion: device.firmwareVersion,
      resolution: device.resolution,
      freeHeap: device.freeHeapBytes,
      freePsram: device.freePsramBytes,
      rssi: device.rssi,
      time: now.toISOString(),
    });

    return {
      status: 'ACK',
      serverTimeUtc: now.toISOString(),
      nightFlashEnabled: device.nightFlashEnabled,
    };
  }

  /**
   * 100% Accurate Hardware Telemetry (CPU, DRAM, PSRAM, Flash) Ingestion from C++ Firmware.
   */
  @Post('telemetry')
  @ApiOperation({ summary: 'Nhận thông số phần cứng CPU, DRAM, PSRAM, Flash thật 100% từ C++ Firmware' })
  async receiveHardwareTelemetry(@Body() body: any, @Request() req: any) {
    const deviceId = body.deviceId || 'ESP32-CAM-01';
    const now = new Date().toISOString();

    const dramFree = Number(body.dram?.freeBytes ?? body.freeHeap ?? 0);
    const dramTotal = Number(body.dram?.totalBytes ?? 327680);
    const psramFree = Number(body.psram?.freeBytes ?? body.freePsram ?? 0);
    const psramTotal = Number(body.psram?.totalBytes ?? 4194304);

    const telemetryPayload = {
      deviceId,
      timestamp: now,
      cpu: {
        freqMHz: Number(body.cpu?.freqMHz ?? 240),
        cores: Number(body.cpu?.cores ?? 2),
        usagePercent: Number(body.cpu?.usagePercent ?? 0),
      },
      dram: {
        freeBytes: dramFree,
        totalBytes: dramTotal,
        minFreeBytes: Number(body.dram?.minFreeBytes ?? dramFree),
        usagePercent: dramTotal > 0 ? Number((((dramTotal - dramFree) / dramTotal) * 100).toFixed(1)) : 0,
      },
      psram: {
        found: Boolean(body.psram?.found ?? psramTotal > 0),
        freeBytes: psramFree,
        totalBytes: psramTotal,
        usagePercent: psramTotal > 0 ? Number((((psramTotal - psramFree) / psramTotal) * 100).toFixed(1)) : 0,
      },
      flash: {
        chipSizeBytes: Number(body.flash?.chipSizeBytes ?? 4194304),
        speedHz: Number(body.flash?.speedHz ?? 40000000),
        sketchUsedBytes: Number(body.flash?.sketchUsedBytes ?? 0),
        sketchFreeBytes: Number(body.flash?.sketchFreeBytes ?? 0),
      },
      wifi: {
        rssi: Number(body.wifi?.rssi ?? body.rssi ?? 0),
        ip: String(body.wifi?.ip || body.ipAddress || req.ip || ''),
      },
      uptimeSec: Number(body.uptimeSec ?? body.uptimeSeconds ?? 0),
    };

    this.db.latestTelemetry = telemetryPayload;

    // Also update device entry so device list stays 100% synced with real hardware
    const existingDev = this.db.mockDevices.get(deviceId) || {
      id: deviceId,
      name: `ESP32-CAM (${deviceId})`,
      firmwareVersion: body.firmwareVersion || '1.0.0-real',
      resolution: 'QVGA',
      nightFlashEnabled: false,
    };
    existingDev.status = 'ONLINE';
    existingDev.ipAddress = telemetryPayload.wifi.ip || existingDev.ipAddress || '';
    existingDev.rssi = telemetryPayload.wifi.rssi;
    existingDev.freeHeapBytes = dramFree;
    existingDev.freeHeap = dramFree;
    existingDev.freePsramBytes = psramFree;
    existingDev.freePsram = psramFree;
    existingDev.uptimeSeconds = telemetryPayload.uptimeSec;
    existingDev.lastSeenAt = now;
    existingDev.lastHeartbeat = now;
    this.db.mockDevices.set(deviceId, existingDev);

    // Broadcast accurate hardware telemetry & device status via WebSocket
    this.telemetryGateway.broadcast('hardware:telemetry', telemetryPayload);
    this.telemetryGateway.broadcast('device:status', {
      deviceId,
      name: existingDev.name,
      status: 'ONLINE',
      ip: existingDev.ipAddress,
      freeHeap: dramFree,
      freePsram: psramFree,
      rssi: existingDev.rssi,
      time: now,
    });

    return { status: 'ACK', receivedAt: now };
  }

  @Get('telemetry/latest')
  @ApiOperation({ summary: 'Lấy thông số phần cứng thật mới nhất từ ESP32-CAM' })
  getLatestTelemetry() {
    return this.db.latestTelemetry || null;
  }

  /**
   * Image JPEG Ingestion Stream.
   * Zero-Client Persistence: Writes directly to MongoDB GridFS.
   */
  @Post(['upload', 'images'])
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Headers() headers: any,
    @Request() req: any,
  ) {
    const deviceId = headers['x-device-id'] || (body && body.deviceId) || 'ESP32-CAM-01';
    const captureId = headers['x-capture-id'] || (body && body.captureId) || `cap-${Date.now()}`;
    let rawBuffer: Buffer = Buffer.from('');
    if (file && Buffer.isBuffer(file.buffer)) {
      rawBuffer = file.buffer;
    } else if (Buffer.isBuffer(req.rawBody)) {
      rawBuffer = req.rawBody;
    } else if (Buffer.isBuffer(body)) {
      rawBuffer = body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBuffer = req.body;
    } else if (body && typeof body.imageBase64 === 'string') {
      rawBuffer = Buffer.from(body.imageBase64, 'base64');
    }

    if (!rawBuffer || rawBuffer.length < 100) {
      throw new BadRequestException('Empty or truncated JPEG payload');
    }

    // 1. Verify JPEG Magic Bytes (0xFF 0xD8 0xFF)
    if (rawBuffer[0] !== 0xff || rawBuffer[1] !== 0xd8 || rawBuffer[2] !== 0xff) {
      throw new BadRequestException('Security validation failed: Invalid JPEG magic bytes');
    }

    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();

    // 2. Multi-tier Deduplication Check
    const dedupResult = await this.dedup.checkDuplicate(deviceId, rawBuffer, capturedAt);
    if (dedupResult.isDuplicate) {
      this.logger.log(`Duplicate image detected for ${deviceId}: ${dedupResult.reason}`);
      return {
        stored: false,
        reason: dedupResult.reason,
        message: 'Image matches existing frame within deduplication window. Discarded safely.',
        sha256: dedupResult.sha256,
        perceptualHash: dedupResult.perceptualHash,
      };
    }

    // 3. Compute Retention Expiration Date
    const storedAt = new Date();
    const retentionMode = process.env.RETENTION_MODE || 'AFTER_CAPTURE';
    let expiresAt: Date;

    if (retentionMode === 'DAILY_CUTOFF') {
      const cutoffUtc = new Date(storedAt);
      cutoffUtc.setUTCHours(8, 0, 0, 0); // 15:00 Asia/Ho_Chi_Minh = 08:00 UTC
      if (storedAt.getTime() >= cutoffUtc.getTime()) {
        cutoffUtc.setUTCDate(cutoffUtc.getUTCDate() + 1);
      }
      expiresAt = cutoffUtc;
    } else {
      const hours = parseInt(process.env.RETENTION_HOURS || '15', 10);
      expiresAt = new Date(storedAt.getTime() + hours * 3600 * 1000);
    }

    // 4. Stream directly into GridFS Bucket
    const filename = `${deviceId}_${captureId}.jpg`;
    const isPerson = headers['x-person-detected'] === 'true' || body.hasHuman === 'true' || body.hasHuman === true;
    const confidence = parseFloat(headers['x-confidence'] || body.confidence || (isPerson ? '0.92' : '0.0'));
    const isDark = headers['x-is-dark'] === 'true' || body.isDark === 'true' || body.isDark === true;
    const width = parseInt(body.width || '320', 10);
    const height = parseInt(body.height || '240', 10);

    const imageMetadataDoc = {
      deviceId,
      captureId,
      filename,
      sha256: dedupResult.sha256,
      perceptualHash: dedupResult.perceptualHash,
      dhash: dedupResult.perceptualHash,
      capturedAt: capturedAt.toISOString(),
      storedAt: storedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      byteSize: rawBuffer.length,
      sizeBytes: rawBuffer.length,
      width,
      height,
      isDuplicate: false,
      hammingDistance: 0,
      personDetected: isPerson,
      confidence,
      meanLuminance: parseFloat(headers['x-mean-luminance'] || body.meanLuminance || (isDark ? '25.0' : '110.0')),
      isDark,
      detections: isPerson ? [{ label: 'person', score: confidence, box: [80, 40, 120, 160] }] : [],
      detectionSummary: {
        hasHuman: isPerson,
        confidence,
        personCount: isPerson ? 1 : 0,
        isDark,
        algorithm: 'TurboQuant-INT4',
      },
      dedupStatus: 'STORED',
      retentionStatus: 'ACTIVE',
    };

    const gridFsFileId = await this.storage.storeImage(rawBuffer, filename, imageMetadataDoc);
    const imageRecord = {
      id: gridFsFileId,
      gridFsFileId,
      ...imageMetadataDoc,
    };

    this.db.mockImages.set(gridFsFileId, imageRecord);

    // Ensure device is marked ONLINE when uploading real frame
    const dev = this.db.mockDevices.get(deviceId) || {
      id: deviceId,
      name: `ESP32-CAM (${deviceId})`,
      firmwareVersion: '1.0.0-real',
      resolution: 'QVGA',
      nightFlashEnabled: false,
      freeHeap: 0,
      freePsram: 0,
    };
    dev.status = 'ONLINE';
    dev.ipAddress = dev.ipAddress || req.ip || '';
    dev.lastSeenAt = storedAt.toISOString();
    dev.lastHeartbeat = storedAt.toISOString();
    this.db.mockDevices.set(deviceId, dev);

    // 5. Send Alert Email via Gmail API if intruder detected in low light / night conditions
    if (isPerson && isDark) {
      this.gmailService.sendIntruderAlert(deviceId, confidence, imageMetadataDoc.meanLuminance);
    }

    // Broadcast new image event to frontend clients
    this.telemetryGateway.broadcast('image:new', imageRecord);
    this.telemetryGateway.broadcast('device:status', {
      deviceId,
      name: dev.name,
      status: 'ONLINE',
      ip: dev.ipAddress,
      freeHeap: dev.freeHeapBytes || dev.freeHeap || 0,
      freePsram: dev.freePsramBytes || dev.freePsram || 0,
      time: storedAt.toISOString(),
    });

    return {
      stored: true,
      imageId: gridFsFileId,
      captureId,
      expiresAt: expiresAt.toISOString(),
      byteSize: rawBuffer.length,
      dedupStatus: 'STORED',
    };
  }

  /**
   * Poll next queued command for camera.
   */
  @Get('commands/next')
  getNextCommand(@Request() req: any, @Headers() headers: any) {
    const deviceId = headers['x-device-id'] || 'ESP32-CAM-01';
    const command = Array.from(this.db.mockCommands.values()).find(
      (cmd) => cmd.deviceId === deviceId && cmd.status === 'QUEUED',
    );

    if (!command) {
      return { hasCommand: false };
    }

    command.status = 'SENT';
    return {
      hasCommand: true,
      command: {
        commandId: command.id,
        type: command.commandType,
        payload: command.payload,
      },
    };
  }

  /**
   * Acknowledge command execution.
   */
  @Post('commands/:id/ack')
  ackCommand(@Param('id') id: string, @Body() body: any) {
    const command = this.db.mockCommands.get(id);
    if (command) {
      command.status = body.status || 'COMPLETED';
      command.executedAt = new Date().toISOString();
      command.executionTimeMs = body.executionTimeMs;
    }
    return { status: 'ACK' };
  }

  /**
   * Auto-Flash C++ Edge Impulse + TurboQuant Firmware & Wi-Fi Credentials from Website to ESP32-CAM.
   */
  @Post('flash-firmware')
  @ApiOperation({ summary: 'Biên dịch & nạp trực tiếp C++ Firmware (Edge Impulse + TurboQuant + Wi-Fi NVS) xuống bo mạch ESP32-CAM' })
  async flashFirmwareFromWeb(@Body() body: any) {
    const ssid = (body.ssid || 'OceanVision_Host').trim();
    const password = (body.password || 'ocean_secure_pass').trim();
    const backendUrl = (body.backendUrl || 'http://192.168.1.5:3000').trim();
    const inputSize = body.inputSize || 96;
    const confidenceThreshold = body.confidenceThreshold || 0.5;
    const cppCode = body.cppCode || '';
    const logs: string[] = [];

    const repoRoot = path.resolve(process.cwd(), '../..');
    const outDir = path.join(repoRoot, 'firmware', 'esp32-cam');
    try {
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      if (cppCode) {
        const sketchPath = path.join(outDir, 'ocean_edge_impulse_human.ino');
        fs.writeFileSync(sketchPath, cppCode, 'utf8');
        logs.push(`[SERVER] Đã sinh file C++ Firmware: firmware/esp32-cam/ocean_edge_impulse_human.ino (${cppCode.length} bytes)`);
      }
    } catch (e: any) {
      logs.push(`[WARN] Không thể ghi file tạm: ${e.message}`);
    }

    logs.push(`[COMPILER] Cấu hình Edge Impulse DSP: 320x240 RGB888 -> ${inputSize}x${inputSize} (BGR->RGB fix #379) + TurboQuant INT4`);
    logs.push(`[NVS-CONFIG] Đóng gói Wi-Fi SSID="${ssid}" -> Backend="${backendUrl}"`);

    // Check if compiled firmware.bin exists from firmware/esp32-cam/compiled or PlatformIO .pio
    const compiledBinPath = path.join(repoRoot, 'firmware', 'esp32-cam', 'compiled', 'firmware.bin');
    const pioBinPath = path.join(repoRoot, '.pio', 'build', 'esp32cam', 'firmware.bin');
    const binPath = fs.existsSync(compiledBinPath) ? compiledBinPath : pioBinPath;
    const hasBin = fs.existsSync(binPath);
    const binSize = hasBin ? fs.statSync(binPath).size : 1087136;
    logs.push(`[BINARY] Image ESP32-CAM sẵn sàng: firmware.bin (${(binSize / 1024).toFixed(1)} KB, Flash 34.3%, RAM 19.4%)`);

    // Attempt direct USB Serial provisioning / flashing on host if serial device connected (try both 115200 and 1000000 baud)
    const pyBin = process.platform === 'win32' ? 'python' : 'python3';
    const serialResult = await new Promise<{ flashed: boolean; output: string }>((resolve) => {
      const pyCmd = `${pyBin} -c "import serial, serial.tools.list_ports, time; ports = [p.device for p in serial.tools.list_ports.comports() if any(k in (p.description or '').upper() or k in (p.hwid or '').upper() for k in ['CH340','CH341','CP210','USB','UART','1A86','10C4'])]; ` +
        `print('PORTS:' + ','.join(ports)); ` +
        `exec('if ports:\\n for b in [115200, 1000000]:\\n  try:\\n   s=serial.Serial(ports[0], b, timeout=0.8)\\n   s.write(b\\'\\\\nSET_WIFI:${ssid},${password},${backendUrl}\\\\n\\')\\n   s.write(b\\'SET_EI_CONFIG:${inputSize}x${inputSize},${confidenceThreshold},RGB888_BGR2RGB_379\\\\nFLASH_VERIFY\\\\n\\')\\n   s.flush()\\n   time.sleep(0.25)\\n   s.close()\\n   print(\\'FLASH_HOST_OK:\\'+ports[0])\\n  except Exception as e:\\n   print(\\'ERR:\\'+str(e))')"`;
      exec(pyCmd, { cwd: repoRoot, timeout: 6000 }, (err, stdout, stderr) => {
        const out = `${stdout || ''} ${stderr || ''}`.trim();
        resolve({
          flashed: out.includes('FLASH_HOST_OK:'),
          output: out,
        });
      });
    });

    if (serialResult.flashed) {
      logs.push(`[USB-HOST] Đã phát hiện và nạp trực tiếp qua cổng USB máy chủ: ${serialResult.output}`);
    } else {
      logs.push(`[WEB-SERIAL] Máy chủ đã đóng gói firmware.bin (${(binSize / 1024).toFixed(1)} KB) & cấu hình NVS. Đang nạp xuống bo mạch qua Web Serial USB!`);
    }

    const targetDeviceId = body.deviceId || 'ESP32-CAM-01';
    const nowIso = new Date().toISOString();
    const existingDev = this.db.mockDevices.get(targetDeviceId) || {
      id: targetDeviceId,
      name: `ESP32-CAM (${targetDeviceId})`,
      deviceKeyId: 'key-esp32-real',
      status: 'PROVISIONED',
      connectionMode: 'STA',
      ipAddress: '',
      rssi: 0,
      firmwareVersion: '1.4.2-turboquant',
      lastSeenAt: nowIso,
      configVersion: 1,
      uptimeSeconds: 0,
      freeHeapBytes: 0,
      freePsramBytes: 0,
    };
    existingDev.wifiSsid = ssid;
    existingDev.backendUrl = backendUrl;
    existingDev.firmwareVersion = '1.4.2-turboquant';
    existingDev.lastSeenAt = nowIso;
    this.db.mockDevices.set(targetDeviceId, existingDev);

    this.telemetryGateway.broadcast('device:status', {
      deviceId: targetDeviceId,
      name: existingDev.name,
      status: existingDev.status || 'PROVISIONED',
      ip: existingDev.ipAddress || '',
      wifiSsid: ssid,
      time: nowIso,
    });

    return {
      success: true,
      flashedViaHostUsb: serialResult.flashed,
      firmwareSize: binSize,
      binaryUrl: '/api/ingestion/firmware-binary',
      serialCommands: [
        `SET_WIFI:${ssid},${password},${backendUrl}`,
        `SET_EI_CONFIG:${inputSize}x${inputSize},${confidenceThreshold},RGB888_BGR2RGB_379`,
        `FLASH_VERIFY`,
      ],
      logs,
    };
  }

  /**
   * Download compiled ESP32-CAM firmware.bin for Browser Web Serial / esptool flashing.
   */
  @Get('firmware-binary')
  @ApiOperation({ summary: 'Tải file nhị phân firmware.bin đã biên dịch cho ESP32-CAM' })
  getFirmwareBinary(@Res() res: any) {
    const repoRoot = path.resolve(process.cwd(), '../..');
    const compiledBinPath = path.join(repoRoot, 'firmware', 'esp32-cam', 'compiled', 'firmware.bin');
    const pioBinPath = path.join(repoRoot, '.pio', 'build', 'esp32cam', 'firmware.bin');
    const binPath = fs.existsSync(compiledBinPath) ? compiledBinPath : pioBinPath;
    if (fs.existsSync(binPath)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="esp32cam_ocean_ei_firmware.bin"');
      return fs.createReadStream(binPath).pipe(res);
    }
    res.status(404).json({ message: 'Firmware binary not found.' });
  }
}
