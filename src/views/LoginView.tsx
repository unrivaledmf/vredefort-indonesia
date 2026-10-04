import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  ArrowRight,
  Sun,
  Moon,
  Eye,
  EyeOff,
  UserCheck,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { api } from '../services/api.ts';

const REMEMBER_KEY = 'vredefort_remembered_username';

export const LoginView: React.FC = () => {
  const { login, loginGuest } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [siteInfo, setSiteInfo] = useState<{
    siteName: string;
    tagline: string;
    academicYear: string;
    logoUrl: string | null;
    guestAccess: { enabled: boolean; mode: 'public' | 'code' };
  }>({
    siteName: 'VREDEFORT INDONESIA',
    tagline: 'Ruang Kerja & Perencanaan Tambang Mineral',
    academicYear: '2026/2027',
    logoUrl: null,
    guestAccess: { enabled: true, mode: 'public' }
  });

  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(() => {
    try {
      return Boolean(localStorage.getItem(REMEMBER_KEY));
    } catch {
      return false;
    }
  });

  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal Kode Akses Tamu
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getPublicSettings()
      .then(settings => {
        if (isMounted && settings) {
          setSiteInfo(settings);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setError('Nama pengguna dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      await login(trimmedUser, password);
      try {
        if (rememberUsername) {
          localStorage.setItem(REMEMBER_KEY, trimmedUser);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali nama pengguna dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestClick = async () => {
    if (siteInfo.guestAccess.mode === 'code') {
      setPasscode('');
      setPasscodeError(null);
      setShowPasscodeModal(true);
      return;
    }

    setGuestLoading(true);
    setError(null);
    try {
      await loginGuest();
    } catch (err: any) {
      setError(err.message || 'Gagal masuk sebagai tamu.');
    } finally {
      setGuestLoading(false);
    }
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setPasscodeError('Masukkan kode akses tamu.');
      return;
    }

    setGuestLoading(true);
    setPasscodeError(null);
    try {
      await loginGuest(passcode.trim());
      setShowPasscodeModal(false);
    } catch (err: any) {
      setPasscodeError(err.message || 'Kode akses tamu tidak sesuai.');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A10] text-neutral-900 dark:text-neutral-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white transition-colors relative">
      {/* Tombol Pengganti Tema */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
          className="p-2.5 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-neutral-700" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Identitas Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex mb-3">
            {siteInfo.logoUrl ? (
              <img
                src={siteInfo.logoUrl}
                alt={siteInfo.siteName}
                className="w-14 h-14 object-contain rounded-xl shadow-sm"
              />
            ) : (
              <BrandLogo size={56} />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">
            {siteInfo.siteName}
          </h1>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 font-medium">
            {siteInfo.tagline}
          </p>
        </div>

        {/* Kartu Masuk */}
        <div className="bg-white dark:bg-[#0E1420] border border-neutral-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-lg dark:shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Pengguna"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan nama pengguna"
              required
              autoFocus
              leftIcon={<User className="w-4 h-4" />}
            />

            <div>
              <Input
                label="Kata Sandi"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                required
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>

            {/* Opsi Ingat Nama Pengguna */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={rememberUsername}
                  onChange={e => setRememberUsername(e.target.checked)}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Ingat saya</span>
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-medium"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full mt-2 font-medium"
            >
              Masuk ke Sistem
            </Button>

            {/* Opsi Masuk Tamu */}
            {siteInfo.guestAccess?.enabled && (
              <div className="pt-2">
                <div className="relative flex py-1.5 items-center">
                  <div className="flex-grow border-t border-neutral-200 dark:border-white/[0.08]" />
                  <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-neutral-400">
                    atau
                  </span>
                  <div className="flex-grow border-t border-neutral-200 dark:border-white/[0.08]" />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleGuestClick}
                  loading={guestLoading}
                  leftIcon={<UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  className="w-full border-neutral-200 dark:border-white/[0.1] hover:bg-neutral-50 dark:hover:bg-white/[0.04] font-medium"
                >
                  Masuk sebagai Tamu
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Modal Masukkan Kode Akses Tamu */}
      <Modal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        title="Masukkan Kode Akses Tamu"
        description="Akses tamu memerlukan kode akses yang diterbitkan oleh administrator."
      >
        <form onSubmit={handlePasscodeSubmit} className="space-y-4 pt-2">
          <Input
            label="Kode Akses"
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            placeholder="Masukkan kode akses tamu"
            autoFocus
            required
            leftIcon={<Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          />

          {passcodeError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 font-medium">
              {passcodeError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowPasscodeModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={guestLoading}
            >
              Masuk
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
