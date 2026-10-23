import React from 'react';
import { Camera, Terminal, Cpu, RefreshCw, LogIn, LogOut, User, Mail, Zap, Usb } from 'lucide-react';
import { Device, UserProfile } from '../types';

interface NavbarProps {
  devices: Device[];
  selectedDevice: Device;
  onSelectDevice: (d: Device) => void;
  onOpenTerminal: () => void;
  isTerminalOpen: boolean;
  onOpenFlasher?: () => void;
  onRefresh: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  onOpenTerminal,
  isTerminalOpen,
  onOpenFlasher,
  onRefresh,
  activeTab,
  setActiveTab,
  user,
  onOpenAuthModal,
  onLogout,
}) => {
  return (
    <header className="bg-ocean-900/90 backdrop-blur-md border-b border-ocean-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-400/40 text-cyan-400 glow-cyan">
              <Camera className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wider text-slate-100 font-sans">
                  OCEAN<span className="text-cyan-400">VISION</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
                  v1.0-ESP32
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                TurboQuant™ Surveillance & Hardware Telemetry
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {[
              { id: 'live', label: 'Luồng Trực Tiếp' },
              { id: 'hardware', label: 'Phần Cứng (CPU/RAM/Flam)' },
              { id: 'gallery', label: 'Thư Viện Ảnh' },
              { id: 'schedule', label: 'Lịch Chụp' },
              { id: 'retention', label: 'Chính Sách Lưu Trữ' },
              { id: 'notifications', label: 'Gmail API' },
              { id: 'audit', label: 'Audit Trail' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-ocean-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Area: Device Switcher & User Profile */}
          <div className="flex items-center gap-2.5">
            {/* Device Switcher */}
            <div className="relative hidden sm:block">
              <select
                value={selectedDevice.id}
                onChange={(e) => {
                  const dev = devices.find((d) => d.id === e.target.value);
                  if (dev) onSelectDevice(dev);
                }}
                className="bg-ocean-850 border border-ocean-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono pr-8 cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Web Serial Wi-Fi Flasher Trigger */}
            {onOpenFlasher && (
              <button
                onClick={onOpenFlasher}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border bg-cyan-950/60 text-cyan-300 border-cyan-700/80 hover:bg-cyan-900/80 hover:border-cyan-400"
                title="Nạp Wi-Fi vào ESP32-CAM qua Web Serial USB"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xl:inline">Nạp Wi-Fi</span>
              </button>
            )}

            {/* Termux Flasher Console Trigger */}
            <button
              onClick={onOpenTerminal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                isTerminalOpen
                  ? 'bg-termux-bg text-termux-text border-cyan-400 glow-cyan'
                  : 'bg-ocean-850 text-slate-300 border-ocean-700 hover:border-cyan-500/50 hover:text-cyan-400'
              }`}
              title="Mở Termux Web Terminal"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Termux</span>
            </button>

            {/* User Account / Google Sign-In */}
            {user ? (
              <div className="flex items-center gap-2 bg-ocean-850 border border-ocean-700 rounded-lg px-2.5 py-1 text-xs font-mono">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.fullName} className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                    {user.fullName.charAt(0)}
                  </div>
                )}
                <span className="hidden lg:inline text-slate-200 truncate max-w-[100px]">
                  {user.fullName}
                </span>
                <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {user.roles[0]}
                </span>
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-rose-400 ml-1"
                  title="Đăng xuất"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 text-ocean-950 font-bold text-xs font-mono transition-all glow-cyan hover:opacity-90"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-ocean-800 border border-ocean-800 transition-colors"
              title="Làm mới trạng thái"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
