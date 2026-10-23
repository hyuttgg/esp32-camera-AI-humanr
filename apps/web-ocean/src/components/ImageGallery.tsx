import React, { useState } from 'react';
import {
  Grid,
  Filter,
  Trash2,
  Eye,
  Clock,
  Shield,
  Layers,
  Sparkles,
  AlertTriangle,
  X,
  Lock,
} from 'lucide-react';
import { ImageMeta } from '../types';
import { createSvgDataUrl } from '../mockData';

interface ImageGalleryProps {
  images: ImageMeta[];
  onDeleteImage: (id: string) => Promise<void>;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onDeleteImage }) => {
  const [filterDuplicate, setFilterDuplicate] = useState<'ALL' | 'UNIQUE' | 'DUPLICATES'>('ALL');
  const [filterPersonOnly, setFilterPersonOnly] = useState(false);
  const [inspectImage, setInspectImage] = useState<ImageMeta | null>(null);

  const filteredImages = images.filter((img) => {
    if (filterDuplicate === 'UNIQUE' && img.isDuplicate) return false;
    if (filterDuplicate === 'DUPLICATES' && !img.isDuplicate) return false;
    if (filterPersonOnly && !img.personDetected) return false;
    return true;
  });

  const formatExpiresIn = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    if (diff <= 0) return 'Đã hết hạn';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Còn ${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-4">
      {/* Gallery Filter & Security Header */}
      <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 glow-cyan">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
              <span>Thư Viện Ảnh (MongoDB GridFS Binary Stream)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                ZERO-CLIENT PERSISTENCE
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Ảnh được stream trực tiếp qua RAM, không lưu đĩa cứng trình duyệt hay localStorage.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-ocean-850 rounded-lg p-1 border border-ocean-800 text-xs font-mono">
            <button
              onClick={() => setFilterDuplicate('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterDuplicate === 'ALL' ? 'bg-cyan-500 text-ocean-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất Cả ({images.length})
            </button>
            <button
              onClick={() => setFilterDuplicate('UNIQUE')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterDuplicate === 'UNIQUE' ? 'bg-cyan-500 text-ocean-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Duy Nhất ({images.filter((i) => !i.isDuplicate).length})
            </button>
            <button
              onClick={() => setFilterDuplicate('DUPLICATES')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterDuplicate === 'DUPLICATES' ? 'bg-amber-500 text-ocean-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Trùng Lặp ({images.filter((i) => i.isDuplicate).length})
            </button>
          </div>

          <button
            onClick={() => setFilterPersonOnly(!filterPersonOnly)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 ${
              filterPersonOnly
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-ocean-850 text-slate-400 border-ocean-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Có Người ({images.filter((i) => i.personDetected).length})</span>
          </button>
        </div>
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredImages.map((img) => {
          const imgPreviewUrl = createSvgDataUrl(
            `FRAME: ${img.filename}`,
            img.isDark,
            img.personDetected,
            img.id,
          );

          return (
            <div
              key={img.id}
              className={`bg-ocean-900 border rounded-xl overflow-hidden transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 ${
                img.isDuplicate ? 'border-amber-600/40' : 'border-ocean-800'
              }`}
            >
              {/* Image Preview Box */}
              <div className="relative aspect-[4/3] bg-ocean-950 overflow-hidden group">
                <img
                  src={imgPreviewUrl}
                  alt={img.filename}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 select-none pointer-events-none"
                />

                {/* Overlays */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 font-mono text-[10px]">
                  {img.isDuplicate ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/90 text-ocean-950 font-bold shadow flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      TRÙNG LẶP (Dist: {img.hammingDistance})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-ocean-950 font-bold shadow">
                      CHÍNH THỨC
                    </span>
                  )}

                  {img.personDetected && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/90 text-ocean-950 font-bold shadow flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      NGƯỜI ({(img.confidence * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>

                {/* Expiry Pill */}
                <div className="absolute bottom-2 left-2 bg-ocean-950/90 border border-ocean-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{formatExpiresIn(img.expiresAt)}</span>
                </div>

                {/* Quick Action Button Overlay */}
                <div className="absolute inset-0 bg-ocean-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => setInspectImage(img)}
                    className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-ocean-950 transition-colors shadow-lg"
                    title="Xem chi tiết & mã băm"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteImage(img.id)}
                    className="p-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white transition-colors shadow-lg"
                    title="Xóa vĩnh viễn khỏi GridFS"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Meta Footer */}
              <div className="p-3 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="truncate font-semibold">{img.filename}</span>
                  <span className="text-[10px] text-slate-400">{(img.sizeBytes / 1024).toFixed(1)} KB</span>
                </div>

                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1" title={img.sha256}>
                  <Lock className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="text-cyan-300/80">SHA: {img.sha256.substring(0, 16)}...</span>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>dHash: {img.dhash}</span>
                  <span>{new Date(img.capturedAt).toLocaleTimeString('vi-VN')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspect Modal */}
      {inspectImage && (
        <div className="fixed inset-0 z-50 bg-ocean-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ocean-900 border border-ocean-700 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setInspectImage(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-ocean-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white text-base">Chi Tiết Ảnh & Metadata GridFS</h3>
            </div>

            <div className="relative aspect-[4/3] max-h-80 w-full rounded-xl overflow-hidden bg-ocean-950 border border-ocean-700">
              <img
                src={createSvgDataUrl(
                  inspectImage.filename,
                  inspectImage.isDark,
                  inspectImage.personDetected,
                  inspectImage.id,
                )}
                alt={inspectImage.filename}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="bg-ocean-950 p-3 rounded-xl border border-ocean-800 font-mono text-xs space-y-2 text-slate-300">
              <div className="grid grid-cols-2 gap-2">
                <div>ID: <span className="text-cyan-300">{inspectImage.id}</span></div>
                <div>Thiết bị: <span className="text-cyan-300">{inspectImage.deviceId}</span></div>
                <div>Độ phân giải: <span className="text-cyan-300">{inspectImage.width}x{inspectImage.height}</span></div>
                <div>Dung lượng: <span className="text-cyan-300">{(inspectImage.sizeBytes / 1024).toFixed(2)} KB</span></div>
              </div>
              <div className="break-all pt-1 border-t border-ocean-800">
                SHA-256: <span className="text-slate-400">{inspectImage.sha256}</span>
              </div>
              <div>
                dHash 64-bit: <span className="text-cyan-300">{inspectImage.dhash}</span> | Trùng lặp:{' '}
                <span className={inspectImage.isDuplicate ? 'text-amber-400' : 'text-emerald-400'}>
                  {inspectImage.isDuplicate ? `CÓ (Hamming: ${inspectImage.hammingDistance})` : 'KHÔNG (Gốc)'}
                </span>
              </div>
              <div>
                Thời hạn lưu: <span className="text-amber-300">{formatExpiresIn(inspectImage.expiresAt)}</span> (Tự xóa lúc{' '}
                {new Date(inspectImage.expiresAt).toLocaleString('vi-VN')})
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setInspectImage(null)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:bg-ocean-800 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={async () => {
                  await onDeleteImage(inspectImage.id);
                  setInspectImage(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Ngay Khỏi GridFS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

