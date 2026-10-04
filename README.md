# VREDEFORT INDONESIA ⛏️
> **Sistem Informasi & Manajemen Perencanaan Tambang Mineral**  
> Workspace kolaboratif untuk pemodelan geologi, block model, optimasi pit, perancangan pushback, hidrologi tambang, evaluasi kelayakan finansial, catatan teknis bergaya Notion, dan manajemen berkas geospasial/CAD/Surpac.

---

## 🌟 Fitur Utama

- 📐 **Perencanaan Tambang (Acara & Proyek)**: Manajemen tahapan perencanaan, target deliverables, status progres, dan pembagian tugas tim.
- 📝 **Catatan Teknis & Lembar Kerja (Notion Style)**: Editor dokumen interaktif dengan dukungan penyusun rumus visual (ala Microsoft Word), embedding gambar/diagram, checklist target, dan ekspor ke **PDF Resmi ber-kop surat**.
- 🗄️ **Penyimpanan Berkas (In-App Preview)**: Repositori berkas tambang dengan kemampuan membaca langsung PDF, penampil gambar (zoom & rotasi), spreadsheet Excel (`.xlsx`, `.xls`, `.csv`), dan panel metadata lengkap.
- 📊 **Papan Kanban & Target Kerja**: Manajemen tugas tim (*To Do, In Progress, Review, Done*) dan pelacakan target mingguan.
- 🌐 **Peta Hubungan Kerja (Knowledge Graph)**: Visualisasi keterhubungan interaktif antara berkas, modul acara, catatan, dan entitas teknis.
- 🔒 **Sistem Autentikasi 3-Peran**: Hak akses terstruktur untuk *Administrator*, *Member*, dan akses terlindungi untuk *Tamu*.

---

## 🚀 Memulai (Development & Local Setup)

### Prasyarat
- **Node.js**: Versi `20.x` LTS atau lebih baru
- **NPM**: Versi `9.x` / `10.x`

### Instalasi & Menjalankan Server Lokal
```bash
# 1. Clone repositori ini
git clone https://github.com/<username>/<nama-repo>.git
cd <nama-repo>

# 2. Install semua dependensi
npm install

# 3. Jalankan server lokal (Development Mode)
npm run dev
```
Akses aplikasi di peramban Anda melalui: `http://localhost:3000`

---

## 🌐 Panduan Deployment ke VPS (Production)

Proyek ini telah dilengkapi konfigurasi siap pakai untuk **Nginx**, **PM2 Process Manager**, dan **Certbot SSL**:

1. **Build Frontend Production**:
   ```bash
   npm run build
   ```
2. **Jalankan Background Service dengan PM2**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```
3. **Konfigurasi Reverse Proxy Nginx**:
   Salin berkas `deploy/nginx-mf035.my.id.conf` ke `/etc/nginx/sites-available/` dan aktifkan.
4. **Pasang Sertifikat SSL HTTPS**:
   ```bash
   sudo certbot --nginx -d mf035.my.id -d www.mf035.my.id
   ```

*Panduan lengkap langkah demi langkah tersedia pada file [PANDUAN_DEPLOYMENT_VPS.md](./PANDUAN_DEPLOYMENT_VPS.md).*

---

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, KaTeX
- **Backend / Server**: Express.js, TypeScript, Multer, XLSX Engine
- **Process Manager**: PM2
- **Web Server**: Nginx Reverse Proxy

---
© 2026 **VREDEFORT INDONESIA** · Laboratorium & Perencanaan Tambang Mineral TA 2026/2027.
