import React, { useState, useEffect, useCallback } from 'react';
import {
  KanbanSquare,
  Plus,
  Calendar,
  User,
  HardDrive,
  FileText,
  AlertCircle,
  Trash2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Filter,
  RefreshCw,
  Clock,
  Pencil
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Task, MiningFile, Note, UserSummary } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Textarea } from '../components/ui/Textarea.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

interface KanbanViewProps {
  onPreviewFile?: (file: MiningFile) => void;
  onOpenNote?: (noteId: string) => void;
}

type ColumnStatus = 'todo' | 'in_progress' | 'review' | 'done';

const COLUMNS: Array<{ id: ColumnStatus; label: string; color: string }> = [
  { id: 'todo', label: 'Belum Dikerjakan', color: 'border-slate-400 dark:border-slate-600' },
  { id: 'in_progress', label: 'Sedang Dikerjakan', color: 'border-amber-500' },
  { id: 'review', label: 'Review & Evaluasi', color: 'border-blue-500' },
  { id: 'done', label: 'Selesai', color: 'border-emerald-500' }
];

export const KanbanView: React.FC<KanbanViewProps> = ({ onPreviewFile, onOpenNote }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<MiningFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [usersSummary, setUsersSummary] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAcara, setFilterAcara] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // Dragging state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnStatus | null>(null);

  // Modal (Create / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ColumnStatus>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [projectAcara, setProjectAcara] = useState('Acara 1');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tList, fList, nList, uList] = await Promise.all([
        api.getTasks(),
        api.getFiles(),
        api.getNotes(),
        api.getUsersSummary().catch(() => [])
      ]);
      setTasks(tList);
      setFiles(fList);
      setNotes(nList);
      setUsersSummary(uList);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError(err.message || 'Gagal memuat task.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent, colId: ColumnStatus) => {
    e.preventDefault();
    setDragOverColumn(colId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, colId: ColumnStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    await updateTaskStatus(taskId, colId);
    setDraggedTaskId(null);
  };

  const updateTaskStatus = async (taskId: string, newStatus: ColumnStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic UI update
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await api.updateTask(taskId, { status: newStatus });
      toast.success('Status Tugas Diperbarui', task.title);
    } catch (err: any) {
      toast.error('Gagal Mengubah Status', err.message);
      await loadData();
    }
  };

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setAssignedTo(user?.username || (usersSummary[0]?.username ?? 'fadil'));
    setProjectAcara('Acara 1');
    setDueDate('');
    setShowModal(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setAssignedTo(task.assignedTo || (user?.username ?? ''));
    setProjectAcara(task.projectAcara);
    setDueDate(task.dueDate || '');
    setShowModal(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignedTo,
        projectAcara,
        dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      };

      if (editingTask) {
        const updated = await api.updateTask(editingTask.id, payload);
        setTasks(prev => prev.map(t => (t.id === editingTask.id ? { ...t, ...payload, ...updated } : t)));
        toast.success('Tugas Diperbarui', payload.title);
      } else {
        const newTask = await api.createTask(payload);
        setTasks(prev => [...prev, newTask]);
        toast.success('Tugas Ditambahkan', newTask.title);
      }
      setShowModal(false);
      setEditingTask(null);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      toast.error(editingTask ? 'Gagal Memperbarui Tugas' : 'Gagal Menambahkan Tugas', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    try {
      await api.deleteTask(deleteTaskId);
      setTasks(prev => prev.filter(t => t.id !== deleteTaskId));
      toast.success('Tugas Dihapus');
      setDeleteTaskId(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus Tugas', err.message);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (filterAcara !== 'all' && t.projectAcara !== filterAcara) return false;
    if (filterAssignee !== 'all' && t.assignedTo?.toLowerCase() !== filterAssignee.toLowerCase()) return false;
    return true;
  });

  const getPriorityBadge = (p: 'low' | 'medium' | 'high') => {
    switch (p) {
      case 'high':
        return <Badge variant="danger" size="sm">TINGGI</Badge>;
      case 'medium':
        return <Badge variant="warning" size="sm">SEDANG</Badge>;
      default:
        return <Badge variant="default" size="sm">RENDAH</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Tugas Tim
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Manajemen alur kerja tugas penambangan, pembagian PIC, dan pelacakan progres per Acara.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreateModal}
          leftIcon={<Plus className="w-4 h-4" />}
          aria-label="Tambah Tugas"
        >
          Tambah Tugas
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-48">
          <Select
            value={filterAcara}
            onChange={e => setFilterAcara(e.target.value)}
            className="text-xs"
            aria-label="Filter Berdasarkan Acara"
          >
            <option value="all">Semua Acara</option>
            <option value="Acara 1">Acara 1 · Block Model</option>
            <option value="Acara 2">Acara 2 · Pit &amp; Disposal</option>
            <option value="Acara 3">Acara 3 · Penjadwalan</option>
            <option value="Acara 4">Acara 4 · Hidrologi</option>
            <option value="Acara 5">Acara 5 · Finansial &amp; AIT</option>
          </Select>
        </div>

        <div className="w-56">
          <Select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="text-xs"
            aria-label="Filter Berdasarkan Anggota"
          >
            <option value="all">Semua Anggota</option>
            {usersSummary.map(u => (
              <option key={u.id} value={u.username}>
                @{u.username} · {u.fullName}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Kanban Board Columns Container */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-3">
              <Skeleton width="50%" height={20} />
              <Skeleton height={90} className="rounded-xl" />
              <Skeleton height={90} className="rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Kanban"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory">
          {COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
            const isOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
                className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-2xl border bg-neutral-50/60 dark:bg-[#0B0F17]/80 p-3 snap-start transition-all ${
                  isOver
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                    : 'border-neutral-200 dark:border-white/[0.08]'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-2 mb-2 border-b border-neutral-200 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full border-2 ${col.color}`} />
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                      {col.label}
                    </h3>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-white/[0.08] text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-[10px] font-bold">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Task Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[300px] p-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 dark:border-white/[0.06] rounded-xl text-center p-3">
                      <span className="text-[11px] text-neutral-400">Tidak ada tugas</span>
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={e => handleDragStart(e, task.id)}
                        className="p-3.5 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-2xs hover:shadow-sm hover:border-amber-500/40 transition-all cursor-grab active:cursor-grabbing space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <Badge variant="accent" size="sm">
                            {task.projectAcara}
                          </Badge>
                          {getPriorityBadge(task.priority)}
                        </div>

                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-white leading-snug">
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-white/[0.05] text-[11px] text-neutral-500 dark:text-neutral-400 ">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {task.dueDate}
                          </span>
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            @{task.assignedTo}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <div className="flex items-center gap-1">
                            {col.id !== 'todo' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const prevCol: Record<ColumnStatus, ColumnStatus> = {
                                    done: 'review',
                                    review: 'in_progress',
                                    in_progress: 'todo',
                                    todo: 'todo'
                                  };
                                  updateTaskStatus(task.id, prevCol[col.id]);
                                }}
                                title="Pindah ke kolom sebelumnya"
                                aria-label="Pindah ke kolom sebelumnya"
                                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/[0.06] text-neutral-400"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {col.id !== 'done' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextCol: Record<ColumnStatus, ColumnStatus> = {
                                    todo: 'in_progress',
                                    in_progress: 'review',
                                    review: 'done',
                                    done: 'done'
                                  };
                                  updateTaskStatus(task.id, nextCol[col.id]);
                                }}
                                title="Pindah ke kolom berikutnya"
                                aria-label="Pindah ke kolom berikutnya"
                                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/[0.06] text-neutral-400"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(task)}
                              title="Edit Tugas"
                              aria-label="Edit Tugas"
                              className="p-1 rounded text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTaskId(task.id)}
                              title="Hapus Tugas"
                              aria-label="Hapus Tugas"
                              className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
        }}
        title={editingTask ? 'Edit Tugas' : 'Tambah Tugas Baru'}
        description={
          editingTask
            ? 'Perbarui rincian tugas dan penugasan PIC.'
            : 'Buat task baru untuk pembagian kerja perencanaan tambang.'
        }
        size="md"
      >
        <form onSubmit={handleSubmitTask} className="space-y-4">
          <Input
            label="Judul Tugas"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Validasi block model komposit lubang bor"
            required
            autoFocus
          />

          <Textarea
            label="Deskripsi Teknis"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Keterangan metodologi, perangkat lunak yang dipakai, atau syarat batas..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Proyek / Acara"
              value={projectAcara}
              onChange={e => setProjectAcara(e.target.value)}
            >
              <option value="Acara 1">Acara 1 · Block Model</option>
              <option value="Acara 2">Acara 2 · Pit &amp; Disposal</option>
              <option value="Acara 3">Acara 3 · Penjadwalan</option>
              <option value="Acara 4">Acara 4 · Hidrologi</option>
              <option value="Acara 5">Acara 5 · Finansial &amp; AIT</option>
            </Select>

            <Select
              label="Penanggung Jawab (PIC)"
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
            >
              {usersSummary.map(u => (
                <option key={u.id} value={u.username}>
                  @{u.username} · {u.fullName}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Status"
              value={status}
              onChange={e => setStatus(e.target.value as any)}
            >
              <option value="todo">Belum Dikerjakan</option>
              <option value="in_progress">Sedang Dikerjakan</option>
              <option value="review">Review</option>
              <option value="done">Selesai</option>
            </Select>

            <Select
              label="Prioritas"
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
            >
              <option value="low">Rendah</option>
              <option value="medium">Sedang</option>
              <option value="high">Tinggi</option>
            </Select>

            <Input
              label="Batas Waktu (Due Date)"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowModal(false);
                setEditingTask(null);
              }}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
              {isSubmitting
                ? editingTask
                  ? 'Menyimpan...'
                  : 'Membuat...'
                : editingTask
                ? 'Simpan Perubahan'
                : 'Simpan Tugas'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTaskId)}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={handleDeleteTask}
        title="Hapus Tugas"
        message="Apakah Anda yakin ingin menghapus tugas ini?"
        confirmText="Hapus Tugas"
        variant="danger"
      />
    </div>
  );
};
