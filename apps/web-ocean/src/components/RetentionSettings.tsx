import React, { useState } from 'react';
import { Trash2, Clock, AlertTriangle, ShieldCheck, Database, RefreshCw, Check } from 'lucide-react';
import { RetentionPolicy } from '../types';

interface RetentionSettingsProps {
  policy: RetentionPolicy;
  onUpdatePolicy: (p: RetentionPolicy) => Promise<void>;
  onTriggerPurgeNow: () => Promise<{ purgedCount: number; purgedBytes: number }>;
}

export const RetentionSettings: React.FC<RetentionSettingsProps> = ({
  policy: initialPolicy,
  onUpdatePolicy,
  onTriggerPurgeNow,
}) => {
  const [policy, setPolicy] = useState<RetentionPolicy>(initialPolicy);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ purgedCount: number; purgedBytes: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdatePolicy(policy);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleManualPurge = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kích hoạt xóa vĩnh viễn toàn bộ ảnh hết hạn khỏi MongoDB GridFS ngay bây giờ?')) {
      return;
    }
    setIsPurging(true);
    const result = await onTriggerPurgeNow();
    setPurgeResult(result);
    setIsPurging(false);
  };

  return (
    <div className="space-y-5">
      {/* Retention Card */}
      <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-5 glow-cyan space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ocean-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Chính Sách Tự Động Xóa Ảnh Hết Hạn</h3>
              <p className="text-xs text-slate-400">
                Ảnh quá hạn sẽ được xóa vĩnh viễn khỏi MongoDB GridFS kèm audit record (không lưu file thừa).
              </p>
            </div>
          </div>

          <div className="px-3 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono text-xs flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>Múi Giờ: {policy.timezone}</span>
          </div>
        </div>

        {/* Dual Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode 1: AFTER_CAPTURE (Default) */}
          <div
            onClick={() => setPolicy({ ...policy, mode: 'AFTER_CAPTURE' })}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              policy.mode === 'AFTER_CAPTURE'
                ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-ocean-850 border-ocean-800 text-slate-400 hover:border-ocean-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={policy.mode === 'AFTER_CAPTURE'}
                  onChange={() => setPolicy({ ...policy, mode: 'AFTER_CAPTURE' })}
                  className="text-cyan-500 focus:ring-cyan-400 bg-ocean-950"
                />
                <span className="font-semibold text-sm">Chế Độ Mặc Định (AFTER_CAPTURE)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                15 GIỜ
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mỗi ảnh tự động hết hạn và bị xóa vĩnh viễn đúng <strong>15 giờ</strong> sau thời điểm chụp.
            </p>
            {policy.mode === 'AFTER_CAPTURE' && (
              <div className="mt-3 flex items-center gap-2 font-mono text-xs text-cyan-300">
                <span>Số giờ lưu:</span>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={policy.retentionHours}
                  onChange={(e) =>
                    setPolicy({ ...policy, retentionHours: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-20 bg-ocean-950 border border-ocean-700 rounded px-2 py-1 text-white text-center focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <span>giờ</span>
              </div>
            )}
          </div>

          {/* Mode 2: DAILY_CUTOFF (Daily 15:00) */}
          <div
            onClick={() => setPolicy({ ...policy, mode: 'DAILY_CUTOFF' })}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              policy.mode === 'DAILY_CUTOFF'
                ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-ocean-850 border-ocean-800 text-slate-400 hover:border-ocean-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={policy.mode === 'DAILY_CUTOFF'}
                  onChange={() => setPolicy({ ...policy, mode: 'DAILY_CUTOFF' })}
                  className="text-cyan-500 focus:ring-cyan-400 bg-ocean-950"
                />
                <span className="font-semibold text-sm">Chế Độ Cắt Mốc Hàng Ngày (DAILY_CUTOFF)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                15:00 CHIỀU
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Xóa toàn bộ ảnh chụp của ngày trước vào đúng mốc <strong>15:00 chiều mỗi ngày</strong> theo giờ Việt Nam.
            </p>
            {policy.mode === 'DAILY_CUTOFF' && (
              <div className="mt-3 flex items-center gap-2 font-mono text-xs text-cyan-300">
                <span>Mốc giờ cắt:</span>
                <input
                  type="time"
                  value={policy.dailyCutoffTime}
                  onChange={(e) => setPolicy({ ...policy, dailyCutoffTime: e.target.value })}
                  className="bg-ocean-950 border border-ocean-700 rounded px-2 py-1 text-white text-center focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <span>(Asia/Ho_Chi_Minh)</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Active Rule Banner */}
        <div className="bg-ocean-850 p-3.5 rounded-xl border border-ocean-700 font-mono text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
          <div>
            Quy tắc đang áp dụng:{' '}
            <strong className="text-cyan-300">
              {policy.mode === 'AFTER_CAPTURE'
                ? `AFTER_CAPTURE (${policy.retentionHours} giờ kể từ lúc lưu)`
                : `DAILY_CUTOFF (${policy.dailyCutoffTime} hàng ngày)`}
            </strong>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-ocean-950 font-bold font-mono text-xs transition-colors glow-cyan"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saveSuccess ? 'Đã Lưu!' : isSaving ? 'Đang lưu...' : 'Lưu Quy Tắc'}</span>
          </button>
        </div>

        {/* Purge Stats & Manual Trigger */}
        <div className="pt-4 border-t border-ocean-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-ocean-950 p-3 rounded-xl border border-ocean-800 font-mono">
            <span className="text-[11px] text-slate-400 block">Đã Xóa Tự Động (GridFS)</span>
            <span className="text-lg font-bold text-cyan-300">{policy.totalPurgedCount.toLocaleString()} ảnh</span>
          </div>

          <div className="bg-ocean-950 p-3 rounded-xl border border-ocean-800 font-mono">
            <span className="text-[11px] text-slate-400 block">Dung Lượng Giải Phóng</span>
            <span className="text-lg font-bold text-emerald-400">
              {(policy.totalPurgedBytes / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>

          <div className="bg-ocean-950 p-3 rounded-xl border border-ocean-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-mono">Tác Vụ Thủ Công</span>
              <span className="text-xs text-rose-300">Dọn dẹp ảnh quá hạn ngay</span>
            </div>
            <button
              onClick={handleManualPurge}
              disabled={isPurging}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-mono text-xs transition-all shadow-md active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isPurging ? 'Đang xóa...' : 'Purge Now'}</span>
            </button>
          </div>
        </div>

        {purgeResult && (
          <div className="bg-emerald-950/60 border border-emerald-500/50 p-3 rounded-xl font-mono text-xs text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Thành công: Đã xóa {purgeResult.purgedCount} ảnh hết hạn ({ (purgeResult.purgedBytes / 1024).toFixed(1) } KB) khỏi MongoDB GridFS.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

