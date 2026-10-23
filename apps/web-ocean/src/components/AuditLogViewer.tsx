import React, { useState } from 'react';
import { Shield, Search, Download, Filter, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditLogViewerProps {
  logs: AuditEvent[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filterAction !== 'ALL' && log.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.deviceId && log.deviceId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const exportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Action', 'Actor', 'Device', 'Details', 'IP', 'Status'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.action,
      l.actor,
      l.deviceId || 'N/A',
      `"${l.details.replace(/"/g, '""')}"`,
      l.ipAddress,
      l.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-5 glow-cyan space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ocean-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Nhật Ký Kiểm Toán (Audit Trail)</h3>
            <p className="text-xs text-slate-400">
              Ghi lại mọi hoạt động nạp ảnh, loại trùng, lệnh điều khiển và xóa dữ liệu.
            </p>
          </div>
        </div>

        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ocean-850 hover:bg-ocean-800 text-slate-200 border border-ocean-700 text-xs font-mono transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Xuất CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo hành động, thiết bị, chi tiết..."
            className="w-full bg-ocean-950 border border-ocean-750 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-lg font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-ocean-950 border border-ocean-750 text-xs text-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          <option value="ALL">Tất cả hành động</option>
          <option value="IMAGE_INGESTION">IMAGE_INGESTION</option>
          <option value="DEDUP_DISCARD">DEDUP_DISCARD</option>
          <option value="RETENTION_PURGE">RETENTION_PURGE</option>
          <option value="DEVICE_HEARTBEAT">DEVICE_HEARTBEAT</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className="overflow-x-auto rounded-xl border border-ocean-800">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-ocean-950/80 text-slate-400 border-b border-ocean-800">
            <tr>
              <th className="py-2.5 px-3">Thời Gian</th>
              <th className="py-2.5 px-3">Hành Động</th>
              <th className="py-2.5 px-3">Tác Nhân</th>
              <th className="py-2.5 px-3">Thiết Bị</th>
              <th className="py-2.5 px-3">Chi Tiết</th>
              <th className="py-2.5 px-3">Trạng Thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ocean-850">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-ocean-850/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                </td>
                <td className="py-2.5 px-3 font-semibold text-cyan-300 whitespace-nowrap">
                  {log.action}
                </td>
                <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{log.actor}</td>
                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{log.deviceId || '-'}</td>
                <td className="py-2.5 px-3 text-slate-300 max-w-md truncate" title={log.details}>
                  {log.details}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {log.status === 'SUCCESS' ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SUCCESS</span>
                    </span>
                  ) : log.status === 'WARNING' ? (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>WARNING</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>FAILED</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

