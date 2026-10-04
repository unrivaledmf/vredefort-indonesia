#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const username = args[0]?.trim();
const newPassword = args[1]?.trim();

if (!username || !newPassword) {
  console.error('Penggunaan: node scripts/reset-password.mjs <username> <password-baru>');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('Kesalahan: Password baru minimal harus 8 karakter.');
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), 'data', 'db.json');

if (!fs.existsSync(dbPath)) {
  console.error(`Kesalahan: File database tidak ditemukan di ${dbPath}`);
  process.exit(1);
}

try {
  const raw = fs.readFileSync(dbPath, 'utf-8');
  const db = JSON.parse(raw);

  if (!db.users || !Array.isArray(db.users)) {
    console.error('Kesalahan: Struktur data pengguna tidak valid dalam database.');
    process.exit(1);
  }

  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    console.error(`Kesalahan: Pengguna dengan username "${username}" tidak ditemukan.`);
    process.exit(1);
  }

  // PBKDF2, 100000 iterasi, 64 byte, sha512 (sama dengan server/auth.ts)
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, 'sha512').toString('hex');

  user.salt = salt;
  user.passwordHash = hash;
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 1) + 1;

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`Sukses: Password untuk @${user.username} (${user.fullName}) berhasil diperbarui.`);
} catch (err) {
  console.error('Gagal memperbarui password:', err.message);
  process.exit(1);
}
