import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderGit2,
  Calendar,
  CheckCircle2,
  HardDrive,
  FileText,
  CheckSquare,
  Users,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Project, MiningFile, Note, Task, ChecklistItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ProgressBar } from '../components/ui/ProgressBar.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Textarea } from '../components/ui/Textarea.tsx';

interface ProjectsViewProps {
  initialProjectId?: string;
  onPreviewFile?: (file: MiningFile) => void;
  onOpenNote?: (noteId: string) => void;
  onNavigate?: (view: string, targetId?: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  initialProjectId,
  onPreviewFile,
  onOpenNote,
  onNavigate
}) => {
  const { user } = useAuth();
  const toast = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<MiningFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || 'prj-1');
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'notes' | 'checklists' | 'tasks'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Project Modal State
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLeader, setNewLeader] = useState('fadil');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, f, n, t, c] = await Promise.all([
        api.getProjects(),
        api.getFiles(),
        api.getNotes(),
        api.getTasks(),
        api.getChecklists()
      ]);
      setProjects(p);
      setFiles(f);
      setNotes(n);
      setTasks(t);
      setChecklists(c);
      if (initialProjectId) {
        setSelectedProjectId(initialProjectId);
      }
    } catch (err: any) {
      console.error('Projects load error:', err);
      setError(err.message || 'Gagal memuat data Acara Perencanaan Tambang.');
    } finally {
      setLoading(false);
    }
  }, [initialProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // Checklist quick toggle
  const handleToggleChecklist = async (item: ChecklistItem) => {
    const nextStatus = item.status === 'completed' ? 'in_progress' : 'completed';
    try {
      await api.updateChecklist(item.id, { status: nextStatus });
      setChecklists(prev =>
        prev.map(c => (c.id === item.id ? { ...c, status: nextStatus } : c))
      );
      toast.success(
        nextStatus === 'completed' ? 'Checklist Selesai' : 'Checklist Diproses',
        item.title
      );
    } catch (err: any) {
      toast.error('Gagal Memperbarui Checklist', err.message);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim() || !newDeadline.trim()) return;

    setIsSubmittingProject(true);
    try {
      const proj = await api.createProject({
        code: newCode.trim(),
        title: newTitle.trim(),
        deadline: newDeadline.trim(),
        description: newDescription.trim(),
        leader: newLeader.trim(),
        members: [newLeader.trim()]
      });
      toast.success('Proyek Ditambahkan', `${proj.code} · ${proj.title}`);
      setShowAddProjectModal(false);
      setNewCode('');
      setNewTitle('');
      setNewDeadline('');
      setNewDescription('');
      await loadData();
      setSelectedProjectId(proj.id);
    } catch (err: any) {
      toast.error('Gagal Menambahkan Proyek', err.message);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton height={140} className="rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} height={180} className="rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !currentProject) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Proyek"
          description={error || 'Data proyek tidak ditemukan.'}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      </div>
    );
  }

  // Linked items for selected project
  const projectFiles = files.filter(
    f => f.acaraTag === currentProject.acaraTag || f.linkedProjectIds?.includes(currentProject.id)
  );
  const projectNotes = notes.filter(
    n => n.acaraId === currentProject.acaraTag || n.acaraId === currentProject.id || n.linkedProjectIds?.includes(currentProject.id)
  );
  const projectTasks = tasks.filter(t => t.projectAcara === currentProject.acaraTag);
  const projectChecklists = checklists.filter(
    c => c.acaraId === currentProject.id || c.category?.includes(currentProject.code)
  );

  const now = new Date();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0B0F17] text-neutral-900 dark:text-white border border-neutral-200 dark:border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                TA 2026/2027
              </span>
              <span>·</span>
              <span>Studio Perencanaan Tambang</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Perencanaan Tambang (Acara 1 s/d Acara 5)
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
              Modul perencanaan komprehensif mulai dari pemodelan cadangan geologi, optimasi batas penambangan (UPL), penjadwalan produksi, saluran penyaliran pit, hingga kelayakan ekonomi.
            </p>
          </div>

          {user?.role === 'admin' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddProjectModal(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Tambah Proyek
            </Button>
          )}
        </div>
      </div>

      {/* Project Cards Grid (Acara 1 to 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(proj => {
          const isSelected = proj.id === selectedProjectId;
          const isOverdue =
            proj.status !== 'completed' &&
            proj.deadline.includes('2026') &&
            new Date(proj.deadline) < now;

          return (
            <div
              key={proj.id}
              onClick={() => setSelectedProjectId(proj.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-[#0E1420] flex flex-col justify-between ${
                isSelected
                  ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                  : 'border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/50 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <Badge variant={isSelected ? 'accent' : 'default'} size="sm">
                    {proj.code}
                  </Badge>
                  <Badge
                    variant={
                      proj.status === 'completed'
                        ? 'success'
                        : proj.status === 'in_progress'
                        ? 'accent'
                        : 'outline'
                    }
                    size="sm"
                  >
                    {proj.status === 'completed'
                      ? 'SELESAI'
                      : proj.status === 'in_progress'
                      ? 'BERJALAN'
                      : 'PERENCANAAN'}
                  </Badge>
                </div>

                <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1.5 leading-snug">
                  {proj.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed mb-4">
                  {proj.description}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-white/[0.06]">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-neutral-500 dark:text-neutral-400">Progres</span>
                    <span className="text-neutral-800 dark:text-white">{proj.progress}%</span>
                  </div>
                  <ProgressBar value={proj.progress} max={100} size="sm" variant="accent" />
                </div>

                {/* Deadline & Leader Info */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-neutral-400'}`} />
                    <span className={`${isOverdue ? 'text-red-500 font-semibold' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {proj.deadline}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                    <span className="text-[10px] text-neutral-400">PJ:</span>
                    <span className="font-semibold ">@{proj.leader}</span>
                  </div>
                </div>

                {/* Members Avatars */}
                {proj.members && proj.members.length > 0 && (
                  <div className="flex items-center gap-1 pt-1">
                    <span className="text-[10px] text-neutral-400 mr-1">Tim:</span>
                    <div className="flex -space-x-1.5">
                      {proj.members.map((m, idx) => (
                        <div
                          key={idx}
                          title={m}
                          className="w-6 h-6 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800 border-2 border-white dark:border-[#0E1420] text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-[9px] uppercase"
                        >
                          {m.slice(0, 2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Detail Section with 5 Tabs */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="accent" size="sm">{currentProject.code}</Badge>
              <CardTitle>{currentProject.title}</CardTitle>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              PJ: @{currentProject.leader} · Target: {currentProject.deadline}
            </p>
          </div>

          {/* 5 Tab Navigation */}
          <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/[0.08] overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-[#0E1420] text-amber-500 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Ringkasan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-white dark:bg-[#0E1420] text-amber-500 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              File ({projectFiles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-[#0E1420] text-amber-500 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Catatan ({projectNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('checklists')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'checklists'
                  ? 'bg-white dark:bg-[#0E1420] text-amber-500 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist ({projectChecklists.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-[#0E1420] text-amber-500 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Tugas ({projectTasks.length})
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {/* TAB 1: Ringkasan */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-neutral-400 mb-2 font-semibold">
                  Deskripsi &amp; Lingkup Acara
                </h4>
                <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-white/[0.02] p-4 rounded-xl border border-neutral-200 dark:border-white/[0.06]">
                  {currentProject.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
                  <span className="text-[11px] text-neutral-400 block mb-1">Status Pengerjaan</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white capitalize">
                    {currentProject.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
                  <span className="text-[11px] text-neutral-400 block mb-1">Target Penyelesaian</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    {currentProject.deadline}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
                  <span className="text-[11px] text-neutral-400 block mb-1">Penanggung Jawab</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 ">
                    @{currentProject.leader}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: File */}
          {activeTab === 'files' && (
            <div className="space-y-3">
              {projectFiles.length === 0 ? (
                <EmptyState
                  icon={<HardDrive className="w-6 h-6 text-neutral-400" />}
                  title="Belum Ada Berkas Tertaut"
                  description={`Belum ada file yang diunggah dengan label ${currentProject.acaraTag}.`}
                  action={
                    onNavigate && (
                      <Button variant="primary" size="sm" onClick={() => onNavigate('files')}>
                        Unggah File untuk {currentProject.code}
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectFiles.map(file => (
                    <div
                      key={file.id}
                      onClick={() => onPreviewFile && onPreviewFile(file)}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/40 bg-white dark:bg-[#0E1420] transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-300 text-[10px] font-bold uppercase shrink-0">
                          {file.extension.replace('.', '')}
                        </div>
                        <div className="truncate">
                          <h5 className="text-xs font-semibold text-neutral-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            {file.name}
                          </h5>
                          <span className="text-[11px] text-neutral-400 ">
                            {(file.size / 1024).toFixed(0)} KB · @{file.uploadedBy}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Catatan */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              {projectNotes.length === 0 ? (
                <EmptyState
                  icon={<FileText className="w-6 h-6 text-neutral-400" />}
                  title="Belum Ada Catatan Tertaut"
                  description={`Buat catatan teknis atau pedoman perhitungan untuk ${currentProject.code}.`}
                  action={
                    onNavigate && (
                      <Button variant="primary" size="sm" onClick={() => onNavigate('notes')}>
                        Buka Engineering Notes
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projectNotes.map(note => (
                    <div
                      key={note.id}
                      onClick={() => onOpenNote ? onOpenNote(note.id) : onNavigate && onNavigate('notes', note.id)}
                      className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/40 bg-white dark:bg-[#0E1420] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {note.title}
                        </h5>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {note.content.replace(/[#*`_]/g, '').slice(0, 120)}
                      </p>
                      <div className="mt-2 text-[10px] text-neutral-400 ">
                        @{note.createdBy} · {new Date(note.updatedAt).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Checklist */}
          {activeTab === 'checklists' && (
            <div className="space-y-2.5">
              {projectChecklists.length === 0 ? (
                <EmptyState
                  icon={<CheckSquare className="w-6 h-6 text-neutral-400" />}
                  title="Belum Ada Target Kerja"
                  description={`Semua target kerja untuk ${currentProject.code} dapat diatur pada menu Target Kerja.`}
                  action={
                    onNavigate && (
                      <Button variant="primary" size="sm" onClick={() => onNavigate('checklists')}>
                        Lihat Target Kerja
                      </Button>
                    )
                  }
                />
              ) : (
                projectChecklists.map(item => {
                  const isDone = item.status === 'completed';
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isDone
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/40 bg-white dark:bg-[#0E1420]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                            isDone
                              ? 'bg-emerald-500 text-white'
                              : 'border border-neutral-300 dark:border-neutral-600 bg-transparent'
                          }`}
                        >
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div className="truncate">
                          <span
                            className={`text-xs font-medium block truncate ${
                              isDone
                                ? 'line-through text-neutral-400 dark:text-neutral-500'
                                : 'text-neutral-900 dark:text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[10px] text-neutral-400 ">
                            {item.category} {item.assignedTo ? `· @${item.assignedTo}` : ''}
                          </span>
                        </div>
                      </div>
                      <Badge variant={isDone ? 'success' : 'outline'} size="sm">
                        {isDone ? 'SELESAI' : 'TERTUNDA'}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 5: Tugas */}
          {activeTab === 'tasks' && (
            <div className="space-y-2.5">
              {projectTasks.length === 0 ? (
                <EmptyState
                  icon={<Calendar className="w-6 h-6 text-neutral-400" />}
                  title="Belum Ada Tugas Tertaut"
                  description={`Belum ada tugas yang dibuat untuk ${currentProject.acaraTag}.`}
                  action={
                    onNavigate && (
                      <Button variant="primary" size="sm" onClick={() => onNavigate('kanban')}>
                        Lihat Daftar Tugas
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projectTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => onNavigate && onNavigate('kanban', task.id)}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/40 bg-white dark:bg-[#0E1420] transition-colors cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <Badge variant={task.status === 'done' ? 'success' : 'accent'} size="sm">
                            {task.status.toUpperCase()}
                          </Badge>
                          <Badge variant={task.priority === 'high' ? 'danger' : 'default'} size="sm">
                            {task.priority.toUpperCase()}
                          </Badge>
                        </div>
                        <h5 className="text-xs font-semibold text-neutral-900 dark:text-white line-clamp-2">
                          {task.title}
                        </h5>
                      </div>
                      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-neutral-400 ">
                        <span>PJ: @{task.assignedTo}</span>
                        <span>{task.dueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Project Modal */}
      <Modal
        isOpen={showAddProjectModal}
        onClose={() => setShowAddProjectModal(false)}
        title="Tambah Proyek / Acara Baru"
        description="Tambahkan rencana tahapan atau deliverable baru dalam workspace perencanaan tambang."
        size="md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Acara / Proyek"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              placeholder="Contoh: Acara 6"
              required
              autoFocus
            />
            <Input
              label="Batas Waktu (Deadline)"
              value={newDeadline}
              onChange={e => setNewDeadline(e.target.value)}
              placeholder="Contoh: 15–16 Desember 2026"
              required
            />
          </div>

          <Input
            label="Judul Proyek / Topik Perencanaan"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Contoh: Reklamasi & Rencana Pascatambang"
            required
          />

          <Textarea
            label="Deskripsi Teknis"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Keterangan metodologi, parameter desain, dan deliverables utama..."
            rows={3}
          />

          <Input
            label="Penanggung Jawab (Leader @username)"
            value={newLeader}
            onChange={e => setNewLeader(e.target.value)}
            placeholder="fadil"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddProjectModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmittingProject}
            >
              Simpan Proyek
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
