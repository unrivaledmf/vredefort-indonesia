import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from './auth.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

const CURRENT_SCHEMA_VERSION = 2;

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'member';
  passwordHash: string;
  salt: string;
  avatar: string;
  lastLogin: string;
  createdAt: string;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  activity: Array<{ id: string; action: string; details: string; timestamp: string }>;
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
  codeSalt?: string;
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

export interface DatabaseSchema {
  schemaVersion: number;
  users: User[];
  files: MiningFile[];
  folders: Folder[];
  notes: Note[];
  projects: Project[];
  checklists: ChecklistItem[];
  tasks: Task[];
  references: ReferenceItem[];
  assessments: AssessmentItem[];
  timeline: TimelineEvent[];
  workspaceInfo: WorkspaceInfo;
  siteSettings: SiteSettings;
  submissions: Submission[];
}

let db: DatabaseSchema;
let saveDebounceTimer: NodeJS.Timeout | null = null;
let pendingSave = false;

export function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

// Schema migration handler (idempotent & safe)
function runMigrations(raw: any): DatabaseSchema {
  const version = raw.schemaVersion || 0;

  if (version < 1) {
    raw.schemaVersion = 1;
    if (Array.isArray(raw.users)) {
      raw.users.forEach((u: any) => {
        if (u.tokenVersion === undefined) u.tokenVersion = 1;
        if (u.mustChangePassword === undefined) u.mustChangePassword = false;
      });
    }
  }

  if (version < 2) {
    raw.schemaVersion = 2;

    // Initialize siteSettings if not present
    if (!raw.siteSettings) {
      raw.siteSettings = {
        siteName: raw.workspaceInfo?.subjectName || 'VREDEFORT INDONESIA',
        tagline: raw.workspaceInfo?.tagline || 'Mining Knowledge, Files & Planning Workspace',
        academicYear: raw.workspaceInfo?.academicYear || '2026/2027',
        accentColor: '#f59e0b',
        guestAccess: {
          enabled: true,
          mode: 'public',
          maxDownloadSizeMb: 150,
          rateLimitPerHour: 60
        },
        categories: [
          'Presentasi Kelompok',
          'Laporan Kelompok',
          'Laporan Individu',
          'Penyaliran Tambang',
          'Model Blok Geologi',
          'Geoteknik Lereng',
          'Studi Kelayakan & AIT'
        ],
        acaraList: [
          { code: 'Acara 1', label: 'Acara 1 · Block Model' },
          { code: 'Acara 2', label: 'Acara 2 · Pit & Disposal' },
          { code: 'Acara 3', label: 'Acara 3 · Penjadwalan' },
          { code: 'Acara 4', label: 'Acara 4 · Hidrologi' },
          { code: 'Acara 5', label: 'Acara 5 · Finansial & AIT' },
          { code: 'Final', label: 'Final · Seminar & Laporan' }
        ]
      };
    } else if (!raw.siteSettings.guestAccess) {
      raw.siteSettings.guestAccess = {
        enabled: true,
        mode: 'public',
        maxDownloadSizeMb: 150,
        rateLimitPerHour: 60
      };
    }

    // Default visibleToGuest on files
    if (Array.isArray(raw.files)) {
      raw.files.forEach((f: any) => {
        if (f.visibleToGuest === undefined) f.visibleToGuest = false;
      });
    }

    // Default visibleToGuest on folders
    if (Array.isArray(raw.folders)) {
      raw.folders.forEach((fld: any) => {
        if (fld.visibleToGuest === undefined) fld.visibleToGuest = false;
      });
    }

    // Default visibleToGuest on references (regulations/SNI default true for presentation testing)
    if (Array.isArray(raw.references)) {
      raw.references.forEach((r: any) => {
        if (r.visibleToGuest === undefined) {
          r.visibleToGuest = r.type === 'Kepmen/Peraturan' || r.type === 'Standar/SNI';
        }
      });
    }

    // Default visibleToGuest on notes
    if (Array.isArray(raw.notes)) {
      raw.notes.forEach((n: any) => {
        if (n.visibleToGuest === undefined) n.visibleToGuest = false;
      });
    }

    // Initialize submissions collection
    if (!Array.isArray(raw.submissions)) {
      raw.submissions = [];
    }
  }

  return raw as DatabaseSchema;
}

// Daily automatic backup: keeps last 14 backups
export function performDailyBackup() {
  try {
    ensureDirectories();
    if (!fs.existsSync(DB_FILE)) return;

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const backupPath = path.resolve(BACKUPS_DIR, `db-${todayStr}.json`);

    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(DB_FILE, backupPath);
      console.log(`[BACKUP] Cadangan database harian dibuat: db-${todayStr}.json`);
    }

    // Prune backups beyond last 14
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('db-') && f.endsWith('.json'))
      .sort();

    if (files.length > 14) {
      const toDelete = files.slice(0, files.length - 14);
      for (const oldFile of toDelete) {
        fs.unlinkSync(path.resolve(BACKUPS_DIR, oldFile));
      }
    }
  } catch (err) {
    console.error('Peringatan saat membuat backup harian:', err);
  }
}

function generateRandomSecurePassword(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 character random alphanumeric
}

function createSeedData(): DatabaseSchema {
  const now = new Date().toISOString();

  // Initial passwords for seed accounts
  const fadilPass = 'fadiltampan';
  const odePass = 'ode2026';
  const fitaPass = 'fita2026';
  const dzulPass = 'dzul2026';
  const rifkyPass = 'rifky2026';

  const fadilAuth = hashPassword(fadilPass);
  const odeAuth = hashPassword(odePass);
  const fitaAuth = hashPassword(fitaPass);
  const dzulAuth = hashPassword(dzulPass);
  const rifkyAuth = hashPassword(rifkyPass);

  console.log('================================================================================');
  console.log('[VREDEFORT INDONESIA] KREDENSIAL AWAL DATABASE DI-GENERATE:');
  console.log(`  - fadil (Admin) : ${fadilPass}`);
  console.log(`  - ode   (Member): ${odePass}`);
  console.log(`  - fita  (Member): ${fitaPass}`);
  console.log(`  - dzul  (Member): ${dzulPass}`);
  console.log(`  - rifky (Member): ${rifkyPass}`);
  console.log('Harap simpan password di atas. Pengguna wajib mengganti password saat login pertama.');
  console.log('================================================================================');

  const users: User[] = [
    {
      id: crypto.randomUUID(),
      username: 'fadil',
      fullName: 'Muhammad Fadil',
      role: 'admin',
      passwordHash: fadilAuth.hash,
      salt: fadilAuth.salt,
      avatar: 'MF',
      lastLogin: now,
      createdAt: now,
      mustChangePassword: true,
      tokenVersion: 1,
      activity: [
        { id: crypto.randomUUID(), action: 'Inisialisasi Workspace', details: 'Setup proyek Perencanaan Tambang 2026/2027', timestamp: now }
      ]
    },
    {
      id: crypto.randomUUID(),
      username: 'ode',
      fullName: 'La Ode Ahmad',
      role: 'member',
      passwordHash: odeAuth.hash,
      salt: odeAuth.salt,
      avatar: 'LO',
      lastLogin: now,
      createdAt: now,
      mustChangePassword: true,
      tokenVersion: 1,
      activity: []
    },
    {
      id: crypto.randomUUID(),
      username: 'fita',
      fullName: 'Fita Nuraini',
      role: 'member',
      passwordHash: fitaAuth.hash,
      salt: fitaAuth.salt,
      avatar: 'FN',
      lastLogin: now,
      createdAt: now,
      mustChangePassword: true,
      tokenVersion: 1,
      activity: []
    },
    {
      id: crypto.randomUUID(),
      username: 'dzul',
      fullName: 'Dzul Fadli',
      role: 'member',
      passwordHash: dzulAuth.hash,
      salt: dzulAuth.salt,
      avatar: 'DF',
      lastLogin: now,
      createdAt: now,
      mustChangePassword: true,
      tokenVersion: 1,
      activity: []
    },
    {
      id: crypto.randomUUID(),
      username: 'rifky',
      fullName: 'Rifky Hidayat',
      role: 'member',
      passwordHash: rifkyAuth.hash,
      salt: rifkyAuth.salt,
      avatar: 'RH',
      lastLogin: now,
      createdAt: now,
      mustChangePassword: true,
      tokenVersion: 1,
      activity: []
    }
  ];

  const folders: Folder[] = [
    { id: 'fld-1', name: 'Acara 1 - Block Model', createdAt: now },
    { id: 'fld-2', name: 'Acara 2 - Pit & Disposal', createdAt: now },
    { id: 'fld-3', name: 'Acara 3 - Penjadwalan & Sekuens', createdAt: now },
    { id: 'fld-4', name: 'Acara 4 - Penyaliran & Hidro', createdAt: now },
    { id: 'fld-5', name: 'Acara 5 - Kelayakan Investasi', createdAt: now },
    { id: 'fld-6', name: 'Format & Regulasi SNI', createdAt: now }
  ];

  const projects: Project[] = [
    {
      id: 'prj-1',
      code: 'Acara 1',
      title: 'Pemodelan Sumberdaya & Block Model (Mineral)',
      acaraTag: 'Acara 1',
      description: 'Pemodelan geologi bawah permukaan, database lubang bor (borehole), komposit komposit kadar, variogram geostatistik, dan block model estimasi Ordinary Kriging (OK) serta Inverse Distance Weighting (IDW).',
      status: 'in_progress',
      progress: 65,
      deadline: '12–13 Juni 2026',
      leader: 'fadil',
      members: ['fadil', 'ode', 'fita', 'dzul', 'rifky']
    },
    {
      id: 'prj-2',
      code: 'Acara 2',
      title: 'Optimasi Pit Limit (UPL), Lereng Tambang & Desain Disposal',
      acaraTag: 'Acara 2',
      description: 'Penentuan Ultimate Pit Limit dengan algoritma Lerchs-Grossmann, parameter geoteknik (FK lereng jenjang, overall slope), rasio pengupasan impas (BESR), dan kapasitas tampung disposal area.',
      status: 'in_progress',
      progress: 25,
      deadline: 'Juli–Agustus 2026',
      leader: 'ode',
      members: ['ode', 'fadil', 'dzul']
    },
    {
      id: 'prj-3',
      code: 'Acara 3',
      title: 'Perancangan Tahapan Penambangan (Pushback) & Penjadwalan Produksi',
      acaraTag: 'Acara 3',
      description: 'Desain sekuen penambangan tahunan/triwulanan, pushback phase development, cut-off grade dinamis, kebutuhan armada alat muat-angkut, dan balance penimbunan material waste.',
      status: 'planning',
      progress: 10,
      deadline: '11–12 September 2026',
      leader: 'fita',
      members: ['fita', 'rifky', 'fadil']
    },
    {
      id: 'prj-4',
      code: 'Acara 4',
      title: 'Sistem Penyaliran Tambang (Mine Drainage & Dewatering)',
      acaraTag: 'Acara 4',
      description: 'Analisis curah hujan rencana (Gumbel), koefisien limpasan air permukaan, desain sump dasar pit, kapasitas pompa sentrifugal tambang, dan dimensi kolam pengendap sedimen (sediment pond).',
      status: 'planning',
      progress: 5,
      deadline: '2–3 Oktober 2026',
      leader: 'dzul',
      members: ['dzul', 'ode', 'fita']
    },
    {
      id: 'prj-5',
      code: 'Acara 5',
      title: 'Analisis Investasi Tambang & Evaluasi Kelayakan Ekonomi (AIT)',
      acaraTag: 'Acara 5',
      description: 'Penyusunan CAPEX/OPEX penambangan, model arus kas terdiskonto (DCF), Net Present Value (NPV), Internal Rate of Return (IRR), Payback Period, dan analisis sensitivitas harga komoditas.',
      status: 'planning',
      progress: 0,
      deadline: '30–31 Oktober 2026',
      leader: 'rifky',
      members: ['rifky', 'fadil', 'ode']
    },
    {
      id: 'prj-6',
      code: 'Final',
      title: 'Penyusunan Laporan Lengkap & Seminar Akhir',
      acaraTag: 'Final',
      description: 'Kompilasi peta rancangan tambang, lampiran tabel perhitungan cadangan, analisis sensitivitas, dan presentasi komprehensif di depan tim evaluator.',
      status: 'planning',
      progress: 0,
      deadline: '27–28 November 2026',
      leader: 'fadil',
      members: ['fadil', 'ode', 'fita', 'dzul', 'rifky']
    }
  ];

  const checklists: ChecklistItem[] = [
    { id: 'chk-1', title: 'Verifikasi Database Kolom Collar, Survey, Assay, Lithology', category: 'Acara 1 - Mineral', acaraId: 'prj-1', status: 'completed', assignedTo: 'fadil', updatedAt: now },
    { id: 'chk-2', title: 'Topografi Surface DTM Wireframe Validated', category: 'Acara 1 - Mineral', acaraId: 'prj-1', status: 'completed', assignedTo: 'fita', updatedAt: now },
    { id: 'chk-3', title: 'Solid Model Badan Bijih (Orebody Wireframe) Tertutup Kedap Air', category: 'Acara 1 - Mineral', acaraId: 'prj-1', status: 'completed', assignedTo: 'ode', updatedAt: now },
    { id: 'chk-4', title: 'Komposit Assay Lubang Bor Interval 2m', category: 'Acara 1 - Mineral', acaraId: 'prj-1', status: 'completed', assignedTo: 'fadil', updatedAt: now },
    { id: 'chk-5', title: 'Parameter Blok Model (Ukuran Blok X=10, Y=10, Z=5, Sub-blocking)', category: 'Acara 1 - Mineral', acaraId: 'prj-1', status: 'in_progress', assignedTo: 'dzul', updatedAt: now },
    { id: 'chk-6', title: 'Estimasi Kadar Ordinary Kriging & IDW2', category: 'Acara 1 - Mineral', acaraId: 'prj-1', status: 'in_progress', assignedTo: 'fadil', updatedAt: now },
    { id: 'chk-7', title: 'Koreksi lapisan bijih mineral Roof & Floor Grid DTM', category: 'Acara 1 - Mineral (Dasar)', acaraId: 'prj-1', status: 'pending', assignedTo: 'rifky', updatedAt: now },
    { id: 'chk-8', title: 'Perhitungan Cadangan Insitu Berdasarkan Cut-Off Grade (COG)', category: 'Acara 1 - Mineral (Dasar)', acaraId: 'prj-1', status: 'pending', assignedTo: 'fita', updatedAt: now },
    { id: 'chk-9', title: 'Optimasi Pit Shell Lerchs-Grossmann Algoritma', category: 'Acara 2 - UPL & Pit Design', acaraId: 'prj-2', status: 'in_progress', assignedTo: 'ode', updatedAt: now },
    { id: 'chk-10', title: 'Geometri Jenjang (Tinggi 10m, Berm Width 5m, Single Slope 65°)', category: 'Acara 2 - UPL & Pit Design', acaraId: 'prj-2', status: 'in_progress', assignedTo: 'ode', updatedAt: now },
    { id: 'chk-11', title: 'Desain Ramp Akses Jalan Angkut Pit (Lebar 25m, Grade 8%)', category: 'Acara 2 - UPL & Pit Design', acaraId: 'prj-2', status: 'pending', assignedTo: 'dzul', updatedAt: now },
    { id: 'chk-12', title: 'Perhitungan Kapasitas Ruang Timbunan Disposal & Swell Factor', category: 'Acara 2 - UPL & Pit Design', acaraId: 'prj-2', status: 'pending', assignedTo: 'fadil', updatedAt: now },
    { id: 'chk-13', title: 'Desain Pushback Tahap Penambangan Phase 1 s/d Phase 4', category: 'Acara 3 - Sekuens & Produksi', acaraId: 'prj-3', status: 'pending', assignedTo: 'fita', updatedAt: now },
    { id: 'chk-14', title: 'Match Factor Alat Gali-Muat (Excavator) & Alat Angkut (Dump Truck)', category: 'Acara 3 - Sekuens & Produksi', acaraId: 'prj-3', status: 'pending', assignedTo: 'rifky', updatedAt: now },
    { id: 'chk-15', title: 'Analisis Curah Hujan Periode Ulang 10 Tahun (Metode Gumbel)', category: 'Acara 4 - Hidrologi & Penyaliran', acaraId: 'prj-4', status: 'pending', assignedTo: 'dzul', updatedAt: now },
    { id: 'chk-16', title: 'Dimensi Saluran Terbuka Drainase Keliling Tambang', category: 'Acara 4 - Hidrologi & Penyaliran', acaraId: 'prj-4', status: 'pending', assignedTo: 'ode', updatedAt: now },
    { id: 'chk-17', title: 'Penyusunan Rencana Anggaran Biaya (CAPEX & OPEX)', category: 'Acara 5 - Kelayakan Investasi', acaraId: 'prj-5', status: 'pending', assignedTo: 'rifky', updatedAt: now },
    { id: 'chk-18', title: 'Kelayakan Finansial: NPV, IRR, PBP & Sensitivity Analysis', category: 'Acara 5 - Kelayakan Investasi', acaraId: 'prj-5', status: 'pending', assignedTo: 'fadil', updatedAt: now }
  ];

  const tasks: Task[] = [
    {
      id: crypto.randomUUID(),
      title: 'Validasi lapisan bijih mineral Roof-Floor Grid DTM',
      description: 'Lakukan perbaikan kontur ketebalan semu mineral di Surpac untuk mencegah interseksi negatif.',
      status: 'in_progress',
      priority: 'high',
      assignedTo: 'fadil',
      projectAcara: 'Acara 1',
      dueDate: '2026-06-05',
      createdAt: now
    },
    {
      id: crypto.randomUUID(),
      title: 'Running Pit Optimizer Lerchs-Grossmann',
      description: 'Gunakan revenue factor 0.6 hingga 1.2 untuk menentukan nested pit shells acuan pushback.',
      status: 'todo',
      priority: 'high',
      assignedTo: 'ode',
      projectAcara: 'Acara 2',
      dueDate: '2026-07-15',
      createdAt: now
    },
    {
      id: crypto.randomUUID(),
      title: 'Simulasi Match Factor Armada Hauling',
      description: 'Hitung cycle time truk CAT 777D dan loader Komatsu PC1250 untuk target produksi 2.5 Jt Ton/thn.',
      status: 'todo',
      priority: 'medium',
      assignedTo: 'fita',
      projectAcara: 'Acara 3',
      dueDate: '2026-08-25',
      createdAt: now
    },
    {
      id: crypto.randomUUID(),
      title: 'Perhitungan Debit Limpasan Catchment Area',
      description: 'Tentukan dimensi settling pond 3 kompartemen sesuai baku mutu TSS lingkungan Kepmen LH.',
      status: 'todo',
      priority: 'medium',
      assignedTo: 'dzul',
      projectAcara: 'Acara 4',
      dueDate: '2026-09-20',
      createdAt: now
    },
    {
      id: crypto.randomUUID(),
      title: 'Formulasi DCF Model Arus Kas Tambang',
      description: 'Buat tabel amortisasi pinjaman bank, royalti IUPK 14%, dan depresiasi alat berat tambang.',
      status: 'todo',
      priority: 'low',
      assignedTo: 'rifky',
      projectAcara: 'Acara 5',
      dueDate: '2026-10-18',
      createdAt: now
    }
  ];

  const references: ReferenceItem[] = [
    {
      id: crypto.randomUUID(),
      title: 'Kepmen ESDM No. 1827 K/30/MEM/2018 tentang Kaidah Pertambangan yang Baik',
      author: 'Kementerian Energi dan Sumber Daya Mineral Republik Indonesia',
      year: 2018,
      type: 'Kepmen/Peraturan',
      source: 'Ditjen Minerba ESDM RI',
      url: 'https://minerba.esdm.go.id',
      tags: ['#Kepmen1827', '#GoodMiningPractice', '#KeselamatanTambang'],
      notes: 'Rujukan standar lereng jenjang, faktor keamanan (FK) statis minimal 1.3 dan dinamis 1.1.'
    },
    {
      id: crypto.randomUUID(),
      title: 'SNI 4726:2019 Pedoman Pelaporan Hasil Eksplorasi, Sumberdaya, dan Cadangan Mineral',
      author: 'Badan Standardisasi Nasional (BSN)',
      year: 2019,
      type: 'Standar/SNI',
      source: 'Komite Bersama KCMI - Perhapi & IAGI',
      url: 'https://bsn.go.id',
      tags: ['#SNI4726', '#KCMI', '#SumberdayaCadangan'],
      notes: 'Pedoman klasifikasi cadangan terkira dan terbukti berdasarkan jarak spasi titik informasi bor.'
    },
    {
      id: crypto.randomUUID(),
      title: 'Open Pit Mine Planning and Design (3rd Edition)',
      author: 'William A. Hustrulid, Mark Kuchta, & Randall K. Martin',
      year: 2013,
      type: 'Buku',
      source: 'CRC Press / Balkema',
      tags: ['#PitDesign', '#Hustrulid', '#CutOffGrade'],
      notes: 'Buku teks standar perancangan jenjang, pemilihan stripping ratio, dan desain ramp jalan hauling.'
    }
  ];

  const assessments: AssessmentItem[] = [
    { id: crypto.randomUUID(), category: 'Presentasi Kelompok', acara: 'Acara 1 · Block Model', score: 85, maxScore: 100, weight: 30, evaluator: 'Tim Evaluator I', feedback: 'Visualisasi solid orebody sangat baik, perhatikan kerapatan sub-blocking pada bidang kontak.', updatedAt: now },
    { id: crypto.randomUUID(), category: 'Laporan Kelompok', acara: 'Acara 1 · Block Model', score: 82, maxScore: 100, weight: 40, evaluator: 'Tim Asisten Lab Komputasi', feedback: 'Analisis semivariogram dan perhitungan tonase cadangan sudah sesuai SNI KCMI.', updatedAt: now },
    { id: crypto.randomUUID(), category: 'Laporan Individu', targetUser: 'fadil', acara: 'Acara 1 · Block Model', score: 88, maxScore: 100, weight: 30, evaluator: 'Tim Evaluator I', feedback: 'Pemahaman kriging dan script otomasi Surpac sangat mendalam.', updatedAt: now },
    { id: crypto.randomUUID(), category: 'Laporan Individu', targetUser: 'ode', acara: 'Acara 1 · Block Model', score: 84, maxScore: 100, weight: 30, evaluator: 'Tim Asisten Lab Komputasi', feedback: 'Validasi database collar dan survey akurat.', updatedAt: now }
  ];

  const timeline: TimelineEvent[] = [
    { id: crypto.randomUUID(), title: 'Kickoff Kuliah Perencanaan Tambang & Pembagian Data Bor', period: 'Minggu 1', dateRange: '2–6 Maret 2026', category: 'kuliah', description: 'Pengenalan silabus TA 2026/2027, distribusi database collar dan assay.', isMilestone: true },
    { id: crypto.randomUUID(), title: 'Asistensi Teknis & Pemodelan Badan Bijih (Acara 1)', period: 'Minggu 2–6', dateRange: '9 Maret – 17 April 2026', category: 'kuliah', description: 'Pelatihan pembuatan string, solid wireframe, dan variografi di software tambang.', isMilestone: false },
    { id: crypto.randomUUID(), title: 'Pengumpulan Laporan Draf Acara 1 & Presentasi Evaluasi', period: 'Minggu 14', dateRange: '12–13 Juni 2026', category: 'presentasi', description: 'Presentasi hasil estimasi block model mineral.', isMilestone: true },
    { id: crypto.randomUUID(), title: 'Pelaksanaan KKN Tematik Mahasiswa (Jeda Perkuliahan)', period: 'Jeda Semester', dateRange: '22 Juni – 8 Agustus 2026', category: 'kkn', description: 'Libur kuliah tatap muka studio, kerja mandiri pengerjaan optimasi pit Acara 2.', isMilestone: false },
    { id: crypto.randomUUID(), title: 'Presentasi & Evaluasi Acara 2 (UPL & Desain Lereng)', period: 'Minggu 18', dateRange: '11–12 September 2026', category: 'presentasi', description: 'Penyajian batas pit penambangan dan penempatan waste dump.', isMilestone: true },
    { id: crypto.randomUUID(), title: 'Seminar Akhir Perencanaan Tambang TA 2026/2027', period: 'Minggu 28', dateRange: '27–28 November 2026', category: 'presentasi', description: 'Sidang komprehensif presentasi kelayakan penambangan di hadapan dewan evaluasi.', isMilestone: true }
  ];

  const workspaceInfo: WorkspaceInfo = {
    subjectName: 'Perencanaan Tambang (Mining Planning & Design)',
    academicYear: 'TA 2026/2027',
    tagline: 'VREDEFORT INDONESIA — Mining Knowledge, Files & Planning Workspace',
    groupNumber: 'Kelompok 5',
    members: [
      { username: 'fadil', name: 'Muhammad Fadil', nim: 'F1D121035', role: 'Ketua Kelompok & Lead Acara 1' },
      { username: 'ode', name: 'La Ode Ahmad', nim: 'F1D121014', role: 'Lead Acara 2 (Pit & Lereng Tambang)' },
      { username: 'fita', name: 'Fita Nuraini', nim: 'F1D121005', role: 'Lead Acara 3 (Pushback & Produksi)' },
      { username: 'dzul', name: 'Dzul Fadli', nim: 'F1D121047', role: 'Lead Acara 4 (Penyaliran & Hidro)' },
      { username: 'rifky', name: 'Rifky Hidayat', nim: 'F1D121088', role: 'Lead Acara 5 (Analisis Finansial AIT)' }
    ],
    workDurationPerAcara: '3–4 Minggu Efektif per Acara Teknis',
    presentationRequirements: [
      'Menampilkan model 3D wireframe / block model aktual',
      'Membawa draf lembar kerja perhitungan Excel & lampiran formulasi SNI',
      'Seluruh 5 anggota wajib memahami parameter rancangan yang dipresentasikan'
    ],
    attendanceRule: 'Kehadiran minimum 80% asistensi studio komputasi tambang',
    labPcScheduleStatus: 'Terjadwal: Setiap Selasa & Kamis pukul 08:00 - 12:00 WIB',
    updatedAt: now
  };

  const files: MiningFile[] = [];
  const notes: Note[] = [];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    users,
    files,
    folders,
    notes,
    projects,
    checklists,
    tasks,
    references,
    assessments,
    timeline,
    workspaceInfo,
    siteSettings: {
      siteName: workspaceInfo.subjectName,
      tagline: workspaceInfo.tagline,
      academicYear: workspaceInfo.academicYear,
      accentColor: '#f59e0b',
      guestAccess: {
        enabled: true,
        mode: 'public',
        maxDownloadSizeMb: 150,
        rateLimitPerHour: 60
      },
      categories: [
        'Presentasi Kelompok',
        'Laporan Kelompok',
        'Laporan Individu',
        'Penyaliran Tambang',
        'Model Blok Geologi',
        'Geoteknik Lereng',
        'Studi Kelayakan & AIT'
      ],
      acaraList: [
        { code: 'Acara 1', label: 'Acara 1 · Block Model' },
        { code: 'Acara 2', label: 'Acara 2 · Pit & Disposal' },
        { code: 'Acara 3', label: 'Acara 3 · Penjadwalan' },
        { code: 'Acara 4', label: 'Acara 4 · Hidrologi' },
        { code: 'Acara 5', label: 'Acara 5 · Finansial & AIT' },
        { code: 'Final', label: 'Final · Seminar & Laporan' }
      ]
    },
    submissions: []
  };
}

export function initDatabase(): DatabaseSchema {
  ensureDirectories();

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const raw = JSON.parse(content);
      db = runMigrations(raw);
      performDailyBackup();
      return db;
    } catch (err) {
      console.error('Error saat membaca db.json, inisialisasi ulang seed baru:', err);
    }
  }

  db = createSeedData();
  saveDatabase(true);
  performDailyBackup();
  return db;
}

export function getDatabase(): DatabaseSchema {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// Debounced and Atomic Save Database (write to tmp file then rename)
export function saveDatabase(immediate: boolean = false): void {
  ensureDirectories();

  const writeAtomic = () => {
    try {
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
      pendingSave = false;
    } catch (err) {
      console.error('Gagal menyimpan file db.json secara atomik:', err);
    }
  };

  if (immediate) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    writeAtomic();
    return;
  }

  pendingSave = true;
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    writeAtomic();
    saveDebounceTimer = null;
  }, 300);
}

// Flush pending database writes on process exit signals
process.on('SIGINT', () => {
  if (pendingSave && db) {
    saveDatabase(true);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (pendingSave && db) {
    saveDatabase(true);
  }
  process.exit(0);
});
