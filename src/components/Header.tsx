import React, { useState } from 'react';
import { Search, Sun, Moon, LogOut, Key, Shield, Menu } from 'lucide-react';
import { BrandLogo } from './BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { api } from '../services/api.ts';
import { Modal } from './ui/Modal.tsx';
import { Button } from './ui/Button.tsx';
import { Input } from './ui/Input.tsx';

interface HeaderProps {
  currentView: string;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenSearch,
  onToggleSidebar,
  onNavigate
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ text: string; error: boolean } | null>(null);

  const getBreadcrumbTitle = (view: string) => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'files': return 'Penyimpanan File';
      case 'notes': return 'Catatan Teknis';
      case 'projects': return 'Perencanaan Tambang';
      case 'checklists': return 'Daftar Periksa Deliverables';
      case 'kanban': return 'Papan Tugas Tim';
      case 'graph': return 'Peta Keterkaitan';
      case 'timeline': return 'Timeline & Jadwal';
      case 'references': return 'Pustaka Referensi';
      case 'assessments': return 'Penilaian & Evaluasi';
      case 'workspace_info': return 'Informasi Workspace';
      case 'users': return 'Kelola Pengguna & Aktivitas';
      case 'storage_admin': return 'Penyimpanan & Sampah';
      case 'audit_log': return 'Log Aktivitas';
      default: return 'Workspace';
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    setLoadingPwd(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPwdMsg({ text: 'Password berhasil diperbarui', error: false });
      setTimeout(() => {
        setShowPasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setPwdMsg(null);
      }, 1200);
    } catch (err: any) {
      setPwdMsg({ text: err.message || 'Gagal mengubah password', error: true });
    } finally {
      setLoadingPwd(false);
    }
  };

  return (
    <>
      <header className="h-14 px-4 sm:px-6 border-b border-neutral-200 dark:border-white/[0.08] bg-white/80 dark:bg-[#0B0F17]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 transition-colors">
        {/* Zone 1: Sidebar Toggle & Context Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-neutral-600 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 shrink-0"
            aria-label="Toggle menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo hidden below sm */}
          <div className="hidden sm:block lg:hidden shrink-0">
            <BrandLogo size={26} />
          </div>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-semibold text-neutral-900 dark:text-white tracking-tight truncate">
              {getBreadcrumbTitle(currentView)}
            </span>
            <span className="text-neutral-400 dark:text-slate-600 hidden xs:inline">/</span>
            <span className="hidden sm:inline text-neutral-500 dark:text-slate-400 text-[11px] shrink-0">
              TA 2026/2027
            </span>
          </div>
        </div>

        {/* Zone 2: Global Search Trigger Button */}
        {/* Mobile search icon button */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Cari data di workspace"
          className="p-2 rounded-lg text-neutral-500 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors sm:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Desktop search bar button */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Cari data di workspace"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 w-44 md:w-80 rounded-lg bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] text-xs text-neutral-500 dark:text-slate-400 hover:border-neutral-400 dark:hover:border-white/20 transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-slate-500 shrink-0" />
          <span className="truncate flex-1 text-left text-xs font-sans">Cari file, catatan, atau data...</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded text-neutral-500 dark:text-slate-400">
            Ctrl K
          </kbd>
        </button>

        {/* Zone 3: Actions & Account Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-neutral-500 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-600" />
            )}
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              aria-label="Menu akun pengguna"
              aria-expanded={profileDropdownOpen}
              className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2 sm:pr-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/[0.08] hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="relative shrink-0">
                <div className="w-6 h-6 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-bold text-[10px] tracking-wider">
                  {user?.avatar || 'US'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0B0F17]" />
              </div>
              <span className="hidden sm:inline text-xs font-medium text-neutral-800 dark:text-slate-200 truncate max-w-[80px]">
                {user?.username}
              </span>
              {user?.role === 'guest' ? (
                <span className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Tamu
                </span>
              ) : user?.role === 'admin' ? (
                <span className="hidden md:inline text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase">
                  (Admin)
                </span>
              ) : null}
            </button>

            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#111827] border border-neutral-200 dark:border-white/[0.08] shadow-2xl z-50 p-2 text-xs divide-y divide-neutral-100 dark:divide-white/[0.06] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2.5">
                    <div className="font-semibold text-neutral-900 dark:text-white">{user?.fullName}</div>
                    <div className="text-neutral-500 dark:text-slate-400 text-[11px] mt-0.5">
                      @{user?.username} · {user?.role.toUpperCase()}
                    </div>
                  </div>

                  <div className="py-1">
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('users');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-700 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-neutral-500" />
                        Kelola Pengguna
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-700 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-neutral-500" />
                      Ubah Kata Sandi
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar Akun
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Modal Ubah Kata Sandi */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPwdMsg(null);
        }}
        title="Ganti Kata Sandi"
        description="Amankan akun Anda dengan kata sandi baru yang kuat."
        size="sm"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            label="Kata Sandi Saat Ini"
            type="password"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            required
            placeholder="Masukkan kata sandi saat ini"
          />

          <Input
            label="Kata Sandi Baru"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Minimal 6 karakter"
          />

          {pwdMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs font-medium ${
                pwdMsg.error ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              {pwdMsg.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPasswordModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={loadingPwd}
            >
              Simpan Kata Sandi
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
