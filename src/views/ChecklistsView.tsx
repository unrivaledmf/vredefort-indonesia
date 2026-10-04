import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  User,
  Filter,
  Layers,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  FolderGit2,
  Plus,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { api } from '../services/api.ts';
import { ChecklistItem, Project, UserSummary } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ProgressBar } from '../components/ui/ProgressBar.tsx';
import { Select } from '../components/ui/Select.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

export const ChecklistsView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [usersSummary, setUsersSummary] = useState<UserSummary[]>([]);
  const [selectedAcaraFilter, setSelectedAcaraFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit title
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAcaraId, setNewAcaraId] = useState('prj-1');
  const [newCategory, setNewCategory] = useState('Persiapan & Validasi Data');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadChecklists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cList, pList, uList] = await Promise.all([
        api.getChecklists(),
        api.getProjects(),
        api.getUsersSummary().catch(() => [])
      ]);
      setChecklists(cList);
      setProjects(pList);
      setUsersSummary(uList);
    } catch (err: any) {
      console.error('Error loading checklists:', err);
      setError(err.message || 'Gagal memuat daftar checklist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  // 1-Click Status Toggle
  const handleToggleStatus = async (item: ChecklistItem) => {
    const nextStatus = item.status === 'completed' ? 'in_progress' : 'completed';
    // Optimistic UI update
    setChecklists(prev =>
      prev.map(c => (c.id === item.id ? { ...c, status: nextStatus } : c))
    );

    try {
      await api.updateChecklist(item.id, { status: nextStatus });
      toast.success(
        nextStatus === 'completed' ? 'Item Ditandai Selesai' : 'Item Diproses',
        item.title
      );
    } catch (err: any) {
      toast.error('Gagal Mengubah Status', err.message);
      await loadChecklists();
    }
  };

  const handleAssigneeChange = async (item: ChecklistItem, newAssignee: string) => {
    try {
      await api.updateChecklist(item.id, { assignedTo: newAssignee });
      setChecklists(prev =>
        prev.map(c => (c.id === item.id ? { ...c, assignedTo: newAssignee } : c))
      );
      toast.success('PIC Ditugaskan', `@${newAssignee} -> ${item.title}`);
    } catch (err: any) {
      toast.error('Gagal Mengubah PIC', err.message);
    }
  };

  // Inline Title Save
  const handleSaveInlineTitle = async (itemId: string) => {
    const cleanTitle = editingTitle.trim();
    if (!cleanTitle) {
      setEditingItemId(null);
      return;
    }
    const currentItem = checklists.find(c => c.id === itemId);
    if (currentItem && currentItem.title === cleanTitle) {
      setEditingItemId(null);
      return;
    }

    try {
      await api.updateChecklist(itemId, { title: cleanTitle });
      setChecklists(prev =>
        prev.map(c => (c.id === itemId ? { ...c, title: cleanTitle } : c))
      );
      toast.success('Judul Diperbarui', cleanTitle);
    } catch (err: any) {
      toast.error('Gagal Memperbarui Judul', err.message);
    } finally {
      setEditingItemId(null);
    }
  };

  // Create Checklist Item
  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedProject = projects.find(p => p.id === newAcaraId);
      const acaraTag = selectedProject ? selectedProject.title : 'Acara 1';

      const newItem = await api.createChecklist({
        title: newTitle.trim(),
        acaraId: newAcaraId,
        category: newCategory.trim() || `${acaraTag} · Deliverable`,
        assignedTo: newAssignedTo || undefined
      });

      setChecklists(prev => [...prev, newItem]);
      toast.success('Item Ditambahkan', newItem.title);
      setShowAddModal(false);
      setNewTitle('');
    } catch (err: any) {
      toast.error('Gagal Menambahkan Item', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group checklists by Acara -> Category
  const groupedData = useMemo(() => {
    const acaraMap: Record<string, Record<string, ChecklistItem[]>> = {};

    checklists.forEach(item => {
      // Determine Acara
      let acaraKey = 'Acara Lainnya';
      if (item.category?.includes('Acara 1') || item.acaraId === 'prj-1') acaraKey = 'Acara 1 · Block Model';
      else if (item.category?.includes('Acara 2') || item.acaraId === 'prj-2') acaraKey = 'Acara 2 · Pit & Disposal';
      else if (item.category?.includes('Acara 3') || item.acaraId === 'prj-3') acaraKey = 'Acara 3 · Penjadwalan Produksi';
      else if (item.category?.includes('Acara 4') || item.acaraId === 'prj-4') acaraKey = 'Acara 4 · Penyaliran & Hidrologi';
      else if (item.category?.includes('Acara 5') || item.acaraId === 'prj-5') acaraKey = 'Acara 5 · Analisis Finansial (AIT)';
      else if (item.category?.includes('Final') || item.acaraId === 'prj-6') acaraKey = 'Final · Seminar & Laporan';

      if (selectedAcaraFilter !== 'all' && !acaraKey.includes(selectedAcaraFilter)) {
        return;
      }

      if (!acaraMap[acaraKey]) acaraMap[acaraKey] = {};
      const catKey = item.category || 'Umum';
      if (!acaraMap[acaraKey][catKey]) acaraMap[acaraKey][catKey] = [];
      acaraMap[acaraKey][catKey].push(item);
    });

    return acaraMap;
  }, [checklists, selectedAcaraFilter]);

  const totalCount = checklists.length;
  const completedCount = checklists.filter(i => i.status === 'completed').length;
  const globalProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 ">
              TARGET KERJA
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Perencanaan Tambang</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Target Kerja &amp; Kelengkapan
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Daftar kendali kelengkapan parameter teknis, output pemodelan, dan dokumen per Acara.
          </p>
        </div>

        {/* Global Progress Card */}
        <div className="p-3.5 sm:px-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block font-medium">
              Progres Kelengkapan
            </span>
            <span className="text-base font-bold text-neutral-900 dark:text-white">
              {completedCount} / {totalCount} Selesai
            </span>
          </div>
          <div className="w-16">
            <ProgressBar value={globalProgress} max={100} size="md" variant="accent" />
            <span className="text-[10px] text-neutral-500 text-center block mt-1">
              {globalProgress}%
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Add Item Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-60">
          <Select
            value={selectedAcaraFilter}
            onChange={e => setSelectedAcaraFilter(e.target.value)}
            className="text-xs"
            aria-label="Filter Acara"
          >
            <option value="all">Semua Acara Tambang</option>
            <option value="Acara 1">Acara 1 · Block Model</option>
            <option value="Acara 2">Acara 2 · Pit &amp; Disposal</option>
            <option value="Acara 3">Acara 3 · Penjadwalan</option>
            <option value="Acara 4">Acara 4 · Hidrologi</option>
            <option value="Acara 5">Acara 5 · Finansial &amp; AIT</option>
          </Select>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setNewTitle('');
            setNewAssignedTo(user?.username || (usersSummary[0]?.username ?? ''));
            setShowAddModal(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          className="whitespace-nowrap shrink-0"
          aria-label="Tambah Item"
        >
          Tambah Item
        </Button>
      </div>

      {/* Checklist Groups */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-3">
              <Skeleton width="40%" height={20} />
              <Skeleton height={40} className="rounded-xl" />
              <Skeleton height={40} className="rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Checklists"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadChecklists} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : Object.keys(groupedData).length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-8 h-8 text-neutral-400" />}
          title="Tidak Ada Checklist Ditemukan"
          description="Tidak ada item checklist yang cocok dengan filter yang dipilih."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([acaraName, categoryMap]) => {
            // Calculate progress for this Acara
            const allItemsInAcara = Object.values(categoryMap).flat();
            const doneInAcara = allItemsInAcara.filter(i => i.status === 'completed').length;
            const percentInAcara = allItemsInAcara.length > 0 ? Math.round((doneInAcara / allItemsInAcara.length) * 100) : 0;

            return (
              <div
                key={acaraName}
                className="rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] overflow-hidden shadow-xs"
              >
                {/* Acara Header Bar */}
                <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                        {acaraName}
                      </h3>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 ">
                        {doneInAcara} dari {allItemsInAcara.length} deliverable selesai
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-48 flex items-center gap-3">
                    <ProgressBar value={percentInAcara} max={100} size="sm" variant="accent" />
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      {percentInAcara}%
                    </span>
                  </div>
                </div>

                {/* Subcategories */}
                <div className="p-4 sm:p-5 space-y-6">
                  {Object.entries(categoryMap).map(([catName, items]) => {
                    const catDone = items.filter(i => i.status === 'completed').length;
                    const catPercent = Math.round((catDone / items.length) * 100);

                    return (
                      <div key={catName} className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <h4 className="font-semibold text-neutral-700 dark:text-neutral-300">
                            {catName}
                          </h4>
                          <span className="text-[11px] text-neutral-400">
                            {catDone}/{items.length} ({catPercent}%)
                          </span>
                        </div>

                        <div className="space-y-2">
                          {items.map(item => {
                            const isDone = item.status === 'completed';
                            const isEditing = editingItemId === item.id;

                            return (
                              <div
                                key={item.id}
                                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isDone
                                    ? 'border-emerald-500/30 bg-emerald-500/5'
                                    : 'border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/40 bg-white dark:bg-[#070A10]/50'
                                }`}
                              >
                                {/* Left Content: Status & Title */}
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div
                                    onClick={() => handleToggleStatus(item)}
                                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                      isDone
                                        ? 'bg-emerald-500 text-white'
                                        : 'border-2 border-neutral-300 dark:border-neutral-600 bg-transparent hover:border-amber-500'
                                    }`}
                                    title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                                    role="button"
                                    aria-label={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                                  >
                                    {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </div>

                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editingTitle}
                                        onChange={e => setEditingTitle(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleSaveInlineTitle(item.id);
                                          else if (e.key === 'Escape') setEditingItemId(null);
                                        }}
                                        onBlur={() => handleSaveInlineTitle(item.id)}
                                        className="w-full text-xs font-medium py-1 px-2.5 rounded-lg border border-amber-500 bg-white dark:bg-[#0E1420] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 min-w-0 flex-1 group">
                                      <span
                                        onClick={() => handleToggleStatus(item)}
                                        className={`text-xs font-medium leading-relaxed cursor-pointer truncate ${
                                          isDone
                                            ? 'line-through text-neutral-400 dark:text-neutral-500'
                                            : 'text-neutral-900 dark:text-white'
                                        }`}
                                      >
                                        {item.title}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingItemId(item.id);
                                          setEditingTitle(item.title);
                                        }}
                                        title="Edit Judul"
                                        aria-label="Edit Judul Checklist"
                                        className="p-1 rounded text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Assignee Dropdown */}
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <span className="text-[10px] text-neutral-400 ">PIC:</span>
                                  <select
                                    value={item.assignedTo || ''}
                                    onChange={e => handleAssigneeChange(item, e.target.value)}
                                    className="text-[11px] py-1 px-2 rounded-lg bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer"
                                    aria-label="Penanggung Jawab"
                                  >
                                    <option value="">Belum Ditugaskan</option>
                                    {usersSummary.map(m => (
                                      <option key={m.id} value={m.username}>
                                        @{m.username} · {m.fullName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Checklist Item Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Item Deliverable"
        description="Tambahkan item checklist baru ke rencana kerja deliverable tambang."
        size="md"
      >
        <form onSubmit={handleCreateChecklist} className="space-y-4">
          <Input
            label="Judul Deliverable"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Contoh: Pembuatan Peta Isopach Overburden"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Proyek / Acara"
              value={newAcaraId}
              onChange={e => setNewAcaraId(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.title}
                </option>
              ))}
            </Select>

            <Select
              label="Penanggung Jawab (PIC)"
              value={newAssignedTo}
              onChange={e => setNewAssignedTo(e.target.value)}
            >
              <option value="">Belum Ditugaskan</option>
              {usersSummary.map(m => (
                <option key={m.id} value={m.username}>
                  @{m.username} · {m.fullName}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Kategori Item"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="Contoh: Output Desain &amp; Perhitungan"
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Deliverable'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
