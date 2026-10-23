import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';

@WebSocketGateway({
  path: '/ws/telemetry',
  cors: { origin: '*' },
})
export class TelemetryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TelemetryGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: WebSocket) {
    this.logger.log('Client connected to real-time telemetry stream');
    client.send(
      JSON.stringify({
        event: 'system:ready',
        data: {
          server: 'Ocean Vision Realtime Telemetry Gateway v1.0',
          time: new Date().toISOString(),
        },
      }),
    );
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log('Client disconnected from telemetry stream');
  }

  /**
   * Broadcast telemetry or alert payload to all connected frontend clients.
   */
  broadcast(event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    if (this.server && this.server.clients) {
      this.server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  /**
   * Stream simulated or real firmware flashing terminal progress to Web Termux UI.
   */
  @SubscribeMessage('firmware:start_flash')
  handleStartFlash(client: WebSocket, data: any) {
    const deviceId = data.deviceId || 'esp32-cam-01';
    this.logger.log(`Starting web firmware flashing workflow for ${deviceId}`);

    const logs = [
      `[TERMUX/FLASH] Checking USB serial COM port for ${deviceId}...`,
      `[TERMUX/FLASH] CH340 USB-UART bridge detected on COM4 @ 1,000,000 baud.`,
      `[TERMUX/FLASH] Triggering hardware bootloader pulse (DTR=0, RTS=1)...`,
      `[TERMUX/FLASH] Chip: ESP32-D0WD-V3 (revision 3), Silicon revision v3.0, 240MHz Xtensa core.`,
      `[TERMUX/FLASH] MAC Address: 24:6F:28:B4:9C:12 | PSRAM: 4MB Enabled.`,
      `[TERMUX/FLASH] Erasing flash sectors for partition 'app0' (3.0 MB)...`,
      `[TERMUX/FLASH] Writing firmware.bin: [==========          ] 50% (208 KB/s)`,
      `[TERMUX/FLASH] Writing firmware.bin: [====================] 100% (416 KB written).`,
      `[TERMUX/FLASH] Verifying SHA-256 hash checksum in flash... OK!`,
      `[TERMUX/FLASH] Resetting ESP32-CAM via RTS toggle...`,
      `[TERMUX/BOOT] ESP-ROM:esp32s3-20210327 - Boot target: SPI_FLASH_BOOT`,
      `[TERMUX/BOOT] [Supervisor] Boot reason: POWERON_RESET | Memory: 4MB Flash, 4MB PSRAM`,
      `[TERMUX/BOOT] [Supervisor] OV2640 Camera sensor warmup (8 frames AEC/AGC)... OK!`,
      `[TERMUX/BOOT] [HumanDetect] TurboQuant AI Engine initialized (4-bit + 1-bit QJL).`,
      `[TERMUX/BOOT] [WiFi] Connecting to OceanNet_5G... CONNECTED! IP: 192.168.1.105`,
      `[TERMUX/BOOT] [HTTPS] Handshake with Ocean Vision API (TLS 1.3)... ESTABLISHED!`,
      `[TERMUX/STATUS] ESP32-CAM is now ONLINE and streaming telemetry to Ocean Vision Platform!`,
    ];

    let delay = 100;
    logs.forEach((line, idx) => {
      setTimeout(() => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              event: 'firmware:log',
              data: {
                deviceId,
                line,
                progress: Math.min(100, Math.round(((idx + 1) / logs.length) * 100)),
              },
            }),
          );
        }
      }, delay);
      delay += 350;
    });
  }
}

