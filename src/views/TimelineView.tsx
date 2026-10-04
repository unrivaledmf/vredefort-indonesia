import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  AlertTriangle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.ts';
import { TimelineEvent } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Textarea } from '../components/ui/Textarea.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

export const TimelineView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal form state
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [category, setCategory] = useState<TimelineEvent['category']>('kuliah');
  const [description, setDescription] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<TimelineEvent | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTimeline();
      setEvents(data);
    } catch (err: any) {
      console.error('Timeline error:', err);
      setError(err.message || 'Gagal memuat linimasa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setTitle('');
    setPeriod('');
    setDateRange('');
    setCategory('kuliah');
    setDescription('');
    setIsMilestone(false);
    setShowModal(true);
  };

  const handleOpenEdit = (evt: TimelineEvent) => {
    setEditingEvent(evt);
    setTitle(evt.title);
    setPeriod(evt.period);
    setDateRange(evt.dateRange);
    setCategory(evt.category);
    setDescription(evt.description);
    setIsMilestone(evt.isMilestone);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !period.trim() || !dateRange.trim() || !description.trim()) {
      toast.error('Validasi Gagal', 'Semua bidang form jadwal wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<TimelineEvent> = {
        title: title.trim(),
        period: period.trim(),
        dateRange: dateRange.trim(),
        category,
        description: description.trim(),
        isMilestone
      };

      if (editingEvent) {
        const updated = await api.updateTimeline(editingEvent.id, payload);
        setEvents(prev => prev.map(ev => (ev.id === updated.id ? updated : ev)));
        toast.success('Jadwal Diperbarui', updated.title);
      } else {
        const created = await api.createTimeline(payload);
        setEvents(prev => [...prev, created]);
        toast.success('Jadwal Ditambahkan', created.title);
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error('Gagal Menyimpan Jadwal', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteTimeline(deleteTarget.id);
      setEvents(prev => prev.filter(ev => ev.id !== deleteTarget.id));
      toast.success('Jadwal Dihapus', deleteTarget.title);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus Jadwal', err.message);
    }
  };

  const getCategoryBadge = (cat: TimelineEvent['category']) => {
    switch (cat) {
      case 'presentasi':
        return <Badge variant="accent" size="sm">PRESENTASI</Badge>;
      case 'pengumpulan':
        return <Badge variant="danger" size="sm">DEADLINE</Badge>;
      case 'kkn':
        return <Badge variant="info" size="sm">KKN JEDA</Badge>;
      case 'evaluasi':
        return <Badge variant="warning" size="sm">EVALUASI</Badge>;
      default:
        return <Badge variant="default" size="sm">KULIAH</Badge>;
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 ">
              ROADMAP AKADEMIK
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">TA 2026/2027</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Timeline &amp; Jadwal
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Jadwal pengerjaan Acara 1 hingga 5, jeda KKN, asistensi rutin, dan seminar akhir.
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Tambah Jadwal
          </Button>
        )}
      </div>

      {/* Main Vertical Timeline */}
      {loading ? (
        <div className="space-y-6 pl-4 border-l-2 border-neutral-200 dark:border-white/[0.08] ml-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2 p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420]">
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={24} />
              <Skeleton width="90%" height={14} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Timeline"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadTimeline} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="w-8 h-8 text-neutral-400" />}
          title="Tidak Ada Jadwal"
          description="Belum ada data linimasa kegiatan akademik."
        />
      ) : (
        <div className="relative border-l-2 border-neutral-200 dark:border-white/[0.1] ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-8 pb-12">
          {/* Today Indicator Line */}
          <div className="relative -ml-[31px] sm:-ml-[39px] flex items-center gap-3 py-1 my-4">
            <div className="w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shadow-md" />
            <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
              HARI INI · {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
            </div>
          </div>

          {events.map((event, index) => {
            const isEventMilestone = event.isMilestone;

            return (
              <div key={event.id || index} className="relative group">
                {/* Node Bullet on Vertical Line */}
                <div
                  className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full flex items-center justify-center transition-transform group-hover:scale-125 ${
                    isEventMilestone
                      ? 'bg-amber-500 ring-4 ring-amber-500/20 shadow-sm'
                      : 'bg-white dark:bg-[#0E1420] border-2 border-neutral-400 dark:border-white/40'
                  }`}
                >
                  {isEventMilestone && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>

                {/* Event Card */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    isEventMilestone
                      ? 'border-amber-500/40 bg-amber-500/5 shadow-xs'
                      : 'border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] hover:border-neutral-300 dark:hover:border-white/20 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isEventMilestone && (
                        <span className="p-1 rounded-md bg-amber-500 text-black">
                          <Flag className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {getCategoryBadge(event.category)}
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {event.period}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{event.dateRange}</span>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1 ml-2 border-l border-neutral-200 dark:border-white/[0.1] pl-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(event)}
                            aria-label="Edit jadwal"
                            className="p-1.5 text-neutral-400 hover:text-amber-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(event)}
                            aria-label="Hapus jadwal"
                            className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-snug">
                    {event.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mt-1.5">
                    {event.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Schedule Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEvent ? 'Edit Jadwal Akademik' : 'Tambah Jadwal Baru'}
        description="Kelola jadwal tahapan kegiatan studio dan evaluasi perencanaan tambang."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Judul Jadwal / Kegiatan"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Asistensi Bab 1 - Pemodelan Geologi"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Periode"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder="Contoh: Pekan 1-2"
              required
            />
            <Input
              label="Rentang Tanggal"
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              placeholder="Contoh: 12–18 Juni 2026"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Kategori Kegiatan"
              value={category}
              onChange={e => setCategory(e.target.value as any)}
            >
              <option value="kuliah">Kuliah / Praktikum</option>
              <option value="presentasi">Presentasi Kelompok</option>
              <option value="pengumpulan">Pengumpulan / Deadline</option>
              <option value="kkn">Jeda KKN</option>
              <option value="evaluasi">Evaluasi / Ujian</option>
            </Select>

            <div className="flex items-center gap-2 pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={isMilestone}
                  onChange={e => setIsMilestone(e.target.checked)}
                  className="rounded border-neutral-300 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                Tandai sebagai Milestone Kunci
              </label>
            </div>
          </div>

          <Textarea
            label="Deskripsi Kegiatan"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Rincian agenda atau deliverables yang harus dipenuhi..."
            required
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
            >
              {editingEvent ? 'Simpan Perubahan' : 'Simpan Jadwal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Jadwal"
        message={`Apakah Anda yakin ingin menghapus jadwal "${deleteTarget?.title || ''}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Jadwal"
        variant="danger"
      />
    </div>
  );
};
