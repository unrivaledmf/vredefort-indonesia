import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  FileCode,
  Layers,
  Info,
  Calendar,
  User as UserIcon,
  Tag,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
  FileText,
  Folder as FolderIcon,
  Edit2,
  Save,
  Table as TableIcon
} from 'lucide-react';
import { MiningFile, Folder as FolderType } from '../types.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from './ui/Toast.tsx';
import { Button } from './ui/Button.tsx';
import { Input } from './ui/Input.tsx';
import { Select } from './ui/Select.tsx';
import { Badge } from './ui/Badge.tsx';
import { Textarea } from './ui/Textarea.tsx';

interface FilePreviewModalProps {
  file: MiningFile | null;
  filesList?: MiningFile[];
  onClose: () => void;
  onOpenNote?: (noteId: string) => void;
  onNavigateFile?: (file: MiningFile) => void;
  onFileUpdated?: (updated: MiningFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file: initialFile,
  filesList = [],
  onClose,
  onOpenNote,
  onNavigateFile,
  onFileUpdated
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const isGuest = user?.role === 'guest';

  const [file, setFile] = useState<MiningFile | null>(initialFile);
  const [content, setContent] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<{ sheetNames: string[]; sheets: Record<string, any[][]> } | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image controls state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Text & Spreadsheet filter state
  const [copied, setCopied] = useState(false);
  const [tableFilter, setTableFilter] = useState('');

  // Metadata Editing State
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFolderId, setEditFolderId] = useState('');
  const [editAcaraTag, setEditAcaraTag] = useState('');
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [savingMetadata, setSavingMetadata] = useState(false);

  useEffect(() => {
    setFile(initialFile);
    if (initialFile) {
      setEditName(initialFile.name);
      setEditTags(initialFile.tags.join(', '));
      setEditDesc(initialFile.description || '');
      setEditFolderId(initialFile.folderId || '');
      setEditAcaraTag(initialFile.acaraTag || '');
    }
  }, [initialFile]);

  // Load folders for metadata editing
  useEffect(() => {
    if (!isGuest) {
      api.getFolders().then(setFolders).catch(() => {});
    }
  }, [isGuest]);

  // Reset controls when file changes
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setCopied(false);
    setTableFilter('');
    setIsEditingMetadata(false);
  }, [file?.id]);

  // Fetch file content (Text, Excel, or PDF status)
  useEffect(() => {
    if (!file) return;

    setContent(null);
    setExcelData(null);
    setActiveSheet('');
    setTruncated(false);
    setError(null);
    setLoading(true);

    api.getFileContent(file.id)
      .then(res => {
        if (res.previewType === 'excel' && (res as any).sheets) {
          const sheetNames = (res as any).sheetNames || Object.keys((res as any).sheets);
          setExcelData({
            sheetNames,
            sheets: (res as any).sheets
          });
          if (sheetNames.length > 0) {
            setActiveSheet(sheetNames[0]);
          }
        } else if (res.previewType === 'text' || res.previewType === 'csv' || res.previewType === 'svg') {
          setContent(res.content || '');
          setTruncated(Boolean(res.truncated));
        }
      })
      .catch(err => {
        console.error('Error fetching file content:', err);
        setError('Format tidak mendukung preview langsung atau berkas biner.');
      })
      .finally(() => setLoading(false));
  }, [file?.id]);

  if (!file) return null;

  const ext = file.extension.toLowerCase().replace('.', '');
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';
  const isExcel = ['xlsx', 'xls'].includes(ext);
  const isCsv = ext === 'csv';
  const isJson = ext === 'json';
  const isMarkdown = ext === 'md';
  const isText = ['txt', 'md', 'xml', 'py', 'tcl', 'js', 'dxf', 'str', 'json'].includes(ext);

  // File list navigation index
  const currentIndex = filesList.findIndex(f => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filesList.length - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigateFile) {
      onNavigateFile(filesList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigateFile) {
      onNavigateFile(filesList[currentIndex + 1]);
    }
  };

  // Copy text handler
  const handleCopyContent = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Teks Tersalin ke Clipboard');
    });
  };

  // Save metadata changes
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !file) return;

    setSavingMetadata(true);
    try {
      const tagsArr = editTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t : `#${t}`));

      const updated = await api.updateFile(file.id, {
        name: editName.trim() || file.name,
        description: editDesc.trim(),
        tags: tagsArr,
        folderId: editFolderId || undefined,
        acaraTag: editAcaraTag || undefined
      });

      setFile(updated);
      setIsEditingMetadata(false);
      if (onFileUpdated) onFileUpdated(updated);
      toast.success('Metadata Berhasil Disimpan', updated.name);
    } catch (err: any) {
      toast.error('Gagal Menyimpan Metadata', err.message);
    } finally {
      setSavingMetadata(false);
    }
  };

  // Parse CSV for table viewer
  let csvHeaders: string[] = [];
  let csvRows: string[][] = [];
  if (isCsv && content) {
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      csvHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      csvRows = lines.slice(1).map(row => row.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    }
  }

  const filteredCsvRows = tableFilter
    ? csvRows.filter(row => row.some(cell => cell.toLowerCase().includes(tableFilter.toLowerCase())))
    : csvRows;

  // Active Excel Sheet rows
  const activeExcelRows: any[][] = excelData && activeSheet && excelData.sheets[activeSheet]
    ? excelData.sheets[activeSheet]
    : [];

  const filteredExcelRows = tableFilter
    ? activeExcelRows.filter(row => row.some(cell => String(cell || '').toLowerCase().includes(tableFilter.toLowerCase())))
    : activeExcelRows;

  // Format explanation for mining files
  const getFormatDetails = (extension: string) => {
    switch (extension) {
      case 'xlsx':
      case 'xls':
        return {
          name: 'Microsoft Excel Spreadsheet',
          software: ['Microsoft Excel', 'LibreOffice Calc', 'Google Sheets'],
          desc: 'Tabel lembar kerja perhitungan cadangan, analisis sensitivitas NPV, cash flow tambang, dan parameter alat berat.'
        };
      case 'pdf':
        return {
          name: 'Portable Document Format (PDF)',
          software: ['Adobe Acrobat', 'PDF Reader', 'Web Browser'],
          desc: 'Laporan teknis komprehensif, dokumen standar SNI, regulasi ESDM, dan peta tata letak tambang beresolusi tinggi.'
        };
      case 'dtm':
        return {
          name: 'Digital Terrain Model (DTM)',
          software: ['GEOVIA Surpac', 'Datamine Discover', 'Micromine'],
          desc: 'Surface mesh wireframe triangulasi 3D topografi asli, batas pit, atau volume spoil dump tambang.'
        };
      case 'str':
        return {
          name: 'Surpac String File (.str)',
          software: ['GEOVIA Surpac', 'MinePlan'],
          desc: 'Vektor segmen koordinat X,Y,Z garis kontur, toe-crest jenjang tambang, boundary IUP, dan centerline jalan angkut.'
        };
      case 'dxf':
        return {
          name: 'AutoCAD DXF Vector',
          software: ['AutoCAD', 'QGIS', 'Surpac', 'ArcGIS Pro'],
          desc: 'Format pertukaran CAD universal untuk peta teknis tambang, layout infrastruktur ROM, dan boundary konsesi.'
        };
      case 'shp':
      case 'dbf':
      case 'shx':
        return {
          name: 'ESRI Shapefile Geospasial',
          software: ['ArcGIS Pro', 'QGIS', 'Global Mapper'],
          desc: 'Format spasial vektor standar untuk batas IUP operasi produksi, litologi regional, catchment area, dan aliran sungai.'
        };
      case 'tcl':
        return {
          name: 'Surpac TCL Macro Script',
          software: ['GEOVIA Surpac'],
          desc: 'Script otomasi otomatisasi alur kerja tambang (pembuatan composite lubang bor, interpolasi inverse distance, dan pelaporan tonase cadangan).'
        };
      case 'dwg':
        return {
          name: 'AutoCAD Drawing Native',
          software: ['Autodesk AutoCAD', 'Civil 3D'],
          desc: 'Gambar teknis konstruksi fasilitas penunjang tambang, kolam pengendap (sediment pond), dan jembatan timbang.'
        };
      case 'zip':
      case 'rar':
      case '7z':
        return {
          name: 'Compressed Archive Container',
          software: ['7-Zip', 'WinRAR', 'Native Explorer'],
          desc: 'Paket arsip terkompresi berisi kompilasi database pemboran, log litologi, assay, dan topografi tambang.'
        };
      default:
        return {
          name: `Berkas .${extension.toUpperCase()}`,
          software: ['Sesuai Ekstensi'],
          desc: 'Berkas data pendukung perencanaan tambang.'
        };
    }
  };

  const formatDetail = getFormatDetails(ext);
  const currentFolderName = folders.find(f => f.id === file.folderId)?.name || 'Root / Utama';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div
        className={`w-full bg-white dark:bg-[#0B0F17] border border-neutral-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'fixed inset-0 h-full max-w-none rounded-none' : 'max-w-6xl h-[90vh]'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-200 dark:border-white/[0.08] bg-neutral-50/90 dark:bg-[#070A10]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 uppercase shrink-0">
              .{ext}
            </span>
            <div className="truncate">
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate flex items-center gap-2">
                {file.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{(file.size / 1024).toFixed(1)} KB</span>
                {!isGuest && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Oleh {file.uploadedBy}</span>
                  </>
                )}
                {file.acaraTag && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{file.acaraTag}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* File list navigation */}
            {filesList.length > 1 && (
              <div className="flex items-center gap-1 border-r border-neutral-200 dark:border-white/[0.08] pr-2 mr-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  aria-label="File sebelumnya"
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-200/60 dark:hover:bg-white/[0.05]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">
                  {currentIndex + 1}/{filesList.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasNext}
                  aria-label="File berikutnya"
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-200/60 dark:hover:bg-white/[0.05]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
              className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-slate-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.05]"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <a
              href={api.getDownloadUrl(file.id)}
              download={file.name}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh Berkas</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela pratinjau"
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content & Metadata Split Area */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 dark:divide-white/[0.08]">
          {/* Main In-App Viewer Area (2 Cols) */}
          <div className="lg:col-span-2 h-full overflow-hidden bg-neutral-100/70 dark:bg-black/60 p-2 sm:p-4 flex flex-col relative">
            {loading && (
              <div className="m-auto text-center text-sm text-neutral-500 dark:text-neutral-400 flex flex-col items-center gap-2">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-medium">Memuat pratinjau berkas dalam website...</span>
              </div>
            )}

            {/* 1. IMAGE VIEWER: In-App Zoom, Rotate, Pan */}
            {!loading && isImage && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Image Toolbar */}
                <div className="flex items-center justify-between px-3.5 py-2 mb-2 bg-white dark:bg-[#0E1420] rounded-xl border border-neutral-200 dark:border-white/[0.08] shadow-xs text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px] font-medium">
                    Perbesaran: {Math.round(zoomLevel * 100)}% · Rotasi: {rotation}°
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 4))}
                      className="p-1.5 rounded-lg text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                      title="Perbesar (Zoom In)"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                      className="p-1.5 rounded-lg text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                      title="Perkecil (Zoom Out)"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      className="p-1.5 rounded-lg text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                      title="Putar 90° (Rotate)"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoomLevel(1);
                        setRotation(0);
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Viewport Canvas */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                  <img
                    src={api.getRawFileUrl(file.id)}
                    alt={file.name}
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-h-full max-w-full object-contain rounded-xl border border-neutral-200 dark:border-white/[0.08] shadow-lg select-none bg-white dark:bg-black/40"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}

            {/* 2. PDF VIEWER: In-App Embedded PDF Frame */}
            {!loading && isPdf && (
              <div className="h-full flex flex-col bg-white dark:bg-[#0E1420] rounded-xl border border-neutral-200 dark:border-white/[0.08] overflow-hidden shadow-xs">
                <iframe
                  src={api.getRawFileUrl(file.id)}
                  title={`PDF: ${file.name}`}
                  className="w-full h-full flex-1 border-none rounded-xl"
                />
              </div>
            )}

            {/* 3. EXCEL SPREADSHEET VIEWER: Multi-Sheet Tabs, Cell Grid, Search */}
            {!loading && isExcel && excelData && (
              <div className="h-full flex flex-col bg-white dark:bg-[#0E1420] rounded-xl border border-neutral-200 dark:border-white/[0.08] overflow-hidden shadow-xs">
                {/* Spreadsheet Toolbar */}
                <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-[#070A10] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-800 dark:text-white flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      {activeSheet || 'Lembar Kerja'}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      ({filteredExcelRows.length} Baris)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Cari dalam lembar..."
                        value={tableFilter}
                        onChange={e => setTableFilter(e.target.value)}
                        className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const csvText = filteredExcelRows.map(r => r.join(',')).join('\n');
                        handleCopyContent(csvText);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-white/[0.04] font-medium"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin' : 'Salin Data'}</span>
                    </button>
                  </div>
                </div>

                {/* Spreadsheet Table Grid */}
                <div className="flex-1 overflow-auto">
                  {filteredExcelRows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400">
                      Tidak ada data yang cocok pada lembar ini.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse font-sans">
                      <tbody>
                        {filteredExcelRows.map((row, rIdx) => {
                          const isHeaderRow = rIdx === 0;
                          return (
                            <tr
                              key={rIdx}
                              className={`${
                                isHeaderRow
                                  ? 'bg-neutral-100 dark:bg-slate-900 font-bold text-neutral-900 dark:text-white sticky top-0 border-b border-neutral-200 dark:border-white/10 shadow-2xs z-10'
                                  : 'hover:bg-neutral-50 dark:hover:bg-white/[0.02] border-b border-neutral-100 dark:border-white/[0.04]'
                              }`}
                            >
                              {/* Row Index Number */}
                              <td className="px-2.5 py-1.5 text-[10px] text-neutral-400 dark:text-slate-500 font-mono text-right bg-neutral-50 dark:bg-slate-950/40 border-r border-neutral-200 dark:border-white/[0.06] select-none w-10">
                                {rIdx + 1}
                              </td>
                              {row.map((cell: any, cIdx: number) => (
                                <td
                                  key={cIdx}
                                  className="px-3 py-1.5 text-neutral-800 dark:text-slate-200 whitespace-nowrap border-r border-neutral-100 dark:border-white/[0.04] text-[11px]"
                                >
                                  {cell !== null && cell !== undefined ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Sheet Tabs Bar at Bottom (Excel style) */}
                {excelData.sheetNames.length > 1 && (
                  <div className="px-3 py-1.5 border-t border-neutral-200 dark:border-white/[0.08] bg-neutral-100 dark:bg-[#070A10] flex items-center gap-1 overflow-x-auto shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 mr-1.5 shrink-0">
                      Sheets:
                    </span>
                    {excelData.sheetNames.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setActiveSheet(name);
                          setTableFilter('');
                        }}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer truncate shrink-0 ${
                          activeSheet === name
                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs border border-neutral-200 dark:border-white/10'
                            : 'text-neutral-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. CSV DATA TABLE VIEWER */}
            {!loading && isCsv && content && (
              <div className="h-full flex flex-col bg-white dark:bg-[#0E1420] rounded-xl border border-neutral-200 dark:border-white/[0.08] overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-[#070A10] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-800 dark:text-white">
                      Tabel CSV ({filteredCsvRows.length} baris)
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {csvHeaders.length} Kolom
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Cari dalam tabel..."
                        value={tableFilter}
                        onChange={e => setTableFilter(e.target.value)}
                        className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContent(content)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin' : 'Salin CSV'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs text-left border-collapse font-sans">
                    <thead className="sticky top-0 bg-neutral-100 dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-700 font-bold text-neutral-800 dark:text-white shadow-2xs z-10">
                      <tr>
                        <th className="px-2.5 py-2 w-10 text-right bg-neutral-50 dark:bg-slate-950/40 border-r border-neutral-200 dark:border-white/[0.06] text-[10px] text-neutral-400">#</th>
                        {csvHeaders.map((h, i) => (
                          <th key={i} className="px-3 py-2 border-r border-neutral-200 dark:border-slate-700 truncate max-w-xs">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                      {filteredCsvRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                          <td className="px-2.5 py-1.5 text-[10px] text-neutral-400 font-mono text-right bg-neutral-50 dark:bg-slate-950/40 border-r border-neutral-200 dark:border-white/[0.06] select-none">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 text-neutral-700 dark:text-slate-300 border-r border-neutral-100 dark:border-white/[0.04] text-[11px] whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. TEXT / SCRIPT / DXF VIEWER */}
            {!loading && isText && !isCsv && content && (
              <div className="h-full flex flex-col bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden shadow-xs">
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono uppercase text-[11px]">{ext} Source File</span>
                  <button
                    type="button"
                    onClick={() => handleCopyContent(content)}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[11px]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin' : 'Salin Semua'}</span>
                  </button>
                </div>
                <pre className="flex-1 p-4 text-xs font-mono overflow-auto leading-relaxed whitespace-pre-wrap select-text">
                  <code>{content}</code>
                </pre>
              </div>
            )}

            {/* 6. BINARY / SPECIALIZED MINING FILE VIEWER (DTM, SHP, ZIP, etc.) */}
            {!loading && !isImage && !isPdf && !isExcel && !isCsv && !isText && (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-[#0E1420] rounded-xl border border-neutral-200 dark:border-white/[0.08] text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                  {formatDetail.name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mb-6 leading-relaxed">
                  {formatDetail.desc}
                </p>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#070A10] border border-neutral-200 dark:border-white/[0.06] text-left max-w-md w-full mb-6 text-xs space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Aplikasi Rekomendasi:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formatDetail.software.map((sw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-slate-200 font-medium text-[11px]">
                        {sw}
                      </span>
                    ))}
                  </div>
                </div>

                <a
                  href={api.getDownloadUrl(file.id)}
                  download={file.name}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md"
                >
                  <Download className="w-4 h-4" />
                  Unduh Berkas ({file.extension.toUpperCase().replace('.', '')})
                </a>
              </div>
            )}
          </div>

          {/* Right Sidebar: Dynamic & Editable Metadata Panel (1 Col) */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto bg-white dark:bg-[#0B0F17]">
            {/* Header Metadata Title + Edit Button */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Metadata Berkas
              </h3>
              {!isGuest && !isEditingMetadata && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingMetadata(true)}
                  leftIcon={<Edit2 className="w-3 h-3 text-emerald-500" />}
                  className="text-xs h-7 px-2"
                >
                  Ubah Metadata
                </Button>
              )}
            </div>

            {/* Editable Form vs Readonly View */}
            {isEditingMetadata ? (
              <form onSubmit={handleSaveMetadata} className="space-y-3.5 pt-1">
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
                  <option value="">Root / Direktori Utama</option>
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
                  label="Tags (Pisahkan koma)"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="#Surpac, #BlockModel, #Kriging"
                />

                <Textarea
                  label="Deskripsi Berkas"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  placeholder="Rincian parameter, batas koordinat, dan metodologi..."
                />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingMetadata(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={savingMetadata}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Simpan Metadata
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.05]">
                  <span className="text-neutral-500 dark:text-neutral-400">Format Ekstensi</span>
                  <span className="font-bold text-neutral-800 dark:text-white uppercase">
                    {file.extension}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.05]">
                  <span className="text-neutral-500 dark:text-neutral-400">Ukuran Berkas</span>
                  <span className="font-semibold text-neutral-800 dark:text-white tabular-nums">
                    {(file.size / 1024).toFixed(2)} KB ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.05]">
                  <span className="text-neutral-500 dark:text-neutral-400">Folder</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <FolderIcon className="w-3 h-3" />
                    {currentFolderName}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.05]">
                  <span className="text-neutral-500 dark:text-neutral-400">MIME Type</span>
                  <span className="text-[11px] text-neutral-800 dark:text-slate-300 truncate max-w-[160px]">
                    {file.mimeType}
                  </span>
                </div>

                {!isGuest && (
                  <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.05]">
                    <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Pengunggah
                    </span>
                    <span className="font-semibold text-neutral-800 dark:text-white">
                      @{file.uploadedBy}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.05]">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Diunggah
                  </span>
                  <span className="text-neutral-700 dark:text-slate-300 tabular-nums text-[11px]">
                    {new Date(file.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* Description Display */}
            {!isEditingMetadata && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Deskripsi Berkas
                </h4>
                <p className="text-xs text-neutral-700 dark:text-slate-300 leading-relaxed bg-neutral-50 dark:bg-[#070A10] p-3.5 rounded-xl border border-neutral-200/80 dark:border-white/[0.06]">
                  {file.description || 'Tidak ada deskripsi tambahan.'}
                </p>
              </div>
            )}

            {/* Tags Display */}
            {!isEditingMetadata && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Tags Terkait
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {file.tags && file.tags.length > 0 ? (
                    file.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 text-[11px] rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Belum ada tag</span>
                  )}
                </div>
              </div>
            )}

            {/* Linked Notes & Project Relations */}
            {!isEditingMetadata && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Hubungan Acara & Catatan
                </h4>
                <div className="space-y-2">
                  {file.acaraTag && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs">
                      <span className="text-neutral-500 dark:text-slate-400 block text-[10px]">Terkait Proyek:</span>
                      <span className="font-bold text-amber-900 dark:text-amber-200">{file.acaraTag}</span>
                    </div>
                  )}
                  {file.linkedNoteIds && file.linkedNoteIds.length > 0 && onOpenNote && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenNote(file.linkedNoteIds[0]);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs hover:border-emerald-400 transition-colors cursor-pointer"
                    >
                      <span className="text-neutral-500 dark:text-slate-400 block text-[10px]">Terkait Catatan:</span>
                      <span className="font-bold text-emerald-900 dark:text-emerald-300">Buka Lembar Catatan Terkait →</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
