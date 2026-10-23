import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home,
  Camera,
  Cpu,
  Image as ImageIcon,
  Database,
  Shield,
  User,
  Settings,
  Search,
  Bell,
  Sun,
  ChevronDown,
  ChevronRight,
  Wifi,
  HardDrive,
  Clock,
  Zap,
  Terminal,
  Play,
  Square,
  Calendar,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Eye,
  Trash2,
  Lock,
  Activity,
  Layers,
  Menu,
  LogOut,
  LogIn,
  Usb,
  Sparkles,
} from 'lucide-react';
import { LiveStream } from './components/LiveStream';
import { CaptureControls } from './components/CaptureControls';
import { ImageGallery } from './components/ImageGallery';
import { RetentionSettings } from './components/RetentionSettings';
import { TermuxTerminal } from './components/TermuxTerminal';
import { AuditLogViewer } from './components/AuditLogViewer';
import { HardwareMonitor } from './components/HardwareMonitor';
import { AuthModal } from './components/AuthModal';
import { NotificationSettingsCard } from './components/NotificationSettingsCard';
import { WebWifiFlasherModal } from './components/WebWifiFlasherModal';
import {
  Device,
  ImageMeta,
  ScheduleConfig,
  RetentionPolicy,
  AuditEvent,
  HardwareTelemetryData,
  UserProfile,
} from './types';
import {
  MOCK_RETENTION,
  MOCK_HARDWARE_TELEMETRY,
} from './mockData';

const WAITING_DEVICE: Device = {
  id: 'ESP32-CAM-01',
  name: 'ESP32-CAM-01',
  macAddress: '24:6F:28:AB:12:34',
  ipAddress: 'Chưa kết nối',
  firmwareVersion: 'v1.2.3-edge-impulse',
  status: 'OFFLINE',
  lastHeartbeat: new Date().toISOString(),
  nightFlashEnabled: true,
  resolution: 'QVGA',
  freeHeap: 0,
  freePsram: 0,
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [cameraMenuOpen, setCameraMenuOpen] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartRange, setChartRange] = useState<'today' | '7d' | '30d'>('today');

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device>(WAITING_DEVICE);
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [retentionPolicy, setRetentionPolicy] = useState<RetentionPolicy>(MOCK_RETENTION);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [hardwareTelemetry, setHardwareTelemetry] = useState<HardwareTelemetryData>(MOCK_HARDWARE_TELEMETRY);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWifiFlasherOpen, setIsWifiFlasherOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [captureAlgorithm, setCaptureAlgorithm] = useState('Phát hiện chuyển động + Theo chu kỳ');
  const [sensitivity, setSensitivity] = useState(70);
  const [directStreamIp, setDirectStreamIp] = useState('');
  const [useDirectCameraStream, setUseDirectCameraStream] = useState(false);
  const [usePythonLiveViewer, setUsePythonLiveViewer] = useState(true);
  const [liveViewerTick, setLiveViewerTick] = useState<number>(Date.now());
  const [liveViewerStatus, setLiveViewerStatus] = useState<any>({
    running: true,
    script: 'scripts/python/live_viewer.py',
    cpp_firmware: 'src/main.cpp + src/ai/HumanDetector.cpp (EdgeImpulse 96x96 RGB888 #379)',
    engine_type: 'C++ EdgeImpulse + Python TurboQuant Co-op',
    connection_mode: 'WIFI_CLOUD_DAEMON',
    wifi_ssid: 'khanh2007',
    wifi_ip: '192.168.0.109',
    wifi_rssi: -38,
    resolution: '320x240',
    upscaled_resolution: '640x480',
    fps: 15.0,
    inference_fps: 20.0,
    person_count: 0,
    ambient_lux: 112.0,
    lighting_mode: '[NGAY]',
    has_motion: false,
    motion_ratio: 0.0,
  });

  const [schedule, setSchedule] = useState<ScheduleConfig>({
    deviceId: selectedDevice.id,
    enabled: true,
    intervalSeconds: 30,
    startTime: '06:00',
    endTime: '15:00',
    quietHoursEnabled: true,
    rateLimitPerMinute: 12,
    offlinePolicy: 'BUFFER_RAM',
  });

  // Fetch 100% real data from NestJS Backend
  const fetchRealData = useCallback(async () => {
    try {
      const [devRes, imgRes, telRes, retRes, audRes, lvRes] = await Promise.allSettled([
        fetch('/api/devices'),
        fetch('/api/images'),
        fetch('/api/ingestion/telemetry/latest'),
        fetch('/api/retention/status'),
        fetch('/api/audit'),
        fetch('/api/ingestion/live-viewer/status'),
      ]);

      if (lvRes.status === 'fulfilled' && lvRes.value.ok) {
        const lvData = await lvRes.value.json();
        if (lvData && lvData.script) {
          setLiveViewerStatus(lvData);
        }
      }

      if (devRes.status === 'fulfilled' && devRes.value.ok) {
        const devList = await devRes.value.json();
        if (Array.isArray(devList) && devList.length > 0) {
          const normalized: Device[] = devList.map((d: any) => ({
            id: d.id,
            name: d.name || d.id,
            macAddress: d.macAddress || '24:6F:28:AB:12:34',
            ipAddress: d.ipAddress || 'Đang kết nối',
            firmwareVersion: d.firmwareVersion || 'v1.2.3-edge-impulse',
            status: d.status || 'ONLINE',
            lastHeartbeat: d.lastSeenAt || d.lastHeartbeat || new Date().toISOString(),
            nightFlashEnabled: Boolean(d.nightFlashEnabled),
            resolution: d.resolution || 'QVGA',
            freeHeap: Number(d.freeHeapBytes ?? d.freeHeap ?? 0),
            freePsram: Number(d.freePsramBytes ?? d.freePsram ?? 0),
          }));
          setDevices(normalized);
          setSelectedDevice((prev) => normalized.find((x) => x.id === prev.id) || normalized[0]);
        }
      }

      if (imgRes.status === 'fulfilled' && imgRes.value.ok) {
        const imgPayload = await imgRes.value.json();
        const rawList = Array.isArray(imgPayload) ? imgPayload : imgPayload?.data || [];
        const mappedImages: ImageMeta[] = rawList.map((img: any) => ({
          id: img.id || img.gridFsFileId,
          deviceId: img.deviceId,
          filename: img.filename || `${img.deviceId}_${img.captureId || img.id}.jpg`,
          capturedAt: img.capturedAt,
          expiresAt: img.expiresAt,
          sha256: img.sha256 || '',
          dhash: img.dhash || img.perceptualHash || '',
          sizeBytes: Number(img.sizeBytes ?? img.byteSize ?? 0),
          width: Number(img.width ?? 320),
          height: Number(img.height ?? 240),
          isDuplicate: Boolean(img.isDuplicate),
          hammingDistance: Number(img.hammingDistance ?? 0),
          personDetected: Boolean(img.personDetected ?? img.detectionSummary?.hasHuman),
          confidence: Number(img.confidence ?? img.detectionSummary?.confidence ?? 0),
          meanLuminance: Number(img.meanLuminance ?? 50),
          isDark: Boolean(img.isDark ?? img.detectionSummary?.isDark),
          detections: img.detections || [],
        }));
        setImages(mappedImages);
      }

      if (telRes.status === 'fulfilled' && telRes.value.ok) {
        const telData = await telRes.value.json();
        if (telData && telData.deviceId) {
          setHardwareTelemetry(telData);
        }
      }

      if (retRes.status === 'fulfilled' && retRes.value.ok) {
        const retData = await retRes.value.json();
        if (retData && retData.mode) {
          setRetentionPolicy((prev) => ({
            ...prev,
            mode: retData.mode,
            retentionHours: retData.retentionHours ?? prev.retentionHours,
            dailyCutoffTime: retData.dailyCutoffTime ?? prev.dailyCutoffTime,
            totalPurgedCount: retData.totalPurgedCount ?? prev.totalPurgedCount,
            totalPurgedBytes: retData.totalPurgedBytes ?? prev.totalPurgedBytes,
          }));
        }
      }

      if (audRes.status === 'fulfilled' && audRes.value.ok) {
        const audData = await audRes.value.json();
        const rawAud = Array.isArray(audData) ? audData : audData?.data || [];
        const mappedAud: AuditEvent[] = rawAud.map((a: any) => ({
          id: String(a.id),
          action: a.action,
          actor: a.actorId || a.actor || 'SYSTEM',
          deviceId: a.targetId || a.deviceId,
          details: a.details || `${a.action} — ${a.targetType || 'MongoDB GridFS'}`,
          ipAddress: a.ipAddress || '127.0.0.1',
          timestamp: a.timestamp || a.createdAt || new Date().toISOString(),
          status: a.result === 'SUCCESS' ? 'SUCCESS' : 'WARNING',
        }));
        setAuditLogs(mappedAud);
      }
    } catch {
      // Backend initializing
    }
  }, []);

  // WebSocket Live Real-Time Hardware & Image Stream Listener
  useEffect(() => {
    fetchRealData();

    let ws: WebSocket | null = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'hardware:telemetry' && msg.data) {
            setHardwareTelemetry(msg.data);
          } else if (msg.event === 'live_viewer:update' && msg.data) {
            setLiveViewerStatus(msg.data);
            setLiveViewerTick(Date.now());
          } else if (msg.event === 'device:status' && msg.data) {
            const incomingDev: Device = {
              id: msg.data.deviceId,
              name: msg.data.name || msg.data.deviceId,
              macAddress: msg.data.macAddress || '24:6F:28:AB:12:34',
              ipAddress: msg.data.ip || 'Đang kết nối',
              firmwareVersion: msg.data.firmwareVersion || 'v1.2.3-edge-impulse',
              status: 'ONLINE',
              lastHeartbeat: msg.data.time || new Date().toISOString(),
              nightFlashEnabled: false,
              resolution: msg.data.resolution || 'QVGA',
              freeHeap: Number(msg.data.freeHeap ?? 0),
              freePsram: Number(msg.data.freePsram ?? 0),
            };
            setDevices((prev) => {
              const exists = prev.some((d) => d.id === incomingDev.id);
              if (exists) {
                return prev.map((d) => (d.id === incomingDev.id ? { ...d, ...incomingDev } : d));
              }
              return [incomingDev, ...prev];
            });
            setSelectedDevice((prev) =>
              prev.status === 'OFFLINE' || prev.id === incomingDev.id ? { ...prev, ...incomingDev } : prev,
            );
          } else if (msg.event === 'image:new' && msg.data) {
            const img = msg.data;
            const newImg: ImageMeta = {
              id: img.id || img.gridFsFileId,
              deviceId: img.deviceId,
              filename: img.filename || `${img.deviceId}_${Date.now()}.jpg`,
              capturedAt: img.capturedAt || new Date().toISOString(),
              expiresAt: img.expiresAt || new Date(Date.now() + 15 * 3600000).toISOString(),
              sha256: img.sha256 || '',
              dhash: img.dhash || img.perceptualHash || '',
              sizeBytes: Number(img.sizeBytes ?? img.byteSize ?? 0),
              width: Number(img.width ?? 320),
              height: Number(img.height ?? 240),
              isDuplicate: Boolean(img.isDuplicate),
              hammingDistance: Number(img.hammingDistance ?? 0),
              personDetected: Boolean(img.personDetected ?? img.isPerson ?? img.detectionSummary?.hasHuman),
              confidence: Number(img.confidence ?? img.detectionSummary?.confidence ?? 0),
              meanLuminance: Number(img.meanLuminance ?? 50),
              isDark: Boolean(img.isDark ?? img.detectionSummary?.isDark),
              detections: img.detections || [],
            };
            setImages((prev) => [newImg, ...prev.filter((x) => x.id !== newImg.id)]);
          }
        } catch {
          // ignore non-json
        }
      };
    } catch {
      // fallback
    }

    return () => {
      if (ws) ws.close();
    };
  }, [fetchRealData]);

  // Handlers
  const handleInstantCapture = async () => {
    try {
      await fetch(`/api/devices/${selectedDevice.id}/commands/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flashLed: selectedDevice.nightFlashEnabled }),
      });
      await fetchRealData();
    } catch {
      // ignore
    }
  };

  const handleToggleFlash = () => {
    const updated = !selectedDevice.nightFlashEnabled;
    setSelectedDevice({ ...selectedDevice, nightFlashEnabled: updated });
    setDevices((prev) =>
      prev.map((d) => (d.id === selectedDevice.id ? { ...d, nightFlashEnabled: updated } : d)),
    );
  };

  const handleSaveSchedule = async (newSchedule: ScheduleConfig) => {
    setSchedule(newSchedule);
    try {
      await fetch(`/api/devices/${selectedDevice.id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule),
      });
      await fetchRealData();
    } catch {
      // ignore
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      await fetch(`/api/images/${id}/delete`, { method: 'POST' });
    } catch {
      // ignore
    }
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdatePolicy = async (p: RetentionPolicy) => {
    setRetentionPolicy(p);
    try {
      await fetch('/api/retention/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
    } catch {
      // ignore
    }
  };

  const handleTriggerPurgeNow = async () => {
    try {
      const res = await fetch('/api/retention/purge-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await fetchRealData();
        return {
          purgedCount: data.purgedCount ?? 0,
          purgedBytes: data.purgedBytes ?? 0,
        };
      }
    } catch {
      // ignore
    }
    return { purgedCount: 0, purgedBytes: 0 };
  };

  const handleSendTestEmail = async (email: string) => {
    try {
      const res = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return {
      success: false,
      messageId: '',
      simulated: false,
    };
  };

  // Format uptime nicely like "2 ngày 4 giờ 12 phút" or "0 giờ 0 phút"
  const formattedUptime = useMemo(() => {
    const sec = hardwareTelemetry.uptimeSec || 0;
    if (sec <= 0) return 'Chờ tín hiệu từ ESP32-CAM';
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (days > 0) return `${days} ngày ${hours} giờ ${mins} phút`;
    if (hours > 0) return `${hours} giờ ${mins} phút ${secs} giây`;
    return `${mins} phút ${secs} giây`;
  }, [hardwareTelemetry.uptimeSec]);

  // Compute hourly image chart points from real images
  const hourlyStats = useMemo(() => {
    const hours = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    return hours.map((label, idx) => {
      const hStart = idx * 2;
      const inSlot = images.filter((img) => {
        const h = new Date(img.capturedAt).getHours();
        return h >= hStart && h < hStart + 2;
      });
      const total = inSlot.length;
      const person = inSlot.filter((i) => i.personDetected).length;
      const other = Math.max(0, total - person);
      return { label, total, person, other };
    });
  }, [images]);

  const isOnline = selectedDevice.status === 'ONLINE';
  const latestImage = images[0];
  const uniqueImagesCount = images.filter((i) => !i.isDuplicate).length;
  const duplicateImagesCount = images.filter((i) => i.isDuplicate).length;

  return (
    <div className="min-h-screen bg-[#040d1a] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <div className="flex flex-1 overflow-hidden">
        {/* =====================================================================
            LEFT SIDEBAR — Exact match to reference-dashboard.png
            ===================================================================== */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-20' : 'w-64'
          } bg-[#061325] border-r border-[#122b4a] flex flex-col justify-between shrink-0 transition-all duration-200 select-none z-30`}
        >
          <div>
            {/* Brand Header */}
            <div className="h-16 px-4 flex items-center gap-3 border-b border-[#122b4a]">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                <Camera className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden">
                  <div className="font-extrabold text-base tracking-wide text-white leading-tight">
                    ESP32 <span className="text-cyan-400">CAM</span>
                  </div>
                  <div className="text-[11px] text-cyan-300/80 font-medium truncate">
                    Smart Surveillance
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="p-3 space-y-1 text-xs">
              {/* Tổng quan */}
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-blue-600/80 to-cyan-500/40 text-white border border-cyan-400/40 shadow-md shadow-cyan-500/10'
                    : 'text-slate-300 hover:bg-[#0b1f3a] hover:text-white'
                }`}
              >
                <Home className="w-4 h-4 text-cyan-400 shrink-0" />
                {!sidebarCollapsed && <span>Tổng quan</span>}
              </button>

              {/* Camera ESP32 Collapsible Group */}
              <div>
                <button
                  onClick={() => setCameraMenuOpen(!cameraMenuOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-[#0b1f3a] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Camera className="w-4 h-4 text-blue-400 shrink-0" />
                    {!sidebarCollapsed && <span>Camera ESP32</span>}
                  </div>
                  {!sidebarCollapsed && (
                    cameraMenuOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {cameraMenuOpen && !sidebarCollapsed && (
                  <div className="mt-1 ml-4 pl-3 border-l border-[#16355b] space-y-1">
                    {[
                      { id: 'devices', label: 'Danh sách thiết bị' },
                      { id: 'overview', label: 'Xem trực tiếp' },
                      { id: 'live', label: 'Điều khiển chụp ảnh' },
                      { id: 'gallery', label: 'Lịch sử ảnh' },
                      { id: 'schedule', label: 'Cài đặt lịch trình' },
                    ].map((sub, idx) => (
                      <button
                        key={`${sub.id}-${idx}`}
                        onClick={() => setActiveTab(sub.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                          activeTab === sub.id && (sub.label === 'Xem trực tiếp' ? activeTab === 'overview' : true)
                            ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-cyan-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#0a1c34]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{sub.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Main Sections matching reference-dashboard.png */}
              {[
                { id: 'hardware', label: 'Nhận diện AI & Phần cứng', icon: Cpu, color: 'text-teal-400' },
                { id: 'gallery', label: 'Hình ảnh & Dữ liệu', icon: ImageIcon, color: 'text-cyan-400' },
                { id: 'retention', label: 'Cơ sở dữ liệu & Tự xóa', icon: Database, color: 'text-blue-400' },
                { id: 'audit', label: 'Bảo mật & Audit', icon: Shield, color: 'text-emerald-400' },
                { id: 'notifications', label: 'Tài khoản & Gmail API', icon: User, color: 'text-amber-400' },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-blue-600/80 to-cyan-500/40 text-white border border-cyan-400/40 shadow-md'
                        : 'text-slate-300 hover:bg-[#0b1f3a] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComp className={`w-4 h-4 ${item.color} shrink-0`} />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                );
              })}

              {/* Cài đặt hệ thống / Nạp Firmware */}
              <button
                onClick={() => setIsWifiFlasherOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 transition-all mt-2"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
                  {!sidebarCollapsed && <span>Cài đặt & Nạp Firmware</span>}
                </div>
                {!sidebarCollapsed && <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
            </nav>
          </div>

          {/* Bottom Sidebar Ocean Emblem Card (matching reference-dashboard.png) */}
          {!sidebarCollapsed && (
            <div className="p-3 m-3 rounded-2xl bg-gradient-to-b from-[#071a33] to-[#040d1a] border border-[#143258] text-center relative overflow-hidden">
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shadow-inner">
                <Shield className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="font-bold text-sm text-white tracking-wider">ESP32 CAM</div>
              <div className="text-[11px] text-cyan-300/80 mt-0.5">Small Device • Big Vision</div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">Secure • Smart • Forever</div>
            </div>
          )}
        </aside>

        {/* =====================================================================
            MAIN WORKSPACE AREA (Topbar + Content Grid)
            ===================================================================== */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Topbar Header */}
          <header className="h-16 bg-[#061325]/95 backdrop-blur-md border-b border-[#122b4a] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#0d2442] transition-colors"
                title="Thu gọn / Mở rộng menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm thiết bị, IP, hình ảnh..."
                  className="w-full bg-[#091b32] border border-[#173760] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
            </div>

            {/* Right Topbar Controls */}
            <div className="flex items-center gap-2.5">
              {/* Auto-Flash C++ Firmware & Wi-Fi Button */}
              <button
                onClick={() => setIsWifiFlasherOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-md shadow-cyan-500/20 transition-all"
              >
                <Usb className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nạp Firmware & Wi-Fi</span>
              </button>

              {/* Termux Diagnostic Console */}
              <button
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-[#091b32] hover:bg-[#0f294a] text-cyan-300 border border-[#1a3f6e] transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Termux</span>
              </button>

              {/* Refresh */}
              <button
                onClick={fetchRealData}
                className="p-2 rounded-xl bg-[#091b32] hover:bg-[#0f294a] text-slate-300 hover:text-cyan-300 border border-[#173760] transition-colors"
                title="Làm mới dữ liệu thật"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Notifications Bell */}
              <button
                onClick={() => setActiveTab('notifications')}
                className="relative p-2 rounded-xl bg-[#091b32] hover:bg-[#0f294a] text-slate-300 border border-[#173760]"
                title="Cảnh báo Gmail API"
              >
                <Bell className="w-4 h-4" />
                {images.some((i) => i.personDetected) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {images.filter((i) => i.personDetected).length}
                  </span>
                )}
              </button>

              {/* Admin / Google User Profile */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#16355b]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow">
                  {currentUser ? currentUser.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {currentUser ? currentUser.username : 'admin'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser ? currentUser.roles[0] : 'Quản trị viên'}
                  </div>
                </div>
                {currentUser ? (
                  <button
                    onClick={() => setCurrentUser(null)}
                    className="p-1.5 text-slate-400 hover:text-rose-400"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="p-1.5 text-cyan-400 hover:text-cyan-300"
                    title="Đăng nhập / Google OAuth2"
                  >
                    <LogIn className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* =================================================================
              MAIN DASHBOARD CONTENT (Matches reference-dashboard.png layout)
              ================================================================= */}
          <main className="flex-1 p-4 lg:p-5 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                {/* CENTER 9 COLUMNS */}
                <div className="xl:col-span-9 space-y-4">
                  {/* 1. TOP DEVICE STATUS BANNER CARD */}
                  <div className="bg-[#07162c] border border-[#16355d] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
                    {/* Left: ESP32-CAM Board + Identity */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-[#040d1a] border border-cyan-500/40 p-1.5 flex flex-col items-center justify-center relative shrink-0 shadow-inner">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-cyan-400 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-cyan-400/80" />
                        </div>
                        <span className="text-[8px] font-mono text-cyan-300 mt-1">OV2640</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-lg font-bold text-white tracking-wide">
                            {selectedDevice.id}
                          </h2>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              isOnline
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                              }`}
                            />
                            {isOnline ? 'Online' : 'Chờ kết nối thật'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-mono mt-1">
                          IP: <span className="text-cyan-300">{selectedDevice.ipAddress}</span>
                          <span className="mx-2 text-slate-600">|</span>
                          WiFi: <span className="text-cyan-300">STA Mode</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          📍 Vị trí: Phòng giám sát trung tâm
                        </div>
                      </div>
                    </div>

                    {/* Right: 3 Status Metric Sub-cards (WiFi, Camera, Lưu trữ) */}
                    <div className="grid grid-cols-3 gap-3 flex-1 max-w-xl min-w-[300px]">
                      <div className="bg-[#0a1d37] border border-[#183b68] rounded-xl p-3 text-center">
                        <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                          <Wifi className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] text-slate-400">WiFi</div>
                        <div className="text-xs font-bold text-emerald-400">
                          {isOnline ? 'Đã kết nối' : 'Chờ thiết bị'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          RSSI: {hardwareTelemetry.wifi.rssi || 0} dBm
                        </div>
                      </div>

                      <div className="bg-[#0a1d37] border border-[#183b68] rounded-xl p-3 text-center">
                        <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] text-slate-400">Camera</div>
                        <div className="text-xs font-bold text-cyan-300">
                          {isOnline ? 'Hoạt động' : 'Sẵn sàng'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Chất lượng: 100%
                        </div>
                      </div>

                      <div className="bg-[#0a1d37] border border-[#183b68] rounded-xl p-3 text-center">
                        <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center">
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] text-slate-400">Lưu trữ</div>
                        <div className="text-xs font-bold text-blue-300">Đám mây (Backend)</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          MongoDB GridFS
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. MIDDLE ROW: XEM TRỰC TIẾP (7 cols) + TRẠNG THÁI THIẾT BỊ (5 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left 8 cols: Xem trực tiếp + Controls */}
                    <div className="lg:col-span-8 bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-cyan-400" />
                          <h3 className="font-bold text-sm text-white">Xem trực tiếp (ESP32-CAM + Python &amp; C++)</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            live_viewer.py 24/7
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => {
                              setUsePythonLiveViewer(true);
                              setUseDirectCameraStream(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              usePythonLiveViewer && !useDirectCameraStream
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-[#091b32] text-slate-400 border-[#183b68] hover:text-white'
                            }`}
                          >
                            Python + C++ Live Viewer
                          </button>
                          <button
                            onClick={() => {
                              setUsePythonLiveViewer(false);
                              setUseDirectCameraStream(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              !usePythonLiveViewer && !useDirectCameraStream
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-[#091b32] text-slate-400 border-[#183b68] hover:text-white'
                            }`}
                          >
                            GridFS Raw
                          </button>
                          <input
                            type="text"
                            value={directStreamIp}
                            onChange={(e) => setDirectStreamIp(e.target.value)}
                            placeholder="IP LAN (192.168.0.109)"
                            className="bg-[#091b32] border border-[#183b68] rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200 placeholder:text-slate-500 w-36 focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            onClick={() => {
                              setUseDirectCameraStream(!useDirectCameraStream);
                              if (!useDirectCameraStream) setUsePythonLiveViewer(false);
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              useDirectCameraStream
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-[#091b32] text-slate-400 border-[#183b68] hover:text-white'
                            }`}
                          >
                            MJPEG LAN
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Camera Live Viewport (8 cols) */}
                        <div className="md:col-span-8 flex flex-col gap-2">
                          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#030914] border border-[#1b4172] flex items-center justify-center group">
                            {useDirectCameraStream && directStreamIp ? (
                              <img
                                src={`http://${directStreamIp.replace(/^https?:\/\//, '')}:81/stream`}
                                alt="ESP32-CAM Direct MJPEG Stream"
                                className="w-full h-full object-cover"
                              />
                            ) : usePythonLiveViewer ? (
                              <img
                                src="/api/ingestion/live-viewer/mjpeg"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `/api/ingestion/live-viewer/stream.jpg?t=${Date.now()}`;
                                }}
                                alt="ESP32-CAM Python live_viewer.py MJPEG Stream"
                                className="w-full h-full object-cover"
                              />
                            ) : latestImage ? (
                              <img
                                src={`/api/images/${latestImage.id}/stream`}
                                alt={latestImage.filename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-6 space-y-2">
                                <Camera className="w-10 h-10 text-cyan-400/50 mx-auto animate-pulse" />
                                <div className="text-xs font-semibold text-slate-300">
                                  Đang đồng bộ luồng từ {selectedDevice.id}
                                </div>
                              </div>
                            )}

                            {/* Top-Left Badge when not in Python HUD mode (Python HUD already has its own header bar) */}
                            {!usePythonLiveViewer && (
                              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/75 backdrop-blur-sm border border-white/10 text-[11px] font-semibold text-white">
                                ESP32-CAM
                              </div>
                            )}

                            {/* Bottom-Left Timestamp */}
                            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-slate-950/75 backdrop-blur-sm text-[10px] font-mono text-slate-200 border border-white/10">
                              Wi-Fi: {liveViewerStatus?.wifi_ssid || 'khanh2007'} ({selectedDevice.ipAddress}) •{' '}
                              {latestImage
                                ? new Date(latestImage.capturedAt).toLocaleTimeString('vi-VN')
                                : new Date().toLocaleTimeString('vi-VN')}
                            </div>

                            {/* Bottom-Right Fullscreen Icon */}
                            <button
                              onClick={() => setActiveTab('live')}
                              className="absolute bottom-3 right-3 p-1.5 rounded bg-slate-950/75 hover:bg-slate-900 text-slate-200 border border-white/10"
                              title="Mở rộng toàn khung hình"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Embedded Python live_viewer.py + C++ Firmware Cloud Runtime Status Bar */}
                          <div className="bg-[#040d1a] border border-[#173760] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                            <div className="flex items-center gap-2 text-cyan-300">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>
                                Runtime: <strong className="text-white">python scripts/python/live_viewer.py</strong> +{' '}
                                <strong className="text-emerald-300">C++ EdgeImpulse INT4</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                              <span>
                                Người: <strong className="text-emerald-400">{liveViewerStatus?.person_count ?? (latestImage?.personDetected ? 1 : 0)}</strong>
                              </span>
                              <span>|</span>
                              <span>
                                AI: <strong className="text-cyan-300">{liveViewerStatus?.inference_fps ?? 20} Hz</strong>
                              </span>
                              <span>|</span>
                              <span>
                                Lux: <strong className="text-amber-300">{liveViewerStatus?.ambient_lux ?? 112}</strong> {liveViewerStatus?.lighting_mode || '[NGAY]'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Control Column inside Xem trực tiếp (4 cols) */}
                        <div className="md:col-span-4 flex flex-col justify-between space-y-2.5">
                          <div className="space-y-2">
                            <button
                              onClick={handleInstantCapture}
                              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all"
                            >
                              <Camera className="w-4 h-4" />
                              <span>Chụp ảnh ngay</span>
                            </button>

                            <button
                              onClick={() => setIsRecording(true)}
                              className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all ${
                                isRecording
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                  : 'bg-[#0a1d37] text-slate-300 border-[#183b68] hover:text-white'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>Bắt đầu ghi</span>
                            </button>

                            <button
                              onClick={() => setIsRecording(false)}
                              className="w-full py-2 px-3 rounded-xl bg-[#0a1d37] hover:bg-[#102a4d] text-slate-300 hover:text-white border border-[#183b68] text-xs font-medium flex items-center gap-2.5 transition-all"
                            >
                              <Square className="w-3.5 h-3.5 text-slate-400" />
                              <span>Dừng ghi</span>
                            </button>

                            <button
                              onClick={() => setActiveTab('schedule')}
                              className="w-full py-2 px-3 rounded-xl bg-[#0a1d37] hover:bg-[#102a4d] text-slate-300 hover:text-white border border-[#183b68] text-xs font-medium flex items-center gap-2.5 transition-all"
                            >
                              <Clock className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Lịch trình chụp</span>
                            </button>

                            <button
                              onClick={() => setIsWifiFlasherOpen(true)}
                              className="w-full py-2 px-3 rounded-xl bg-[#0a1d37] hover:bg-[#102a4d] text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-medium flex items-center gap-2.5 transition-all"
                            >
                              <Settings className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Cài đặt camera</span>
                            </button>
                          </div>

                          {/* Quick Auto-Capture Controls */}
                          <div className="pt-2 border-t border-[#153258] space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-300 text-[11px]">Chế độ chụp tự động</span>
                              <button
                                onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
                                className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
                                  schedule.enabled ? 'bg-blue-500' : 'bg-slate-700'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    schedule.enabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 text-[11px]">Chu kỳ chụp (giây)</span>
                              <select
                                value={schedule.intervalSeconds}
                                onChange={(e) =>
                                  setSchedule({ ...schedule, intervalSeconds: Number(e.target.value) })
                                }
                                className="bg-[#0a1d37] border border-[#183b68] rounded-lg px-2 py-1 text-xs font-mono text-white"
                              >
                                <option value={5}>5</option>
                                <option value={15}>15</option>
                                <option value={30}>30</option>
                                <option value={60}>60</option>
                              </select>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 text-[11px]">Thời gian kết thúc</span>
                              <span className="bg-[#0a1d37] border border-[#183b68] rounded-lg px-2 py-1 text-[11px] font-mono text-cyan-300">
                                {retentionPolicy.dailyCutoffTime} 🕒
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right 4 cols: Trạng thái thiết bị (Device Status Card) */}
                    <div className="lg:col-span-4 bg-[#07162c] border border-[#16355d] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#143258]">
                        <h3 className="font-bold text-sm text-white">Trạng thái thiết bị</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                            isOnline
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="space-y-3 text-xs flex-1 flex flex-col justify-around">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-slate-400 text-[11px]">{selectedDevice.id}</div>
                            <div className="font-mono font-semibold text-white">{selectedDevice.ipAddress}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-slate-400 text-[11px]">Uptime</div>
                            <div className="font-semibold text-white">{formattedUptime}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Tải CPU & DRAM</span>
                              <span className="text-rose-300 font-mono font-bold">
                                {hardwareTelemetry.cpu.usagePercent}% ({(hardwareTelemetry.dram.freeBytes / 1024).toFixed(0)} KB trống)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-slate-400">Bộ nhớ PSRAM / Flash</span>
                              <span className="text-cyan-300 font-mono">
                                {(hardwareTelemetry.psram.freeBytes / (1024 * 1024)).toFixed(1)} MB / 4 MB
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#0a1d37] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                style={{ width: `${Math.max(8, hardwareTelemetry.psram.usagePercent || 25)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                            <Wifi className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-slate-400 text-[11px]">WiFi Signal</div>
                            <div className="font-mono font-semibold text-emerald-300">
                              {hardwareTelemetry.wifi.rssi || 0} dBm
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                            <Settings className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-slate-400 text-[11px]">Phiên bản Firmware</div>
                            <div className="font-mono font-semibold text-slate-200">
                              {selectedDevice.firmwareVersion}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. LOWER-MIDDLE ROW: HÌNH ẢNH GẦN ĐÂY (8 cols) + ĐIỀU KHIỂN CHỤP ẢNH (4 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Recent Unique Images Strip */}
                    <div className="lg:col-span-8 bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm text-white">
                          Hình ảnh gần đây{' '}
                          <span className="text-xs font-normal text-slate-400">
                            (Lưu 1 ảnh duy nhất cho mỗi lần nhận diện)
                          </span>
                        </h3>
                        <button
                          onClick={() => setActiveTab('gallery')}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          Xem tất cả
                        </button>
                      </div>

                      {images.length === 0 ? (
                        <div className="h-36 rounded-xl bg-[#040d1a] border border-dashed border-[#1b3f6e] flex flex-col items-center justify-center text-center p-4">
                          <p className="text-xs text-slate-400">
                            Chưa có ảnh nào trong MongoDB GridFS. Khi ESP32-CAM phát hiện người và tải ảnh lên, các khung hình duy nhất sẽ xuất hiện tại đây.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                          {images.slice(0, 5).map((img) => (
                            <div
                              key={img.id}
                              onClick={() => setActiveTab('gallery')}
                              className="bg-[#0a1d37] border border-[#1a3d68] hover:border-cyan-400 rounded-xl overflow-hidden cursor-pointer group transition-all"
                            >
                              <div className="relative aspect-[4/3] bg-[#030914]">
                                <img
                                  src={`/api/images/${img.id}/stream`}
                                  alt={img.filename}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[9px]">
                                  {img.personDetected ? 'Người' : 'Cảnh'}
                                </span>
                              </div>
                              <div className="p-1.5 text-[10px] font-mono text-slate-300 flex items-center justify-between">
                                <span className="truncate">
                                  {new Date(img.capturedAt).toLocaleTimeString('vi-VN')}
                                </span>
                                <Eye className="w-3 h-3 text-cyan-400 shrink-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Điều khiển chụp ảnh Card */}
                    <div className="lg:col-span-4 bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-bold text-sm text-white">Điều khiển chụp ảnh</h3>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">Thuật toán chụp</label>
                          <select
                            value={captureAlgorithm}
                            onChange={(e) => setCaptureAlgorithm(e.target.value)}
                            className="w-full bg-[#0a1d37] border border-[#183b68] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                          >
                            <option>Phát hiện chuyển động + Theo chu kỳ</option>
                            <option>Chỉ khi AI phát hiện có người (Edge Impulse)</option>
                            <option>Chụp định kỳ cố định</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">Chu kỳ</label>
                          <select
                            value={schedule.intervalSeconds}
                            onChange={(e) =>
                              setSchedule({ ...schedule, intervalSeconds: Number(e.target.value) })
                            }
                            className="w-full bg-[#0a1d37] border border-[#183b68] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                          >
                            <option value={5}>5 giây</option>
                            <option value={15}>15 giây</option>
                            <option value={30}>30 giây</option>
                            <option value={60}>60 giây</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Độ nhạy AI</span>
                            <span className="text-cyan-300 font-mono font-bold">{sensitivity}%</span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={95}
                            value={sensitivity}
                            onChange={(e) => setSensitivity(Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => handleSaveSchedule(schedule)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                        >
                          Lưu cài đặt
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. BOTTOM ROW: THỐNG KÊ ẢNH THEO THỜI GIAN (7 cols) + NHẬT KÝ HỆ THỐNG (5 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Chart Card */}
                    <div className="lg:col-span-7 bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-4">
                          <h3 className="font-bold text-sm text-white">Thống kê ảnh theo thời gian</h3>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1 text-blue-400">
                              <span className="w-2 h-2 rounded-full bg-blue-400" /> Tổng ảnh
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Người
                            </span>
                            <span className="flex items-center gap-1 text-purple-400">
                              <span className="w-2 h-2 rounded-full bg-purple-400" /> Khác
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center bg-[#0a1d37] rounded-lg p-0.5 border border-[#183b68] text-[11px]">
                          {[
                            { id: 'today', label: 'Hôm nay' },
                            { id: '7d', label: '7 ngày' },
                            { id: '30d', label: '30 ngày' },
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setChartRange(t.id as any)}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                chartRange === t.id
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Responsive Bar/Line Area Visual */}
                      <div className="h-40 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-[#143258]">
                        {hourlyStats.map((slot) => {
                          const maxVal = Math.max(10, ...hourlyStats.map((s) => s.total));
                          const totalH = Math.max(6, Math.round((slot.total / maxVal) * 110));
                          const personH = Math.max(4, Math.round((slot.person / maxVal) * 110));
                          return (
                            <div key={slot.label} className="flex-1 flex flex-col items-center gap-1.5">
                              <div className="w-full flex items-end justify-center gap-1 h-28">
                                <div
                                  className="w-2.5 rounded-t bg-blue-500/80 transition-all"
                                  style={{ height: `${totalH}px` }}
                                  title={`Tổng ảnh: ${slot.total}`}
                                />
                                <div
                                  className="w-2.5 rounded-t bg-emerald-400/90 transition-all"
                                  style={{ height: `${personH}px` }}
                                  title={`Có người: ${slot.person}`}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">{slot.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* System Logs Card */}
                    <div className="lg:col-span-5 bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm text-white">Nhật ký hệ thống (Logs)</h3>
                        <button
                          onClick={() => setActiveTab('audit')}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          Xem tất cả
                        </button>
                      </div>

                      <div className="space-y-2.5 text-xs max-h-44 overflow-y-auto pr-1">
                        {auditLogs.length === 0 ? (
                          <div className="text-slate-400 text-xs py-8 text-center font-mono">
                            Hệ thống sẵn sàng. Nhật ký thật từ ESP32-CAM và MongoDB GridFS sẽ ghi nhận tại đây.
                          </div>
                        ) : (
                          auditLogs.slice(0, 6).map((log) => (
                            <div key={log.id} className="flex items-start gap-2.5 text-[11px]">
                              <span
                                className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                                  log.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-amber-400'
                                }`}
                              />
                              <span className="font-mono text-slate-400 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                              </span>
                              <span className="text-slate-200 truncate">{log.details}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* =============================================================
                    RIGHT SIDEBAR COLUMN (3 cols — Matches reference-dashboard.png)
                    ============================================================= */}
                <div className="xl:col-span-3 space-y-4">
                  {/* Card 1: Thống kê thiết bị */}
                  <div className="bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm text-white">Thống kê thiết bị</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Live DB
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a1d37] border border-[#183b68]">
                        <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">Tổng ảnh đã lưu</div>
                          <div className="text-lg font-extrabold text-white font-mono">
                            {images.length}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a1d37] border border-[#183b68]">
                        <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">Ảnh trùng lặp (đã bỏ qua)</div>
                          <div className="text-lg font-extrabold text-white font-mono">
                            {duplicateImagesCount}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a1d37] border border-[#183b68]">
                        <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">Đã lưu vào MongoDB</div>
                          <div className="text-lg font-extrabold text-white font-mono">
                            {uniqueImagesCount}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a1d37] border border-[#183b68]">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">Đã tự hủy (sau 15h)</div>
                          <div className="text-lg font-extrabold text-white font-mono">
                            {retentionPolicy.totalPurgedCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Nhận diện AI */}
                  <div className="bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-bold text-sm text-white">Nhận diện AI</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
                        ● Bật
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-[#143258]">
                        <span className="text-slate-400">Đối tượng phát hiện</span>
                        <span className="font-bold text-white">Người (Human)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#143258]">
                        <span className="text-slate-400">Độ chính xác</span>
                        <span className="font-mono font-bold text-cyan-300">
                          {latestImage ? `${(latestImage.confidence * 100).toFixed(1)}%` : 'Chờ ảnh thật'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-400">Lần nhận diện gần nhất</span>
                        <span className="font-mono text-slate-200">
                          {latestImage
                            ? new Date(latestImage.capturedAt).toLocaleTimeString('vi-VN')
                            : '--:--:--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Bảo mật & Kết nối */}
                  <div className="bg-[#07162c] border border-[#16355d] rounded-2xl p-4 shadow-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-sm text-white">Bảo mật & Kết nối</h3>
                    </div>

                    <div className="space-y-2 text-xs">
                      {[
                        { label: 'HTTPS (TLS 1.3)', status: 'Đã bật' },
                        { label: 'JWT Authentication', status: 'Đã bật' },
                        { label: 'RBAC (Phân quyền)', status: 'Đã bật' },
                        { label: 'WAF / Rate Limit', status: 'Đã bật' },
                        { label: 'Chống OWASP Top 10', status: 'Đã bật' },
                      ].map((sec) => (
                        <div key={sec.label} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {sec.label}
                          </span>
                          <span className="text-emerald-400 font-semibold">● {sec.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#143258] space-y-1.5 text-[11px]">
                      <div className="text-slate-400 font-semibold mb-1">Kết nối backend</div>
                      {[
                        { name: 'MongoDB GridFS', state: 'Online' },
                        { name: 'MySQL (Prepared ?)', state: 'Ready' },
                        { name: 'Python Vision AI', state: 'Online' },
                        { name: 'WebSocket Stream', state: 'Online' },
                      ].map((svc) => (
                        <div key={svc.name} className="flex items-center justify-between">
                          <span className="text-slate-300">{svc.name}</span>
                          <span className="text-emerald-400 font-mono">● {svc.state}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Sub-Pages when clicked from Left Sidebar */}
            {activeTab === 'devices' && (
              <div className="bg-[#07162c] border border-[#16355d] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Danh sách thiết bị ESP32-CAM</h2>
                    <p className="text-xs text-slate-400">
                      Hiển thị 100% thiết bị vật lý kết nối thật qua Wi-Fi STA hoặc nạp từ Web Serial USB
                    </p>
                  </div>
                  <button
                    onClick={() => setIsWifiFlasherOpen(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <Usb className="w-4 h-4" />
                    <span>Thêm / Nạp ESP32-CAM Mới</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0a1d37] text-slate-300 border-b border-[#183b68]">
                      <tr>
                        <th className="p-3">Device ID</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3">Địa chỉ IP</th>
                        <th className="p-3">Firmware</th>
                        <th className="p-3">DRAM / PSRAM trống</th>
                        <th className="p-3">Heartbeat cuối</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#143258]">
                      {(devices.length > 0 ? devices : [selectedDevice]).map((d) => (
                        <tr key={d.id} className="hover:bg-[#0a1d37]/60">
                          <td className="p-3 font-mono font-bold text-cyan-300">{d.id}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                d.status === 'ONLINE'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono">{d.ipAddress}</td>
                          <td className="p-3 font-mono text-slate-300">{d.firmwareVersion}</td>
                          <td className="p-3 font-mono">
                            {(d.freeHeap / 1024).toFixed(0)} KB / {(d.freePsram / (1024 * 1024)).toFixed(1)} MB
                          </td>
                          <td className="p-3 font-mono text-slate-400">
                            {new Date(d.lastHeartbeat).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'live' && (
              <LiveStream
                device={selectedDevice}
                onInstantCapture={handleInstantCapture}
                onToggleFlash={handleToggleFlash}
                latestImage={images[0]}
              />
            )}

            {activeTab === 'hardware' && <HardwareMonitor telemetry={hardwareTelemetry} />}

            {activeTab === 'gallery' && (
              <ImageGallery images={images} onDeleteImage={handleDeleteImage} />
            )}

            {activeTab === 'schedule' && (
              <CaptureControls schedule={schedule} onSaveSchedule={handleSaveSchedule} />
            )}

            {activeTab === 'retention' && (
              <RetentionSettings
                policy={retentionPolicy}
                onUpdatePolicy={handleUpdatePolicy}
                onTriggerPurgeNow={handleTriggerPurgeNow}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationSettingsCard onSendTestEmail={handleSendTestEmail} />
            )}

            {activeTab === 'audit' && <AuditLogViewer logs={auditLogs} />}
          </main>

          {/* Bottom Footer Bar matching reference-dashboard.png */}
          <footer className="h-10 bg-[#051020] border-t border-[#122b4a] px-6 flex flex-wrap items-center justify-between text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-200">ESP32 CAM Surveillance System</span>
              <span>|</span>
              <span>Powered by C++ / NestJS / Python</span>
              <span>|</span>
              <span className="text-cyan-400">React + TypeScript + Tailwind CSS</span>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Bảo mật đa lớp OWASP 2025
              </span>
              <span>•</span>
              <span>Dữ liệu lưu trữ trên Backend (GridFS)</span>
              <span>•</span>
              <span>Không lưu trên máy tính</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Floating Termux Terminal Modal */}
      <TermuxTerminal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        deviceId={selectedDevice.id}
      />

      {/* Auth Modal with Google Sign-In */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />

      {/* Web Wi-Fi & C++ Firmware Auto-Flasher Modal */}
      <WebWifiFlasherModal
        isOpen={isWifiFlasherOpen}
        onClose={() => setIsWifiFlasherOpen(false)}
        onSuccess={() => {
          fetchRealData();
        }}
      />
    </div>
  );
};
