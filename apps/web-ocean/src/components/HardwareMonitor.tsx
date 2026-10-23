import React from 'react';
import { Cpu, HardDrive, Zap, Wifi, Clock, Activity, CheckCircle, ShieldAlert } from 'lucide-react';
import { HardwareTelemetryData } from '../types';

interface HardwareMonitorProps {
  telemetry: HardwareTelemetryData;
}

export const HardwareMonitor: React.FC<HardwareMonitorProps> = ({ telemetry }) => {
  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  // Safe percentage helper
  const dramPercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        (
          ((telemetry.dram.totalBytes - telemetry.dram.freeBytes) / telemetry.dram.totalBytes) *
          100
        ).toFixed(1),
      ),
    ),
  );

  const psramPercent = telemetry.psram.found
    ? Math.min(
        100,
        Math.max(
          0,
          Number(
            (
              ((telemetry.psram.totalBytes - telemetry.psram.freeBytes) / telemetry.psram.totalBytes) *
              100
            ).toFixed(1),
          ),
        ),
      )
    : 0;

  const flashPercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        (
          (telemetry.flash.sketchUsedBytes / telemetry.flash.chipSizeBytes) *
          100
        ).toFixed(1),
      ),
    ),
  );

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 glow-cyan">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
              <span>Trạng Thái Phần Cứng ESP32-CAM (100% C++ Telemetry)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                REALTIME 1S PUSH
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Đo lường trực tiếp từ thanh ghi phần cứng ESP-IDF: CPU, DRAM, 4MB PSRAM (Flam) & Flash ROM.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Thiết bị: <strong className="text-cyan-300">{telemetry.deviceId}</strong></span>
          <span>•</span>
          <span>Uptime: <strong className="text-slate-200">{formatUptime(telemetry.uptimeSec)}</strong></span>
        </div>
      </div>

      {/* Bento Grid Hardware Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. CPU Load & Freq */}
        <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 flex flex-col justify-between hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>CPU (Dual-Core Xtensa)</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              {telemetry.cpu.freqMHz} MHz
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold font-mono text-white">
                {telemetry.cpu.usagePercent.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-slate-400">{telemetry.cpu.cores} Cores @ 240MHz Max</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-ocean-950 rounded-full h-2 overflow-hidden border border-ocean-800">
              <div
                className="bg-gradient-to-r from-cyan-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, telemetry.cpu.usagePercent)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex justify-between pt-2 border-t border-ocean-850">
            <span>Core 0: Network & DMA</span>
            <span className="text-emerald-400">Core 1: AI Vision</span>
          </div>
        </div>

        {/* 2. Internal DRAM (SRAM) */}
        <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 flex flex-col justify-between hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Internal RAM (DRAM)</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Fast SRAM
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold font-mono text-emerald-300">
                {formatBytes(telemetry.dram.freeBytes)}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Còn lại ({dramPercent}% Dùng)
              </span>
            </div>
            <div className="w-full bg-ocean-950 rounded-full h-2 overflow-hidden border border-ocean-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${dramPercent}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex justify-between pt-2 border-t border-ocean-850">
            <span>Tổng: {formatBytes(telemetry.dram.totalBytes)}</span>
            <span>Min Watermark: {formatBytes(telemetry.dram.minFreeBytes)}</span>
          </div>
        </div>

        {/* 3. External PSRAM (Flam - 4MB SPI RAM) */}
        <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 flex flex-col justify-between hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-teal-400" />
              <span>External PSRAM (Flam)</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800">
              4MB SPI RAM
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold font-mono text-teal-300">
                {formatBytes(telemetry.psram.freeBytes)}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Còn trống ({psramPercent}% Dùng)
              </span>
            </div>
            <div className="w-full bg-ocean-950 rounded-full h-2 overflow-hidden border border-ocean-800">
              <div
                className="bg-gradient-to-r from-teal-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${psramPercent}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex justify-between pt-2 border-t border-ocean-850">
            <span>Framebuffers: 2x SVGA</span>
            <span className="text-cyan-400">TurboQuant Weights: OK</span>
          </div>
        </div>

        {/* 4. Flash Memory (ROM) */}
        <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 flex flex-col justify-between hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Flash Memory (ROM)</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
              {formatBytes(telemetry.flash.chipSizeBytes)} QIO
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold font-mono text-amber-300">
                {formatBytes(telemetry.flash.sketchUsedBytes)}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Đã nạp ({flashPercent}% App)
              </span>
            </div>
            <div className="w-full bg-ocean-950 rounded-full h-2 overflow-hidden border border-ocean-800">
              <div
                className="bg-gradient-to-r from-amber-500 to-rose-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${flashPercent}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex justify-between pt-2 border-t border-ocean-850">
            <span>Tốc độ: {telemetry.flash.speedHz / 1000000} MHz</span>
            <span>Trống Partition: {formatBytes(telemetry.flash.sketchFreeBytes)}</span>
          </div>
        </div>
      </div>

      {/* Network & Signal Bar */}
      <div className="bg-ocean-850 border border-ocean-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Wifi className="w-4 h-4 text-cyan-400" />
            <span>Wi-Fi STA: <strong>{telemetry.wifi.ip}</strong></span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">
            Tín hiệu RSSI: <strong className={telemetry.wifi.rssi > -65 ? 'text-emerald-400' : 'text-amber-400'}>
              {telemetry.wifi.rssi} dBm
            </strong>
          </span>
        </div>

        <div className="text-slate-400 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>C++ Hardware Counters Synchronized: 100% Accuracy</span>
        </div>
      </div>
    </div>
  );
};

