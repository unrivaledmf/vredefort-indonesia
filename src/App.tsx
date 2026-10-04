import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { GlobalSearchModal } from './components/GlobalSearchModal.tsx';
import { FilePreviewModal } from './components/FilePreviewModal.tsx';
import { LoginView } from './views/LoginView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { FileManagerView } from './views/FileManagerView.tsx';
import { NotesView } from './views/NotesView.tsx';
import { ProjectsView } from './views/ProjectsView.tsx';
import { ChecklistsView } from './views/ChecklistsView.tsx';
import { KanbanView } from './views/KanbanView.tsx';
import { KnowledgeGraphView } from './views/KnowledgeGraphView.tsx';
import { TimelineView } from './views/TimelineView.tsx';
import { ReferencesView } from './views/ReferencesView.tsx';
import { AssessmentView } from './views/AssessmentView.tsx';
import { WorkspaceInfoView } from './views/WorkspaceInfoView.tsx';
import { UserManagementView } from './views/UserManagementView.tsx';
import { StorageTrashView } from './views/StorageTrashView.tsx';
import { AuditLogView } from './views/AuditLogView.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { MiningFile } from './types.ts';
import { api } from './services/api.ts';

const VALID_VIEWS = new Set([
  'dashboard',
  'files',
  'notes',
  'projects',
  'checklists',
  'kanban',
  'graph',
  'timeline',
  'references',
  'assessments',
  'workspace_info',
  'users',
  'storage_admin',
  'audit_log'
]);

function parseHash(): { view: string; targetId?: string } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) {
    return { view: 'dashboard' };
  }
  const parts = hash.split('/');
  const rawView = parts[0];
  const view = VALID_VIEWS.has(rawView) ? rawView : 'dashboard';
  const targetId = parts[1] || undefined;
  return { view, targetId };
}

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(parseHash);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vredefort_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [previewFile, setPreviewFile] = useState<MiningFile | null>(null);
  const [previewFilesList, setPreviewFilesList] = useState<MiningFile[]>([]);

  // Sync state with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(parseHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    // If no hash present, set to #/dashboard
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = useCallback((view: string, id?: string) => {
    const targetHash = id ? `#/${view}/${id}` : `#/${view}`;
    if (window.location.hash === targetHash) {
      setCurrentRoute({ view, targetId: id });
    } else {
      window.location.hash = targetHash;
    }
  }, []);

  // Guard: Guest hanya boleh buka 'files' dan 'graph'; Admin-only views dilindungi
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'guest') {
        if (currentRoute.view !== 'files' && currentRoute.view !== 'graph') {
          handleNavigate('files');
        }
        return;
      }
      const adminOnlyViews = new Set(['users', 'storage_admin', 'audit_log']);
      if (user.role !== 'admin' && adminOnlyViews.has(currentRoute.view)) {
        handleNavigate('dashboard');
      }
    }
  }, [currentRoute.view, user, isLoading, handleNavigate]);

  // Global Ctrl+K / Cmd+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('vredefort_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleOpenPreview = async (f: MiningFile, list?: MiningFile[]) => {
    setPreviewFile(f);
    if (list && list.length > 0) {
      setPreviewFilesList(list);
    } else {
      try {
        const files = await api.getFiles();
        setPreviewFilesList(files);
      } catch {}
    }
  };

  const handlePreviewFileById = async (fileId: string) => {
    try {
      const files = await api.getFiles();
      setPreviewFilesList(files);
      const target = files.find(f => f.id === fileId);
      if (target) {
        setPreviewFile(target);
      }
    } catch (err) {
      console.error('Error fetching file for preview:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500 text-sm">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo size={56} />
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Memuat Workspace VREDEFORT INDONESIA...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const { view: currentView, targetId } = currentRoute;

  return (
    <div className="min-h-screen flex bg-neutral-100 dark:bg-slate-950 text-neutral-900 dark:text-slate-100 font-sans antialiased">
      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Workspace Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentView={currentView}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleSidebar={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
          onNavigate={handleNavigate}
        />

        {/* View Port with Mobile Bottom Nav Padding */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          )}

          {currentView === 'files' && (
            <FileManagerView
              initialFileId={targetId}
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          )}

          {currentView === 'notes' && (
            <NotesView
              initialNoteId={targetId}
              onPreviewFile={handleOpenPreview}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'projects' && (
            <ProjectsView
              initialProjectId={targetId}
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'checklists' && <ChecklistsView />}

          {currentView === 'kanban' && (
            <KanbanView
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          )}

          {currentView === 'graph' && (
            <KnowledgeGraphView
              onNavigate={handleNavigate}
              onPreviewFile={handlePreviewFileById}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          )}

          {currentView === 'timeline' && <TimelineView />}

          {currentView === 'references' && (
            <ReferencesView
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          )}

          {currentView === 'assessments' && <AssessmentView />}

          {currentView === 'workspace_info' && <WorkspaceInfoView />}

          {currentView === 'users' && (user.role === 'admin' ? <UserManagementView /> : (
            <DashboardView
              onNavigate={handleNavigate}
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          ))}

          {currentView === 'storage_admin' && (user.role === 'admin' ? (
            <StorageTrashView onPreviewFile={handleOpenPreview} />
          ) : (
            <DashboardView
              onNavigate={handleNavigate}
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          ))}

          {currentView === 'audit_log' && (user.role === 'admin' ? <AuditLogView /> : (
            <DashboardView
              onNavigate={handleNavigate}
              onPreviewFile={handleOpenPreview}
              onOpenNote={nId => handleNavigate('notes', nId)}
            />
          ))}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav currentView={currentView} onNavigate={handleNavigate} />
      </div>

      {/* Global Search Dialog (Cmd+K / Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Universal File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        filesList={previewFilesList}
        onClose={() => setPreviewFile(null)}
        onOpenNote={nId => handleNavigate('notes', nId)}
        onNavigateFile={setPreviewFile}
        onFileUpdated={updated => {
          setPreviewFilesList(prev => prev.map(f => (f.id === updated.id ? updated : f)));
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
