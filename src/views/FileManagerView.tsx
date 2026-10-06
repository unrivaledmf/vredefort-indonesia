import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  FolderPlus,
  Folder,
  File,
  Grid,
  List,
  Search,
  Star,
  Trash2,
  RotateCcw,
  Download,
  Eye,
  MoreVertical,
  Tag,
  Check,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  MapPin,
  Layers,
  ArrowUpDown,
  RefreshCw,
  FolderInput,
  X,
  AlertTriangle,
  Pencil,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api.ts';
import { MiningFile, Folder as FolderType, StorageStats } from '../types.ts';
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
import { ProgressBar } from '../components/ui/ProgressBar.tsx';

interface FileManagerViewProps {
  initialFileId?: string;
  onPreviewFile: (file: MiningFile) => void;
  onOpenNote?: (noteId: string) => void;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  initialFileId,
  onPreviewFile
}) => {
  const { user } = useAuth();
  const isGuest = user?.role === 'guest';
  const toast = useToast();

  const [files, setFiles] = useState<MiningFile[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem('vredefort_fm_folder') || undefined;
    } catch {
      return undefined;
    }
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('vredefort_file_view_mode') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'trash'>(() => {
    try {
      const t = sessionStorage.getItem('vredefort_fm_tab');
      return t === 'favorites' || t === 'trash' ? t : 'all';
    } catch {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      if (currentFolderId) sessionStorage.setItem('vredefort_fm_folder', currentFolderId);
      else sessionStorage.removeItem('vredefort_fm_folder');
      sessionStorage.setItem('vredefort_fm_tab', activeTab);
    } catch {}
  }, [currentFolderId, activeTab]);

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('vredefort_file_view_mode', mode);
    } catch {}
  };

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAcara, setSelectedAcara] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date' | 'acara'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: 'name' | 'size' | 'date' | 'acara') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadAcaraTag, setUploadAcaraTag] = useState('Acara 1');
  const [uploadTagInput, setUploadTagInput] = useState('#MinePlanning');
  const [uploadDesc, setUploadDesc] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<FolderType | null>(null);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState<string>('');

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    fileId?: string;
    isPermanent: boolean;
    isBulk?: boolean;
  }>({ isOpen: false, isPermanent: false });

  // Edit file metadata modal
  const [editingFile, setEditingFile] = useState<MiningFile | null>(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFolderId, setEditFolderId] = useState('');
  const [editAcaraTag, setEditAcaraTag] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const isTrashed = isGuest ? false : activeTab === 'trash';
      const isFavorite = activeTab === 'favorites' ? true : undefined;

      const [f, flds, st] = await Promise.all([
        api.getFiles({ isTrashed, isFavorite }),
        api.getFolders(),
        api.getStorageStats()
      ]);
      setFiles(f);
      setFolders(flds);
      setStorage(st);

      // Folder tersimpan bisa saja sudah dihapus -> kembali ke root
      setCurrentFolderId(prev => (prev && !flds.some(x => x.id === prev) ? undefined : prev));
    } catch (err: any) {
      console.error('Error loading files:', err);
      setError(err.message || 'Gagal memuat berkas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isGuest && activeTab === 'trash') {
      setActiveTab('all');
      return;
    }
    loadData();
    setSelectedFileIds(new Set());
  }, [activeTab, isGuest]);

  // Auto-preview berkas dari hash (#/files/<id>) - juga saat hash berubah ketika view sudah terbuka
  const previewedFromHashRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialFileId) {
      previewedFromHashRef.current = undefined;
      return;
    }
    if (previewedFromHashRef.current === initialFileId || files.length === 0) return;
    const found = files.find(item => item.id === initialFileId);
    if (found) {
      previewedFromHashRef.current = initialFileId;
      onPreviewFile(found);
    }
  }, [initialFileId, files]);

  // Upload handler with real progress
  const uploadFilesWithTracking = async (fileList: FileList) => {
    if (fileList.length === 0) return;

    setIsUploading(true);
    setUploadPercent(0);
    setUploadFileName(fileList.length === 1 ? fileList[0].name : `${fileList.length} file`);

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }
    if (currentFolderId) formData.append('folderId', currentFolderId);
    if (uploadAcaraTag) formData.append('acaraTag', uploadAcaraTag);

    const tagsArr = uploadTagInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('#') ? t : `#${t}`));
    formData.append('tags', JSON.stringify(tagsArr));
    formData.append('description', uploadDesc);

    try {
      await api.uploadFilesWithProgress(formData, percent => {
        setUploadPercent(percent);
      });
      toast.success('Berhasil Diunggah', `${fileList.length} file berhasil disimpan.`);
      setShowUploadModal(false);
      setUploadDesc('');
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Mengunggah', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
      setUploadFileName('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFilesWithTracking(e.dataTransfer.files);
    }
  };

  // Folder creation
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await api.createFolder(name, currentFolderId);
      toast.success('Folder Dibuat', `Folder "${name}" berhasil ditambahkan.`);
      setNewFolderName('');
      setShowNewFolderModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Membuat Folder', err.message);
    }
  };

  // Folder rename
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !renameFolderName.trim()) return;
    try {
      await api.updateFolder(editingFolder.id, renameFolderName.trim());
      toast.success('Nama Folder Diubah', `Folder berhasil diubah menjadi "${renameFolderName.trim()}".`);
      setEditingFolder(null);
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Mengubah Nama Folder', err.message);
    }
  };

  // Folder delete prompt & confirm
  const handlePromptDeleteFolder = (folder: FolderType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFolderToDelete(folder);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await api.deleteFolder(folderToDelete.id);
      toast.success('Folder Dihapus', `Folder "${folderToDelete.name}" telah dihapus. Isinya dipindahkan ke folder induk.`);
      setFolderToDelete(null);
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Menghapus Folder', err.message);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (file: MiningFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.updateFile(file.id, { isFavorite: !file.isFavorite });
      setFiles(prev =>
        prev.map(f => (f.id === file.id ? { ...f, isFavorite: !f.isFavorite } : f))
      );
      toast.success(
        file.isFavorite ? 'Dihapus dari Favorit' : 'Ditambahkan ke Favorit',
        file.name
      );
    } catch (err: any) {
      toast.error('Gagal Mengubah Favorit', err.message);
    }
  };

  // Delete & Restore
  const executeDelete = async () => {
    const { fileId, isPermanent, isBulk } = confirmDelete;
    try {
      if (isBulk) {
        for (const id of selectedFileIds) {
          await api.deleteFile(id, isPermanent);
        }
        toast.success(
          isPermanent ? 'File Dihapus Permanen' : 'File Dipindahkan ke Sampah',
          `${selectedFileIds.size} file diproses.`
        );
        setSelectedFileIds(new Set());
      } else if (fileId) {
        await api.deleteFile(fileId, isPermanent);
        toast.success(
          isPermanent ? 'File Dihapus Permanen' : 'File Dipindahkan ke Sampah'
        );
      }
      setConfirmDelete({ isOpen: false, isPermanent: false });
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Menghapus', err.message);
    }
  };

  const handleRestoreFile = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.restoreFile(id);
      toast.success('File Dipulihkan', 'Berkas dikembalikan ke direktori aktif.');
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Memulihkan', err.message);
    }
  };

  // Bulk Move
  const handleBulkMove = async () => {
    try {
      for (const id of selectedFileIds) {
        await api.updateFile(id, { folderId: bulkMoveFolderId || undefined });
      }
      toast.success('File Dipindahkan', `${selectedFileIds.size} file berhasil dipindahkan.`);
      setShowBulkMoveModal(false);
      setSelectedFileIds(new Set());
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Memindahkan', err.message);
    }
  };

  // Edit file metadata
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;

    const tagsArr = editTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('#') ? t : `#${t}`));

    try {
      await api.updateFile(editingFile.id, {
        name: editName.trim() || editingFile.name,
        tags: tagsArr,
        description: editDesc.trim(),
        folderId: editFolderId || undefined,
        acaraTag: editAcaraTag || undefined
      });
      toast.success('Metadata Berhasil Disimpan', editingFile.name);
      setEditingFile(null);
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Menyimpan Metadata', err.message);
    }
  };

  // Get file extension icon & color
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
        return <File className="w-5 h-5 text-neutral-400" />;
    }
  };

  // Breadcrumb path calculation
  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Filter & sort files
  const filteredFiles = useMemo(() => {
    return files
      .filter(f => {
        // Folder scoping when viewing 'all' tab
        if (activeTab === 'all' && currentFolderId !== undefined && f.folderId !== currentFolderId) {
          return false;
        }
        if (activeTab === 'all' && currentFolderId === undefined && f.folderId) {
          return false;
        }
        // Acara filter
        if (selectedAcara !== 'all' && f.acaraTag !== selectedAcara) {
          return false;
        }
        // Type filter
        if (selectedType !== 'all') {
          const ext = f.extension.replace('.', '').toLowerCase();
          if (selectedType === 'mining' && !['str', 'dm', 'dtm', 'dxf', 'tcl'].includes(ext)) {
            return false;
          }
          if (selectedType === 'docs' && !['pdf', 'docx', 'xlsx', 'txt'].includes(ext)) {
            return false;
          }
          if (selectedType === 'spatial' && !['shp', 'kml', 'geojson'].includes(ext)) {
            return false;
          }
        }
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = f.name.toLowerCase().includes(q);
          const matchTag = f.tags.some(t => t.toLowerCase().includes(q));
          const matchUser = isGuest ? false : f.uploadedBy.toLowerCase().includes(q);
          if (!matchName && !matchTag && !matchUser) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortBy === 'size') cmp = a.size - b.size;
        else if (sortBy === 'acara') cmp = (a.acaraTag || '').localeCompare(b.acaraTag || '');
        else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [files, activeTab, currentFolderId, selectedAcara, selectedType, searchQuery, sortBy, sortOrder]);

  const currentSubFolders = useMemo(() => {
    if (activeTab !== 'all') return [];
    return folders.filter(f => f.parentId === currentFolderId);
  }, [folders, activeTab, currentFolderId]);

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const toggleSelectFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & drop visual overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-amber-500/10 backdrop-blur-xs border-4 border-dashed border-amber-500 rounded-3xl flex items-center justify-center pointer-events-none animate-in fade-in duration-100">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0E1420] border border-amber-500/40 shadow-2xl text-center">
            <Upload className="w-12 h-12 text-amber-500 mx-auto mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Lepaskan file untuk mengunggah
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Berkas akan otomatis disimpan ke direktori saat ini
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Penyimpanan File
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Repositori model blok Surpac, data CAD/DXF, shapefile spasial, dan laporan tambang.
          </p>
        </div>

        {!isGuest && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewFolderModal(true)}
              leftIcon={<FolderPlus className="w-4 h-4" />}
            >
              Folder Baru
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Unggah File
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={e => e.target.files && uploadFilesWithTracking(e.target.files)}
            />
          </div>
        )}
      </div>

      {/* Upload Progress Bar Alert */}
      {isUploading && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-neutral-900 dark:text-white space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-500 animate-pulse" />
              Mengunggah {uploadFileName}...
            </span>
            <span>{uploadPercent}%</span>
          </div>
          <ProgressBar value={uploadPercent} max={100} size="sm" variant="accent" />
        </div>
      )}

      {/* Navigation Tabs (Semua File, Favorit, Sampah) */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/[0.08] pb-1.5 gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setCurrentFolderId(undefined);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs'
                : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            Semua File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'favorites'
                ? 'bg-amber-500 text-black font-semibold shadow-xs'
                : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            Favorit
          </button>
          {!isGuest && (
            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'trash'
                  ? 'bg-red-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Sampah
            </button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => handleSetViewMode('grid')}
            aria-label="Tampilan grid"
            title="Tampilan Kotak (Grid)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-[#0E1420] text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode('list')}
            aria-label="Tampilan list"
            title="Tampilan Tabel (List)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#0E1420] text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        <Input
          placeholder={isGuest ? 'Cari nama berkas atau tag...' : 'Cari nama, tag, atau uploader...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="text-xs"
        />

        <Select
          value={selectedAcara}
          onChange={e => setSelectedAcara(e.target.value)}
          className="text-xs"
        >
          <option value="all">Semua Acara</option>
          <option value="Acara 1">Acara 1 · Block Model</option>
          <option value="Acara 2">Acara 2 · Pit &amp; Disposal</option>
          <option value="Acara 3">Acara 3 · Penjadwalan</option>
          <option value="Acara 4">Acara 4 · Hidrologi</option>
          <option value="Acara 5">Acara 5 · Finansial &amp; AIT</option>
        </Select>

        <Select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="text-xs"
        >
          <option value="all">Semua Tipe Berkas</option>
          <option value="mining">Format Tambang (.str, .dm, .dxf)</option>
          <option value="spatial">Spasial GIS (.shp, .kml)</option>
          <option value="docs">Dokumen (.pdf, .docx, .xlsx)</option>
        </Select>

        <div className="flex items-center gap-1.5">
          <Select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-xs flex-1"
          >
            <option value="date">Urutkan: Tanggal</option>
            <option value="name">Urutkan: Nama</option>
            <option value="size">Urutkan: Ukuran</option>
          </Select>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            aria-label="Ganti arah urutan"
            className="px-2.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {activeTab === 'all' && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 py-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCurrentFolderId(undefined)}
            className={`hover:text-amber-500 transition-colors ${
              currentFolderId === undefined ? 'font-bold text-neutral-900 dark:text-white' : ''
            }`}
          >
            Root
          </button>
          {currentFolder && (
            <>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold text-neutral-900 dark:text-white truncate">
                {currentFolder.name}
              </span>
            </>
          )}
        </div>
      )}

      {/* Bulk Action Bar (Visible when >= 1 item selected for non-guests) */}
      {!isGuest && selectedFileIds.size > 0 && (
        <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-[11px]">
              {selectedFileIds.size}
            </span>
            <span>Berkas terpilih</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBulkMoveModal(true)}
              leftIcon={<FolderInput className="w-3.5 h-3.5" />}
            >
              Pindahkan
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                setConfirmDelete({
                  isOpen: true,
                  isPermanent: activeTab === 'trash',
                  isBulk: true
                })
              }
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Hapus Terpilih
            </Button>
            <button
              type="button"
              onClick={() => setSelectedFileIds(new Set())}
              aria-label="Batalkan pilihan"
              className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Subfolders Grid (only on 'all' tab) */}
      {currentSubFolders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
            Folder ({currentSubFolders.length})
          </h3>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {currentSubFolders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="p-3 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] hover:border-amber-500/40 hover:bg-neutral-50 dark:hover:bg-white/[0.03] text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 group shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Folder className="w-5 h-5 text-amber-500 shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                    {folder.name}
                  </span>
                </div>
                {!isGuest && (
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setRenameFolderName(folder.name);
                      }}
                      title="Ubah Nama Folder"
                      aria-label="Ubah Nama Folder"
                      className="p-1 rounded text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={e => handlePromptDeleteFolder(folder, e)}
                      title="Hapus Folder"
                      aria-label="Hapus Folder"
                      className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Files Display */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div
              key={i}
              className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2"
            >
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} />
              <Skeleton width="80%" height={24} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Terjadi Kesalahan"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          icon={<Folder className="w-8 h-8 text-neutral-400" />}
          title={
            activeTab === 'trash'
              ? 'Sampah Kosong'
              : activeTab === 'favorites'
              ? 'Belum Ada File Favorit'
              : 'Tidak Ada File Ditemukan'
          }
          description={
            activeTab === 'trash'
              ? 'Tidak ada berkas di dalam tempat sampah.'
              : activeTab === 'favorites'
              ? 'Tandai file dengan bintang untuk menemukannya dengan cepat di sini.'
              : 'Unggah file model blok, CAD/DXF, atau dokumen laporan Anda sekarang.'
          }
          action={
            !isGuest && activeTab === 'all' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowUploadModal(true)}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Unggah File Sekarang
              </Button>
            )
          }
        />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredFiles.map(file => {
            const isSelected = selectedFileIds.has(file.id);
            const sizeKB = (file.size / 1024).toFixed(0);
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

            return (
              <div
                key={file.id}
                onClick={() => onPreviewFile(file)}
                className={`group relative p-4 rounded-xl border transition-all cursor-pointer bg-white dark:bg-[#0E1420] flex flex-col justify-between hover:shadow-md ${
                  isSelected
                    ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                    : 'border-neutral-200 dark:border-white/[0.08] hover:border-amber-500/50'
                }`}
              >
                <div>
                  {/* Top card bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {!isGuest && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => toggleSelectFile(file.id, e as any)}
                          onClick={e => e.stopPropagation()}
                          className="rounded border-neutral-300 dark:border-neutral-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      )}
                      <div className="p-2 rounded-lg bg-neutral-100 dark:bg-white/[0.04] shrink-0 group-hover:scale-105 transition-transform">
                        {getFileIcon(file.extension)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button type="button"
                        onClick={e => { e.stopPropagation(); api.downloadFile(file.id, file.name).catch((err: any) => toast.error('Gagal Mengunduh', err.message)); }}
                        title="Unduh berkas"
                        aria-label="Unduh berkas"
                        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {activeTab !== 'trash' && (
                        <button
                          type="button"
                          onClick={e => handleToggleFavorite(file, e)}
                          aria-label={file.isFavorite ? 'Hapus favorit' : 'Tambah favorit'}
                          className={`p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                            file.isFavorite ? 'text-amber-500' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-slate-200'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      )}
                      {!isGuest && (
                        <>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingFile(file);
                              setEditName(file.name);
                              setEditTags(file.tags ? file.tags.join(', ') : '');
                              setEditDesc(file.description || '');
                              setEditFolderId(file.folderId || '');
                              setEditAcaraTag(file.acaraTag || '');
                            }}
                            title="Edit metadata"
                            aria-label="Edit metadata"
                            className="p-1.5 rounded-md text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmDelete({
                                isOpen: true,
                                fileId: file.id,
                                isPermanent: activeTab === 'trash'
                              });
                            }}
                            title={activeTab === 'trash' ? 'Hapus Permanen' : 'Pindahkan ke Sampah'}
                            aria-label="Hapus file"
                            className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* File title */}
                  <h4
                    className="text-xs font-semibold text-neutral-900 dark:text-white line-clamp-2 leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                    title={file.name}
                  >
                    {file.name}
                  </h4>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {file.acaraTag && (
                      <Badge variant="accent" size="sm">
                        {file.acaraTag}
                      </Badge>
                    )}
                    {file.tags && file.tags.slice(0, 1).map((t, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom meta */}
                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>{sizeText}</span>
                  {!isGuest && <span>@{file.uploadedBy}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-500 select-none">
                <tr>
                  {!isGuest && (
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-neutral-300 dark:border-neutral-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th
                    className="p-3 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nama Berkas</span>
                      {sortBy === 'name' ? (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                    onClick={() => handleSort('acara')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Acara</span>
                      {sortBy === 'acara' ? (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                    onClick={() => handleSort('size')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Ukuran</span>
                      {sortBy === 'size' ? (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  {!isGuest && <th className="p-3">Pengunggah</th>}
                  <th
                    className="p-3 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Tanggal</span>
                      {sortBy === 'date' ? (
                        sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
                {filteredFiles.map(file => {
                  const isSelected = selectedFileIds.has(file.id);
                  const sizeKB = (file.size / 1024).toFixed(0);
                  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                  const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

                  return (
                    <tr
                      key={file.id}
                      onClick={() => onPreviewFile(file)}
                      className={`hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {!isGuest && (
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => toggleSelectFile(file.id, e as any)}
                            className="rounded border-neutral-300 dark:border-neutral-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="p-3 font-medium text-neutral-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file.extension)}
                          <span className="truncate max-w-xs sm:max-w-md group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {file.acaraTag ? (
                          <Badge variant="accent" size="sm">
                            {file.acaraTag}
                          </Badge>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-neutral-600 dark:text-neutral-400">
                        {sizeText}
                      </td>
                      {!isGuest && (
                        <td className="p-3 text-neutral-600 dark:text-neutral-400">
                          @{file.uploadedBy}
                        </td>
                      )}
                      <td className="p-3 text-neutral-500 dark:text-neutral-400 text-[11px]">
                        {new Date(file.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onPreviewFile(file)}
                            title="Pratinjau berkas"
                            aria-label="Pratinjau berkas"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={e => { api.downloadFile(file.id, file.name).catch((err: any) => toast.error('Gagal Mengunduh', err.message)); }}
                            title="Unduh berkas"
                            aria-label="Unduh berkas"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {activeTab === 'trash' ? (
                            !isGuest && (
                              <button
                                type="button"
                                onClick={e => handleRestoreFile(file.id, e)}
                                title="Pulihkan berkas"
                                aria-label="Pulihkan berkas"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={e => handleToggleFavorite(file, e)}
                              aria-label={file.isFavorite ? 'Hapus favorit' : 'Tambah favorit'}
                              className={`p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer ${
                                file.isFavorite ? 'text-amber-500' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-slate-200'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${file.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          )}
                          {!isGuest && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFile(file);
                                  setEditName(file.name);
                                  setEditTags(file.tags ? file.tags.join(', ') : '');
                                  setEditDesc(file.description || '');
                                  setEditFolderId(file.folderId || '');
                                  setEditAcaraTag(file.acaraTag || '');
                                }}
                                title="Edit metadata"
                                aria-label="Edit metadata"
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({
                                    isOpen: true,
                                    fileId: file.id,
                                    isPermanent: activeTab === 'trash'
                                  })
                                }
                                title={activeTab === 'trash' ? 'Hapus Permanen' : 'Hapus berkas'}
                                aria-label="Hapus berkas"
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Unggah File"
        description="Unggah model tambang, peta CAD, atau berkas laporan perencanaan tambang."
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Kategori Acara"
            value={uploadAcaraTag}
            onChange={e => setUploadAcaraTag(e.target.value)}
          >
            <option value="Acara 1">Acara 1 · Block Model Mineral</option>
            <option value="Acara 2">Acara 2 · Optimasi Pit, UPL, MHR &amp; Disposal</option>
            <option value="Acara 3">Acara 3 · Penjadwalan Produksi &amp; Pushback</option>
            <option value="Acara 4">Acara 4 · Pengelolaan Air Tambang (Hidro)</option>
            <option value="Acara 5">Acara 5 · Analisis Investasi Tambang (AIT)</option>
            <option value="Umum">Umum / Lainnya</option>
          </Select>

          <Input
            label="Tag Berkas"
            value={uploadTagInput}
            onChange={e => setUploadTagInput(e.target.value)}
            placeholder="#Surpac, #BlockModel, #PitDesign"
            helperText="Pisahkan tag dengan tanda koma"
          />

          <Textarea
            label="Deskripsi / Catatan Teknis"
            value={uploadDesc}
            onChange={e => setUploadDesc(e.target.value)}
            rows={3}
            placeholder="Keterangan versi file, parameter koordinat, atau asumsi teknis..."
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-xl border-2 border-dashed border-neutral-300 dark:border-white/[0.15] hover:border-amber-500 text-center cursor-pointer transition-colors bg-neutral-50 dark:bg-white/[0.02]"
          >
            <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-900 dark:text-white">
              Pilih File dari Komputer
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
              Atau seret dan lepas berkas langsung ke area ini
            </p>
          </div>
        </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        title="Buat Folder Baru"
        size="sm"
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input
            label="Nama Folder"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Contoh: Model Blok Surpac 2026"
            required
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowNewFolderModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Buat Folder
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Move Modal */}
      <Modal
        isOpen={showBulkMoveModal}
        onClose={() => setShowBulkMoveModal(false)}
        title="Pindahkan Berkas"
        description={`Pilih folder tujuan untuk ${selectedFileIds.size} berkas terpilih.`}
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Folder Tujuan"
            value={bulkMoveFolderId}
            onChange={e => setBulkMoveFolderId(e.target.value)}
          >
            <option value="">Root (Direktori Utama)</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowBulkMoveModal(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleBulkMove}>
              Pindahkan Sekarang
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permanent or Trash Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, isPermanent: false })}
        onConfirm={executeDelete}
        title={confirmDelete.isPermanent ? 'Hapus Permanen' : 'Pindahkan ke Tempat Sampah'}
        message={
          confirmDelete.isPermanent
            ? 'Hapus file ini secara permanen? Tindakan ini tidak dapat dibatalkan.'
            : 'File akan dipindahkan ke tempat sampah dan dapat dipulihkan sewaktu-waktu.'
        }
        confirmText={confirmDelete.isPermanent ? 'Hapus Permanen' : 'Pindahkan'}
        variant="danger"
      />

      {/* Rename Folder Modal */}
      <Modal
        isOpen={Boolean(editingFolder)}
        onClose={() => setEditingFolder(null)}
        title="Ubah Nama Folder"
        size="sm"
      >
        <form onSubmit={handleRenameFolder} className="space-y-4">
          <Input
            label="Nama Folder"
            value={renameFolderName}
            onChange={e => setRenameFolderName(e.target.value)}
            maxLength={120}
            required
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingFolder(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit File Metadata Modal */}
      <Modal
        isOpen={Boolean(editingFile)}
        onClose={() => setEditingFile(null)}
        title="Ubah Metadata Berkas"
        description={editingFile ? `${editingFile.name} (${editingFile.extension.toUpperCase()})` : undefined}
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-3.5">
          <Input
            label="Nama Berkas"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
            autoFocus
          />

          <Select
            label="Folder"
            value={editFolderId}
            onChange={e => setEditFolderId(e.target.value)}
          >
            <option value="">Root (Direktori Utama)</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>

          <Input
            label="Acara Proyek Tambang"
            value={editAcaraTag}
            onChange={e => setEditAcaraTag(e.target.value)}
            placeholder="Misal: Acara 1 · Block Model"
          />

          <Input
            label="Tags (Pisahkan dengan koma)"
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
            placeholder="#Surpac, #BlockModel, #Kriging"
          />

          <Textarea
            label="Deskripsi Berkas"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            rows={3}
            placeholder="Keterangan parameter desain, koordinat, atau versi file..."
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingFile(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Metadata
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Folder Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(folderToDelete)}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleConfirmDeleteFolder}
        title="Hapus Folder"
        message={`Isi folder "${folderToDelete?.name}" akan dipindahkan ke folder induk dan tidak akan terhapus. Apakah Anda yakin ingin menghapus folder ini?`}
        confirmText="Hapus Folder"
        variant="danger"
      />
    </div>
  );
};
