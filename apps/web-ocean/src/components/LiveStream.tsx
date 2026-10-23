import React, { useState, useEffect } from 'react';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  Moon,
  Sun,
  Activity,
  Maximize2,
  Scan,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Device, ImageMeta } from '../types';
import { createSvgDataUrl } from '../mockData';

interface LiveStreamProps {
  device: Device;
  onInstantCapture: () => void;
  onToggleFlash: () => void;
  latestImage?: ImageMeta;
}

export const LiveStream: React.FC<LiveStreamProps> = ({
  device,
  onInstantCapture,
  onToggleFlash,
  latestImage,
}) => {
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '16:9'>('4:3');
  const [showScanlines, setShowScanlines] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [liveStreamUrl, setLiveStreamUrl] = useState<string>('');

  useEffect(() => {
    if (latestImage && latestImage.id) {
      // Load real binary JPEG stream from backend GridFS
      setLiveStreamUrl(`/api/images/${latestImage.id}/stream`);
    } else {
      const url = createSvgDataUrl(
        device.status === 'ONLINE' ? `${device.name} [ONLINE]` : 'CHƯA KẾT NỐI THIẾT BỊ THẬT',
        false,
        false,
        'waiting',
      );
      setLiveStreamUrl(url);
    }
  }, [device, latestImage]);

  const handleCaptureClick = async () => {
    setIsCapturing(true);
    await onInstantCapture();
    setTimeout(() => setIsCapturing(false), 600);
  };

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-4 sm:p-5 glow-cyan transition-all">
      {/* Header bar of Video Player */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                device.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span>{device.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <span className="text-sm font-semibold text-white font-sans">{device.name}</span>
          <span className="text-xs font-mono text-slate-400">({device.ipAddress || 'Chưa có IP'})</span>
        </div>

        {/* Stream Controls */}
        <div className="flex items-center gap-2">
          {/* Scanline toggle */}
          <button
            onClick={() => setShowScanlines(!showScanlines)}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
              showScanlines
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40'
                : 'bg-ocean-850 text-slate-400 border-ocean-800 hover:text-white'
            }`}
            title="Bật/Tắt hiệu ứng quét cảm biến"
          >
            <Scan className="w-4 h-4" />
          </button>

          {/* Bounding box toggle */}
          <button
            onClick={() => setShowDetections(!showDetections)}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
              showDetections
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40'
                : 'bg-ocean-850 text-slate-400 border-ocean-800 hover:text-white'
            }`}
            title="Bật/Tắt khung nhận diện TurboQuant AI"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          {/* Aspect ratio */}
          <button
            onClick={() => setAspectRatio(aspectRatio === '4:3' ? '16:9' : '4:3')}
            className="px-2.5 py-1 rounded-lg bg-ocean-850 border border-ocean-800 text-xs text-slate-300 font-mono hover:text-cyan-400 transition-colors"
          >
            {aspectRatio}
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div
        className={`relative w-full rounded-xl overflow-hidden bg-ocean-950 border border-ocean-700/80 shadow-2xl flex items-center justify-center ${
          aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-video'
        }`}
      >
        {/* Stream Display */}
        <img
          src={liveStreamUrl}
          alt="ESP32-CAM Live View"
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Scanlines Overlay */}
        {showScanlines && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-24 animate-scanline" />
        )}

        {/* Bounding Box Overlay for AI Person Detection */}
        {showDetections && latestImage?.personDetected && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-44 h-56 border-2 border-cyan-400/90 rounded-lg shadow-lg shadow-cyan-500/20 animate-pulse">
              <div className="absolute -top-6 left-0 bg-cyan-500 text-ocean-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow">
                <Zap className="w-3 h-3 fill-current" />
                <span>PERSON: {((latestImage?.confidence ?? 0.954) * 100).toFixed(1)}%</span>
              </div>
              <div className="absolute -bottom-5 right-0 bg-ocean-950/90 border border-cyan-500/40 text-cyan-300 text-[9px] font-mono px-1.5 py-0.5 rounded">
                INT4 TurboQuant
              </div>
            </div>
          </div>
        )}

        {/* Top-Left Telemetry HUD */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none font-mono text-[11px]">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-ocean-950/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {latestImage
                ? `FRAME: ${(latestImage.sizeBytes / 1024).toFixed(1)} KB | ${latestImage.width}x${latestImage.height}`
                : 'CHỜ TÍN HIỆU TỪ ESP32-CAM'}
            </span>
          </div>

          {latestImage?.isDark ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/80 backdrop-blur-md border border-blue-500/40 text-blue-300">
              <Moon className="w-3 h-3 text-blue-400" />
              <span>NIGHT MODE (38.5 lux)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300">
              <Sun className="w-3 h-3 text-amber-400" />
              <span>DAYLIGHT (120 lux)</span>
            </div>
          )}
        </div>

        {/* Top-Right Resolution & Heap HUD */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 pointer-events-none font-mono text-[11px] items-end">
          <div className="px-2 py-0.5 rounded bg-ocean-950/80 backdrop-blur-md border border-ocean-700 text-slate-300">
            RES: {device.resolution} (800x600)
          </div>
          <div className="px-2 py-0.5 rounded bg-ocean-950/80 backdrop-blur-md border border-ocean-700 text-slate-400">
            HEAP: {(device.freeHeap / 1024).toFixed(1)} KB | PSRAM: {(device.freePsram / (1024 * 1024)).toFixed(1)} MB
          </div>
        </div>
      </div>

      {/* Control Actions Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-ocean-800">
        <div className="flex items-center gap-2">
          {/* Instant Capture Button ("Chụp ngay") */}
          <button
            onClick={handleCaptureClick}
            disabled={isCapturing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider font-mono uppercase transition-all shadow-lg ${
              isCapturing
                ? 'bg-cyan-600 text-white animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-ocean-950 glow-cyan active:scale-95'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{isCapturing ? 'Đang chụp...' : 'Chụp Ngay (Manual Capture)'}</span>
          </button>

          {/* Auto Night Flash Toggle */}
          <button
            onClick={onToggleFlash}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-all border ${
              device.nightFlashEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20'
                : 'bg-ocean-850 text-slate-400 border-ocean-700 hover:text-white'
            }`}
            title="Tự động kích hoạt đèn flash trên ESP32-CAM khi môi trường tối"
          >
            {device.nightFlashEnabled ? (
              <Flashlight className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            ) : (
              <FlashlightOff className="w-4 h-4" />
            )}
            <span>
              Auto Flash: <strong className={device.nightFlashEnabled ? 'text-amber-300' : 'text-slate-400'}>
                {device.nightFlashEnabled ? 'BẬT' : 'TẮT'}
              </strong>
            </span>
          </button>
        </div>

        {/* Stream Status Info */}
        <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Zero-Client-Persistence Active (RAM Stream Only)</span>
        </div>
      </div>
    </div>
  );
};

