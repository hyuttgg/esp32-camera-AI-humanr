import { Device, ImageMeta, RetentionPolicy, AuditEvent, TelemetryLog, HardwareTelemetryData, UserProfile } from './types';

export const MOCK_DEVICES: Device[] = [
  {
    id: 'ESP32-CAM-DEV-001',
    name: 'Camera 01 - Main Entrance (Demo)',
    macAddress: '24:6F:28:AB:12:34',
    ipAddress: '192.168.1.145',
    firmwareVersion: '1.4.2-turboquant',
    status: 'DEMO',
    lastHeartbeat: new Date().toISOString(),
    nightFlashEnabled: true,
    resolution: 'SVGA',
    freeHeap: 142850,
    freePsram: 3840120,
  },
  {
    id: 'ESP32-CAM-DEV-002',
    name: 'Camera 02 - Server Lab (Demo)',
    macAddress: '24:6F:28:AB:56:78',
    ipAddress: '192.168.1.146',
    firmwareVersion: '1.4.2-turboquant',
    status: 'DEMO',
    lastHeartbeat: new Date(Date.now() - 45000).toISOString(),
    nightFlashEnabled: false,
    resolution: 'VGA',
    freeHeap: 138200,
    freePsram: 3792000,
  },
];

export const MOCK_RETENTION: RetentionPolicy = {
  id: 'pol-default-01',
  mode: 'AFTER_CAPTURE',
  retentionHours: 15,
  dailyCutoffTime: '15:00',
  timezone: 'Asia/Ho_Chi_Minh',
  lastPurgeAt: new Date(Date.now() - 3600000).toISOString(),
  nextPurgeAt: new Date(Date.now() + 14 * 3600000).toISOString(),
  totalPurgedCount: 1428,
  totalPurgedBytes: 94829104,
};

// Generate high-fidelity demo frames with synthetic svg data
function createSvgDataUrl(title: string, isDark: boolean, hasPerson: boolean, id: string): string {
  const bg = isDark ? '#050c17' : '#142a45';
  const personSvg = hasPerson
    ? `<circle cx="160" cy="80" r="30" fill="${isDark ? '#38bdf8' : '#22d3ee'}" opacity="0.85"/>
       <path d="M120,130 C120,110 200,110 200,130 L195,200 L125,200 Z" fill="${isDark ? '#38bdf8' : '#22d3ee'}" opacity="0.85"/>
       <rect x="110" y="45" width="100" height="165" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="4"/>
       <text x="115" y="40" fill="#22d3ee" font-family="monospace" font-size="12">PERSON: 95.4%</text>`
    : `<text x="160" y="120" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="14">NO MOTION DETECTED</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="${bg}"/>
    <line x1="0" y1="60" x2="320" y2="60" stroke="#1e293b" stroke-width="0.5"/>
    <line x1="0" y1="120" x2="320" y2="120" stroke="#1e293b" stroke-width="0.5"/>
    <line x1="0" y1="180" x2="320" y2="180" stroke="#1e293b" stroke-width="0.5"/>
    ${personSvg}
    <text x="10" y="20" fill="#38bdf8" font-family="monospace" font-size="10">${title}</text>
    <text x="10" y="230" fill="#64748b" font-family="monospace" font-size="9">FRAME ID: ${id} | RAM ONLY STREAM</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MOCK_IMAGES: ImageMeta[] = [
  {
    id: 'img-demo-001',
    deviceId: 'ESP32-CAM-DEV-001',
    filename: 'capture_1792667000.jpg',
    capturedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 15 - 1000 * 60 * 5).toISOString(),
    sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
    dhash: '000c0e0e0e0e0c00',
    sizeBytes: 42180,
    width: 640,
    height: 480,
    isDuplicate: false,
    hammingDistance: 0,
    personDetected: true,
    confidence: 0.954,
    meanLuminance: 38.5,
    isDark: true,
    detections: [{ label: 'person', score: 0.954, box: [110, 45, 100, 165] }],
  },
  {
    id: 'img-demo-002',
    deviceId: 'ESP32-CAM-DEV-001',
    filename: 'capture_1792667015.jpg',
    capturedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 15 - 1000 * 60 * 12).toISOString(),
    sha256: '8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c',
    dhash: '000c0e0e0e0e0c02',
    sizeBytes: 41850,
    width: 640,
    height: 480,
    isDuplicate: true,
    hammingDistance: 1,
    personDetected: true,
    confidence: 0.941,
    meanLuminance: 39.1,
    isDark: true,
    detections: [{ label: 'person', score: 0.941, box: [112, 46, 100, 165] }],
  },
  {
    id: 'img-demo-003',
    deviceId: 'ESP32-CAM-DEV-001',
    filename: 'capture_1792667030.jpg',
    capturedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 15 - 1000 * 60 * 45).toISOString(),
    sha256: '7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d',
    dhash: '1f3e7a0b5c9d2e4f',
    sizeBytes: 38200,
    width: 640,
    height: 480,
    isDuplicate: false,
    hammingDistance: 19,
    personDetected: false,
    confidence: 0.12,
    meanLuminance: 62.4,
    isDark: false,
    detections: [],
  },
];

export const MOCK_AUDIT_LOGS: AuditEvent[] = [
  {
    id: 'aud-001',
    action: 'DEVICE_HEARTBEAT',
    actor: 'ESP32-CAM-DEV-001',
    deviceId: 'ESP32-CAM-DEV-001',
    details: 'Heartbeat ping received (Free Heap: 142KB, Free PSRAM: 3.8MB)',
    ipAddress: '192.168.1.145',
    timestamp: new Date().toISOString(),
    status: 'SUCCESS',
  },
  {
    id: 'aud-002',
    action: 'IMAGE_INGESTION',
    actor: 'ESP32-CAM-DEV-001',
    deviceId: 'ESP32-CAM-DEV-001',
    details: 'JPEG streamed to GridFS (42.1 KB, dHash: 000c0e0e0e0e0c00, Person: 95.4%)',
    ipAddress: '192.168.1.145',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: 'SUCCESS',
  },
  {
    id: 'aud-003',
    action: 'DEDUP_DISCARD',
    actor: 'SYSTEM_DEDUP_ENGINE',
    deviceId: 'ESP32-CAM-DEV-001',
    details: 'Near-duplicate discarded (Hamming distance: 1 <= 8 threshold)',
    ipAddress: '127.0.0.1',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: 'WARNING',
  },
  {
    id: 'aud-004',
    action: 'RETENTION_PURGE',
    actor: 'CRON_SCHEDULER',
    details: 'Automated 15h purge executed. 48 expired frames deleted from GridFS.',
    ipAddress: '127.0.0.1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'SUCCESS',
  },
];

export const MOCK_TELEMETRY_LOGS: TelemetryLog[] = [
  {
    id: 'log-1',
    timestamp: '18:14:02.124',
    level: 'INFO',
    source: 'esp32_cam',
    message: '[BOOT] ESP-IDF v5.1.2 initializing on ESP32-WROVER-E (Dual Core 240MHz)...',
  },
  {
    id: 'log-2',
    timestamp: '18:14:02.482',
    level: 'INFO',
    source: 'psram',
    message: '[PSRAM] 4MB External SPI RAM detected and mapped at 0x3F800000.',
  },
  {
    id: 'log-3',
    timestamp: '18:14:03.110',
    level: 'INFO',
    source: 'camera',
    message: '[OV2640] Sensor PID: 0x26, MID: 0x7F initialized in SVGA JPEG mode.',
  },
  {
    id: 'log-4',
    timestamp: '18:14:04.290',
    level: 'INFO',
    source: 'turboquant',
    message: '[TURBOQUANT] INT4 Weight Quantization Kernel loaded. Speedup 6.2x active.',
  },
  {
    id: 'log-5',
    timestamp: '18:14:05.112',
    level: 'INFO',
    source: 'wifi',
    message: '[WiFi-STA] Connected to SSID "OceanMesh_Secure". IP: 192.168.1.145, RSSI: -48dBm',
  },
  {
    id: 'log-6',
    timestamp: '18:14:06.002',
    level: 'INFO',
    source: 'telemetry',
    message: '[WS] WebSocket Telemetry channel open to backend ws://192.168.1.5:3000/ws/telemetry',
  },
];

export const MOCK_HARDWARE_TELEMETRY: HardwareTelemetryData = {
  deviceId: 'ESP32-CAM-DEV-001',
  timestamp: new Date().toISOString(),
  cpu: {
    freqMHz: 160,
    cores: 2,
    usagePercent: 22.4,
  },
  dram: {
    freeBytes: 142850,
    totalBytes: 327680,
    minFreeBytes: 112000,
    usagePercent: 56.4,
  },
  psram: {
    found: true,
    freeBytes: 3840120,
    totalBytes: 4194304,
    usagePercent: 8.4,
  },
  flash: {
    chipSizeBytes: 4194304,
    speedHz: 40000000,
    sketchUsedBytes: 431777,
    sketchFreeBytes: 2713951,
  },
  wifi: {
    rssi: -48,
    ip: '192.168.1.145',
  },
  uptimeSec: 7240,
};

export const MOCK_USER: UserProfile = {
  id: 'usr-001',
  email: 'khanh.engineer@gmail.com',
  username: 'khanh_engineer',
  fullName: 'Khanh Engineer (Google Verified)',
  avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
  roles: ['ADMIN', 'OPERATOR'],
};

export { createSvgDataUrl };

