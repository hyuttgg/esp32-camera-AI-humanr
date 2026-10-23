import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Trash2, RefreshCw, Cpu, Send, Zap } from 'lucide-react';
import { TelemetryLog } from '../types';
import { MOCK_TELEMETRY_LOGS } from '../mockData';

interface TermuxTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
}

export const TermuxTerminal: React.FC<TermuxTerminalProps> = ({ isOpen, onClose, deviceId }) => {
  const [logs, setLogs] = useState<TelemetryLog[]>(MOCK_TELEMETRY_LOGS);
  const [inputCmd, setInputCmd] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const appendLog = (level: TelemetryLog['level'], message: string, source = 'termux_cli') => {
    const newLog: TelemetryLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
      level,
      source,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    appendLog('INFO', `$ ${trimmed}`, 'user');

    const lower = trimmed.toLowerCase();
    if (lower === 'clear') {
      setLogs([]);
      return;
    } else if (lower === 'help') {
      appendLog('DEBUG', 'Available commands:\n- status       : Query ESP32-CAM heap, PSRAM & network\n- turboquant   : Run INT4 6.2x edge benchmark\n- reboot       : Trigger software restart\n- capture      : Force immediate JPEG capture\n- clear        : Clear console output');
    } else if (lower === 'status') {
      appendLog('INFO', `[STATUS] Device: ${deviceId} | IP: 192.168.1.145 | Free Heap: 142.8 KB | Free PSRAM: 3.84 MB | OV2640: OK`);
    } else if (lower === 'turboquant') {
      appendLog('INFO', '[TURBOQUANT] Initiating INT4 quant benchmark...');
      setTimeout(() => {
        appendLog('INFO', '[TURBOQUANT] Weights: 4-bit packed | Model: YOLOv8n-Pose | Speedup: 6.2x | Accuracy: 97.8% | Latency: 16.4ms/frame');
      }, 300);
    } else if (lower === 'reboot') {
      appendLog('WARN', `[CMD] Sending soft reset signal to ${deviceId}...`);
      setTimeout(() => {
        appendLog('INFO', '[BOOT] ESP32-CAM restarting... ESP-IDF v5.1.2 booting up.');
      }, 800);
    } else if (lower === 'capture') {
      appendLog('INFO', `[CAMERA] Triggering immediate snapshot on ${deviceId}...`);
      setTimeout(() => {
        appendLog('INFO', '[CAPTURE] Frame captured in 14ms (42.1 KB JPEG). Streaming to NestJS GridFS...');
      }, 500);
    } else {
      appendLog('ERROR', `zsh: command not found: ${trimmed}. Type "help" for available diagnostics.`);
    }
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommand(inputCmd);
    setInputCmd('');
  };

  return (
    <div
      className={`fixed z-50 bg-termux-bg/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col font-mono text-xs text-termux-text transition-all ${
        isFullScreen ? 'inset-4' : 'bottom-6 right-6 w-full max-w-2xl h-[520px]'
      }`}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-ocean-950/90 border-b border-ocean-800 rounded-t-2xl select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200">Termux Flasher & ESP32-CAM Diagnostics</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400">
            {deviceId}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-slate-400">
          <button
            onClick={() => setLogs([])}
            className="p-1 hover:text-white hover:bg-ocean-800 rounded"
            title="Xóa màn hình"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1 hover:text-white hover:bg-ocean-800 rounded"
            title={isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-rose-400 hover:bg-ocean-800 rounded"
            title="Đóng Terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Macro Bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-ocean-950/50 border-b border-ocean-850 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleCommand('status')}
          className="px-2.5 py-1 rounded bg-ocean-900 hover:bg-ocean-850 text-cyan-300 border border-ocean-700 whitespace-nowrap transition-colors"
        >
          $ status
        </button>
        <button
          onClick={() => handleCommand('turboquant')}
          className="px-2.5 py-1 rounded bg-ocean-900 hover:bg-ocean-850 text-teal-300 border border-ocean-700 whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Zap className="w-3 h-3" />
          $ turboquant
        </button>
        <button
          onClick={() => handleCommand('capture')}
          className="px-2.5 py-1 rounded bg-ocean-900 hover:bg-ocean-850 text-amber-300 border border-ocean-700 whitespace-nowrap transition-colors"
        >
          $ capture
        </button>
        <button
          onClick={() => handleCommand('reboot')}
          className="px-2.5 py-1 rounded bg-ocean-900 hover:bg-ocean-850 text-rose-300 border border-ocean-700 whitespace-nowrap transition-colors"
        >
          $ reboot
        </button>
      </div>

      {/* Terminal Output Log Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[12px] leading-relaxed">
        <div className="text-termux-dim mb-2">
          =======================================================<br />
          Ocean Vision Serial Telemetry & Web Flasher (Termux Mode)<br />
          Target: ESP32-WROVER-E (OV2640 + TurboQuant INT4 Engine)<br />
          Type 'help' for diagnostic command list.<br />
          =======================================================
        </div>

        {logs.map((log) => {
          const color =
            log.level === 'ERROR'
              ? 'text-rose-400'
              : log.level === 'WARN'
              ? 'text-amber-400'
              : log.level === 'DEBUG'
              ? 'text-slate-400'
              : log.source === 'user'
              ? 'text-cyan-300 font-bold'
              : 'text-emerald-400';

          return (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-slate-500 select-none text-[10px] pt-0.5">{log.timestamp}</span>
              <span className={`flex-1 break-all whitespace-pre-wrap ${color}`}>
                {log.message}
              </span>
            </div>
          );
        })}
      </div>

      {/* Interactive Command Input Bar */}
      <form onSubmit={onSubmitForm} className="flex items-center gap-2 p-3 bg-ocean-950/90 border-t border-ocean-800 rounded-b-2xl">
        <span className="text-emerald-400 font-bold pl-1">esp32@ocean:~$</span>
        <input
          type="text"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          placeholder="Nhập lệnh (status, turboquant, reboot, capture)..."
          className="flex-1 bg-transparent text-cyan-200 outline-none font-mono text-xs placeholder:text-slate-600"
          autoFocus
        />
        <button
          type="submit"
          className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

