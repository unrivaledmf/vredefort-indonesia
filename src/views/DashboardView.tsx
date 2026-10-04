import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderGit2,
  Clock,
  HardDrive,
  FileText,
  Calendar,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  FileCode,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { MiningFile, Note, Project, Task, StorageStats } from '../types.ts';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Button } from '../components/ui/Button.tsx';

interface DashboardViewProps {
  onNavigate: (view: string, targetId?: string) => void;
  onPreviewFile: (file: MiningFile) => void;
  onOpenNote: (noteId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onPreviewFile,
  onOpenNote
}) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<MiningFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, n, p, t, s] = await Promise.all([
        api.getFiles(),
        api.getNotes(),
        api.getProjects(),
        api.getTasks(),
        api.getStorageStats()
      ]);
      setFiles(f);
      setNotes(n);
      setProjects(p);
      setTasks(t);
      setStorage(s);
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2">
              <Skeleton width="40%" height={14} />
              <Skeleton width="70%" height={28} />
              <Skeleton width="50%" height={12} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height={280} className="rounded-xl" />
          <Skeleton height={280} className="rounded-xl" />
          <Skeleton height={280} className="rounded-xl" />
          <Skeleton height={280} className="rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-12 max-w-lg mx-auto">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Terjadi Kendala Memuat Data"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      </div>
    );
  }

  // 1. KPI: Rata-rata Progres
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length)
    : 0;

  // 2. KPI: Tugas jatuh tempo <= 7 hari (atau overdue)
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const dueSoonTasks = tasks.filter(t => {
    if (t.status === 'done' || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due <= sevenDaysFromNow;
  });

  // 3. KPI: File diunggah minggu ini
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  const filesUploadedThisWeek = files.filter(f => {
    const created = new Date(f.createdAt);
    return created >= sevenDaysAgo;
  }).length;

  // 4. KPI: Penyimpanan terpakai
  const usedMB = storage ? (storage.usedBytes / (1024 * 1024)).toFixed(1) : '0';
  const totalGB = storage?.totalCapacityBytes
    ? (storage.totalCapacityBytes / (1024 * 1024 * 1024)).toFixed(1)
    : '10.0';
  const percentUsed = storage ? storage.percentUsed.toFixed(1) : '0';

  // Section 1: Deadline Terdekat (kombinasi project & task terdekat)
  const upcomingDeadlines: Array<{
    id: string;
    title: string;
    type: 'project' | 'task';
    dueDate: string;
    badgeText: string;
    targetId: string;
    isOverdue: boolean;
  }> = [];

  projects.forEach(p => {
    if (p.deadline) {
      upcomingDeadlines.push({
        id: p.id,
        title: `${p.code}: ${p.title}`,
        type: 'project',
        dueDate: p.deadline,
        badgeText: p.code,
        targetId: p.id,
        isOverdue: p.status !== 'completed' && p.deadline.includes('2026') && new Date(p.deadline) < now
      });
    }
  });

  tasks.forEach(t => {
    if (t.status !== 'done' && t.dueDate) {
      const isPast = new Date(t.dueDate) < now;
      upcomingDeadlines.push({
        id: t.id,
        title: t.title,
        type: 'task',
        dueDate: t.dueDate,
        badgeText: t.projectAcara,
        targetId: t.id,
        isOverdue: isPast
      });
    }
  });

  // Sort upcoming deadlines
  const sortedDeadlines = upcomingDeadlines.slice(0, 5);

  // Section 2: Tugas Saya
  const myTasks = tasks
    .filter(t => {
      if (t.status === 'done') return false;
      if (user?.username && t.assignedTo?.toLowerCase() === user.username.toLowerCase()) return true;
      return t.priority === 'high';
    })
    .slice(0, 5);

  // Section 3: Aktivitas Terbaru (gabungan catatan & file terupdate)
  const recentActivities = [
    ...notes.map(n => ({
      id: n.id,
      title: n.title,
      type: 'note' as const,
      user: n.createdBy,
      time: n.updatedAt,
      label: 'Catatan diperbarui'
    })),
    ...files.map(f => ({
      id: f.id,
      title: f.name,
      type: 'file' as const,
      user: f.uploadedBy,
      time: f.createdAt,
      label: 'File diunggah'
    }))
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  // Section 4: File Terbaru
  const recentFiles = [...files]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Notice */}
      <div className="bg-white dark:bg-[#0B0F17] text-neutral-900 dark:text-white border border-neutral-200 dark:border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="text-amber-600 dark:text-amber-400 font-semibold tracking-wider uppercase">TA 2026/2027</span>
              <span>·</span>
              <span>Kelompok Perencanaan Tambang</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              VREDEFORT INDONESIA
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
              Pusat Dokumentasi, Manajemen Berkas &amp; Perancangan Tambang. Pemodelan geologi, block model, optimasi pit, perancangan pushback, hidrologi tambang, dan evaluasi kelayakan finansial.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('projects')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Lihat Proyek
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('files')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Buka File
            </Button>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards (All Clickable) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Progres Rata-rata */}
        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] text-left hover:border-amber-500/50 hover:shadow-sm transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">
            <span>Progres Rata-rata</span>
            <TrendingUp className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {avgProgress}%
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            Dari {projects.length} Acara Tambang
          </p>
        </button>

        {/* KPI 2: Tugas Jatuh Tempo */}
        <button
          type="button"
          onClick={() => onNavigate('kanban')}
          className="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] text-left hover:border-amber-500/50 hover:shadow-sm transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">
            <span>Tugas Segera Jatuh Tempo</span>
            <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {dueSoonTasks.length}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            Jatuh tempo dlm ≤7 hari
          </p>
        </button>

        {/* KPI 3: File Diunggah Minggu Ini */}
        <button
          type="button"
          onClick={() => onNavigate('files')}
          className="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] text-left hover:border-amber-500/50 hover:shadow-sm transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">
            <span>File Baru Minggu Ini</span>
            <FileText className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {filesUploadedThisWeek}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            Total {files.length} berkas tersimpan
          </p>
        </button>

        {/* KPI 4: Penyimpanan Terpakai */}
        <button
          type="button"
          onClick={() => onNavigate('files')}
          className="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] text-left hover:border-amber-500/50 hover:shadow-sm transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">
            <span>Penyimpanan Terpakai</span>
            <HardDrive className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {usedMB} <span className="text-xs font-normal text-neutral-500">MB</span>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
            {percentUsed}% dari {totalGB} GB
          </p>
        </button>
      </div>

      {/* Grid of 4 Interactive Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Deadline Terdekat */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Batas Waktu Terdekat</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Target pengumpulan &amp; tugas penting
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('timeline')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Jadwal
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {sortedDeadlines.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6 text-neutral-400" />}
                title="Belum Ada Batas Waktu Terdekat"
                description="Semua tugas dan target Acara saat ini telah terselesaikan atau belum dijadwalkan."
              />
            ) : (
              sortedDeadlines.map(item => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => onNavigate(item.type === 'project' ? 'projects' : 'kanban', item.targetId)}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-white/[0.05] hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={item.type === 'project' ? 'accent' : 'default'} size="sm">
                      {item.badgeText}
                    </Badge>
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-[11px] ${item.isOverdue ? 'text-red-500 font-semibold' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {item.dueDate}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Section 2: Tugas Saya */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Tugas Saya</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Daftar tugas prioritas yang ditugaskan kepada Anda
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('kanban')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Semua Tugas
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {myTasks.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="w-6 h-6 text-emerald-500" />}
                title="Tidak Ada Tugas Tertunda"
                description="Semua tugas prioritas Anda telah selesai dikerjakan."
                action={
                  <Button variant="secondary" size="sm" onClick={() => onNavigate('kanban')}>
                    Lihat Semua Tugas
                  </Button>
                }
              />
            ) : (
              myTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => onNavigate('kanban', task.id)}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-white/[0.05] hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 ">
                        {task.projectAcara} · PJ: @{task.assignedTo}
                      </div>
                    </div>
                  </div>
                  <Badge variant={task.priority === 'high' ? 'danger' : 'warning'} size="sm">
                    {task.priority.toUpperCase()}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Section 3: Aktivitas Terbaru */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Aktivitas Terbaru</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Pembaruan catatan dan file kelompok
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('notes')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Semua Catatan
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentActivities.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-6 h-6 text-neutral-400" />}
                title="Belum Ada Aktivitas"
                description="Mulai buat engineering notes atau unggah file perencanaan tambang."
              />
            ) : (
              recentActivities.map(act => (
                <div
                  key={`${act.type}-${act.id}`}
                  onClick={() => {
                    if (act.type === 'note') {
                      onOpenNote(act.id);
                    } else {
                      onNavigate('files', act.id);
                    }
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-white/[0.05] hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-neutral-600 dark:text-slate-300 shrink-0">
                      {act.type === 'note' ? <FileText className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {act.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 ">
                        {act.label} oleh @{act.user}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Section 4: File Terbaru */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>File Terbaru</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Berkas rancangan teknis &amp; pemodelan
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('files')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              File Manager
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentFiles.length === 0 ? (
              <EmptyState
                icon={<HardDrive className="w-6 h-6 text-neutral-400" />}
                title="Belum Ada File"
                description="Unggah file data bore hole, model blok Surpac, atau laporan."
                action={
                  <Button variant="primary" size="sm" onClick={() => onNavigate('files')}>
                    Unggah File Sekarang
                  </Button>
                }
              />
            ) : (
              recentFiles.map(file => {
                const sizeKB = (file.size / 1024).toFixed(0);
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

                return (
                  <div
                    key={file.id}
                    onClick={() => onPreviewFile(file)}
                    className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-white/[0.05] hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-neutral-600 dark:text-slate-300 text-[10px] font-bold uppercase shrink-0">
                        {file.extension.replace('.', '') || 'FILE'}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 ">
                          {sizeText} · @{file.uploadedBy}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
