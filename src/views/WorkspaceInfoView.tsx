import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Edit,
  Save,
  RefreshCw,
  Upload,
  Code,
  Image as ImageIcon,
  Check,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api.ts';
import { WorkspaceInfo } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';

export const WorkspaceInfoView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form edit fields
  const [attendanceRule, setAttendanceRule] = useState('');
  const [labPcScheduleStatus, setLabPcScheduleStatus] = useState('');
  const [workDuration, setWorkDuration] = useState('');

  // Logo management state
  const [svgCodeInput, setSvgCodeInput] = useState('');
  const [isSubmittingLogo, setIsSubmittingLogo] = useState(false);
  const [showSvgPasteArea, setShowSvgPasteArea] = useState(false);
  const [logoVersion, setLogoVersion] = useState(() => Date.now());

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWorkspaceInfo();
      setInfo(data);
      setAttendanceRule(data.attendanceRule);
      setLabPcScheduleStatus(data.labPcScheduleStatus);
      setWorkDuration(data.workDurationPerAcara);
      if (data.customLogoSvg) {
        setSvgCodeInput(data.customLogoSvg);
      }
    } catch (err: any) {
      console.error('Workspace info error:', err);
      setError(err.message || 'Gagal memuat informasi workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    try {
      const updated = await api.updateWorkspaceInfo({
        attendanceRule,
        labPcScheduleStatus,
        workDurationPerAcara: workDuration
      });
      setInfo(updated);
      setIsEditing(false);
      toast.success('Informasi Workspace Diperbarui');
    } catch (err: any) {
      toast.error('Gagal Menyimpan Perubahan', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle file upload (.svg or .png/.jpg/.webp)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmittingLogo(true);
    try {
      const isSvg = file.name.toLowerCase().endsWith('.svg') || file.type.includes('svg');

      if (isSvg) {
        const reader = new FileReader();
        reader.onload = async event => {
          try {
            const svgContent = event.target?.result as string;
            if (!svgContent || !svgContent.includes('<svg')) {
              toast.error('File SVG Tidak Valid', 'Pastikan berkas berformat XML SVG yang sah.');
              setIsSubmittingLogo(false);
              return;
            }

            const res = await api.updateLogo({ svgContent });
            setInfo(res.workspaceInfo);
            setSvgCodeInput(svgContent);
            const newVer = Date.now();
            setLogoVersion(newVer);
            window.dispatchEvent(new CustomEvent('vredefort-logo-updated', { detail: { version: newVer } }));
            toast.success('Logo Resmi Berhasil Diperbarui', 'Berkas SVG PT Vredefort Indonesia berhasil diterapkan ke seluruh aplikasi.');
          } catch (err: any) {
            toast.error('Gagal Menerapkan Logo', err.message);
          } finally {
            setIsSubmittingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        reader.readAsText(file);
      } else {
        // Raster Image (PNG, JPG, etc.)
        const reader = new FileReader();
        reader.onload = async event => {
          try {
            const dataUrl = event.target?.result as string;
            const res = await api.updateLogo({ dataUrl });
            setInfo(res.workspaceInfo);
            const newVer = Date.now();
            setLogoVersion(newVer);
            window.dispatchEvent(new CustomEvent('vredefort-logo-updated', { detail: { version: newVer } }));
            toast.success('Logo Resmi Berhasil Diperbarui', 'Gambar logo berhasil diunggah.');
          } catch (err: any) {
            toast.error('Gagal Menerapkan Logo', err.message);
          } finally {
            setIsSubmittingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      toast.error('Kesalahan Membaca Berkas', err.message);
      setIsSubmittingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle direct paste of SVG code
  const handleApplySvgCode = async () => {
    if (!svgCodeInput.trim() || !svgCodeInput.includes('<svg')) {
      toast.error('Kode SVG Kosong / Tidak Sah', 'Harap masukkan kode tag <svg>...</svg> yang valid.');
      return;
    }

    setIsSubmittingLogo(true);
    try {
      const res = await api.updateLogo({ svgContent: svgCodeInput.trim() });
      setInfo(res.workspaceInfo);
      const newVer = Date.now();
      setLogoVersion(newVer);
      window.dispatchEvent(new CustomEvent('vredefort-logo-updated', { detail: { version: newVer } }));
      toast.success('Logo Resmi Berhasil Diperbarui', 'Kode SVG Vredefort berhasil diterapkan ke seluruh sistem.');
      setShowSvgPasteArea(false);
    } catch (err: any) {
      toast.error('Gagal Menerapkan Kode SVG', err.message);
    } finally {
      setIsSubmittingLogo(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 ">
              WORKSPACE GUIDELINES
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Ketentuan Silabus Laboratorium</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Informasi Workspace Perencanaan Tambang
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Pedoman akademik TA 2026/2027, aturan kehadiran harian lab, syarat presentasi teknis, dan identitas resmi tim.
          </p>
        </div>

        {user?.role === 'admin' && (
          <Button
            variant={isEditing ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              if (isEditing) handleSave();
              else setIsEditing(true);
            }}
            loading={saving}
            leftIcon={isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
          >
            {isEditing ? 'Simpan Perubahan' : 'Edit Panduan'}
          </Button>
        )}
      </div>

      {/* BRAND LOGO MANAGEMENT CARD (Official PT Vredefort Indonesia Logo) */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 dark:border-white/[0.06] pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Identitas &amp; Logo Resmi PT Vredefort Indonesia
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Format vektor SVG / PNG resmi yang tampil di Login, Header, Navigasi, dan Laporan.
              </p>
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,.png,.webp,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                loading={isSubmittingLogo}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Unggah File Logo (.svg / .png)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSvgPasteArea(prev => !prev)}
                leftIcon={<Code className="w-3.5 h-3.5" />}
              >
                {showSvgPasteArea ? 'Tutup Kode SVG' : 'Tempel Kode SVG'}
              </Button>
            </div>
          )}
        </div>

        {/* Live Logo Previews */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50 dark:bg-black/20 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
              Pratinjau Navigasi (32px)
            </span>
            <div className="py-2">
              <BrandLogo size={32} withText version={logoVersion} />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50 dark:bg-black/20 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
              Pratinjau Header (48px)
            </span>
            <div className="py-1">
              <BrandLogo size={48} version={logoVersion} />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50 dark:bg-black/20 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
              Pratinjau Layar Login (72px)
            </span>
            <div>
              <BrandLogo size={72} version={logoVersion} />
            </div>
          </div>
        </div>

        {/* Optional Paste SVG Markup Section */}
        {showSvgPasteArea && user?.role === 'admin' && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Code className="w-4 h-4 text-amber-500" />
                Tempel Kode Teks XML SVG PT Vredefort Indonesia
              </span>
              <span className="text-[10px] text-neutral-500 ">
                Buka file .svg di Notepad/VSCode, lalu salin isinya ke sini
              </span>
            </div>
            <textarea
              value={svgCodeInput}
              onChange={e => setSvgCodeInput(e.target.value)}
              placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"> ... </svg>'
              rows={5}
              className="w-full p-3 text-xs rounded-xl border border-neutral-300 dark:border-white/10 bg-white dark:bg-[#070b14] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSvgPasteArea(false)}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplySvgCode}
                loading={isSubmittingLogo}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Simpan &amp; Terapkan Kode SVG
              </Button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton height={100} className="rounded-2xl" />
          <Skeleton height={200} className="rounded-2xl" />
        </div>
      ) : error || !info ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Informasi"
          description={error || 'Data panduan workspace tidak tersedia.'}
          action={
            <Button variant="primary" size="sm" onClick={loadInfo} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Important Rules Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                Aturan Kehadiran &amp; Absensi Harian
              </div>
              {isEditing ? (
                <textarea
                  value={attendanceRule}
                  onChange={e => setAttendanceRule(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-lg border border-amber-400/40 bg-white dark:bg-[#0E1420] text-neutral-900 dark:text-white focus:outline-none"
                />
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white leading-relaxed">
                  {info.attendanceRule}
                </p>
              )}
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Wajib hadir dan mengisi presensi studio komputasi tambang sebelum pukul 08:30 WIB.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <Monitor className="w-4 h-4" />
                Status Perangkat &amp; Komputer Laboratorium
              </div>
              {isEditing ? (
                <textarea
                  value={labPcScheduleStatus}
                  onChange={e => setLabPcScheduleStatus(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-lg border border-blue-400/40 bg-white dark:bg-[#0E1420] text-neutral-900 dark:text-white focus:outline-none"
                />
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white leading-relaxed">
                  {info.labPcScheduleStatus}
                </p>
              )}
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Kelompok 5 dapat menggunakan laptop mandiri dengan lisensi software pertambangan yang disediakan.
              </p>
            </div>
          </div>

          {/* Details Panel */}
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-6 shadow-xs">
            {/* Course & Duration Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-neutral-100 dark:border-white/[0.06] text-xs">
              <div>
                <span className="text-neutral-400 block mb-1">Mata Kuliah</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {info.subjectName}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block mb-1">Tahun Akademik</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {info.academicYear}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block mb-1">Durasi Pengerjaan Acara</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={workDuration}
                    onChange={e => setWorkDuration(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-neutral-300 dark:border-white/[0.1] bg-white dark:bg-black/30 text-neutral-900 dark:text-white"
                  />
                ) : (
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    {info.workDurationPerAcara}
                  </span>
                )}
              </div>
            </div>

            {/* Presentation Requirements */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Kewajiban Berkas Saat Presentasi Mahasiswa
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {info.presentationRequirements.map((req, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.06] text-xs text-neutral-800 dark:text-neutral-200 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members Roster */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5 font-semibold">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                Susunan Kelompok 5 Mahasiswa
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {info.members.map(mem => (
                  <div
                    key={mem.username}
                    className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-neutral-50/50 dark:bg-white/[0.01] flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold flex items-center justify-center text-xs uppercase shrink-0">
                      {mem.username.slice(0, 2)}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {mem.name}
                      </div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        @{mem.username} · {mem.nim}
                      </div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {mem.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
