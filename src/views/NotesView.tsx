import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Star,
  Pin,
  Trash2,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Table,
  Eye,
  Edit3,
  HardDrive,
  FolderGit2,
  Check,
  ChevronRight,
  RefreshCw,
  Tag,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Sigma,
  CheckSquare,
  Sparkles,
  Upload,
  AlertCircle,
  ExternalLink,
  Lock,
  Layers,
  MoreVertical,
  X,
  FileCheck,
  Maximize2,
  Printer,
  Download,
  Calculator
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Note, MiningFile, Project, Folder as FolderType } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { EquationBuilderModal } from '../components/EquationBuilderModal.tsx';
import { exportNoteToPdf } from '../utils/pdfExport.ts';

interface NotesViewProps {
  initialNoteId?: string;
  onPreviewFile?: (file: MiningFile) => void;
  onNavigate?: (view: string, targetId?: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  initialNoteId,
  onPreviewFile,
  onNavigate
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const isGuest = user?.role === 'guest';
  const isAdminOrOwner = (noteOwner?: string) => user?.role === 'admin' || user?.username === noteOwner;

  const [siteSettings, setSiteSettings] = useState<{
    siteName: string;
    tagline: string;
    academicYear: string;
    logoUrl: string | null;
  }>({
    siteName: 'VREDEFORT INDONESIA',
    tagline: 'Ruang Kerja & Perencanaan Tambang Mineral',
    academicYear: '2026/2027',
    logoUrl: null
  });

  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [files, setFiles] = useState<MiningFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialNoteId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string>('all'); // 'all' | 'favorites' | 'pinned' | folderId
  const [editorMode, setEditorMode] = useState<'visual' | 'doc' | 'split'>('doc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active note fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteFolderId, setNoteFolderId] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedAcaraId, setSelectedAcaraId] = useState('');
  const [linkedFiles, setLinkedFiles] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Autosave status: 'saved' | 'saving' | 'dirty'
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Modals for Notion blocks
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#10B981');
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nList, fldList, fList, pList, settings] = await Promise.all([
        api.getNotes(),
        api.getFolders(),
        api.getFiles(),
        api.getProjects(),
        api.getPublicSettings().catch(() => null)
      ]);
      setNotes(nList);
      setFolders(fldList);
      setFiles(fList);
      setProjects(pList);
      if (settings) {
        setSiteSettings(settings);
      }

      const targetId = initialNoteId || selectedNoteId || (nList.length > 0 ? nList[0].id : null);
      if (targetId) {
        const found = nList.find(n => n.id === targetId) || nList[0];
        if (found) {
          populateNoteFields(found);
        }
      }
    } catch (err: any) {
      console.error('Error loading notes:', err);
      setError(err.message || 'Gagal memuat catatan.');
    } finally {
      setLoading(false);
    }
  }, [initialNoteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const populateNoteFields = (note: Note) => {
    setSelectedNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setNoteFolderId(note.folderId || '');
    setTagsInput(note.tags.join(', '));
    setSelectedAcaraId(note.acaraId || '');
    setLinkedFiles(note.linkedFileIds || []);
    setIsPinned(note.isPinned);
    setIsFavorite(note.isFavorite);
    setSaveState('saved');
  };

  const handleSelectNote = (note: Note) => {
    if (saveState === 'dirty' && selectedNoteId && !isGuest) {
      handleSave(false);
    }
    populateNoteFields(note);
  };

  // Debounced Autosave
  const triggerAutosave = (newTitle: string, newContent: string, newFolderId?: string) => {
    if (isGuest) return;
    setSaveState('dirty');
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(async () => {
      if (!selectedNoteId) return;
      setSaveState('saving');
      try {
        const tagsArr = tagsInput
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
          .map(t => (t.startsWith('#') ? t : `#${t}`));

        const folderToSave = newFolderId !== undefined ? newFolderId : noteFolderId;

        await api.updateNote(selectedNoteId, {
          title: newTitle,
          content: newContent,
          folderId: folderToSave || undefined,
          tags: tagsArr,
          acaraId: selectedAcaraId || undefined,
          linkedFileIds: linkedFiles,
          isPinned,
          isFavorite
        });

        setNotes(prev =>
          prev.map(n =>
            n.id === selectedNoteId
              ? {
                  ...n,
                  title: newTitle,
                  content: newContent,
                  folderId: folderToSave || undefined,
                  tags: tagsArr,
                  acaraId: selectedAcaraId || undefined,
                  linkedFileIds: linkedFiles,
                  isPinned,
                  isFavorite,
                  updatedAt: new Date().toISOString()
                }
              : n
          )
        );
        setSaveState('saved');
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveState('dirty');
      }
    }, 800);
  };

  const handleSave = async (showToast = true) => {
    if (isGuest || !selectedNoteId) return;
    setSaveState('saving');
    try {
      const tagsArr = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t : `#${t}`));

      const updated = await api.updateNote(selectedNoteId, {
        title,
        content,
        folderId: noteFolderId || undefined,
        tags: tagsArr,
        acaraId: selectedAcaraId || undefined,
        linkedFileIds: linkedFiles,
        isPinned,
        isFavorite
      });

      setNotes(prev => prev.map(n => (n.id === selectedNoteId ? updated : n)));
      setSaveState('saved');
      if (showToast) {
        toast.success('Catatan Berhasil Disimpan');
      }
    } catch (err: any) {
      toast.error('Gagal Menyimpan', err.message);
      setSaveState('dirty');
    }
  };

  const handleCreateNote = async (targetFolderId?: string) => {
    if (isGuest) return;
    try {
      const folderToUse = targetFolderId || (activeFolderId !== 'all' && activeFolderId !== 'favorites' && activeFolderId !== 'pinned' ? activeFolderId : undefined);
      const newNote = await api.createNote({
        title: 'Catatan Baru Tanpa Judul',
        content: '# Judul Catatan\n\nMulai menulis catatan teknis, menempel gambar, atau menyisipkan formulasi tambang...',
        folderId: folderToUse,
        tags: ['#Draft'],
        isPinned: false,
        isFavorite: false
      });

      setNotes(prev => [newNote, ...prev]);
      populateNoteFields(newNote);
      setEditorMode('visual');
      toast.success('Catatan Baru Dibuat');
    } catch (err: any) {
      toast.error('Gagal Membuat Catatan', err.message);
    }
  };

  const handleDeleteNote = async () => {
    if (isGuest || !selectedNoteId) return;
    try {
      await api.deleteNote(selectedNoteId);
      const remaining = notes.filter(n => n.id !== selectedNoteId);
      setNotes(remaining);
      setDeleteConfirmOpen(false);
      if (remaining.length > 0) {
        populateNoteFields(remaining[0]);
      } else {
        setSelectedNoteId(null);
        setTitle('');
        setContent('');
      }
      toast.success('Catatan Telah Dihapus');
    } catch (err: any) {
      toast.error('Gagal Menghapus', err.message);
    }
  };

  // Export to PDF with official header and logo
  const handleExportPdf = () => {
    if (!selectedNote) {
      toast.error('Pilih catatan terlebih dahulu');
      return;
    }
    const folderObj = folders.find(f => f.id === noteFolderId);
    const projectObj = projects.find(p => p.id === selectedAcaraId || p.code === selectedAcaraId);
    exportNoteToPdf({
      note: {
        ...selectedNote,
        title,
        content,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      },
      folderName: folderObj?.name || 'Umum',
      acaraName: projectObj?.title || selectedAcaraId || undefined,
      logoUrl: siteSettings.logoUrl,
      siteName: siteSettings.siteName,
      academicYear: siteSettings.academicYear
    });
  };

  // Text Insertion Helper
  const insertBlockAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const newContent = content + '\n' + textToInsert;
      setContent(newContent);
      triggerAutosave(title, newContent);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setContent(newContent);
    triggerAutosave(title, newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  // Formatting Shortcuts
  const applyFormat = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    let replacement = '';
    if (selected) {
      replacement = `${prefix}${selected}${suffix}`;
    } else {
      replacement = `${prefix}teks${suffix}`;
    }

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    triggerAutosave(title, newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 50);
  };

  // Paste image directly from clipboard (Ctrl+V / Cmd+V)
  const handlePasteCapture = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
    if (isGuest) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
              const imageMarkdown = `\n\n![Tangkapan Layar / Grafik](${dataUrl})\n\n`;
              insertBlockAtCursor(imageMarkdown);
              toast.success('Gambar Ditempel', 'Gambar screenshot berhasil disisipkan.');
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  };

  // Drag and drop image file onto editor
  const handleDropCapture = (e: React.DragEvent) => {
    if (isGuest) return;
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            const imageMarkdown = `\n\n![${file.name}](${dataUrl})\n\n`;
            insertBlockAtCursor(imageMarkdown);
            toast.success('Gambar Disisipkan', `Berkas ${file.name} dimasukkan.`);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Handle image upload from computer via input
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingImage(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImageSrc(dataUrl);
        setImageAlt(file.name.replace(/\.[^/.]+$/, ''));
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmInsertImage = () => {
    if (!imageSrc.trim()) return;
    const imgMarkdown = `![${imageAlt.trim() || 'Gambar Tambang'}](${imageSrc.trim()})`;
    insertBlockAtCursor(imgMarkdown);
    setShowImageModal(false);
    setImageSrc('');
    setImageAlt('');
    toast.success('Gambar Ditambahkan');
  };

  // Insert formula from Visual Equation Builder Modal
  const handleInsertEquation = (equationLatex: string, equationName: string) => {
    const equationBlock = `\n\n> [!NOTE]\n> **${equationName || 'Formulasi Rekayasa Tambang'}**\n\n$$ ${equationLatex} $$\n\n`;
    insertBlockAtCursor(equationBlock);
    toast.success('Rumus Matematika Disisipkan');
  };

  // Folder management
  const handleCreateOrUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !newFolderName.trim()) return;

    try {
      if (editingFolder) {
        await api.updateFolder(editingFolder.id, newFolderName.trim());
        setFolders(prev => prev.map(f => (f.id === editingFolder.id ? { ...f, name: newFolderName.trim() } : f)));
        toast.success('Folder Diperbarui', newFolderName.trim());
      } else {
        const created = await api.createFolder(newFolderName.trim(), undefined, newFolderColor);
        setFolders(prev => [...prev, created]);
        setActiveFolderId(created.id);
        toast.success('Folder Dibuat', newFolderName.trim());
      }
      setShowFolderModal(false);
      setNewFolderName('');
      setEditingFolder(null);
    } catch (err: any) {
      toast.error('Gagal Menyimpan Folder', err.message);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (isGuest) return;
    try {
      await api.deleteFolder(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (activeFolderId === folderId) setActiveFolderId('all');
      toast.success('Folder Dihapus');
    } catch (err: any) {
      toast.error('Gagal Menghapus Folder', err.message);
    }
  };

  // Filter notes by activeFolder and search query
  const filteredNotes = notes.filter(note => {
    // 1. Folder filter
    if (activeFolderId === 'favorites' && !note.isFavorite) return false;
    if (activeFolderId === 'pinned' && !note.isPinned) return false;
    if (activeFolderId !== 'all' && activeFolderId !== 'favorites' && activeFolderId !== 'pinned') {
      if (note.folderId !== activeFolderId) return false;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      const matchTags = note.tags.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }

    return true;
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-[#070A10] overflow-hidden">
      {/* Top Workspace Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0B0F17] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
              Catatan Teknis &amp; Lembar Kerja
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {notes.length} Catatan tersimpan · {folders.length} Folder Kategori
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isGuest && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingFolder(null);
                  setNewFolderName('');
                  setShowFolderModal(true);
                }}
                leftIcon={<FolderPlus className="w-3.5 h-3.5" />}
                className="text-xs hidden md:flex"
              >
                Folder Baru
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCreateNote()}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Catatan Baru
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main 2-Column Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Folders Tree + Notes Index */}
        <div className="w-full md:w-80 lg:w-96 border-r border-neutral-200 dark:border-white/[0.08] flex flex-col bg-neutral-50 dark:bg-[#0A0E17] shrink-0">
          {/* Search Bar */}
          <div className="p-3 border-b border-neutral-200 dark:border-white/[0.08]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari catatan, rumus, atau tag..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Folder Filter Navigation */}
          <div className="p-2 border-b border-neutral-200 dark:border-white/[0.08] max-h-48 overflow-y-auto space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center justify-between">
              <span>Folder &amp; Kategori</span>
              {!isGuest && (
                <button
                  type="button"
                  onClick={() => setShowFolderModal(true)}
                  className="hover:text-emerald-500 transition-colors cursor-pointer"
                  title="Tambah Folder"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveFolderId('all')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                activeFolderId === 'all'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30'
                  : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-200/60 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                Semua Catatan
              </span>
              <span className="text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-slate-300">
                {notes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFolderId('favorites')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                activeFolderId === 'favorites'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30'
                  : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-200/60 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                Favorit
              </span>
              <span className="text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-slate-300">
                {notes.filter(n => n.isFavorite).length}
              </span>
            </button>

            {/* Folder List */}
            {folders.map(folder => {
              const count = notes.filter(n => n.folderId === folder.id).length;
              const isActive = activeFolderId === folder.id;
              return (
                <div key={folder.id} className="group/folder flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer truncate ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30'
                        : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-200/60 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-slate-300 shrink-0 ml-1">
                      {count}
                    </span>
                  </button>

                  {!isGuest && (
                    <div className="hidden group-hover/folder:flex items-center gap-0.5 pl-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFolder(folder);
                          setNewFolderName(folder.name);
                          setShowFolderModal(true);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                        title="Ubah Nama"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-1 text-neutral-400 hover:text-red-500"
                        title="Hapus Folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                Belum ada catatan di folder ini.
              </div>
            ) : (
              filteredNotes.map(note => {
                const isSelected = note.id === selectedNoteId;
                const folder = folders.find(f => f.id === note.folderId);
                const previewSnippet = note.content
                  .replace(/#|\*|`|\[!NOTE\]|\[!INFO\]|\$\$|\$/g, '')
                  .trim()
                  .slice(0, 70);

                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => handleSelectNote(note)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-xs'
                        : 'border-transparent hover:bg-white/60 dark:hover:bg-white/[0.03] hover:border-neutral-200 dark:hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        {note.isPinned && <Pin className="w-3 h-3 text-blue-500 fill-blue-500 shrink-0" />}
                        {note.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                        <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {note.title || 'Catatan Tanpa Judul'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      {previewSnippet || 'Tidak ada pratinjau teks...'}
                    </p>

                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-neutral-100 dark:border-white/[0.05] text-[10px] text-neutral-400">
                      {folder && (
                        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">
                          <Folder className="w-2.5 h-2.5" />
                          {folder.name}
                        </span>
                      )}
                      <span>
                        {new Date(note.updatedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      {note.tags.length > 0 && (
                        <span className="truncate max-w-[80px] font-mono">
                          {note.tags[0]}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Note Document Workspace */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#070A10] overflow-hidden">
          {selectedNote ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Note Header & Actions Bar */}
              <div className="p-4 sm:p-6 pb-3 border-b border-neutral-200 dark:border-white/[0.08] space-y-4 shrink-0 bg-white/95 dark:bg-[#070A10]/95 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Autosave Status */}
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          saveState === 'saved'
                            ? 'bg-emerald-500'
                            : saveState === 'saving'
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {saveState === 'saved'
                        ? 'Tersimpan di Cloud'
                        : saveState === 'saving'
                        ? 'Menyimpan...'
                        : 'Ada Perubahan'}
                    </span>

                    {isGuest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <Lock className="w-3 h-3" /> Mode Baca Tamu
                      </span>
                    )}
                  </div>

                  {/* Actions (Ekspor PDF, Toggle Mode, Pin, Star, Delete) */}
                  <div className="flex items-center gap-1.5">
                    {/* Official PDF Export Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExportPdf}
                      leftIcon={<Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      className="text-xs font-semibold"
                      title="Cetak atau simpan catatan ke format PDF resmi"
                    >
                      Ekspor PDF
                    </Button>

                    {/* View mode toggle */}
                    <div className="flex items-center p-0.5 rounded-lg bg-neutral-200/70 dark:bg-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditorMode('doc')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          editorMode === 'doc'
                            ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white font-semibold shadow-2xs'
                            : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        Tampilan Dokumen
                      </button>
                      {!isGuest && (
                        <button
                          type="button"
                          onClick={() => setEditorMode('visual')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            editorMode === 'visual'
                              ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white font-semibold shadow-2xs'
                              : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          Editor Blok
                        </button>
                      )}
                    </div>

                    {!isGuest && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !isPinned;
                            setIsPinned(next);
                            api.updateNote(selectedNote.id, { isPinned: next });
                            setNotes(prev => prev.map(n => (n.id === selectedNote.id ? { ...n, isPinned: next } : n)));
                            toast.success(next ? 'Catatan Disematkan' : 'Sematkan Dicabut');
                          }}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isPinned
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                              : 'border-neutral-200 dark:border-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white'
                          }`}
                          title="Sematkan di atas"
                        >
                          <Pin className="w-3.5 h-3.5 fill-current" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = !isFavorite;
                            setIsFavorite(next);
                            api.updateNote(selectedNote.id, { isFavorite: next });
                            setNotes(prev => prev.map(n => (n.id === selectedNote.id ? { ...n, isFavorite: next } : n)));
                            toast.success(next ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
                          }}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isFavorite
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                              : 'border-neutral-200 dark:border-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white'
                          }`}
                          title="Tandai Favorit"
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>

                        {isAdminOrOwner(selectedNote.createdBy) && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmOpen(true)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-white/10 text-neutral-400 hover:text-red-600 hover:border-red-500/30 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Frameless Document Title (Notion Style) */}
                <div>
                  {isGuest ? (
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                      {title}
                    </h2>
                  ) : (
                    <input
                      type="text"
                      value={title}
                      onChange={e => {
                        setTitle(e.target.value);
                        triggerAutosave(e.target.value, content);
                      }}
                      placeholder="Judul Catatan..."
                      className="w-full text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white bg-transparent border-none focus:outline-none placeholder-neutral-300 dark:placeholder-neutral-700"
                    />
                  )}
                </div>

                {/* Notion Properties Grid (Folder, Acara, Penulis, Tags) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
                  {/* Property 1: Folder */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-neutral-200/80 dark:border-white/[0.06]">
                    <Folder className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-[11px] text-neutral-400 shrink-0">Folder:</span>
                    {isGuest ? (
                      <span className="font-semibold text-neutral-800 dark:text-white truncate">
                        {folders.find(f => f.id === noteFolderId)?.name || 'Umum'}
                      </span>
                    ) : (
                      <select
                        value={noteFolderId}
                        onChange={e => {
                          setNoteFolderId(e.target.value);
                          triggerAutosave(title, content, e.target.value);
                          toast.success('Folder Dipindahkan');
                        }}
                        className="w-full bg-transparent text-xs font-semibold text-neutral-800 dark:text-white focus:outline-none cursor-pointer truncate"
                      >
                        <option value="" className="bg-white dark:bg-slate-900">
                          (Tanpa Folder / Umum)
                        </option>
                        {folders.map(f => (
                          <option key={f.id} value={f.id} className="bg-white dark:bg-slate-900">
                            {f.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Property 2: Acara Proyek */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-neutral-200/80 dark:border-white/[0.06]">
                    <FolderGit2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-[11px] text-neutral-400 shrink-0">Acara:</span>
                    {isGuest ? (
                      <span className="font-semibold text-neutral-800 dark:text-white truncate">
                        {projects.find(p => p.id === selectedAcaraId || p.code === selectedAcaraId)?.title ||
                          selectedAcaraId ||
                          '-'}
                      </span>
                    ) : (
                      <select
                        value={selectedAcaraId}
                        onChange={e => {
                          setSelectedAcaraId(e.target.value);
                          triggerAutosave(title, content);
                        }}
                        className="w-full bg-transparent text-xs font-semibold text-neutral-800 dark:text-white focus:outline-none cursor-pointer truncate"
                      >
                        <option value="" className="bg-white dark:bg-slate-900">
                          (Tidak Terikat Acara)
                        </option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900">
                            {p.code} - {p.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Property 3: Penulis */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-neutral-200/80 dark:border-white/[0.06]">
                    <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="text-[11px] text-neutral-400 shrink-0">Penulis:</span>
                    <span className="font-semibold text-neutral-800 dark:text-white truncate">
                      {selectedNote.createdBy || 'Tim Rekayasa'}
                    </span>
                  </div>

                  {/* Property 4: Tags */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-neutral-200/80 dark:border-white/[0.06]">
                    <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[11px] text-neutral-400 shrink-0">Tag:</span>
                    {isGuest ? (
                      <span className="font-semibold text-neutral-800 dark:text-white truncate">
                        {selectedNote.tags.join(', ') || '-'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={tagsInput}
                        onChange={e => {
                          setTagsInput(e.target.value);
                          triggerAutosave(title, content);
                        }}
                        placeholder="Contoh: #pit, #kriging"
                        className="w-full bg-transparent text-xs font-medium text-neutral-800 dark:text-white focus:outline-none placeholder-neutral-400 truncate"
                      />
                    )}
                  </div>
                </div>

                {/* MS Word & Notion Floating Visual Toolbar (Only on Edit mode) */}
                {!isGuest && editorMode === 'visual' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-200/60 dark:border-white/[0.06]">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 mr-1">
                      Sisipkan Blok:
                    </span>

                    {/* Word Equation Editor Button */}
                    <button
                      type="button"
                      onClick={() => setShowFormulaModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Penyusun Rumus (MS Word)
                    </button>

                    {/* Image Embed Button */}
                    <button
                      type="button"
                      onClick={() => setShowImageModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-neutral-200 dark:border-white/10 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                      Sisipkan Gambar
                    </button>

                    {/* Checklist */}
                    <button
                      type="button"
                      onClick={() => insertBlockAtCursor('\n- [ ] Target kerja baru\n')}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-neutral-200 dark:border-white/10 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <CheckSquare className="w-3 h-3 text-blue-500" />
                      Checklist
                    </button>

                    {/* Callout Info */}
                    <button
                      type="button"
                      onClick={() =>
                        insertBlockAtCursor('\n> [!NOTE]\n> **Catatan Teknis Penting:** Masukkan poin evaluasi di sini.\n')
                      }
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-neutral-200 dark:border-white/10 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      Kotak Catatan
                    </button>

                    {/* Table */}
                    <button
                      type="button"
                      onClick={() =>
                        insertBlockAtCursor(
                          '\n| Parameter | Nilai Satuan | Keterangan |\n| :--- | :--- | :--- |\n| Kadar Cut-off | 0.45 % | Batas Bijih |\n| Specific Gravity | 2.65 t/m3 | Andesit |\n\n'
                        )
                      }
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-neutral-200 dark:border-white/10 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <Table className="w-3 h-3 text-neutral-500" />
                      Tabel
                    </button>

                    <div className="h-4 w-px bg-neutral-200 dark:bg-white/10 mx-1" />

                    {/* Formatting Helpers */}
                    <button
                      type="button"
                      onClick={() => applyFormat('**', '**')}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5"
                      title="Tebal (Bold)"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('*', '*')}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5"
                      title="Miring (Italic)"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('## ')}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5"
                      title="Sub-Judul"
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Note Content Area */}
              <div
                className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-4xl mx-auto w-full"
                onPaste={handlePasteCapture}
                onDrop={handleDropCapture}
                onDragOver={e => e.preventDefault()}
              >
                {editorMode === 'doc' ? (
                  /* Clean Notion Document View (Renders Formulas, Images, Tables smoothly) */
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <Markdown content={content} />
                  </div>
                ) : (
                  /* Block Editor Area */
                  <div className="h-full flex flex-col">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={e => {
                        setContent(e.target.value);
                        triggerAutosave(title, e.target.value);
                      }}
                      placeholder="Mulai menulis catatan atau sisipkan rumus & gambar..."
                      className="flex-1 w-full p-4 rounded-xl bg-neutral-50 dark:bg-slate-900/40 border border-neutral-200 dark:border-white/[0.08] text-sm text-neutral-900 dark:text-neutral-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                icon={<FileText className="w-10 h-10 text-neutral-400" />}
                title="Pilih atau Buat Catatan"
                description="Pilih catatan dari daftar di sebelah kiri atau buat catatan teknis baru."
                action={
                  !isGuest ? (
                    <Button variant="primary" size="sm" onClick={() => handleCreateNote()}>
                      Buat Catatan Baru
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Visual Equation Builder Modal (MS Word Style) */}
      <EquationBuilderModal
        isOpen={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
        onInsert={handleInsertEquation}
      />

      {/* MODAL 2: Sisipkan & Tempel Gambar */}
      <Modal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        title="Sisipkan Gambar ke Catatan"
        description="Unggah gambar dari komputer, tempel tangkapan layar, atau gunakan tautan URL."
        size="md"
      >
        <div className="space-y-4 pt-2">
          {/* File Upload Trigger */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-white/10 hover:border-emerald-500 text-center cursor-pointer hover:bg-emerald-500/5 transition-all"
          >
            <Upload className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-800 dark:text-slate-200">
              Klik untuk pilih gambar dari komputer
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              PNG, JPG, WEBP, atau SVG (Maks. 10MB)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageFileUpload}
            />
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-neutral-200 dark:border-white/[0.08]" />
            <span className="flex-shrink mx-3 text-[10px] uppercase text-neutral-400">atau tautan URL</span>
            <div className="flex-grow border-t border-neutral-200 dark:border-white/[0.08]" />
          </div>

          <Input
            label="URL Gambar"
            value={imageSrc}
            onChange={e => setImageSrc(e.target.value)}
            placeholder="https://contoh.com/gambar-pit.png"
          />

          <Input
            label="Keterangan / Caption Gambar"
            value={imageAlt}
            onChange={e => setImageAlt(e.target.value)}
            placeholder="Penampang Cross-Section Blok Model Acara 1"
          />

          {imageSrc && (
            <div className="p-2 rounded-xl border border-neutral-200 dark:border-white/10 text-center bg-neutral-50 dark:bg-slate-900">
              <span className="text-[10px] text-neutral-400 block mb-1">Pratinjau:</span>
              <img src={imageSrc} alt={imageAlt} className="max-h-40 mx-auto rounded-lg object-contain" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowImageModal(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!imageSrc.trim()}
              onClick={handleConfirmInsertImage}
            >
              Sisipkan Gambar
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Kelola / Tambah Folder */}
      <Modal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setEditingFolder(null);
        }}
        title={editingFolder ? 'Ubah Nama Folder' : 'Tambah Folder Catatan Baru'}
        description="Folder memudahkan klasifikasi catatan berdasarkan Acara Tambang atau topik spesifik."
        size="sm"
      >
        <form onSubmit={handleCreateOrUpdateFolder} className="space-y-4 pt-2">
          <Input
            label="Nama Folder"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Misal: Acara 1 - Block Model"
            required
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowFolderModal(false);
                setEditingFolder(null);
              }}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingFolder ? 'Simpan Perubahan' : 'Buat Folder'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteNote}
        title="Hapus Catatan Ini?"
        message={`Catatan "${selectedNote?.title}" akan dihapus dari workspace.`}
        confirmText="Hapus Catatan"
        variant="danger"
      />
    </div>
  );
};
