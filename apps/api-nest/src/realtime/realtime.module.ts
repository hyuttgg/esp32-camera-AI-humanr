import { Module } from '@nestjs/common';
import { TelemetryGateway } from './telemetry.gateway';

@Module({
  providers: [TelemetryGateway],
  exports: [TelemetryGateway],
})
export class RealtimeModule {}

