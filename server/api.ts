import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import * as XLSX from 'xlsx';
import {
  getDatabase,
  saveDatabase,
  getUploadsDir,
  User,
  MiningFile,
  Note,
  Task,
  ChecklistItem,
  ReferenceItem,
  Folder,
  Project
} from './db.ts';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authMiddleware,
  adminOnly,
  requireNotGuest,
  requireRole,
  requirePermission,
  checkGuestDownloadLimit,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
  can,
  AuthRequest
} from './auth.ts';

// Serializer for Guest Responses (removes sensitive internal metadata)
function serializeFileForGuest(f: MiningFile) {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    extension: f.extension,
    size: f.size,
    folderId: f.folderId,
    acaraTag: f.acaraTag,
    isFavorite: false,
    isTrashed: false,
    visibleToGuest: true,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt
  };
}

function serializeReferenceForGuest(r: ReferenceItem) {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    year: r.year,
    type: r.type,
    source: r.source,
    url: r.url,
    fileId: r.fileId,
    visibleToGuest: true
  };
}

const router = express.Router();

// Total Storage Quota (10 GB)
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

// Max Single File Size from Environment (default 200 MB)
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Allowed File Extensions Whitelist
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx', 'csv',
  'ppt', 'pptx',
  'txt', 'md', 'json',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg',
  'zip', 'rar', '7z',
  'dxf', 'dwg',
  'shp', 'dbf', 'shx',
  'str', 'dm', 'tcl', 'dtm',
  'py',
  'kml', 'kmz', 'geojson'
]);

// Helper for logging user activities
function logActivity(username: string, action: string, details: string) {
  const db = getDatabase();
  const user = db.users.find(u => u.username === username);
  if (user) {
    if (!user.activity) user.activity = [];
    user.activity.unshift({
      id: crypto.randomUUID(),
      action,
      details,
      timestamp: new Date().toISOString()
    });
    if (user.activity.length > 50) user.activity.pop();
  }
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${uniqueSuffix}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Ekstensi file .${ext} tidak diizinkan. Harap unggah format file pertambangan/laporan yang didukung.`));
    }
    cb(null, true);
  }
});

// ----------------------------------------------------
// 0. HEALTH CHECK
// ----------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'VREDEFORT INDONESIA Backend API'
  });
});

// ----------------------------------------------------
// 1. AUTH & USER ENDPOINTS
// ----------------------------------------------------
router.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  // Check rate limit: 5 failed attempts per 15 minutes
  const rateLimit = checkLoginRateLimit(ip, username);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah ${rateLimit.remainingMinutes} menit.`
    });
  }

  const db = getDatabase();
  const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user) {
    recordFailedLogin(ip, username);
    return res.status(401).json({ error: 'Kombinasi username atau password salah.' });
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    recordFailedLogin(ip, username);
    return res.status(401).json({ error: 'Kombinasi username atau password salah.' });
  }

  // Reset rate limit on successful login
  resetLoginRateLimit(ip, username);

  // Update last login
  user.lastLogin = new Date().toISOString();
  logActivity(user.username, 'Login', 'Masuk ke sistem workspace');
  saveDatabase();

  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion || 1
  });

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
      mustChangePassword: Boolean(user.mustChangePassword)
    }
  });
});

router.post('/auth/guest', (req: Request, res: Response) => {
  const db = getDatabase();
  const guestConfig = db.siteSettings?.guestAccess;
  if (guestConfig && !guestConfig.enabled) {
    return res.status(403).json({ error: 'Akses tamu dinonaktifkan oleh administrator.' });
  }

  if (guestConfig?.mode === 'code') {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'Kode akses tamu wajib diisi.' });
    }
    if (guestConfig.expiresAt && new Date(guestConfig.expiresAt).getTime() < Date.now()) {
      return res.status(403).json({ error: 'Kode akses tamu telah kedaluwarsa.' });
    }
    const hash = crypto.createHash('sha256').update(String(passcode).trim()).digest('hex');
    if (hash !== guestConfig.codeHash) {
      return res.status(401).json({ error: 'Kode akses tamu salah.' });
    }
  }

  const token = generateToken(
    {
      id: 'guest-user',
      username: 'tamu',
      role: 'guest',
      tokenVersion: 1
    },
    8 * 60 * 60 * 1000 // 8 jam
  );

  return res.json({
    token,
    user: {
      id: 'guest-user',
      username: 'tamu',
      fullName: 'Tamu',
      role: 'guest',
      avatar: 'TM',
      lastLogin: new Date().toISOString(),
      mustChangePassword: false
    }
  });
});

router.get('/public/settings', (_req: Request, res: Response) => {
  const db = getDatabase();
  const settings = db.siteSettings || {
    siteName: 'VREDEFORT INDONESIA',
    tagline: 'Mining Knowledge, Files & Planning Workspace',
    academicYear: '2026/2027',
    guestAccess: { enabled: true, mode: 'public' as const, maxDownloadSizeMb: 150, rateLimitPerHour: 60 }
  };
  return res.json({
    siteName: settings.siteName,
    tagline: settings.tagline,
    academicYear: settings.academicYear,
    logoUrl: db.workspaceInfo?.customLogoUrl || null,
    guestAccess: {
      enabled: settings.guestAccess?.enabled ?? true,
      mode: settings.guestAccess?.mode ?? 'public'
    }
  });
});

router.get('/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'guest') {
    return res.json({
      user: {
        id: 'guest-user',
        username: 'tamu',
        fullName: 'Tamu',
        role: 'guest',
        avatar: 'TM',
        lastLogin: new Date().toISOString(),
        mustChangePassword: false
      }
    });
  }

  const db = getDatabase();
  const user = db.users.find(u => u.id === req.user?.id);
  if (!user) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
      mustChangePassword: Boolean(user.mustChangePassword)
    }
  });
});

router.post('/auth/change-password', authMiddleware, (req: AuthRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password baru minimal harus 8 karakter.' });
  }

  const db = getDatabase();
  const user = db.users.find(u => u.id === req.user?.id);
  if (!user) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  if (!verifyPassword(oldPassword, user.passwordHash, user.salt)) {
    return res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
  }

  const newAuth = hashPassword(newPassword);
  user.passwordHash = newAuth.hash;
  user.salt = newAuth.salt;
  user.mustChangePassword = false;
  // Increment tokenVersion so any other active sessions are invalidated
  user.tokenVersion = (user.tokenVersion || 1) + 1;

  logActivity(user.username, 'Ubah Password', 'Memperbarui password akun');
  saveDatabase(true);

  // Return fresh new token with updated tokenVersion
  const newToken = generateToken(user);

  return res.json({ message: 'Password berhasil diperbarui.', token: newToken });
});

router.get('/users/summary', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const summary = db.users.map(u => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    avatar: u.avatar
  }));
  return res.json(summary);
});

router.get('/users', authMiddleware, adminOnly, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const safeUsers = db.users.map(u => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    avatar: u.avatar,
    lastLogin: u.lastLogin,
    activityCount: u.activity?.length || 0,
    activity: u.activity || []
  }));
  return res.json(safeUsers);
});

router.post('/users', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { username, fullName, role, password } = req.body;
  if (!username || !fullName || !password) {
    return res.status(400).json({ error: 'Username, nama lengkap, dan password wajib diisi.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    return res.status(400).json({ error: 'Username harus memiliki panjang 3 hingga 30 karakter.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password minimal harus 8 karakter.' });
  }

  const db = getDatabase();
  if (db.users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ error: 'Username sudah digunakan oleh anggota lain.' });
  }

  const { hash, salt } = hashPassword(password);
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const now = new Date().toISOString();
  const newUser: User = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    fullName: fullName.trim(),
    role: role === 'admin' ? 'admin' : 'member',
    passwordHash: hash,
    salt,
    avatar: initials || cleanUsername.slice(0, 2).toUpperCase(),
    lastLogin: '',
    createdAt: now,
    mustChangePassword: true,
    tokenVersion: 1,
    activity: [
      { id: crypto.randomUUID(), action: 'Akun Dibuat', details: `Dibuat oleh admin @${req.user?.username}`, timestamp: now }
    ]
  };

  db.users.push(newUser);
  logActivity(req.user!.username, 'Tambah Pengguna', `Menambahkan pengguna baru @${cleanUsername}`);
  saveDatabase(true);

  return res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    fullName: newUser.fullName,
    role: newUser.role,
    avatar: newUser.avatar,
    lastLogin: newUser.lastLogin
  });
});

router.put('/users/:id', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role, password, fullName } = req.body;

  const db = getDatabase();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  // Tolak menurunkan peran akun sendiri
  if (req.user?.id === id && role && role !== user.role && role === 'member') {
    return res.status(400).json({ error: 'Tidak dapat menurunkan hak akses admin pada akun Anda sendiri.' });
  }

  // Tolak menurunkan admin terakhir sistem
  if (role && role === 'member' && user.role === 'admin') {
    const adminCount = db.users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menurunkan admin terakhir pada sistem.' });
    }
  }

  // Ubah peran dan naikkan tokenVersion saat peran berubah
  if (role && (role === 'admin' || role === 'member')) {
    if (role !== user.role) {
      user.role = role;
      user.tokenVersion = (user.tokenVersion || 1) + 1;
      logActivity(req.user!.username, 'Ubah Peran', `Mengubah peran @${user.username} menjadi ${role.toUpperCase()}`);
    }
  }

  // Validasi fullName (tidak kosong, maks 100) dan sinkronkan dengan workspaceInfo.members
  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'Nama lengkap wajib diisi dan tidak boleh kosong.' });
    }
    const cleanFullName = fullName.trim();
    if (cleanFullName.length > 100) {
      return res.status(400).json({ error: 'Nama lengkap maksimal 100 karakter.' });
    }
    const oldName = user.fullName;
    user.fullName = cleanFullName;

    if (db.workspaceInfo?.members) {
      const member = db.workspaceInfo.members.find(
        m => m.username.toLowerCase() === user.username.toLowerCase()
      );
      if (member) {
        member.name = cleanFullName;
      }
    }
    logActivity(req.user!.username, 'Ubah Nama', `Mengubah nama @${user.username}: "${oldName}" -> "${cleanFullName}"`);
  }

  if (password && typeof password === 'string' && password.length >= 8) {
    const { hash, salt } = hashPassword(password);
    user.passwordHash = hash;
    user.salt = salt;
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    logActivity(req.user!.username, 'Reset Password', `Mereset password pengguna @${user.username}`);
  }

  saveDatabase(true);
  return res.json({ message: 'Pengguna berhasil diperbarui.' });
});

router.delete('/users/:id', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  const targetUser = db.users[userIndex];

  // Tidak boleh hapus diri sendiri
  if (req.user?.id === id || req.user?.username.toLowerCase() === targetUser.username.toLowerCase()) {
    return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri yang sedang aktif.' });
  }

  // Tidak boleh hapus admin terakhir
  if (targetUser.role === 'admin') {
    const adminCount = db.users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menghapus admin terakhir pada sistem.' });
    }
  }

  // Tugas & checklist milik user itu jadi tanpa PIC (bukan ikut terhapus)
  const targetUsername = targetUser.username.toLowerCase();
  db.tasks.forEach(t => {
    if (t.assignedTo && t.assignedTo.toLowerCase() === targetUsername) {
      t.assignedTo = '';
    }
  });

  db.checklists.forEach(c => {
    if (c.assignedTo && c.assignedTo.toLowerCase() === targetUsername) {
      c.assignedTo = '';
    }
  });

  // Hapus dari workspaceInfo.members jika ada
  if (db.workspaceInfo?.members) {
    db.workspaceInfo.members = db.workspaceInfo.members.filter(
      m => m.username.toLowerCase() !== targetUsername
    );
  }

  db.users.splice(userIndex, 1);
  logActivity(req.user!.username, 'Hapus Pengguna', `Menghapus akun pengguna @${targetUser.username} (${targetUser.fullName})`);
  saveDatabase(true);

  return res.json({ message: `Pengguna @${targetUser.username} berhasil dihapus.` });
});

// ----------------------------------------------------
// 2. FILE MANAGEMENT ENDPOINTS
// ----------------------------------------------------
router.get('/files', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { folderId, tag, acaraTag, search, isTrashed, isFavorite } = req.query;

  let result = db.files;

  if (isTrashed !== undefined) {
    const trashedBool = isTrashed === 'true';
    result = result.filter(f => Boolean(f.isTrashed) === trashedBool);
  } else {
    result = result.filter(f => !f.isTrashed);
  }

  if (isFavorite !== undefined) {
    const favBool = isFavorite === 'true';
    result = result.filter(f => Boolean(f.isFavorite) === favBool);
  }

  if (folderId !== undefined) {
    if (folderId === 'root' || folderId === '') {
      result = result.filter(f => !f.folderId);
    } else {
      result = result.filter(f => f.folderId === folderId);
    }
  }

  if (tag && typeof tag === 'string') {
    const searchTag = tag.startsWith('#') ? tag : `#${tag}`;
    result = result.filter(f => f.tags.some(t => t.toLowerCase() === searchTag.toLowerCase()));
  }

  if (acaraTag && typeof acaraTag === 'string' && acaraTag !== 'all') {
    result = result.filter(f => f.acaraTag === acaraTag);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return res.json(result);
});

router.post('/files/upload', authMiddleware, (req: AuthRequest, res: Response, next) => {
  // Pre-check storage quota before uploading
  const db = getDatabase();
  const currentUsedBytes = db.files.filter(f => !f.isTrashed).reduce((acc, f) => acc + f.size, 0);

  if (currentUsedBytes >= STORAGE_LIMIT_BYTES) {
    return res.status(400).json({
      error: 'Kapasitas penyimpanan penuh. Batas kuota penyimpanan telah tercapai.'
    });
  }

  upload.array('files')(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `Ukuran berkas melebihi batas maksimum (${MAX_FILE_SIZE_MB} MB).`
        });
      }
      return res.status(400).json({ error: err.message || 'Gagal mengunggah berkas.' });
    }

    const uploadedFiles = req.files as Express.Multer.File[];
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'Tidak ada berkas yang dipilih untuk diunggah.' });
    }

    const totalBatchBytes = uploadedFiles.reduce((acc, f) => acc + f.size, 0);
    if (currentUsedBytes + totalBatchBytes > STORAGE_LIMIT_BYTES) {
      // Clean up uploaded files if quota exceeded
      uploadedFiles.forEach(f => {
        try { fs.unlinkSync(f.path); } catch {}
      });
      return res.status(400).json({
        error: 'Kapasitas penyimpanan tidak mencukupi untuk berkas ini.'
      });
    }

    const folderId = req.body.folderId || undefined;
    const acaraTag = req.body.acaraTag || undefined;
    const description = req.body.description || '';

    let tags: string[] = [];
    try {
      if (req.body.tags) {
        tags = JSON.parse(req.body.tags);
      }
    } catch {
      tags = req.body.tags ? [req.body.tags] : [];
    }

    // Fix Bug 13: Find matching project dynamically from db.projects
    let linkedProjectIds: string[] = [];
    if (acaraTag) {
      const matchProj = db.projects.find(p => p.acaraTag === acaraTag || p.code === acaraTag);
      if (matchProj) {
        linkedProjectIds = [matchProj.id];
      }
    }

    const now = new Date().toISOString();
    const createdFiles: MiningFile[] = [];

    for (const f of uploadedFiles) {
      const ext = path.extname(f.originalname).toLowerCase();
      const miningFile: MiningFile = {
        id: crypto.randomUUID(),
        name: f.originalname,
        originalName: f.originalname,
        storedName: f.filename,
        mimeType: f.mimetype,
        extension: ext,
        size: f.size,
        uploadedBy: req.user?.username || 'system',
        folderId,
        tags,
        description,
        linkedNoteIds: [],
        linkedProjectIds,
        acaraTag,
        isFavorite: false,
        isTrashed: false,
        createdAt: now,
        updatedAt: now
      };

      db.files.push(miningFile);
      createdFiles.push(miningFile);
    }

    logActivity(
      req.user!.username,
      'Unggah File',
      `Mengunggah ${uploadedFiles.length} berkas ke ${acaraTag || 'Root'}`
    );
    saveDatabase(true);

    return res.status(201).json(createdFiles);
  });
});

// Update File Metadata (Ownership check: uploader or admin)
router.put('/files/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const file = db.files.find(f => f.id === id);

  if (!file) {
    return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
  }

  // Authorization: Only owner or admin can update
  if (file.uploadedBy !== req.user?.username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah berkas ini.' });
  }

  const { name, folderId, tags, description, linkedNoteIds, linkedProjectIds, acaraTag, isFavorite } = req.body;

  if (name !== undefined) file.name = String(name).trim();
  if (folderId !== undefined) file.folderId = folderId || undefined;
  if (tags !== undefined && Array.isArray(tags)) file.tags = tags;
  if (description !== undefined) file.description = String(description).trim();
  if (linkedNoteIds !== undefined && Array.isArray(linkedNoteIds)) file.linkedNoteIds = linkedNoteIds;
  if (linkedProjectIds !== undefined && Array.isArray(linkedProjectIds)) file.linkedProjectIds = linkedProjectIds;
  if (acaraTag !== undefined) file.acaraTag = acaraTag;
  if (isFavorite !== undefined) file.isFavorite = Boolean(isFavorite);

  file.updatedAt = new Date().toISOString();
  saveDatabase();

  return res.json(file);
});

// Delete or Move to Trash (Ownership check: uploader or admin)
router.delete('/files/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const permanent = req.query.permanent === 'true';

  const db = getDatabase();
  const index = db.files.findIndex(f => f.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
  }

  const file = db.files[index];

  // Authorization: Only owner or admin can delete
  if (file.uploadedBy !== req.user?.username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk menghapus berkas ini.' });
  }

  if (permanent) {
    // Delete physical file safely
    const filePath = path.resolve(getUploadsDir(), file.storedName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Peringatan saat menghapus file fisik:', err);
    }

    db.files.splice(index, 1);
    logActivity(req.user!.username, 'Hapus Permanen', `Menghapus permanen file: ${file.name}`);
  } else {
    file.isTrashed = true;
    file.updatedAt = new Date().toISOString();
    logActivity(req.user!.username, 'Pindah Sampah', `Memindahkan file ke sampah: ${file.name}`);
  }

  saveDatabase(true);
  return res.json({ message: 'Berkas berhasil dihapus.' });
});

router.post('/files/:id/restore', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const file = db.files.find(f => f.id === id);

  if (!file) {
    return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
  }

  file.isTrashed = false;
  file.updatedAt = new Date().toISOString();
  logActivity(req.user!.username, 'Pulihkan File', `Memulihkan file dari sampah: ${file.name}`);
  saveDatabase(true);

  return res.json({ message: 'Berkas berhasil dipulihkan.' });
});

// RAW STREAMING ENDPOINT for files and images
router.get('/files/:id/raw', (req: Request, res: Response) => {
  // Support Bearer auth header or ?token query param
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token autentikasi diperlukan.' });
  }

  // PENTING: token harus diverifikasi (tanda tangan, kedaluwarsa, tokenVersion), bukan sekadar ada.
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Sesi telah berakhir atau tidak valid, silakan login kembali.' });
  }

  const db = getDatabase();
  const file = db.files.find(f => f.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'Berkas tidak ditemukan di database.' });
  }

  const filePath = path.resolve(getUploadsDir(), file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File tidak ditemukan di penyimpanan.' });
  }

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(filePath);
});

// File Content Preview (streaming / truncated <= 2MB, no giant base64 images)
router.get('/files/:id/content', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const file = db.files.find(f => f.id === id);

  if (!file) {
    return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
  }

  const filePath = path.resolve(getUploadsDir(), file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File tidak ditemukan di penyimpanan.' });
  }

  const ext = file.extension.toLowerCase().replace('.', '');
  const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

  if (imageExtensions.includes(ext)) {
    return res.json({
      previewType: 'image',
      rawUrl: `/api/files/${file.id}/raw`
    });
  }

  if (ext === 'pdf') {
    return res.json({
      previewType: 'pdf',
      rawUrl: `/api/files/${file.id}/raw`
    });
  }

  // Excel spreadsheets (.xlsx, .xls)
  if (['xlsx', 'xls'].includes(ext)) {
    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheets: Record<string, any[][]> = {};
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        sheets[sheetName] = json as any[][];
      });
      return res.json({
        previewType: 'excel',
        sheetNames: workbook.SheetNames,
        sheets
      });
    } catch (err: any) {
      return res.status(500).json({ error: `Gagal membaca berkas Excel: ${err.message}` });
    }
  }

  // Text-based files: limit preview to 2 MB
  const textExtensions = ['txt', 'csv', 'json', 'md', 'xml', 'py', 'tcl', 'dxf', 'str'];
  if (textExtensions.includes(ext)) {
    try {
      const stats = fs.statSync(filePath);
      const MAX_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 MB limit
      const readLength = Math.min(stats.size, MAX_PREVIEW_BYTES);

      const buffer = Buffer.alloc(readLength);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, readLength, 0);
      fs.closeSync(fd);

      const text = buffer.toString('utf-8');
      return res.json({
        previewType: ext === 'csv' ? 'csv' : 'text',
        content: text,
        truncated: stats.size > MAX_PREVIEW_BYTES
      });
    } catch (err: any) {
      return res.status(500).json({ error: `Gagal membaca isi berkas: ${err.message}` });
    }
  }

  return res.json({
    previewType: 'binary',
    extension: ext,
    size: file.size
  });
});

// Download Endpoint with RFC 5987 Content-Disposition
router.get('/files/:id/download', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const file = db.files.find(f => f.id === id);

  if (!file) {
    return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
  }

  const filePath = path.resolve(getUploadsDir(), file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File tidak ditemukan di penyimpanan.' });
  }

  if (req.user?.role === 'guest') {
    const limit = checkGuestDownloadLimit(req.ip || req.socket.remoteAddress || 'unknown');
    if (!limit.allowed) {
      return res.status(429).json({ error: 'Batas unduhan tamu per jam tercapai. Coba lagi nanti.' });
    }
  }

  // RFC 5987 compliant Content-Disposition
  const asciiFallback = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const encodedName = encodeURIComponent(file.name).replace(/['()]/g, escape);

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.sendFile(filePath);
});

// ----------------------------------------------------
// 3. FOLDERS MANAGEMENT ENDPOINTS
// ----------------------------------------------------
router.get('/folders', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.folders);
});

router.post('/folders', authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, parentId, color } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nama folder wajib diisi.' });
  }

  const db = getDatabase();
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name: name.trim(),
    parentId: parentId || undefined,
    color,
    createdAt: new Date().toISOString()
  };

  db.folders.push(newFolder);
  logActivity(req.user!.username, 'Buat Folder', `Membuat folder: ${newFolder.name}`);
  saveDatabase(true);

  return res.status(201).json(newFolder);
});

router.put('/folders/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nama folder wajib diisi.' });
  }

  const cleanName = name.trim();
  if (cleanName.length > 120) {
    return res.status(400).json({ error: 'Nama folder maksimal 120 karakter.' });
  }

  const db = getDatabase();
  const folder = db.folders.find(f => f.id === id);
  if (!folder) {
    return res.status(404).json({ error: 'Folder tidak ditemukan.' });
  }

  // Seed folders (fld-1 to fld-6) can only be updated by admin
  const isSeedFolder = ['fld-1', 'fld-2', 'fld-3', 'fld-4', 'fld-5', 'fld-6'].includes(id);
  if (isSeedFolder && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Folder sistem bawaan hanya dapat diubah oleh Admin.' });
  }

  const oldName = folder.name;
  folder.name = cleanName;
  logActivity(req.user!.username, 'Ubah Folder', `Mengubah nama folder: "${oldName}" menjadi "${cleanName}"`);
  saveDatabase(true);

  return res.json(folder);
});

// Folder deletion: safely reassign files and subfolders to parent (prevents orphan files)
router.delete('/folders/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const folderIndex = db.folders.findIndex(f => f.id === id);

  if (folderIndex === -1) {
    return res.status(404).json({ error: 'Folder tidak ditemukan.' });
  }

  const targetFolder = db.folders[folderIndex];

  // Reassign files in this folder to the parent folder (or root)
  db.files.forEach(f => {
    if (f.folderId === id) {
      f.folderId = targetFolder.parentId || undefined;
    }
  });

  // Reassign subfolders
  db.folders.forEach(f => {
    if (f.parentId === id) {
      f.parentId = targetFolder.parentId || undefined;
    }
  });

  db.folders.splice(folderIndex, 1);
  logActivity(req.user!.username, 'Hapus Folder', `Menghapus folder: ${targetFolder.name}`);
  saveDatabase(true);

  return res.json({ message: 'Folder berhasil dihapus.' });
});

// ----------------------------------------------------
// 4. ENGINEERING NOTES ENDPOINTS
// ----------------------------------------------------
router.get('/notes', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.notes);
});

router.get('/notes/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const note = db.notes.find(n => n.id === req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }
  return res.json(note);
});

router.post('/notes', authMiddleware, (req: AuthRequest, res: Response) => {
  const { title, content, folderId, acaraId, tags, linkedFileIds, linkedProjectIds } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Judul catatan wajib diisi.' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  const newNote: Note = {
    id: crypto.randomUUID(),
    title: title.trim(),
    content: content || '',
    folderId: folderId || undefined,
    acaraId: acaraId || undefined,
    tags: Array.isArray(tags) ? tags : [],
    linkedFileIds: Array.isArray(linkedFileIds) ? linkedFileIds : [],
    linkedProjectIds: Array.isArray(linkedProjectIds) ? linkedProjectIds : [],
    isPinned: false,
    isFavorite: false,
    createdBy: req.user!.username,
    createdAt: now,
    updatedAt: now
  };

  db.notes.unshift(newNote);
  logActivity(req.user!.username, 'Buat Catatan', `Membuat catatan: ${newNote.title}`);
  saveDatabase(true);

  return res.status(201).json(newNote);
});

// Update Note (Ownership check: creator or admin)
router.put('/notes/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const note = db.notes.find(n => n.id === id);

  if (!note) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }

  // Authorization: Only owner or admin can edit
  if (note.createdBy !== req.user?.username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya pembuat catatan atau admin yang boleh mengubah.' });
  }

  const { title, content, folderId, acaraId, tags, linkedFileIds, linkedProjectIds, isPinned, isFavorite } = req.body;

  if (title !== undefined) note.title = String(title).trim();
  if (content !== undefined) note.content = String(content);
  if (folderId !== undefined) note.folderId = folderId || undefined;
  if (acaraId !== undefined) note.acaraId = acaraId || undefined;
  if (tags !== undefined && Array.isArray(tags)) note.tags = tags;
  if (linkedFileIds !== undefined && Array.isArray(linkedFileIds)) note.linkedFileIds = linkedFileIds;
  if (linkedProjectIds !== undefined && Array.isArray(linkedProjectIds)) note.linkedProjectIds = linkedProjectIds;
  if (isPinned !== undefined) note.isPinned = Boolean(isPinned);
  if (isFavorite !== undefined) note.isFavorite = Boolean(isFavorite);

  note.updatedAt = new Date().toISOString();
  saveDatabase();

  return res.json(note);
});

// Delete Note (Ownership check: creator or admin)
router.delete('/notes/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const index = db.notes.findIndex(n => n.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }

  const note = db.notes[index];
  if (note.createdBy !== req.user?.username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya pembuat catatan atau admin yang boleh menghapus.' });
  }

  db.notes.splice(index, 1);
  logActivity(req.user!.username, 'Hapus Catatan', `Menghapus catatan: ${note.title}`);
  saveDatabase(true);

  return res.json({ message: 'Catatan berhasil dihapus.' });
});

// ----------------------------------------------------
// 5. PROJECTS & ACARA ENDPOINTS
// ----------------------------------------------------
router.get('/projects', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.projects);
});

router.post('/projects', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { code, title, deadline, description, acaraTag, leader, members } = req.body;
  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Kode acara/proyek wajib diisi.' });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Judul proyek wajib diisi.' });
  }
  if (!deadline || typeof deadline !== 'string' || !deadline.trim()) {
    return res.status(400).json({ error: 'Batas waktu / deadline wajib diisi.' });
  }

  const db = getDatabase();
  const cleanCode = code.trim();
  const newProject: Project = {
    id: `prj-${Date.now()}`,
    code: cleanCode,
    title: title.trim(),
    acaraTag: acaraTag && typeof acaraTag === 'string' ? acaraTag.trim() : cleanCode,
    description: description && typeof description === 'string' ? description.trim() : '',
    status: 'planning',
    progress: 0,
    deadline: deadline.trim(),
    leader: leader && typeof leader === 'string' ? leader.trim() : (req.user?.username || 'admin'),
    members: Array.isArray(members) && members.length > 0 ? members : [req.user?.username || 'admin']
  };

  db.projects.push(newProject);
  logActivity(req.user!.username, 'Buat Proyek', `Membuat proyek baru: ${newProject.code} - ${newProject.title}`);
  saveDatabase(true);

  return res.status(201).json(newProject);
});

router.put('/projects/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const project = db.projects.find(p => p.id === id);

  if (!project) {
    return res.status(404).json({ error: 'Proyek tidak ditemukan.' });
  }

  const { progress, status, leader, members } = req.body;

  if (progress !== undefined) {
    const num = Number(progress);
    if (!isNaN(num) && num >= 0 && num <= 100) project.progress = num;
  }
  if (status && ['planning', 'in_progress', 'review', 'completed'].includes(status)) {
    project.status = status;
  }
  if (leader && typeof leader === 'string') {
    project.leader = leader.trim();
  }
  if (members && Array.isArray(members)) {
    project.members = members;
  }

  logActivity(req.user!.username, 'Update Proyek', `Memperbarui progres ${project.code}: ${project.progress}%`);
  saveDatabase(true);

  return res.json(project);
});

// ----------------------------------------------------
// 6. CHECKLISTS ENDPOINTS
// ----------------------------------------------------
router.get('/checklists', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.checklists);
});

router.post('/checklists', authMiddleware, (req: AuthRequest, res: Response) => {
  const { title, category, acaraId, assignedTo, notes } = req.body;
  if (!title || !acaraId) {
    return res.status(400).json({ error: 'Judul dan Acara checklist wajib diisi.' });
  }

  const db = getDatabase();
  const newItem: ChecklistItem = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    category: category || 'Umum',
    acaraId: String(acaraId),
    status: 'pending',
    assignedTo: assignedTo || undefined,
    notes: notes || '',
    updatedAt: new Date().toISOString()
  };

  db.checklists.push(newItem);
  logActivity(req.user!.username, 'Tambah Checklist', `Menambahkan checklist: ${newItem.title}`);
  saveDatabase(true);

  return res.status(201).json(newItem);
});

router.put('/checklists/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const item = db.checklists.find(c => c.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item checklist tidak ditemukan.' });
  }

  const { status, assignedTo, notes } = req.body;
  if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
    item.status = status;
  }
  if (assignedTo !== undefined) item.assignedTo = assignedTo || undefined;
  if (notes !== undefined) item.notes = notes;

  item.updatedAt = new Date().toISOString();
  saveDatabase();

  return res.json(item);
});

// ----------------------------------------------------
// 7. WORKFORCE TASKS (KANBAN) ENDPOINTS
// ----------------------------------------------------
router.get('/tasks', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.tasks);
});

router.post('/tasks', authMiddleware, (req: AuthRequest, res: Response) => {
  const { title, description, status, priority, assignedTo, projectAcara, dueDate, linkedFileId, linkedNoteId } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Judul tugas wajib diisi.' });
  }

  const validStatuses = ['todo', 'in_progress', 'review', 'done'];
  const validPriorities = ['low', 'medium', 'high'];

  const db = getDatabase();
  const newTask: Task = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: description || '',
    status: validStatuses.includes(status) ? status : 'todo',
    priority: validPriorities.includes(priority) ? priority : 'medium',
    assignedTo: assignedTo || req.user!.username,
    projectAcara: projectAcara || 'Acara 1',
    linkedFileId,
    linkedNoteId,
    dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };

  db.tasks.unshift(newTask);
  logActivity(req.user!.username, 'Tambah Tugas', `Menambahkan task: ${newTask.title}`);
  saveDatabase(true);

  return res.status(201).json(newTask);
});

// Update Task (Ownership check: assigned user or admin)
router.put('/tasks/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const task = db.tasks.find(t => t.id === id);

  if (!task) {
    return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
  }

  // Authorization: Only PIC or admin can update
  if (task.assignedTo !== req.user?.username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya PIC tugas atau admin yang dapat mengubah.' });
  }

  const { title, description, status, priority, assignedTo, projectAcara, dueDate } = req.body;

  if (title !== undefined) task.title = String(title).trim();
  if (description !== undefined) task.description = String(description).trim();
  if (status && ['todo', 'in_progress', 'review', 'done'].includes(status)) task.status = status;
  if (priority && ['low', 'medium', 'high'].includes(priority)) task.priority = priority;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (projectAcara !== undefined) task.projectAcara = projectAcara;
  if (dueDate !== undefined) task.dueDate = dueDate;

  saveDatabase();
  return res.json(task);
});

// Delete Task (Ownership check: assigned user or admin)
router.delete('/tasks/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const index = db.tasks.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
  }

  const task = db.tasks[index];
  if (task.assignedTo !== req.user?.username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya PIC tugas atau admin yang dapat menghapus.' });
  }

  db.tasks.splice(index, 1);
  logActivity(req.user!.username, 'Hapus Tugas', `Menghapus tugas: ${task.title}`);
  saveDatabase(true);

  return res.json({ message: 'Tugas berhasil dihapus.' });
});

// ----------------------------------------------------
// 8. REFERENCES LIBRARY ENDPOINTS
// ----------------------------------------------------
router.get('/references', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.references);
});

router.post('/references', authMiddleware, (req: AuthRequest, res: Response) => {
  const { title, author, year, type, source, url, tags, fileId, notes } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'Judul dan penulis referensi wajib diisi.' });
  }

  const db = getDatabase();
  const newRef: ReferenceItem = {
    id: crypto.randomUUID(),
    title: title.trim(),
    author: author.trim(),
    year: Number(year) || 2026,
    type: type || 'Kepmen/Peraturan',
    source: source || '',
    url: url || undefined,
    tags: Array.isArray(tags) ? tags : [],
    fileId: fileId || undefined,
    notes: notes || ''
  };

  db.references.unshift(newRef);
  logActivity(req.user!.username, 'Tambah Referensi', `Menambahkan rujukan: ${newRef.title}`);
  saveDatabase(true);

  return res.status(201).json(newRef);
});

router.put('/references/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const ref = db.references.find(r => r.id === id);

  if (!ref) {
    return res.status(404).json({ error: 'Referensi tidak ditemukan.' });
  }

  const { title, author, year, type, source, url, tags, fileId, notes } = req.body;
  if (title !== undefined) ref.title = String(title).trim();
  if (author !== undefined) ref.author = String(author).trim();
  if (year !== undefined) ref.year = Number(year) || ref.year;
  if (type !== undefined) ref.type = type;
  if (source !== undefined) ref.source = String(source);
  if (url !== undefined) ref.url = url || undefined;
  if (tags !== undefined && Array.isArray(tags)) ref.tags = tags;
  if (fileId !== undefined) ref.fileId = fileId || undefined;
  if (notes !== undefined) ref.notes = String(notes);

  saveDatabase(true);
  return res.json(ref);
});

router.delete('/references/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const index = db.references.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Referensi tidak ditemukan.' });
  }

  const ref = db.references[index];
  db.references.splice(index, 1);
  logActivity(req.user!.username, 'Hapus Referensi', `Menghapus referensi: ${ref.title}`);
  saveDatabase(true);

  return res.json({ message: 'Referensi berhasil dihapus.' });
});

// ----------------------------------------------------
// 9. ASSESSMENTS ENDPOINTS (Only Admin / Evaluator can PUT)
// ----------------------------------------------------
router.get('/assessments', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.assessments);
});

router.put('/assessments/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  // Authorization: Only admin can update academic grades
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya evaluator atau admin yang dapat mengubah nilai.' });
  }

  const { id } = req.params;
  const { score, feedback, evaluator } = req.body;

  const db = getDatabase();
  const item = db.assessments.find(a => a.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Item penilaian tidak ditemukan.' });
  }

  if (score !== undefined) {
    const num = Number(score);
    if (!isNaN(num) && num >= 0 && num <= 100) item.score = num;
  }
  if (feedback !== undefined) item.feedback = String(feedback).trim();
  if (evaluator !== undefined) item.evaluator = String(evaluator).trim();

  item.updatedAt = new Date().toISOString();
  logActivity(req.user!.username, 'Update Penilaian', `Memperbarui nilai ${item.acara} (${item.category}): ${item.score}`);
  saveDatabase(true);

  return res.json(item);
});

// ----------------------------------------------------
// 10. TIMELINE ENDPOINTS
// ----------------------------------------------------
router.get('/timeline', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.timeline);
});

router.post('/timeline', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { title, period, dateRange, category, description, isMilestone } = req.body;
  if (!title || !period || !dateRange || !category || !description) {
    return res.status(400).json({ error: 'Semua field jadwal wajib diisi.' });
  }

  const db = getDatabase();
  const newEvent = {
    id: `tl-${Date.now()}`,
    title: String(title).trim(),
    period: String(period).trim(),
    dateRange: String(dateRange).trim(),
    category,
    description: String(description).trim(),
    isMilestone: Boolean(isMilestone)
  };

  db.timeline.push(newEvent);
  logActivity(req.user!.username, 'Tambah Jadwal', `Menambahkan jadwal timeline: ${newEvent.title}`);
  saveDatabase(true);

  return res.status(201).json(newEvent);
});

router.put('/timeline/:id', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const event = db.timeline.find(t => t.id === id);
  if (!event) {
    return res.status(404).json({ error: 'Jadwal timeline tidak ditemukan.' });
  }

  const { title, period, dateRange, category, description, isMilestone } = req.body;
  if (title !== undefined) event.title = String(title).trim();
  if (period !== undefined) event.period = String(period).trim();
  if (dateRange !== undefined) event.dateRange = String(dateRange).trim();
  if (category !== undefined) event.category = category;
  if (description !== undefined) event.description = String(description).trim();
  if (isMilestone !== undefined) event.isMilestone = Boolean(isMilestone);

  logActivity(req.user!.username, 'Update Jadwal', `Memperbarui jadwal timeline: ${event.title}`);
  saveDatabase(true);

  return res.json(event);
});

router.delete('/timeline/:id', authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const idx = db.timeline.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Jadwal timeline tidak ditemukan.' });
  }

  const event = db.timeline[idx];
  db.timeline.splice(idx, 1);
  logActivity(req.user!.username, 'Hapus Jadwal', `Menghapus jadwal timeline: ${event.title}`);
  saveDatabase(true);

  return res.json({ message: 'Jadwal berhasil dihapus.' });
});

// ----------------------------------------------------
// 11. WORKSPACE INFO ENDPOINTS
// ----------------------------------------------------
router.get(['/workspace/info', '/workspace-info'], authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  return res.json(db.workspaceInfo);
});

router.put(['/workspace/info', '/workspace-info'], authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { attendanceRule, labPcScheduleStatus, workDurationPerAcara } = req.body;

  if (attendanceRule !== undefined) db.workspaceInfo.attendanceRule = String(attendanceRule).trim();
  if (labPcScheduleStatus !== undefined) db.workspaceInfo.labPcScheduleStatus = String(labPcScheduleStatus).trim();
  if (workDurationPerAcara !== undefined) db.workspaceInfo.workDurationPerAcara = String(workDurationPerAcara).trim();

  db.workspaceInfo.updatedAt = new Date().toISOString();
  saveDatabase(true);

  return res.json(db.workspaceInfo);
});

// Update Workspace Official Logo (Admin only)
router.post(['/workspace/logo', '/workspace-logo'], authMiddleware, adminOnly, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { svgContent, dataUrl } = req.body;

  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    const distDir = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

    let finalSvg = '';

    if (svgContent && typeof svgContent === 'string' && svgContent.includes('<svg')) {
      finalSvg = svgContent.trim();
      fs.writeFileSync(path.join(publicDir, 'logo.svg'), finalSvg, 'utf-8');
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'logo.svg'), finalSvg, 'utf-8');
      }

      // Convert to logo.png using ffmpeg if possible
      try {
        execSync(`ffmpeg -y -i "${path.join(publicDir, 'logo.svg')}" -vf "scale=1024:1024" "${path.join(publicDir, 'logo.png')}"`, { stdio: 'ignore' });
        if (fs.existsSync(distDir)) {
          fs.copyFileSync(path.join(publicDir, 'logo.png'), path.join(distDir, 'logo.png'));
        }
      } catch (err) {
        console.warn('ffmpeg conversion warning:', err);
      }

      db.workspaceInfo.customLogoSvg = finalSvg;
      db.workspaceInfo.customLogoUrl = `/logo.svg?v=${Date.now()}`;
    } else if (dataUrl && typeof dataUrl === 'string') {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Format Data URL tidak valid.' });
      }

      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');

      if (mimeType === 'image/svg+xml' || mimeType.includes('svg')) {
        finalSvg = buffer.toString('utf-8');
        fs.writeFileSync(path.join(publicDir, 'logo.svg'), finalSvg, 'utf-8');
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(path.join(distDir, 'logo.svg'), finalSvg, 'utf-8');
        }
        try {
          execSync(`ffmpeg -y -i "${path.join(publicDir, 'logo.svg')}" -vf "scale=1024:1024" "${path.join(publicDir, 'logo.png')}"`, { stdio: 'ignore' });
          if (fs.existsSync(distDir)) {
            fs.copyFileSync(path.join(publicDir, 'logo.png'), path.join(distDir, 'logo.png'));
          }
        } catch (err) {
          console.warn('ffmpeg conversion warning:', err);
        }
        db.workspaceInfo.customLogoSvg = finalSvg;
        db.workspaceInfo.customLogoUrl = `/logo.svg?v=${Date.now()}`;
      } else {
        // PNG or other raster image
        fs.writeFileSync(path.join(publicDir, 'logo.png'), buffer);
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(path.join(distDir, 'logo.png'), buffer);
        }
        db.workspaceInfo.customLogoUrl = `/logo.png?v=${Date.now()}`;
        delete db.workspaceInfo.customLogoSvg;
      }
    } else {
      return res.status(400).json({ error: 'Harap lampirkan data SVG atau file gambar base64.' });
    }

    db.workspaceInfo.updatedAt = new Date().toISOString();
    saveDatabase(true);
    logActivity(req.user!.username, 'Update Logo', 'Memperbarui logo resmi perusahaan');

    return res.json({
      message: 'Logo resmi Vredefort Indonesia berhasil diperbarui.',
      workspaceInfo: db.workspaceInfo
    });
  } catch (err: any) {
    console.error('Update logo error:', err);
    return res.status(500).json({ error: 'Gagal memproses logo: ' + (err.message || 'Kesalahan server') });
  }
});

// ----------------------------------------------------
// 12. STORAGE STATS & DASHBOARD OVERVIEW
// ----------------------------------------------------
router.get(['/storage/stats', '/storage-stats'], authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const activeFiles = db.files.filter(f => !f.isTrashed);

  const usedBytes = activeFiles.reduce((acc, f) => acc + f.size, 0);
  const freeBytes = Math.max(0, STORAGE_LIMIT_BYTES - usedBytes);
  const percentUsed = (usedBytes / STORAGE_LIMIT_BYTES) * 100;

  const categories: Record<string, { bytes: number; count: number }> = {};
  for (const f of activeFiles) {
    const ext = f.extension.toLowerCase().replace('.', '') || 'other';
    if (!categories[ext]) {
      categories[ext] = { bytes: 0, count: 0 };
    }
    categories[ext].bytes += f.size;
    categories[ext].count += 1;
  }

  const largestFiles = [...activeFiles]
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      extension: f.extension,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt
    }));

  return res.json({
    totalCapacityBytes: STORAGE_LIMIT_BYTES,
    usedBytes,
    freeBytes,
    percentUsed: Math.min(100, Math.round(percentUsed * 10) / 10),
    isWarning: percentUsed >= 80,
    isCritical: percentUsed >= 95,
    categories,
    largestFiles
  });
});

// ----------------------------------------------------
// 13. GLOBAL SEARCH (Ctrl+K)
// ----------------------------------------------------
router.get('/search', authMiddleware, (req: AuthRequest, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.json({ files: [], notes: [], tasks: [], references: [], projects: [] });
  }

  const db = getDatabase();

  const files = db.files
    .filter(f => !f.isTrashed)
    .filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
    )
    .slice(0, 8);

  const notes = db.notes
    .filter(
      n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
    )
    .slice(0, 8);

  const tasks = db.tasks
    .filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    .slice(0, 8);

  const references = db.references
    .filter(
      r =>
        r.title.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
    )
    .slice(0, 8);

  const projects = db.projects
    .filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
    .slice(0, 8);

  return res.json({ files, notes, tasks, references, projects });
});

// ----------------------------------------------------
// 14. KNOWLEDGE GRAPH NETWORK
// ----------------------------------------------------
router.get('/graph', authMiddleware, (_req: AuthRequest, res: Response) => {
  const db = getDatabase();

  interface NodeItem {
    id: string;
    label: string;
    type: 'project' | 'note' | 'file' | 'task' | 'reference';
    color: string;
    radius: number;
    targetId: string;
  }

  interface LinkItem {
    source: string;
    target: string;
    label?: string;
  }

  const nodes: NodeItem[] = [];
  const links: LinkItem[] = [];

  // 1. Projects Nodes (Amber)
  for (const p of db.projects) {
    nodes.push({
      id: `node-${p.id}`,
      label: `${p.code}: ${p.title}`,
      type: 'project',
      color: '#f59e0b',
      radius: 20,
      targetId: p.id
    });
  }

  // 2. Notes Nodes (Cyan)
  for (const n of db.notes) {
    const nodeId = `node-${n.id}`;
    nodes.push({
      id: nodeId,
      label: n.title,
      type: 'note',
      color: '#06b6d4',
      radius: 14,
      targetId: n.id
    });

    if (n.acaraId) {
      const parentProj = db.projects.find(p => p.id === n.acaraId || p.acaraTag === n.acaraId);
      if (parentProj) {
        links.push({ source: nodeId, target: `node-${parentProj.id}`, label: 'Pedoman' });
      }
    }
  }

  // 3. Files Nodes (Emerald)
  for (const f of db.files.filter(f => !f.isTrashed)) {
    const nodeId = `node-${f.id}`;
    nodes.push({
      id: nodeId,
      label: f.name,
      type: 'file',
      color: '#10b981',
      radius: 12,
      targetId: f.id
    });

    if (f.acaraTag) {
      const parentProj = db.projects.find(p => p.acaraTag === f.acaraTag);
      if (parentProj) {
        links.push({ source: nodeId, target: `node-${parentProj.id}`, label: 'Model' });
      }
    }

    if (f.linkedNoteIds) {
      for (const nId of f.linkedNoteIds) {
        links.push({ source: nodeId, target: `node-${nId}`, label: 'Dokumen' });
      }
    }
  }

  // 4. Tasks Nodes (Purple)
  for (const t of db.tasks) {
    const nodeId = `node-${t.id}`;
    nodes.push({
      id: nodeId,
      label: t.title,
      type: 'task',
      color: '#a855f7',
      radius: 10,
      targetId: t.id
    });

    const parentProj = db.projects.find(p => p.acaraTag === t.projectAcara);
    if (parentProj) {
      links.push({ source: nodeId, target: `node-${parentProj.id}`, label: 'Task' });
    }
  }

  return res.json({ nodes, links });
});

export default router;
