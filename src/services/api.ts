import {
  User,
  UserSummary,
  MiningFile,
  Folder,
  Note,
  Project,
  ChecklistItem,
  Task,
  ReferenceItem,
  AssessmentItem,
  TimelineEvent,
  WorkspaceInfo,
  StorageStats,
  SearchResults,
  GraphData
} from '../types.ts';

const TOKEN_KEY = 'vredefort_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    if (endpoint === '/auth/login' || endpoint === '/auth/guest') {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Username atau password salah.');
    }
    clearStoredToken();
    window.dispatchEvent(new Event('auth_unauthorized'));
    throw new Error('Sesi telah berakhir, silakan login kembali');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await response.text();
    throw new Error(`Respon server tidak valid (${response.status}): ${rawText.slice(0, 100)}`);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Terjadi kesalahan sistem');
  }

  return data as T;
}

export const api = {
  // Public
  getPublicSettings: () =>
    request<{
      siteName: string;
      tagline: string;
      academicYear: string;
      logoUrl: string | null;
      guestAccess: { enabled: boolean; mode: 'public' | 'code' };
    }>('/public/settings'),

  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  loginGuest: (passcode?: string) =>
    request<{ token: string; user: User }>('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ passcode })
    }),

  getMe: () => request<{ user: User }>('/auth/me'),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    }),

  // Users
  getUsers: () => request<User[]>('/users'),
  getUsersSummary: () => request<UserSummary[]>('/users/summary'),
  createUser: (data: Partial<User> & { password: string }) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id: string, data: Partial<User> & { password?: string }) =>
    request<{ message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteUser: (id: string) =>
    request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE'
    }),

  // Files
  getFiles: (params?: { folderId?: string; tag?: string; acaraTag?: string; search?: string; isTrashed?: boolean; isFavorite?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.folderId) q.append('folderId', params.folderId);
    if (params?.tag) q.append('tag', params.tag);
    if (params?.acaraTag) q.append('acaraTag', params.acaraTag);
    if (params?.search) q.append('search', params.search);
    if (params?.isTrashed !== undefined) q.append('isTrashed', String(params.isTrashed));
    if (params?.isFavorite !== undefined) q.append('isFavorite', String(params.isFavorite));
    return request<MiningFile[]>(`/files?${q.toString()}`);
  },

  uploadFiles: (formData: FormData) =>
    request<MiningFile[]>('/files/upload', {
      method: 'POST',
      body: formData
    }),

  uploadFilesWithProgress: (
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<MiningFile[]> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload');
      const token = getStoredToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data as MiningFile[]);
          } catch {
            reject(new Error('Gagal memproses respon server'));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || 'Gagal mengunggah file'));
          } catch {
            reject(new Error(`Gagal mengunggah (status: ${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Koneksi terputus saat mengunggah file'));
      };

      xhr.send(formData);
    });
  },

  updateFile: (id: string, data: Partial<MiningFile>) =>
    request<MiningFile>(`/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteFile: (id: string, permanent: boolean = false) =>
    request<{ message: string }>(`/files/${id}?permanent=${permanent}`, {
      method: 'DELETE'
    }),

  restoreFile: (id: string) =>
    request<{ message: string }>(`/files/${id}/restore`, {
      method: 'POST'
    }),

  getFileContent: (id: string) =>
    request<{
      previewType: string;
      content?: string;
      rawUrl?: string;
      dataUri?: string;
      mimeType?: string;
      extension?: string;
      size?: number;
      truncated?: boolean;
    }>(`/files/${id}/content`),

  getRawFileUrl: (id: string) => {
    const token = getStoredToken();
    return `/api/files/${id}/raw${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  getDownloadUrl: (id: string) => `/api/files/${id}/download`,

  // Folders
  getFolders: () => request<Folder[]>('/folders'),
  createFolder: (name: string, parentId?: string, color?: string) =>
    request<Folder>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId, color })
    }),
  updateFolder: (id: string, name: string) =>
    request<Folder>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    }),
  deleteFolder: (id: string) =>
    request<{ message: string }>(`/folders/${id}`, {
      method: 'DELETE'
    }),

  // Notes
  getNotes: () => request<Note[]>('/notes'),
  getNote: (id: string) => request<Note>(`/notes/${id}`),
  createNote: (data: Partial<Note>) =>
    request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateNote: (id: string, data: Partial<Note>) =>
    request<Note>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteNote: (id: string) =>
    request<{ message: string }>(`/notes/${id}`, {
      method: 'DELETE'
    }),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: Partial<Project>) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateProject: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Checklists
  getChecklists: () => request<ChecklistItem[]>('/checklists'),
  createChecklist: (data: Partial<ChecklistItem>) =>
    request<ChecklistItem>('/checklists', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateChecklist: (id: string, data: Partial<ChecklistItem>) =>
    request<ChecklistItem>(`/checklists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Tasks
  getTasks: () => request<Task[]>('/tasks'),
  createTask: (data: Partial<Task>) =>
    request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTask: (id: string) =>
    request<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE'
    }),

  // References
  getReferences: () => request<ReferenceItem[]>('/references'),
  createReference: (data: Partial<ReferenceItem>) =>
    request<ReferenceItem>('/references', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateReference: (id: string, data: Partial<ReferenceItem>) =>
    request<ReferenceItem>(`/references/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteReference: (id: string) =>
    request<{ message: string }>(`/references/${id}`, {
      method: 'DELETE'
    }),

  // Assessments
  getAssessments: () => request<AssessmentItem[]>('/assessments'),
  updateAssessment: (id: string, data: Partial<AssessmentItem>) =>
    request<AssessmentItem>(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Timeline
  getTimeline: () => request<TimelineEvent[]>('/timeline'),
  createTimeline: (data: Partial<TimelineEvent>) =>
    request<TimelineEvent>('/timeline', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateTimeline: (id: string, data: Partial<TimelineEvent>) =>
    request<TimelineEvent>(`/timeline/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTimeline: (id: string) =>
    request<{ message: string }>(`/timeline/${id}`, {
      method: 'DELETE'
    }),

  // Workspace Info
  getWorkspaceInfo: () => request<WorkspaceInfo>('/workspace-info'),
  updateWorkspaceInfo: (data: Partial<WorkspaceInfo>) =>
    request<WorkspaceInfo>('/workspace-info', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  updateLogo: (data: { svgContent?: string; dataUrl?: string }) =>
    request<{ message: string; workspaceInfo: WorkspaceInfo }>('/workspace/logo', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Storage Stats
  getStorageStats: () => request<StorageStats>('/storage-stats'),

  // Search
  search: (query: string) => request<SearchResults>(`/search?q=${encodeURIComponent(query)}`),

  // Knowledge Graph
  getGraph: () => request<GraphData>('/graph')
};
