export type Role = 'admin' | 'member' | 'guest';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  avatar: string;
  lastLogin: string;
  mustChangePassword?: boolean;
  activityCount?: number;
  activity?: Array<{ id: string; action: string; details: string; timestamp: string }>;
}

export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  avatar: string;
}

export interface MiningFile {
  id: string;
  name: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: number;
  uploadedBy: string;
  folderId?: string;
  tags: string[];
  description: string;
  linkedNoteIds: string[];
  linkedProjectIds: string[];
  acaraTag?: string;
  isFavorite: boolean;
  isTrashed: boolean;
  visibleToGuest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  visibleToGuest?: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  acaraId?: string;
  tags: string[];
  linkedFileIds: string[];
  linkedProjectIds: string[];
  isPinned: boolean;
  isFavorite: boolean;
  visibleToGuest?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  code: string;
  title: string;
  acaraTag: string;
  description: string;
  status: 'planning' | 'in_progress' | 'review' | 'completed';
  progress: number;
  deadline: string;
  leader: string;
  members: string[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  acaraId: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
  fileId?: string;
  notes?: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
  projectAcara: string;
  linkedFileId?: string;
  linkedNoteId?: string;
  dueDate: string;
  createdAt: string;
}

export interface ReferenceItem {
  id: string;
  title: string;
  author: string;
  year: number;
  type: 'Kepmen/Peraturan' | 'Jurnal' | 'Buku' | 'Laporan' | 'Standar/SNI' | 'Website' | 'Diktat Kuliah';
  source: string;
  url?: string;
  tags: string[];
  fileId?: string;
  notes: string;
  visibleToGuest?: boolean;
}

export interface AssessmentItem {
  id: string;
  category: 'Presentasi Kelompok' | 'Laporan Kelompok' | 'Laporan Individu';
  targetUser?: string;
  acara: string;
  score: number;
  maxScore: number;
  weight: number;
  evaluator: string;
  feedback: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  period: string;
  dateRange: string;
  category: 'kuliah' | 'kkn' | 'presentasi' | 'pengumpulan' | 'evaluasi';
  description: string;
  isMilestone: boolean;
}

export interface WorkspaceInfo {
  subjectName: string;
  academicYear: string;
  tagline: string;
  groupNumber: string;
  members: Array<{ username: string; name: string; nim: string; role: string }>;
  workDurationPerAcara: string;
  presentationRequirements: string[];
  attendanceRule: string;
  labPcScheduleStatus: string;
  updatedAt: string;
  customLogoSvg?: string;
  customLogoUrl?: string;
}

export interface GuestAccessSettings {
  enabled: boolean;
  mode: 'public' | 'code';
  codeHash?: string;
  expiresAt?: string;
  maxDownloadSizeMb: number;
  rateLimitPerHour: number;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  academicYear: string;
  accentColor: string;
  guestAccess: GuestAccessSettings;
  categories: string[];
  acaraList: Array<{ code: string; label: string }>;
}

export interface PublicSiteSettings {
  siteName: string;
  tagline: string;
  academicYear: string;
  accentColor: string;
  customLogoSvg?: string;
  customLogoUrl?: string;
  guestAccess: {
    enabled: boolean;
    mode: 'public' | 'code';
  };
}

export interface Submission {
  id: string;
  type: string;
  action: 'create' | 'update' | 'delete';
  targetType: 'file' | 'reference' | 'note' | 'task' | 'checklist' | 'screenshot';
  targetId?: string;
  payload: any;
  attachments?: Array<{ name: string; url: string; size: number; mimeType: string }>;
  status: 'pending' | 'approved' | 'rejected' | 'revision';
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface StorageStats {
  totalCapacityBytes: number;
  usedBytes: number;
  freeBytes: number;
  percentUsed: number;
  isWarning: boolean;
  isCritical: boolean;
  categories: Record<string, { bytes: number; count: number }>;
  largestFiles: Array<{
    id: string;
    name: string;
    size: number;
    extension: string;
    uploadedBy: string;
    createdAt: string;
  }>;
}

export interface SearchResults {
  files: MiningFile[];
  notes: Note[];
  tasks: Task[];
  references: ReferenceItem[];
  projects: Project[];
}

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: 'project' | 'note' | 'file' | 'task' | 'reference';
    color: string;
    radius: number;
    targetId: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    label?: string;
  }>;
}
