import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  HardDrive,
  Tag,
  Copy,
  Trash2,
  Bookmark,
  RefreshCw,
  AlertTriangle,
  Check,
  Pencil
} from 'lucide-react';
import { api } from '../services/api.ts';
import { ReferenceItem, MiningFile } from '../types.ts';
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

interface ReferencesViewProps {
  onPreviewFile?: (file: MiningFile) => void;
  onOpenNote?: (noteId: string) => void;
}

export const ReferencesView: React.FC<ReferencesViewProps> = ({ onPreviewFile }) => {
  const toast = useToast();

  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [files, setFiles] = useState<MiningFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Reference modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState<number>(2026);
  const [type, setType] = useState<ReferenceItem['type']>('Kepmen/Peraturan');
  const [source, setSource] = useState('');
  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('#Kepmen1827');
  const [notes, setNotes] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Reference modal
  const [editingRef, setEditingRef] = useState<ReferenceItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editYear, setEditYear] = useState<number>(2026);
  const [editType, setEditType] = useState<ReferenceItem['type']>('Kepmen/Peraturan');
  const [editSource, setEditSource] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete confirm
  const [deleteRefId, setDeleteRefId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rList, fList] = await Promise.all([
        api.getReferences(),
        api.getFiles()
      ]);
      setReferences(rList);
      setFiles(fList);
    } catch (err: any) {
      console.error('References error:', err);
      setError(err.message || 'Gagal memuat daftar referensi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy citation to clipboard
  const handleCopyCitation = (ref: ReferenceItem) => {
    const citation = `${ref.author} (${ref.year}). ${ref.title}. ${ref.source || ''}`.trim();
    navigator.clipboard.writeText(citation);
    toast.success('Sitasi Disalin', citation);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    const tagsArr = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('#') ? t : `#${t}`));

    setIsSubmittingAdd(true);
    try {
      const newRef = await api.createReference({
        title: title.trim(),
        author: author.trim(),
        year,
        type,
        source: source.trim(),
        url: url.trim(),
        tags: tagsArr,
        notes: notes.trim()
      });
      setReferences(prev => [newRef, ...prev]);
      setShowAddModal(false);
      setTitle('');
      setAuthor('');
      setNotes('');
      toast.success('Referensi Ditambahkan', newRef.title);
    } catch (err: any) {
      toast.error('Gagal Menambah Referensi', err.message);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleOpenEdit = (ref: ReferenceItem) => {
    setEditingRef(ref);
    setEditTitle(ref.title);
    setEditAuthor(ref.author);
    setEditYear(ref.year);
    setEditType(ref.type);
    setEditSource(ref.source || '');
    setEditUrl(ref.url || '');
    setEditTagsInput(ref.tags?.join(', ') || '');
    setEditNotes(ref.notes || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRef || !editTitle.trim() || !editAuthor.trim()) return;

    const tagsArr = editTagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('#') ? t : `#${t}`));

    setIsSubmittingEdit(true);
    try {
      const updated = await api.updateReference(editingRef.id, {
        title: editTitle.trim(),
        author: editAuthor.trim(),
        year: editYear,
        type: editType,
        source: editSource.trim(),
        url: editUrl.trim(),
        tags: tagsArr,
        notes: editNotes.trim()
      });
      setReferences(prev =>
        prev.map(r => (r.id === editingRef.id ? { ...r, ...updated } : r))
      );
      toast.success('Referensi Diperbarui', editTitle.trim());
      setEditingRef(null);
    } catch (err: any) {
      toast.error('Gagal Memperbarui Referensi', err.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRefId) return;
    try {
      await api.deleteReference(deleteRefId);
      setReferences(prev => prev.filter(r => r.id !== deleteRefId));
      toast.success('Referensi Dihapus');
      setDeleteRefId(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus Referensi', err.message);
    }
  };

  const filteredReferences = references.filter(ref => {
    if (selectedType !== 'all' && ref.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ref.title.toLowerCase().includes(q);
      const matchAuthor = ref.author.toLowerCase().includes(q);
      const matchTags = ref.tags.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchAuthor && !matchTags) return false;
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 ">
              STANDAR &amp; REGULASI
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Kepmen ESDM &amp; SNI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Pustaka Referensi
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Kompilasi Kepmen 1827 K/30/MEM/2018, SNI estimasi sumberdaya/cadangan, jurnal optimasi tambang, dan buku ajar.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddModal(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          aria-label="Tambah Referensi"
        >
          Tambah Referensi
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari regulasi, SNI, penulis, atau kata kunci..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              aria-label="Cari referensi"
            />
          </div>

          <div className="w-48">
            <Select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="text-xs"
              aria-label="Filter kategori"
            >
              <option value="all">Semua Tipe Referensi</option>
              <option value="Kepmen/Peraturan">Kepmen / Peraturan</option>
              <option value="Standar/SNI">Standar / SNI</option>
              <option value="Jurnal">Jurnal Ilmiah</option>
              <option value="Buku">Buku Referensi</option>
              <option value="Laporan">Laporan Eksplorasi</option>
              <option value="Diktat Kuliah">Diktat Kuliah</option>
              <option value="Website">Website</option>
            </Select>
          </div>
        </div>

        <div className="text-xs text-neutral-500 self-end sm:self-center">
          {filteredReferences.length} rujukan ditemukan
        </div>
      </div>

      {/* References Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-3">
              <Skeleton width="60%" height={20} />
              <Skeleton width="40%" height={16} />
              <Skeleton height={60} className="rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Referensi"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : filteredReferences.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8 text-neutral-400" />}
          title="Tidak Ada Referensi Ditemukan"
          description={
            searchQuery
              ? 'Tidak ada rujukan atau regulasi yang sesuai dengan kata kunci pencarian.'
              : 'Belum ada referensi yang tersimpan.'
          }
          action={
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Tambah Referensi Pertama
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReferences.map(ref => {
            const linkedFile = ref.fileId ? files.find(f => f.id === ref.fileId) : null;

            return (
              <div
                key={ref.id}
                className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] hover:border-amber-500/40 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="accent" size="sm">
                      {ref.type}
                    </Badge>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      {ref.year}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-snug mb-1">
                    {ref.title}
                  </h3>

                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    {ref.author}
                  </p>

                  {ref.source && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 italic mb-3">
                      {ref.source}
                    </p>
                  )}

                  {ref.notes && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-white/[0.02] p-2.5 rounded-lg border border-neutral-100 dark:border-white/[0.04] mb-3">
                      {ref.notes}
                    </p>
                  )}

                  {ref.tags && ref.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {ref.tags.map(t => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Copy Citation Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyCitation(ref)}
                      leftIcon={<Copy className="w-3.5 h-3.5" />}
                      aria-label="Salin sitasi"
                    >
                      Salin Sitasi
                    </Button>

                    {/* Linked File if available */}
                    {linkedFile && onPreviewFile && (
                      <button
                        type="button"
                        onClick={() => onPreviewFile(linkedFile)}
                        title="Buka Berkas PDF/Dokumen"
                        aria-label="Buka berkas PDF"
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <HardDrive className="w-4 h-4" />
                      </button>
                    )}

                    {/* External Link */}
                    {ref.url && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Buka tautan luar"
                        aria-label="Buka tautan luar"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(ref)}
                      title="Edit referensi"
                      aria-label="Edit referensi"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteRefId(ref.id)}
                      title="Hapus referensi"
                      aria-label="Hapus referensi"
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Reference Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Referensi Baru"
        description="Simpan rujukan standar teknis, regulasi pemerintah, atau literatur ilmiah."
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Judul Referensi / Regulasi"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Kepmen ESDM No. 1827 K/30/MEM/2018"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Penulis / Instansi Penerbit"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Contoh: Kementerian ESDM RI"
              required
            />

            <Input
              label="Tahun Penerbitan"
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Kategori Dokumen"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              <option value="Kepmen/Peraturan">Kepmen / Peraturan</option>
              <option value="Standar/SNI">Standar / SNI (JORC/KCMI)</option>
              <option value="Jurnal">Jurnal Ilmiah</option>
              <option value="Buku">Buku Referensi</option>
              <option value="Laporan">Laporan Eksplorasi</option>
              <option value="Diktat Kuliah">Diktat Kuliah</option>
              <option value="Website">Website Resmi</option>
            </Select>

            <Input
              label="Sumber / Penerbit"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="Contoh: Ditjen Minerba ESDM"
            />
          </div>

          <Input
            label="Tautan URL Dokumen (Opsional)"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
          />

          <Input
            label="Tags Kata Kunci"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            placeholder="#GoodMiningPractice, #UPL, #SlopeStability"
          />

          <Textarea
            label="Catatan Relevansi Teknis"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Catatan pasal krusial, batas ambang stripping ratio, atau pedoman hidrologi..."
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSubmittingAdd}>
              Simpan Referensi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Reference Modal */}
      <Modal
        isOpen={Boolean(editingRef)}
        onClose={() => setEditingRef(null)}
        title="Edit Referensi"
        description="Perbarui informasi rujukan standar teknis atau regulasi."
        size="md"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Judul Referensi / Regulasi"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Penulis / Instansi Penerbit"
              value={editAuthor}
              onChange={e => setEditAuthor(e.target.value)}
              required
            />

            <Input
              label="Tahun Penerbitan"
              type="number"
              value={editYear}
              onChange={e => setEditYear(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Kategori Dokumen"
              value={editType}
              onChange={e => setEditType(e.target.value as any)}
            >
              <option value="Kepmen/Peraturan">Kepmen / Peraturan</option>
              <option value="Standar/SNI">Standar / SNI (JORC/KCMI)</option>
              <option value="Jurnal">Jurnal Ilmiah</option>
              <option value="Buku">Buku Referensi</option>
              <option value="Laporan">Laporan Eksplorasi</option>
              <option value="Diktat Kuliah">Diktat Kuliah</option>
              <option value="Website">Website Resmi</option>
            </Select>

            <Input
              label="Sumber / Penerbit"
              value={editSource}
              onChange={e => setEditSource(e.target.value)}
            />
          </div>

          <Input
            label="Tautan URL Dokumen (Opsional)"
            type="url"
            value={editUrl}
            onChange={e => setEditUrl(e.target.value)}
          />

          <Input
            label="Tags Kata Kunci"
            value={editTagsInput}
            onChange={e => setEditTagsInput(e.target.value)}
          />

          <Textarea
            label="Catatan Relevansi Teknis"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            rows={2}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingRef(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSubmittingEdit}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteRefId)}
        onClose={() => setDeleteRefId(null)}
        onConfirm={handleDelete}
        title="Hapus Referensi"
        message="Apakah Anda yakin ingin menghapus referensi ini dari koleksi?"
        confirmText="Hapus"
        variant="danger"
      />
    </div>
  );
};
