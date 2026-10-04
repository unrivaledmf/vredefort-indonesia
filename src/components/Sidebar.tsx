import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  HardDrive,
  FileText,
  FolderGit2,
  CheckSquare,
  KanbanSquare,
  Share2,
  Calendar,
  BookOpen,
  Award,
  Info,
  Users,
  Database,
  Trash2,
  Activity,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BrandLogo } from './BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { StorageStats } from '../types.ts';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavGroup {
  name: string;
  items: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user } = useAuth();
  const [storage, setStorage] = useState<StorageStats | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getStorageStats()
      .then(setStorage)
      .catch(err => console.error('Storage stats error:', err));
  }, [currentView, user]);

  const isGuest = user?.role === 'guest';

  const navGroups: NavGroup[] = isGuest
    ? [
        {
          name: 'Dokumen & Visual',
          items: [
            { id: 'files', label: 'Berkas Dokumen', icon: HardDrive },
            { id: 'graph', label: 'Peta Hubungan Kerja', icon: Share2 }
          ]
        }
      ]
    : [
        {
          name: 'Ringkasan',
          items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
          name: 'Pekerjaan',
          items: [
            { id: 'projects', label: 'Perencanaan Tambang', icon: FolderGit2 },
            { id: 'kanban', label: 'Tugas Tim', icon: KanbanSquare },
            { id: 'checklists', label: 'Target Kerja', icon: CheckSquare },
            { id: 'timeline', label: 'Jadwal Kegiatan', icon: Calendar }
          ]
        },
        {
          name: 'Dokumen & Data',
          items: [
            { id: 'files', label: 'Berkas Dokumen', icon: HardDrive },
            { id: 'notes', label: 'Catatan', icon: FileText },
            { id: 'references', label: 'Pustaka Referensi', icon: BookOpen },
            { id: 'graph', label: 'Peta Hubungan', icon: Share2 }
          ]
        },
        {
          name: 'Informasi',
          items: [
            { id: 'assessments', label: 'Penilaian', icon: Award },
            { id: 'workspace_info', label: 'Informasi Tim', icon: Info },
            ...(user?.role === 'admin'
              ? [
                  { id: 'users', label: 'Kelola Pengguna', icon: Users },
                  { id: 'storage_admin', label: 'Penyimpanan & Sampah', icon: Trash2 },
                  { id: 'audit_log', label: 'Log Aktivitas', icon: Activity }
                ]
              : [])
          ]
        }
      ];

  const usedMB = storage ? (storage.usedBytes / (1024 * 1024)).toFixed(1) : '0';
  const totalGB = storage?.totalCapacityBytes
    ? (storage.totalCapacityBytes / (1024 * 1024 * 1024)).toFixed(1)
    : '10.0';
  const percent = storage ? Math.min(100, Math.max(1, storage.percentUsed)) : 1;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-neutral-950/60 dark:bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navigasi Utama"
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 bg-slate-50 dark:bg-[#090D14] border-r border-neutral-200 dark:border-white/[0.08] text-neutral-700 dark:text-slate-300 flex flex-col transition-all duration-200 ease-in-out ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${isOpenMobile ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-neutral-200 dark:border-white/[0.07] bg-white dark:bg-[#070A10]">
          <div className="flex items-center gap-3 overflow-hidden">
            <BrandLogo size={32} withText={!isCollapsed} />
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup navigasi"
            className="p-1 rounded-lg text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              className="hidden lg:flex p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-slate-200 hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {navGroups.map(group => (
            <div key={group.name} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[11px] uppercase tracking-wider text-neutral-400 dark:text-slate-500 font-semibold">
                  {group.name}
                </div>
              )}
              {group.items.map(item => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => {
                      onNavigate(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                    } rounded-lg text-xs font-medium transition-all text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      active
                        ? 'bg-amber-500/10 text-amber-900 dark:bg-white/[0.08] dark:text-white font-semibold border border-amber-500/20 dark:border-transparent shadow-xs'
                        : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200 hover:bg-neutral-200/60 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active
                          ? 'text-amber-500 dark:text-amber-400'
                          : 'text-neutral-400 dark:text-slate-500 group-hover:text-neutral-700 dark:group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                    {!isCollapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Storage Indicator Panel */}
        <div className="p-3.5 border-t border-neutral-200 dark:border-white/[0.07] bg-white dark:bg-[#070A10]/90">
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-neutral-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-neutral-400 dark:text-slate-400" /> Penyimpanan
                </span>
                <span className="text-neutral-800 dark:text-slate-300 font-semibold tabular-nums text-[11px]">
                  {usedMB} MB / {totalGB} GB
                </span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    storage?.isCritical
                      ? 'bg-red-500'
                      : storage?.isWarning
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1.5 text-[11px] text-neutral-500 dark:text-slate-500 ">
                <span>Terpakai</span>
                <span className="tabular-nums">{percent.toFixed(1)}%</span>
              </div>
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-1 cursor-pointer"
              title={`Penyimpanan: ${usedMB} MB / ${totalGB} GB (${percent.toFixed(1)}%)`}
            >
              <Database className="w-4 h-4 text-neutral-400 dark:text-slate-400 mb-1" />
              <span className="text-[10px] text-neutral-600 dark:text-slate-300 font-semibold">
                {percent.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
