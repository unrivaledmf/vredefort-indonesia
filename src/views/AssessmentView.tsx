import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Award,
  Edit,
  Save,
  CheckCircle2,
  FileCheck,
  User,
  Users,
  MessageSquare,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { api } from '../services/api.ts';
import { AssessmentItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ProgressBar } from '../components/ui/ProgressBar.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Textarea } from '../components/ui/Textarea.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

export const AssessmentView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [editingItem, setEditingItem] = useState<AssessmentItem | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [editFeedback, setEditFeedback] = useState<string>('');
  const [editEvaluator, setEditEvaluator] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const isAdminOrEvaluator = user?.role === 'admin';

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAssessments();
      setAssessments(data);
    } catch (err: any) {
      console.error('Assessment load error:', err);
      setError(err.message || 'Gagal memuat data penilaian.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  const handleStartEdit = (item: AssessmentItem) => {
    if (!isAdminOrEvaluator) return;
    setEditingItem(item);
    setEditScore(item.score);
    setEditFeedback(item.feedback || '');
    setEditEvaluator(item.evaluator || user?.fullName || 'Tim Evaluator');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingEdit(true);
    try {
      const updated = await api.updateAssessment(editingItem.id, {
        score: Number(editScore),
        feedback: editFeedback.trim(),
        evaluator: editEvaluator.trim()
      });
      setAssessments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      toast.success('Nilai Disimpan', `${editingItem.acara} (${editingItem.category})`);
      setEditingItem(null);
    } catch (err: any) {
      toast.error('Gagal Menyimpan Nilai', err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Group by Category
  const categories = useMemo(() => {
    const presentasi = assessments.filter(a => a.category === 'Presentasi Kelompok');
    const lapKelompok = assessments.filter(a => a.category === 'Laporan Kelompok');
    const lapIndividu = assessments.filter(a => a.category === 'Laporan Individu');

    const getAvg = (list: AssessmentItem[]) =>
      list.length > 0 ? Math.round(list.reduce((acc, curr) => acc + curr.score, 0) / list.length) : 0;

    return {
      presentasi: { items: presentasi, avg: getAvg(presentasi), weight: 30 },
      lapKelompok: { items: lapKelompok, avg: getAvg(lapKelompok), weight: 40 },
      lapIndividu: { items: lapIndividu, avg: getAvg(lapIndividu), weight: 30 }
    };
  }, [assessments]);

  // Overall Weighted Score
  const totalWeightedScore = useMemo(() => {
    if (assessments.length === 0) return 0;
    const { presentasi, lapKelompok, lapIndividu } = categories;
    const score =
      (presentasi.avg * presentasi.weight +
        lapKelompok.avg * lapKelompok.weight +
        lapIndividu.avg * lapIndividu.weight) /
      100;
    return Math.round(score * 10) / 10;
  }, [categories, assessments]);

  const getGrade = (score: number) => {
    if (score >= 85) return { letter: 'A', variant: 'success' as const };
    if (score >= 80) return { letter: 'A-', variant: 'success' as const };
    if (score >= 75) return { letter: 'B+', variant: 'accent' as const };
    if (score >= 70) return { letter: 'B', variant: 'accent' as const };
    if (score >= 65) return { letter: 'B-', variant: 'warning' as const };
    return { letter: 'C', variant: 'danger' as const };
  };

  const finalGrade = getGrade(totalWeightedScore);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 ">
              EVALUASI AKADEMIK
            </span>
            <span className="text-xs text-neutral-400">·</span>
            <span className="text-xs text-neutral-500 ">Perencanaan Tambang 2026/2027</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Penilaian &amp; Evaluasi
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Evaluasi capaian presentasi mingguan, draf laporan komprehensif, dan kontribusi individu.
          </p>
        </div>

        {/* Weighted Score Aggregate Box */}
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] shadow-xs flex items-center gap-5 shrink-0">
          <div className="text-right">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
              Skor Tertimbang Total
            </span>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {totalWeightedScore} <span className="text-xs font-normal text-neutral-400">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <Badge variant={finalGrade.variant} size="md" className="text-sm font-bold px-3 py-1">
              GRADE {finalGrade.letter}
            </Badge>
          </div>
        </div>
      </div>

      {/* KPI Cards: 3 Categories Summary & CSS Bar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Presentasi Kelompok</span>
            <span className="text-amber-500 font-bold">Bobot 30%</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {categories.presentasi.avg} <span className="text-xs font-normal text-neutral-400">/ 100</span>
          </div>
          <ProgressBar value={categories.presentasi.avg} max={100} size="sm" variant="accent" />
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Laporan Kelompok</span>
            <span className="text-emerald-500 font-bold">Bobot 40%</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {categories.lapKelompok.avg} <span className="text-xs font-normal text-neutral-400">/ 100</span>
          </div>
          <ProgressBar value={categories.lapKelompok.avg} max={100} size="sm" variant="success" />
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Laporan Individu</span>
            <span className="text-blue-500 font-bold">Bobot 30%</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {categories.lapIndividu.avg} <span className="text-xs font-normal text-neutral-400">/ 100</span>
          </div>
          <ProgressBar value={categories.lapIndividu.avg} max={100} size="sm" variant="default" />
        </div>
      </div>

      {/* SVG Bar Chart Comparison */}
      <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Distribusi Nilai Per Kategori
          </h3>
          {!isAdminOrEvaluator && (
            <span className="text-[11px] text-neutral-400 flex items-center gap-1 ">
              <Lock className="w-3 h-3" /> Mode Hanya Baca (Member)
            </span>
          )}
        </div>

        {/* Responsive HTML Bar Chart */}
        <div className="space-y-4 pt-1">
          {/* Bar 1: Presentasi */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Presentasi Kelompok <span className="text-neutral-400 ">(Bobot 30%)</span>
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {categories.presentasi.avg} <span className="text-neutral-400 font-normal">/ 100</span>
              </span>
            </div>
            <div className="w-full h-3.5 bg-neutral-100 dark:bg-white/[0.06] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, categories.presentasi.avg))}%` }}
              />
            </div>
          </div>

          {/* Bar 2: Laporan Kelompok */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Laporan Kelompok <span className="text-neutral-400 ">(Bobot 40%)</span>
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {categories.lapKelompok.avg} <span className="text-neutral-400 font-normal">/ 100</span>
              </span>
            </div>
            <div className="w-full h-3.5 bg-neutral-100 dark:bg-white/[0.06] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, categories.lapKelompok.avg))}%` }}
              />
            </div>
          </div>

          {/* Bar 3: Laporan Individu */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Laporan Individu <span className="text-neutral-400 ">(Bobot 30%)</span>
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {categories.lapIndividu.avg} <span className="text-neutral-400 font-normal">/ 100</span>
              </span>
            </div>
            <div className="w-full h-3.5 bg-neutral-100 dark:bg-white/[0.06] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, categories.lapIndividu.avg))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Table & Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] space-y-2">
              <Skeleton width="40%" height={16} />
              <Skeleton width="90%" height={12} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Gagal Memuat Penilaian"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={loadAssessments} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Coba Lagi
            </Button>
          }
        />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={<Award className="w-8 h-8 text-neutral-400" />}
          title="Belum Ada Nilai Tersimpan"
          description="Data evaluasi tim penilai atau asisten laboratorium belum diunggah."
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1420] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="p-3.5">Acara / Modul</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5">Target Mahasiswa</th>
                  <th className="p-3.5 text-center">Skor</th>
                  <th className="p-3.5 text-center">Grade</th>
                  <th className="p-3.5">Catatan Evaluator</th>
                  {isAdminOrEvaluator && <th className="p-3.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
                {assessments.map(item => {
                  const grade = getGrade(item.score);

                  return (
                    <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-semibold text-neutral-900 dark:text-white">
                        {item.acara}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" size="sm">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-neutral-600 dark:text-neutral-400">
                        {item.targetUser ? `@${item.targetUser}` : 'Seluruh Tim'}
                      </td>
                      <td className="p-3.5 text-center font-bold text-sm text-neutral-900 dark:text-white">
                        {item.score}
                      </td>
                      <td className="p-3.5 text-center">
                        <Badge variant={grade.variant} size="sm">
                          {grade.letter}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                        {item.feedback || '-'}
                      </td>
                      {isAdminOrEvaluator && (
                        <td className="p-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(item)}
                            leftIcon={<Edit className="w-3.5 h-3.5" />}
                          >
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Score Modal (Admin/Evaluator only) */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Ubah Nilai &amp; Feedback"
        description={editingItem ? `${editingItem.acara} · ${editingItem.category}` : undefined}
        size="sm"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Skor Nilai (0 - 100)"
            type="number"
            min={0}
            max={100}
            value={editScore}
            onChange={e => setEditScore(Number(e.target.value))}
            required
            autoFocus
          />

          <Input
            label="Nama Evaluator / Penilai"
            value={editEvaluator}
            onChange={e => setEditEvaluator(e.target.value)}
            placeholder="Tim Evaluator"
            required
          />

          <Textarea
            label="Catatan &amp; Feedback Evaluasi"
            value={editFeedback}
            onChange={e => setEditFeedback(e.target.value)}
            rows={3}
            placeholder="Komentar kekurangan analisis, saran optimasi lereng jenjang..."
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingItem(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={savingEdit}>
              Simpan Nilai
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
