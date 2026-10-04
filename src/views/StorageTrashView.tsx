import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  FileCode,
  Layers,
  MapPin,
  FileArchive,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  Database,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api.ts';
import { MiningFile, StorageStats } from '../types.ts';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

interface StorageTrashViewProps {
  onPreviewFile?: (file: MiningFile, list?: MiningFile[]) => void;
}

export const StorageTrashView: React.FC<StorageTrashViewProps> = ({ onPreviewFile }) => {
  const toast = useToast();

  const [stats, setStats] = useState<StorageStats | null>(null);
  const [trashedFiles, setTrashedFiles] = useState<MiningFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    fileId?: string;
    isAll?: boolean;
    fileName?: string;
  }>({ isOpen: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [storageStats, trashList] = await Promise.all([
        api.getStorageStats(),
        api.getFiles({ isTrashed: true })
      ]);
      setStats(storageStats);
      setTrashedFiles(trashList);
    } catch (err: any) {
      console.error('Error loading storage and trash:', err);
      setError(err.message || 'Gagal memuat data penyimpanan dan sampah.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestore = async (file: MiningFile) => {
    try {
      await api.restoreFile(file.id);
      toast.success('File Dipulihkan', `"${file.name}" berhasil dikembalikan ke berkas aktif.`);
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Memulihkan File', err.message);
    }
  };

  const executeDelete = async () => {
    const { fileId, isAll } = confirmDelete;
    try {
      if (isAll) {
        for (const file of trashedFiles) {
          await api.deleteFile(file.id, true);
        }
        toast.success('Tempat Sampah Dikosongkan', `${trashedFiles.length} berkas dihapus permanen.`);
      } else if (fileId) {
        await api.deleteFile(fileId, true);
        toast.success('File Dihapus Permanen', 'Berkas telah dihapus dari sistem.');
      }
      setConfirmDelete({ isOpen: false });
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Menghapus', err.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (ext: string) => {
    const clean = ext.replace('.', '').toLowerCase();
    switch (clean) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'dxf':
      case 'dwg':
        return <FileCode className="w-5 h-5 text-amber-500" />;
      case 'str':
      case 'dm':
      case 'dtm':
      case 'tcl':
        return <Layers className="w-5 h-5 text-cyan-500" />;
      case 'shp':
      case 'geojson':
      case 'kml':
      case 'kmz':
        return <MapPin className="w-5 h-5 text-purple-500" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FileArchive className="w-5 h-5 text-orange-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return <ImageIcon className="w-5 h-5 text-rose-500" />;
      default:
        return <FileText className="w-5 h-5 text-neutral-400" />;
    }
  };

  const usedMB = stats ? (stats.usedBytes / (1024 * 1024)).toFixed(1) : '0';
  const totalGB = stats ? (stats.totalCapacityBytes / (1024 * 1024 * 1024)).toFixed(1) : '10.0';
  const percent = stats ? Math.min(100, Math.max(1, stats.percentUsed)) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-500/20 text-red-600 dark:text-red-400 ">
              ADMINISTRASI SISTEM
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Penyimpanan &amp; Sampah</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Penyimpanan &amp; Tempat Sampah
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Audit kuota server, pemantauan berkas terbesar, dan pemulihan atau pembersihan berkas terhapus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Segarkan Data
          </Button>
          {trashedFiles.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                setConfirmDelete({
                  isOpen: true,
                  isAll: true
                })
              }
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Kosongkan Sampah
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton height={140} className="rounded-2xl" />
          <Skeleton height={200} className="rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Data"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Storage Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Used Card */}
            <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Database className="w-4 h-4 text-amber-500" />
                  Kapasitas Disk Terpakai
                </span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {percent.toFixed(1)}%
                </span>
              </div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                {usedMB} MB <span className="text-xs font-normal text-neutral-400">/ {totalGB} GB</span>
              </div>
              <div className="w-full h-2 bg-neutral-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats?.isCritical
                      ? 'bg-red-500'
                      : stats?.isWarning
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Trashed Count Card */}
            <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Berkas di Tempat Sampah
                </span>
                <Badge variant={trashedFiles.length > 0 ? 'warning' : 'default'} size="sm">
                  {trashedFiles.length} Berkas
                </Badge>
              </div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                {formatBytes(trashedFiles.reduce((acc, f) => acc + f.size, 0))}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Berkas di sampah tidak dihitung pada kuota aktif, namun dapat dipulihkan atau dihapus permanen.
              </p>
            </div>

            {/* Status Card */}
            <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Status Integritas Kuota
                </span>
                <Badge variant={stats?.isCritical ? 'danger' : stats?.isWarning ? 'warning' : 'success'} size="sm">
                  {stats?.isCritical ? 'KRITIS' : stats?.isWarning ? 'PERINGATAN' : 'NORMAL'}
                </Badge>
              </div>
              <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mt-2">
                Penyimpanan Sehat
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Batas unggah per berkas maksimal 200 MB. Berkas tambang .str, .dm, dan .dxf didukung penuh.
              </p>
            </div>
          </div>

          {/* Trashed Files List Section */}
          <div className="rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Daftar Berkas Terhapus ({trashedFiles.length})
                </h3>
              </div>
            </div>

            {trashedFiles.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                title="Tempat Sampah Bersih"
                description="Tidak ada berkas di tempat sampah. Semua berkas aktif berada di direktori penyimpanan."
                className="py-12"
              />
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {trashedFiles.map(file => (
                  <div
                    key={file.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-neutral-100 dark:bg-white/[0.04] shrink-0">
                        {getFileIcon(file.extension)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                          {file.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 ">
                          <span>{formatBytes(file.size)}</span>
                          <span>·</span>
                          <span>Oleh @{file.uploadedBy}</span>
                          <span>·</span>
                          <span>Dihapus {new Date(file.updatedAt).toLocaleDateString('id-ID')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {onPreviewFile && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPreviewFile(file, trashedFiles)}
                          aria-label={`Pratinjau ${file.name}`}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Lihat
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestore(file)}
                        aria-label={`Pulihkan ${file.name}`}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        Pulihkan
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          setConfirmDelete({
                            isOpen: true,
                            fileId: file.id,
                            fileName: file.name
                          })
                        }
                        aria-label={`Hapus permanen ${file.name}`}
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Hapus Permanen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Permanent Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false })}
        onConfirm={executeDelete}
        title={confirmDelete.isAll ? 'Kosongkan Tempat Sampah' : 'Hapus File Permanen'}
        message={
          confirmDelete.isAll
            ? `Hapus permanen semua ${trashedFiles.length} berkas yang ada di tempat sampah? Tindakan ini tidak dapat dibatalkan.`
            : `Hapus permanen berkas "${confirmDelete.fileName || ''}"? Tindakan ini tidak dapat dibatalkan.`
        }
        confirmText={confirmDelete.isAll ? 'Kosongkan Semua' : 'Hapus Permanen'}
        variant="danger"
      />
    </div>
  );
};
