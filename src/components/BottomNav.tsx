import React, { useState } from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  HardDrive,
  FileText,
  MoreHorizontal,
  FolderGit2,
  CheckSquare,
  Calendar,
  Share2,
  BookOpen,
  Award,
  Info,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const { user } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const isGuest = user?.role === 'guest';

  const mainItems = isGuest
    ? [
        { id: 'files', label: 'Berkas', icon: HardDrive },
        { id: 'graph', label: 'Peta Kerja', icon: Share2 }
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'kanban', label: 'Tugas', icon: KanbanSquare },
        { id: 'files', label: 'Berkas', icon: HardDrive },
        { id: 'notes', label: 'Catatan', icon: FileText }
      ];

  const moreItems = isGuest
    ? []
    : [
        { id: 'projects', label: 'Perencanaan Tambang', icon: FolderGit2, desc: 'Acara 1 s/d Acara 5' },
        { id: 'checklists', label: 'Target Kerja', icon: CheckSquare, desc: 'Daftar kendali teknis' },
        { id: 'timeline', label: 'Jadwal Kegiatan', icon: Calendar, desc: 'Jadwal dan batas waktu' },
        { id: 'graph', label: 'Peta Hubungan', icon: Share2, desc: 'Visualisasi alur dokumen' },
        { id: 'references', label: 'Pustaka Referensi', icon: BookOpen, desc: 'Regulasi, SNI & literatur' },
        { id: 'assessments', label: 'Penilaian', icon: Award, desc: 'Penilaian dan evaluasi' },
        { id: 'workspace_info', label: 'Informasi Tim', icon: Info, desc: 'Roster tim dan panduan' },
        ...(user?.role === 'admin'
          ? [{ id: 'users', label: 'Kelola Pengguna', icon: Users, desc: 'Kelola akun anggota' }]
          : [])
      ];

  const isMoreActive = moreItems.some(item => item.id === currentView);

  return (
    <>
      {/* Mobile Bottom Bar (Fixed) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0E1420]/95 backdrop-blur-md border-t border-neutral-200 dark:border-white/[0.08] lg:hidden px-2 py-1.5 flex items-center justify-around shadow-lg"
      >
        {mainItems.map(item => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            isMoreActive
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Lainnya</span>
        </button>
      </nav>

      {/* "Lainnya" Bottom Sheet Modal */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSheetOpen(false)}
            aria-hidden="true"
          />

          <div className="relative bg-white dark:bg-[#0E1420] border-t border-neutral-200 dark:border-white/[0.1] rounded-t-2xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Semua Modul &amp; Menu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                aria-label="Tutup sheet"
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pb-6">
              {moreItems.map(item => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setIsSheetOpen(false);
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300 font-semibold'
                        : 'border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-700 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/[0.08] shrink-0">
                      <Icon className={`w-4 h-4 ${active ? 'text-amber-500' : 'text-neutral-500 dark:text-slate-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[11px] text-neutral-500 dark:text-slate-400 truncate mt-0.5 font-normal">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
