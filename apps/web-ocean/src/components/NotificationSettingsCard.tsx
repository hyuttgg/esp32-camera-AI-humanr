import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react';

interface NotificationSettingsCardProps {
  onSendTestEmail: (email: string) => Promise<{ success: boolean; simulated?: boolean; messageId?: string }>;
}

export const NotificationSettingsCard: React.FC<NotificationSettingsCardProps> = ({ onSendTestEmail }) => {
  const [targetEmail, setTargetEmail] = useState('khanh.engineer@gmail.com');
  const [notifyIntruder, setNotifyIntruder] = useState(true);
  const [notifyPurge, setNotifyPurge] = useState(true);
  const [notifyDisconnect, setNotifyDisconnect] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; simulated?: boolean; messageId?: string } | null>(null);

  const handleTest = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await onSendTestEmail(targetEmail);
      setResult(res);
    } catch (e) {
      setResult({ success: false });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-5 glow-cyan space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ocean-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <span>Cấu Hình Thông Báo Qua Google Gmail API</span>
              <a
                href="https://googleapis.dev/nodejs/googleapis/latest/gmail/index.html"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-normal"
              >
                <span>v1 Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </h3>
            <p className="text-xs text-slate-400">
              Gửi email cảnh báo thời gian thực khi phát hiện người ban đêm hoặc hoàn thành dọn dẹp ảnh.
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
          GMAIL API v1 READY
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email Recipient Input */}
        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Email nhận thông báo khẩn cấp:
          </label>
          <div className="relative mt-1">
            <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="w-full bg-ocean-950 border border-ocean-700 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="admin@example.com"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Hỗ trợ tài khoản Gmail cá nhân và Google Workspace doanh nghiệp.
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-2 text-xs font-mono">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyIntruder}
              onChange={(e) => setNotifyIntruder(e.target.checked)}
              className="rounded bg-ocean-950 border-ocean-700 text-cyan-500 focus:ring-cyan-400"
            />
            <span>Cảnh báo phát hiện người ban đêm (Night Intruder)</span>
          </label>
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyPurge}
              onChange={(e) => setNotifyPurge(e.target.checked)}
              className="rounded bg-ocean-950 border-ocean-700 text-cyan-500 focus:ring-cyan-400"
            />
            <span>Báo cáo chu kỳ dọn dẹp ảnh tự động (15h Purge Report)</span>
          </label>
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyDisconnect}
              onChange={(e) => setNotifyDisconnect(e.target.checked)}
              className="rounded bg-ocean-950 border-ocean-700 text-cyan-500 focus:ring-cyan-400"
            />
            <span>Cảnh báo mất sóng Wi-Fi / Brownout nguồn camera</span>
          </label>
        </div>
      </div>

      {/* Test Button & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-ocean-800">
        <div className="text-xs font-mono text-slate-400">
          Gửi email MIME mã hóa UTF-8 trực tiếp qua Google OAuth2
        </div>

        <button
          onClick={handleTest}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-ocean-950 font-bold text-xs font-mono transition-all glow-cyan shadow-md active:scale-95"
        >
          {sending ? (
            <span>Đang gửi qua Gmail API...</span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Gửi Thử Email Thông Báo (Test Gmail Send)</span>
            </>
          )}
        </button>
      </div>

      {/* Result Alert */}
      {result && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
            result.success
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}
        >
          {result.success ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Thành công: Đã phát lệnh gửi email cảnh báo an ninh tới{' '}
                <strong>{targetEmail}</strong> qua Gmail API v1 (MessageId: {result.messageId || 'OK'})!
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Lỗi: Không thể gửi email. Vui lòng kiểm tra thông tin cấu hình Google API.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

