import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getDatabase } from './db.ts';

// Get or validate SESSION_SECRET
let JWT_SECRET = process.env.SESSION_SECRET || 'vredefort-indonesia-secure-session-secret-key-2026';
if (!process.env.SESSION_SECRET) {
  console.warn('[SECURITY] SESSION_SECRET belum diset di .env - memakai kunci default yang terlihat di source code. Segera set SESSION_SECRET.');
}

// In-Memory Login Rate Limiter (Max 5 failed attempts per 15 minutes per IP + username)
interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (now > record.resetAt) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkLoginRateLimit(ip: string, username: string): { allowed: boolean; remainingMinutes: number } {
  const key = `${ip}:${username.trim().toLowerCase()}`;
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true, remainingMinutes: 15 };
  }

  if (now > record.resetAt) {
    loginAttempts.delete(key);
    return { allowed: true, remainingMinutes: 15 };
  }

  if (record.attempts >= 5) {
    const remainingMinutes = Math.ceil((record.resetAt - now) / 60000);
    return { allowed: false, remainingMinutes };
  }

  return { allowed: true, remainingMinutes: Math.ceil((record.resetAt - now) / 60000) };
}

export function recordFailedLogin(ip: string, username: string): void {
  const key = `${ip}:${username.trim().toLowerCase()}`;
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { attempts: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.attempts += 1;
  }
}

export function resetLoginRateLimit(ip: string, username: string): void {
  const key = `${ip}:${username.trim().toLowerCase()}`;
  loginAttempts.delete(key);
}

// Secure password hashing with PBKDF2 (100,000 iterations, 64-byte key)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const verifyBuf = Buffer.from(verifyHash, 'hex');
    if (hashBuf.length !== verifyBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, verifyBuf);
  } catch {
    return false;
  }
}

export type Role = 'admin' | 'member' | 'guest';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'upload'
  | 'download'
  | 'approve'
  | 'manage_settings'
  | 'manage_guest_access'
  | 'publish_to_guest'
  | 'submit'
  | 'view_internal';

// Role-to-actions permissions table
const ROLE_PERMISSIONS: Record<Role, Set<Action>> = {
  admin: new Set<Action>([
    'read',
    'create',
    'update',
    'delete',
    'upload',
    'download',
    'approve',
    'manage_settings',
    'manage_guest_access',
    'publish_to_guest',
    'submit',
    'view_internal'
  ]),
  member: new Set<Action>([
    'read',
    'create',
    'update',
    'delete',
    'upload',
    'download',
    'submit',
    'view_internal'
  ]),
  guest: new Set<Action>([
    'read',
    'download'
  ])
};

export function can(user: { role?: string } | undefined | null, action: Action): boolean {
  if (!user || !user.role) return false;
  const role = user.role as Role;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.has(action);
}

export interface TokenPayload {
  id: string;
  username: string;
  role: Role;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export function generateToken(
  user: { id: string; username: string; role: Role; tokenVersion?: number },
  expiresInMs: number = 7 * 24 * 60 * 60 * 1000 // default 7 days
): string {
  const now = Date.now();
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion || 1,
    iat: now,
    exp: now + expiresInMs
  };

  const base64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET!).update(base64).digest('base64url');
  return `${base64}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [base64, signature] = token.split('.');
    if (!base64 || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', JWT_SECRET!).update(base64).digest('base64url');

    const sigBuf = Buffer.from(signature, 'utf-8');
    const expectedBuf = Buffer.from(expectedSig, 'utf-8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    const db = getDatabase();

    // Guest token validation: no entry in db.users, but guest access must be enabled in siteSettings
    if (payload.role === 'guest') {
      if (db.siteSettings?.guestAccess && !db.siteSettings.guestAccess.enabled) {
        return null;
      }
      return payload;
    }

    // Verify tokenVersion against DB to immediately invalidate old tokens after password changes
    const dbUser = db.users.find(u => u.id === payload.id);
    if (!dbUser) return null;

    const currentVersion = dbUser.tokenVersion || 1;
    if (payload.tokenVersion !== currentVersion) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Support Bearer header or ?token query parameter (used for raw streaming endpoints)
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesi telah berakhir atau tidak valid, silakan login kembali.' });
  }

  req.user = payload;
  next();
}

export function requireNotGuest(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role === 'guest') {
    return res.status(403).json({ error: 'Akses ditolak: Mode tamu tidak diizinkan mengakses fitur internal ini.' });
  }
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Akses ditolak: Operasi ini membutuhkan peran [${allowedRoles.join(', ')}].` });
    }
    next();
  };
}

export function requirePermission(action: Action) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!can(req.user, action)) {
      return res.status(403).json({ error: `Akses ditolak: Anda tidak memiliki izin '${action}'.` });
    }
    next();
  };
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Operasi ini membutuhkan hak akses Admin.' });
  }
  next();
}

// Guest download rate limiter (per IP, e.g. 60 downloads per hour)
const guestDownloads = new Map<string, { count: number; resetAt: number }>();

export function checkGuestDownloadLimit(ip: string, limitPerHour: number = 60): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = guestDownloads.get(ip);
  if (!record || now > record.resetAt) {
    guestDownloads.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return { allowed: true, remaining: limitPerHour - 1 };
  }
  if (record.count >= limitPerHour) {
    return { allowed: false, remaining: 0 };
  }
  record.count += 1;
  return { allowed: true, remaining: limitPerHour - record.count };
}
