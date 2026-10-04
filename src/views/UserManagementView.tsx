import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Clock,
  Activity,
  CheckCircle2,
  X,
  Lock,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Pencil,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.ts';
import { User } from '../types.ts';
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

export const UserManagementView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUserActivities, setSelectedUserActivities] = useState<User | null>(null);

  // New user form fields
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [newPassword, setNewPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Edit Name modal
  const [editNameTargetUser, setEditNameTargetUser] = useState<User | null>(null);
  const [editFullNameInput, setEditFullNameInput] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Password reset modal
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  // Delete user confirm dialog
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'Gagal memuat data pengguna.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim() || !newPassword.trim()) return;

    setCreatingUser(true);
    try {
      await api.createUser({
        username: newUsername.trim().toLowerCase(),
        fullName: newFullName.trim(),
        role: newRole,
        password: newPassword.trim()
      });
      toast.success('Pengguna Ditambahkan', `@${newUsername}`);
      setShowAddUserModal(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      await loadUsers();
    } catch (err: any) {
      toast.error('Gagal Menambah Pengguna', err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateFullName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNameTargetUser || !editFullNameInput.trim()) return;

    setIsUpdatingName(true);
    try {
      await api.updateUser(editNameTargetUser.id, { fullName: editFullNameInput.trim() });
      setUsers(prev =>
        prev.map(u => (u.id === editNameTargetUser.id ? { ...u, fullName: editFullNameInput.trim() } : u))
      );
      toast.success('Nama Pengguna Diperbarui', editFullNameInput.trim());
      setEditNameTargetUser(null);
    } catch (err: any) {
      toast.error('Gagal Memperbarui Nama', err.message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordInput.trim()) return;

    setResettingPwd(true);
    try {
      await api.updateUser(resetTargetUser.id, { password: resetPasswordInput.trim() });
      toast.success('Password Direset', `Password untuk @${resetTargetUser.username} berhasil diubah.`);
      setResetTargetUser(null);
      setResetPasswordInput('');
    } catch (err: any) {
      toast.error('Gagal Reset Password', err.message);
    } finally {
      setResettingPwd(false);
    }
  };

  const handleToggleRole = async (targetUser: User) => {
    const nextRole = targetUser.role === 'admin' ? 'member' : 'admin';
    try {
      await api.updateUser(targetUser.id, { role: nextRole });
      setUsers(prev =>
        prev.map(u => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
      );
      toast.success('Role Diperbarui', `@${targetUser.username} sekarang menjadi ${nextRole.toUpperCase()}`);
    } catch (err: any) {
      toast.error('Gagal Mengubah Role', err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingUser(true);
    try {
      await api.deleteUser(deleteTargetUser.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTargetUser.id));
      toast.success('Pengguna Dihapus', `@${deleteTargetUser.username}`);
      setDeleteTargetUser(null);
    } catch (err: any) {
      toast.error('Gagal Menghapus Pengguna', err.message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-500/20 text-red-600 dark:text-red-400 ">
              ADMIN ACCESS
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Kontrol Akun Mahasiswa</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Kelola Pengguna &amp; Aktivitas
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Pengaturan akun anggota kelompok, hak akses admin, reset kredensial, dan rekam jejak aktivitas.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddUserModal(true)}
          leftIcon={<UserPlus className="w-4 h-4" />}
          aria-label="Tambah Anggota"
        >
          Tambah Anggota
        </Button>
      </div>

      {loading ? (
        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between p-3">
              <Skeleton width="30%" height={20} />
              <Skeleton width="20%" height={20} />
              <Skeleton width="15%" height={20} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Pengguna"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadUsers} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile Card List (< md) */}
          <div className="block md:hidden space-y-3">
            {users.map(u => {
              const isCurrent = currentUser?.id === u.id;

              return (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {u.avatar || u.username.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                          {u.fullName}
                        </h4>
                        <span className="text-xs text-neutral-500 block">
                          @{u.username}
                        </span>
                      </div>
                    </div>
                    <Badge variant={u.role === 'admin' ? 'danger' : 'default'} size="sm">
                      {u.role.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-white/[0.04]">
                    <span>Login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('id-ID') : 'Belum pernah'}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserActivities(u)}
                      className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold"
                    >
                      <Activity className="w-3 h-3" />
                      {u.activity?.length || u.activityCount || 0} Aksi
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 dark:border-white/[0.04]">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditNameTargetUser(u);
                        setEditFullNameInput(u.fullName);
                      }}
                      leftIcon={<Pencil className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      Edit Nama
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setResetTargetUser(u)}
                      leftIcon={<Key className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      Reset Password
                    </Button>

                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRole(u)}
                        className="text-xs col-span-1"
                      >
                        Jadikan {u.role === 'admin' ? 'Member' : 'Admin'}
                      </Button>
                    )}

                    {!isCurrent && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTargetUser(u)}
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        className="text-xs col-span-1"
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="p-4">Pengguna</th>
                    <th className="p-4">Nama Lengkap</th>
                    <th className="p-4">Peran (Role)</th>
                    <th className="p-4">Login Terakhir</th>
                    <th className="p-4 text-center">Aktivitas</th>
                    <th className="p-4 text-right">Aksi Akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
                  {users.map(u => {
                    const isCurrent = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {u.avatar || u.username.slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-bold text-neutral-900 dark:text-white block">
                                @{u.username}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  (Akun Anda)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-4 font-medium text-neutral-800 dark:text-neutral-200">
                          {u.fullName}
                        </td>

                        <td className="p-4">
                          <Badge variant={u.role === 'admin' ? 'danger' : 'default'} size="sm">
                            {u.role.toUpperCase()}
                          </Badge>
                        </td>

                        <td className="p-4 text-neutral-500 text-[11px]">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString('id-ID') : 'Belum pernah'}
                        </td>

                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedUserActivities(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-white/[0.04] text-[11px] text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                            aria-label={`Riwayat aktivitas @${u.username}`}
                          >
                            <Activity className="w-3.5 h-3.5 text-amber-500" />
                            <span>{u.activity?.length || u.activityCount || 0} Aksi</span>
                          </button>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditNameTargetUser(u);
                                setEditFullNameInput(u.fullName);
                              }}
                              leftIcon={<Pencil className="w-3 h-3" />}
                              aria-label={`Edit nama @${u.username}`}
                            >
                              Edit Nama
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setResetTargetUser(u)}
                              leftIcon={<Key className="w-3 h-3" />}
                              aria-label={`Reset password @${u.username}`}
                            >
                              Reset
                            </Button>

                            {!isCurrent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleRole(u)}
                                aria-label={`Ubah peran @${u.username}`}
                              >
                                {u.role === 'admin' ? 'Member' : 'Admin'}
                              </Button>
                            )}

                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetUser(u)}
                                title="Hapus Pengguna"
                                aria-label={`Hapus pengguna @${u.username}`}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        </>
      )}

      {/* Edit Name Modal */}
      <Modal
        isOpen={Boolean(editNameTargetUser)}
        onClose={() => setEditNameTargetUser(null)}
        title="Edit Nama Pengguna"
        description={editNameTargetUser ? `Perbarui nama lengkap untuk @${editNameTargetUser.username}` : undefined}
        size="sm"
      >
        <form onSubmit={handleUpdateFullName} className="space-y-4">
          <Input
            label="Nama Lengkap"
            value={editFullNameInput}
            onChange={e => setEditFullNameInput(e.target.value)}
            maxLength={100}
            required
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditNameTargetUser(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isUpdatingName}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title="Tambah Akun Anggota"
        description="Buat akun login baru untuk mahasiswa atau tim kerja."
        size="sm"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Username"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Contoh: arif"
            required
            autoFocus
          />

          <Input
            label="Nama Lengkap &amp; Gelar"
            value={newFullName}
            onChange={e => setNewFullName(e.target.value)}
            placeholder="Contoh: Muhammad Arif, S.T."
            required
          />

          <Select
            label="Hak Akses (Role)"
            value={newRole}
            onChange={e => setNewRole(e.target.value as any)}
          >
            <option value="member">Member (Akses Workspace Penuh)</option>
            <option value="admin">Admin (Ketua / Administrator Tim)</option>
          </Select>

          <Input
            label="Password Awal"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddUserModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creatingUser}>
              Buat Akun
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={Boolean(resetTargetUser)}
        onClose={() => setResetTargetUser(null)}
        title="Reset Password Akun"
        description={resetTargetUser ? `Atur ulang password untuk @${resetTargetUser.username}` : undefined}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="Password Baru"
            type="password"
            value={resetPasswordInput}
            onChange={e => setResetPasswordInput(e.target.value)}
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setResetTargetUser(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={resettingPwd}>
              Terapkan Password Baru
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetUser)}
        onClose={() => setDeleteTargetUser(null)}
        onConfirm={handleDeleteUser}
        title="Hapus Pengguna"
        message={
          deleteTargetUser
            ? `Apakah Anda yakin ingin menghapus akun @${deleteTargetUser.username} (${deleteTargetUser.fullName})? Tugas yang ditugaskan ke pengguna ini akan dilepaskan (tanpa PIC) dan tidak akan ikut terhapus.`
            : ''
        }
        confirmText={isDeletingUser ? 'Menghapus...' : 'Hapus Pengguna'}
        variant="danger"
      />

      {/* Activity History Modal */}
      <Modal
        isOpen={Boolean(selectedUserActivities)}
        onClose={() => setSelectedUserActivities(null)}
        title={selectedUserActivities ? `Riwayat Aktivitas @${selectedUserActivities.username}` : 'Riwayat Aktivitas'}
        description="Log rekaman aksi pengunggahan file, perubahan catatan, dan penugasan."
        size="md"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {!selectedUserActivities?.activity || selectedUserActivities.activity.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-6 h-6 text-neutral-400" />}
              title="Belum Ada Rekaman Aktivitas"
              description="Pengguna ini belum memiliki riwayat aksi tercatat."
            />
          ) : (
            selectedUserActivities.activity.map(act => (
              <div
                key={act.id}
                className="p-3 rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white block">
                    {act.action}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px] block mt-0.5">
                    {act.details}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 shrink-0">
                  {new Date(act.timestamp).toLocaleString('id-ID')}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
