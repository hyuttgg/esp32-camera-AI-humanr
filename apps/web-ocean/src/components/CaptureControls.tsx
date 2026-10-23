import React, { useState } from 'react';
import { Clock, Calendar, Shield, Save, Check, AlertCircle, WifiOff } from 'lucide-react';
import { ScheduleConfig } from '../types';

interface CaptureControlsProps {
  schedule: ScheduleConfig;
  onSaveSchedule: (s: ScheduleConfig) => Promise<void>;
}

export const CaptureControls: React.FC<CaptureControlsProps> = ({
  schedule: initialSchedule,
  onSaveSchedule,
}) => {
  const [schedule, setSchedule] = useState<ScheduleConfig>(initialSchedule);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaveSchedule(schedule);
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-5 glow-cyan">
      <div className="flex items-center justify-between pb-4 border-b border-ocean-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Cấu Hình Lịch Chụp Định Kỳ</h3>
            <p className="text-xs text-slate-400">Điều khiển chu kỳ chụp, khung giờ hoạt động và chính sách ngoại tuyến</p>
          </div>
        </div>

        {/* Master Enabled Switch */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-300">
            {schedule.enabled ? 'Lịch Đang BẬT' : 'Lịch Đang TẮT'}
          </span>
          <button
            type="button"
            onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              schedule.enabled ? 'bg-cyan-500' : 'bg-ocean-800'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                schedule.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Interval Setting */}
          <div className="bg-ocean-850 p-4 rounded-xl border border-ocean-800">
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Chu kỳ chụp (Interval)</span>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="3600"
                value={schedule.intervalSeconds}
                onChange={(e) =>
                  setSchedule({ ...schedule, intervalSeconds: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="w-24 bg-ocean-950 border border-ocean-700 text-sm text-cyan-300 font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              <span className="text-xs text-slate-400 font-mono">giây / lần</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Khoảng cách giữa 2 lần ESP32-CAM chụp và tải ảnh lên.
            </p>
          </div>

          {/* Time Window */}
          <div className="bg-ocean-850 p-4 rounded-xl border border-ocean-800">
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Khung giờ hoạt động</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <span className="text-[10px] text-slate-400">Bắt đầu</span>
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })}
                  className="w-full bg-ocean-950 border border-ocean-700 text-xs text-slate-200 font-mono rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Kết thúc</span>
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })}
                  className="w-full bg-ocean-950 border border-ocean-700 text-xs text-slate-200 font-mono rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Ngoài khung giờ này, camera tự vào chế độ nghỉ (Power Save).
            </p>
          </div>

          {/* Rate-Limit & Offline Policy */}
          <div className="bg-ocean-850 p-4 rounded-xl border border-ocean-800">
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5 text-cyan-400" />
              <span>Chính sách khi mất mạng Wi-Fi</span>
            </label>
            <select
              value={schedule.offlinePolicy}
              onChange={(e) =>
                setSchedule({ ...schedule, offlinePolicy: e.target.value as 'DROP_OLDEST' | 'BUFFER_RAM' })
              }
              className="w-full bg-ocean-950 border border-ocean-700 text-xs text-slate-200 font-mono rounded-lg px-2.5 py-2 mt-2 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <option value="DROP_OLDEST">DROP_OLDEST (Bỏ ảnh cũ, giữ RAM an toàn)</option>
              <option value="BUFFER_RAM">BUFFER_RAM (Lưu tạm vào 4MB PSRAM)</option>
            </select>
            <div className="mt-2 text-[11px] text-slate-400">
              Giới hạn tốc độ: <strong>{schedule.rateLimitPerMinute} ảnh/phút</strong> để chống quá tải Flash.
            </div>
          </div>
        </div>

        {/* Quiet Hours & Confirmation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-ocean-800">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={schedule.quietHoursEnabled}
              onChange={(e) => setSchedule({ ...schedule, quietHoursEnabled: e.target.checked })}
              className="rounded bg-ocean-950 border-ocean-700 text-cyan-500 focus:ring-cyan-400"
            />
            <span>Bật thời gian nghỉ (Quiet Hours) — Giảm tần suất chụp khi không phát hiện người</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold font-mono tracking-wider bg-cyan-500 hover:bg-cyan-400 text-ocean-950 transition-all glow-cyan ml-auto active:scale-95"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-950" />
                <span>Đã lưu thành công!</span>
              </>
            ) : saving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu Cấu Hình Lịch Chụp</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

