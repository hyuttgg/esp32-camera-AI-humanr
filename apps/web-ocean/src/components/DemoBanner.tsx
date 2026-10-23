import React, { useState } from 'react';
import { AlertTriangle, Wifi, ChevronDown, ChevronUp, Copy, Check, Zap, Usb } from 'lucide-react';

interface DemoBannerProps {
  onOpenFlasher?: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onOpenFlasher }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const configSnippet = `// In firmware/esp32-cam/src/config.h:
#define WIFI_SSID     "Your_Home_WiFi"
#define WIFI_PASSWORD "Your_Password"
#define BACKEND_HOST  "http://192.168.1.5:3000"
#define DEVICE_ID     "ESP32-CAM-01"
#define HMAC_SECRET   "dev_secret_key_change_in_production"`;

  const copyConfig = () => {
    navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/30 text-amber-200 text-xs px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold tracking-wider border border-amber-500/40">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            CHỜ ESP32-CAM THẬT
          </span>
          <span className="text-slate-300">
            Đã xóa toàn bộ dữ liệu ảo. Hệ thống đang chờ bo mạch ESP32-CAM vật lý kết nối và gửi dữ liệu thật.
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {onOpenFlasher && (
            <button
              onClick={onOpenFlasher}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/50 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nạp Wi-Fi Web Serial</span>
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>{expanded ? 'Thu gọn' : 'Cách kết nối ESP32-CAM thật'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-amber-800/40 grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
          <div>
            <h4 className="font-semibold text-white mb-1">1. Cấu hình Firmware (Wi-Fi STA Mode)</h4>
            <p className="text-[11px] text-slate-400 mb-2">
              Mở PlatformIO hoặc Arduino IDE, nạp mã nguồn từ thư mục <code className="text-cyan-400">firmware/esp32-cam/</code>. Điền thông tin Wi-Fi và IP máy tính chạy NestJS:
            </p>
            <div className="relative bg-ocean-950 rounded-lg p-2.5 border border-ocean-700 font-mono text-[11px] text-slate-300">
              <pre className="overflow-x-auto">{configSnippet}</pre>
              <button
                onClick={copyConfig}
                className="absolute top-2 right-2 p-1 rounded bg-ocean-800 hover:bg-ocean-700 text-slate-300 hover:text-white"
                title="Sao chép cấu hình"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-1">2. Khởi chạy & Tự động ghép nối</h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>Cấp nguồn 5V/2A ổn định cho bo mạch ESP32-CAM.</li>
              <li>Thiết bị sẽ kết nối vào Router Wi-Fi và gửi gói tin <code className="text-cyan-400">POST /api/ingestion/heartbeat</code>.</li>
              <li>Trạng thái sẽ tự động đổi từ <span className="text-amber-400 font-mono font-semibold">DEMO</span> sang <span className="text-emerald-400 font-mono font-semibold">ONLINE</span> ngay khi gói tin đầu tiên đến.</li>
              <li>Đặc biệt: Khi mất điện, ESP32-CAM và router tắt; khi có điện trở lại, ESP32-CAM tự động kết nối lại website ngay khi router khởi động xong!</li>
            </ul>
            {onOpenFlasher && (
              <div className="mt-3">
                <button
                  onClick={onOpenFlasher}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs uppercase transition-all shadow-md"
                >
                  <Usb className="w-4 h-4" />
                  <span>Nạp Cấu Hình Wi-Fi NVS Ngay (Web Serial)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

