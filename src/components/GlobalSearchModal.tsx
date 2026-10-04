import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  FolderGit2,
  CheckSquare,
  BookOpen,
  X,
  ArrowRight,
  HardDrive,
  Calendar,
  Layers
} from 'lucide-react';
import { api } from '../services/api.ts';
import { SearchResults } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Badge } from './ui/Badge.tsx';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, targetId?: string) => void;
}

interface FlattenedResult {
  id: string;
  category: 'file' | 'note' | 'task' | 'reference' | 'project';
  categoryLabel: string;
  title: string;
  subtitle?: string;
  targetView: string;
  targetId: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const { user } = useAuth();
  const isGuest = user?.role === 'guest';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Flattened list for keyboard navigation
  const flatList: FlattenedResult[] = React.useMemo(() => {
    if (!results) return [];
    const list: FlattenedResult[] = [];

    if (!isGuest) {
      results.projects.forEach(p => {
        list.push({
          id: `p-${p.id}`,
          category: 'project',
          categoryLabel: 'Proyek',
          title: `${p.code}: ${p.title}`,
          subtitle: p.description,
          targetView: 'projects',
          targetId: p.id
        });
      });
    }

    results.files.forEach(f => {
      list.push({
        id: `f-${f.id}`,
        category: 'file',
        categoryLabel: 'File',
        title: f.name,
        subtitle: isGuest
          ? `${(f.size / 1024).toFixed(0)} KB · ${f.acaraTag || ''}`
          : `${(f.size / 1024).toFixed(0)} KB · @${f.uploadedBy} · ${f.acaraTag || ''}`,
        targetView: 'files',
        targetId: f.id
      });
    });

    if (!isGuest) {
      results.notes.forEach(n => {
        list.push({
          id: `n-${n.id}`,
          category: 'note',
          categoryLabel: 'Catatan',
          title: n.title,
          subtitle: `@${n.createdBy} · ${n.acaraId || ''}`,
          targetView: 'notes',
          targetId: n.id
        });
      });

      results.tasks.forEach(t => {
        list.push({
          id: `t-${t.id}`,
          category: 'task',
          categoryLabel: 'Tugas',
          title: t.title,
          subtitle: `${t.projectAcara} · PJ: @${t.assignedTo}`,
          targetView: 'kanban',
          targetId: t.id
        });
      });

      results.references.forEach(r => {
        list.push({
          id: `r-${r.id}`,
          category: 'reference',
          categoryLabel: 'Referensi',
          title: r.title,
          subtitle: `${r.author} (${r.year}) · ${r.type}`,
          targetView: 'references',
          targetId: r.id
        });
      });
    }

    return list;
  }, [results, isGuest]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Debounced Search (200ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query.trim());
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation: Arrow Up / Down, Enter, ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < flatList.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : flatList.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) {
          const item = flatList[selectedIndex];
          onNavigate(item.targetView, item.targetId);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatList, selectedIndex, onNavigate, onClose]);

  if (!isOpen) return null;

  // Highlight matching keyword
  const highlightMatch = (text: string, term: string) => {
    if (!term.trim()) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark
              key={i}
              className="bg-amber-500/30 text-amber-900 dark:text-amber-200 rounded px-0.5"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const getCategoryIcon = (cat: FlattenedResult['category']) => {
    switch (cat) {
      case 'project':
        return <FolderGit2 className="w-4 h-4 text-amber-500" />;
      case 'file':
        return <HardDrive className="w-4 h-4 text-emerald-500" />;
      case 'note':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-purple-500" />;
      case 'reference':
        return <BookOpen className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-100"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#0E1420] border border-neutral-200 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-200 dark:border-white/[0.08] gap-3">
          <Search className="w-5 h-5 text-neutral-400 dark:text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari file, catatan, tugas, Acara proyek, atau referensi..."
            className="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/[0.08] rounded">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-1">
          {loading && (
            <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Mencari di seluruh modul VREDEFORT...
            </div>
          )}

          {!loading && query && flatList.length === 0 && (
            <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Tidak ditemukan hasil untuk{' '}
              <span className="font-semibold text-neutral-800 dark:text-white">"{query}"</span>
            </div>
          )}

          {!query && (
            <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
              <p className="font-medium">Ketik kata kunci untuk mencari di seluruh workspace</p>
              <p className="text-[11px] text-neutral-400">
                Gunakan panah <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-white/[0.05] text-[10px] ">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-white/[0.05] text-[10px] ">↓</kbd> dan{' '}
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-white/[0.05] text-[10px] ">Enter</kbd> untuk membuka cepat.
              </p>
            </div>
          )}

          {!loading && flatList.length > 0 && (
            <div className="space-y-1">
              {flatList.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.targetView, item.targetId);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 text-neutral-900 dark:text-white border border-amber-500/30'
                        : 'hover:bg-neutral-50 dark:hover:bg-white/[0.03] text-neutral-800 dark:text-neutral-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-neutral-100 dark:bg-white/[0.05] shrink-0">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">
                            {highlightMatch(item.title, query)}
                          </span>
                          <Badge variant="outline" size="sm" className="text-[10px] py-0 px-1.5">
                            {item.categoryLabel}
                          </Badge>
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5 ">
                            {highlightMatch(item.subtitle, query)}
                          </div>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-400 shrink-0 ml-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
