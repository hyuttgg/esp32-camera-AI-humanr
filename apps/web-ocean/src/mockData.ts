import { Device, ImageMeta, RetentionPolicy, AuditEvent, TelemetryLog, HardwareTelemetryData, UserProfile } from './types';

// Không chứa bất kỳ thiết bị ảo hay ảnh ảo nào — 100% chờ dữ liệu thật từ ESP32-CAM
export const MOCK_DEVICES: Device[] = [];

export const MOCK_RETENTION: RetentionPolicy = {
  id: 'pol-default-01',
  mode: 'AFTER_CAPTURE',
  retentionHours: 15,
  dailyCutoffTime: '15:00',
  timezone: 'Asia/Ho_Chi_Minh',
  lastPurgeAt: new Date().toISOString(),
  nextPurgeAt: new Date(Date.now() + 15 * 3600000).toISOString(),
  totalPurgedCount: 0,
  totalPurgedBytes: 0,
};

export function createSvgDataUrl(title: string, isDark: boolean, hasPerson: boolean, id: string): string {
  const bg = '#050c17';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="${bg}"/>
    <line x1="0" y1="60" x2="320" y2="60" stroke="#1e293b" stroke-width="0.5"/>
    <line x1="0" y1="120" x2="320" y2="120" stroke="#1e293b" stroke-width="0.5"/>
    <line x1="0" y1="180" x2="320" y2="180" stroke="#1e293b" stroke-width="0.5"/>
    <text x="160" y="115" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="11">${title}</text>
    <text x="160" y="135" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="9">ĐANG CHỜ KHUNG HÌNH JPEG THẬT TỪ ESP32-CAM...</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MOCK_IMAGES: ImageMeta[] = [];

export const MOCK_AUDIT_LOGS: AuditEvent[] = [];

export const MOCK_TELEMETRY_LOGS: TelemetryLog[] = [];

export const MOCK_HARDWARE_TELEMETRY: HardwareTelemetryData = {
  deviceId: 'CHƯA KẾT NỐI',
  timestamp: new Date().toISOString(),
  cpu: {
    freqMHz: 0,
    cores: 2,
    usagePercent: 0,
  },
  dram: {
    freeBytes: 0,
    totalBytes: 327680,
    minFreeBytes: 0,
    usagePercent: 0,
  },
  psram: {
    found: false,
    freeBytes: 0,
    totalBytes: 4194304,
    usagePercent: 0,
  },
  flash: {
    chipSizeBytes: 4194304,
    speedHz: 40000000,
    sketchUsedBytes: 0,
    sketchFreeBytes: 0,
  },
  wifi: {
    rssi: 0,
    ip: 'Chưa kết nối',
  },
  uptimeSec: 0,
};

export const MOCK_USER: UserProfile | null = null;
