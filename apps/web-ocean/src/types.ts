export interface Device {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  firmwareVersion: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEMO';
  lastHeartbeat: string;
  nightFlashEnabled: boolean;
  resolution: 'QVGA' | 'VGA' | 'SVGA' | 'HD';
  freeHeap: number;
  freePsram: number;
}

export interface ImageDetection {
  label: string;
  score: number;
  box: [number, number, number, number]; // [x, y, w, h]
}

export interface ImageMeta {
  id: string;
  deviceId: string;
  filename: string;
  capturedAt: string;
  expiresAt: string;
  sha256: string;
  dhash: string;
  sizeBytes: number;
  width: number;
  height: number;
  isDuplicate: boolean;
  hammingDistance: number;
  personDetected: boolean;
  confidence: number;
  meanLuminance: number;
  isDark: boolean;
  detections: ImageDetection[];
}

export interface ScheduleConfig {
  deviceId: string;
  enabled: boolean;
  intervalSeconds: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  quietHoursEnabled: boolean;
  rateLimitPerMinute: number;
  offlinePolicy: 'DROP_OLDEST' | 'BUFFER_RAM';
}

export interface RetentionPolicy {
  id: string;
  mode: 'AFTER_CAPTURE' | 'DAILY_CUTOFF';
  retentionHours: number;
  dailyCutoffTime: string; // "15:00"
  timezone: string;
  lastPurgeAt: string;
  nextPurgeAt: string;
  totalPurgedCount: number;
  totalPurgedBytes: number;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  deviceId?: string;
  details: string;
  ipAddress: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source: string;
}

export interface HardwareTelemetryData {
  deviceId: string;
  timestamp: string;
  cpu: {
    freqMHz: number;
    cores: number;
    usagePercent: number;
  };
  dram: {
    freeBytes: number;
    totalBytes: number;
    minFreeBytes: number;
    usagePercent: number;
  };
  psram: {
    found: boolean;
    freeBytes: number;
    totalBytes: number;
    usagePercent: number;
  };
  flash: {
    chipSizeBytes: number;
    speedHz: number;
    sketchUsedBytes: number;
    sketchFreeBytes: number;
  };
  wifi: {
    rssi: number;
    ip: string;
  };
  uptimeSec: number;
}

export interface UserProfile {
  id: number | string;
  email: string;
  username: string;
  fullName: string;
  avatar?: string;
  roles: string[];
}


