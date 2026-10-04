import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  User,
  Clock,
  Shield,
  FileText,
  AlertTriangle,
  FolderGit2,
  Trash2,
  Key
} from 'lucide-react';
import { api } from '../services/api.ts';
import { User as UserType } from '../types.ts';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Select } from '../components/ui/Select.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

interface AuditItem {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
}

export const AuditLogView: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError(err.message || 'Gagal memuat log audit aktivitas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate all user activities
  const allActivities = useMemo(() => {
    const list: AuditItem[] = [];
    users.forEach(u => {
      if (u.activity && Array.isArray(u.activity)) {
        u.activity.forEach(act => {
          list.push({
            id: act.id,
            username: u.username,
            fullName: u.fullName,
            avatar: u.avatar || u.username.slice(0, 2).toUpperCase(),
            role: u.role,
            action: act.action,
            details: act.details,
            timestamp: act.timestamp
          });
        });
      }
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [users]);

  // Filtered
  const filteredActivities = useMemo(() => {
    return allActivities.filter(item => {
      if (selectedUserFilter !== 'all' && item.username.toLowerCase() !== selectedUserFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAction = item.action.toLowerCase().includes(q);
        const matchDetails = item.details.toLowerCase().includes(q);
        const matchUser = item.username.toLowerCase().includes(q) || item.fullName.toLowerCase().includes(q);
        if (!matchAction && !matchDetails && !matchUser) return false;
      }
      return true;
    });
  }, [allActivities, selectedUserFilter, searchQuery]);

  const getActionBadge = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('hapus')) return <Badge variant="danger" size="sm">{action.toUpperCase()}</Badge>;
    if (a.includes('tambah') || a.includes('buat')) return <Badge variant="success" size="sm">{action.toUpperCase()}</Badge>;
    if (a.includes('ubah') || a.includes('update') || a.includes('edit')) return <Badge variant="accent" size="sm">{action.toUpperCase()}</Badge>;
    if (a.includes('reset') || a.includes('password') || a.includes('peran')) return <Badge variant="warning" size="sm">{action.toUpperCase()}</Badge>;
    if (a.includes('login') || a.includes('masuk')) return <Badge variant="info" size="sm">{action.toUpperCase()}</Badge>;
    return <Badge variant="default" size="sm">{action.toUpperCase()}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-500/20 text-red-600 dark:text-red-400 ">
              SECURITY AUDIT
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Log Jejak Aktivitas</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Log Aktivitas &amp; Keamanan
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Rekam jejak tindakan otorisasi, penambahan file, pengubahan data tambang, dan modifikasi pengguna.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          aria-label="Segarkan log aktivitas"
        >
          Segarkan Log
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Cari aksi, rincian aktivitas, atau nama anggota..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="text-xs"
          />
        </div>

        <div className="w-56">
          <Select
            value={selectedUserFilter}
            onChange={e => setSelectedUserFilter(e.target.value)}
            className="text-xs"
          >
            <option value="all">Semua Pengguna</option>
            {users.map(u => (
              <option key={u.id} value={u.username}>
                @{u.username} · {u.fullName}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2">
              <Skeleton width="30%" height={16} />
              <Skeleton width="70%" height={14} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Log"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-neutral-400" />}
          title="Tidak Ada Aktivitas Ditemukan"
          description={searchQuery ? 'Tidak ada rekaman log yang cocok dengan kriteria pencarian.' : 'Belum ada catatan aktivitas dalam sistem.'}
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] overflow-hidden shadow-xs divide-y divide-neutral-100 dark:divide-white/[0.05]">
          {filteredActivities.map(item => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  {item.avatar}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {item.fullName}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      @{item.username}
                    </span>
                    {getActionBadge(item.action)}
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {item.details}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 shrink-0 self-end sm:self-start mt-1 sm:mt-0">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>{new Date(item.timestamp).toLocaleString('id-ID')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
