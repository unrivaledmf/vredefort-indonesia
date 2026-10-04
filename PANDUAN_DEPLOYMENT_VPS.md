# Panduan Lengkap Deployment ke VPS (Ubuntu/Debian)

**Spesifikasi Server Anda:**
- **Domain:** `mf035.my.id`
- **IP VPS:** `202.10.37.170`

---

## Langkah 1: Setting DNS di Registrar Domain Anda
Masuk ke Dashboard tempat Anda membeli domain `mf035.my.id` (misalnya Cloudflare, Niagahoster, DomaiNesia, Rumahweb, dll.) dan buat **DNS Record** berikut:

| Tipe | Nama / Host | Nilai / Target IP | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `202.10.37.170` | Auto / 3600 |
| **A** | `www` | `202.10.37.170` | Auto / 3600 |

*(Jika menggunakan Cloudflare, matikan mode Proxy (ikon awan oranye) terlebih dahulu menjadi **DNS Only (abu-abu)** saat pertama kali generate SSL Certbot).*

---

## Langkah 2: Masuk ke VPS via SSH
Buka terminal (macOS/Linux) atau Git Bash / PowerShell / PuTTY (Windows), lalu login:

```bash
ssh root@202.10.37.170
```

---

## Langkah 3: Update Server & Install Node.js, Nginx, Git, PM2
Jalankan perintah berikut di VPS:

```bash
# 1. Update paket sistem
sudo apt update && sudo apt upgrade -y

# 2. Install Nginx, Git, Curl, dan UFW Firewall
sudo apt install -y nginx git curl ufw certbot python3-certbot-nginx

# 3. Install Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Verifikasi versi
node -v   # Pastikan v20.x.x
npm -v

# 5. Install PM2 secara global (agar web nyala 24/7 dan auto-restart jika server reboot)
sudo npm install -g pm2
```

---

## Langkah 4: Setup Direktori & Tarik Source Code Proyek
Buat direktori kerja di `/var/www/mf035.my.id`:

```bash
# Buat folder
sudo mkdir -p /var/www/mf035.my.id
sudo chown -R $USER:$USER /var/www/mf035.my.id

# Masuk ke folder
cd /var/www/mf035.my.id

# Upload atau Clone source code proyek Anda ke folder ini
# Contoh jika menggunakan Git:
# git clone <URL_REPO_ANDA> .

# Atau jika mengunggah zip/tar:
# unzip project.zip -d /var/www/mf035.my.id/
```

Setelah file berada di `/var/www/mf035.my.id`, jalankan instalasi dependency & build:

```bash
cd /var/www/mf035.my.id

# 1. Install dependencies
npm install

# 2. Build frontend production
npm run build

# 3. Buat folder penyimpanan log PM2
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2
```

---

## Langkah 5: Jalankan Aplikasi dengan PM2 (Nyala Terus 24 Jam Non-Stop)
PM2 memastikan aplikasi tetap hidup meskipun server mengalami crash atau reboot:

```bash
cd /var/www/mf035.my.id

# 1. Jalankan aplikasi menggunakan file ecosystem.config.cjs
pm2 start ecosystem.config.cjs

# 2. Simpan daftar proses aktif PM2
pm2 save

# 3. Aktifkan PM2 agar otomatis berjalan saat VPS reboot/nyala ulang
pm2 startup
# (Salin dan jalankan baris perintah `sudo env PATH=...` yang dimunculkan oleh terminal jika ada)
```

**Perintah Berguna untuk Mengelola PM2:**
- `pm2 status` : Melihat status aplikasi (apakah *online*, memori yang digunakan, dll.).
- `pm2 logs vredefort-app` : Melihat log server secara real-time.
- `pm2 restart vredefort-app` : Restart aplikasi.
- `pm2 stop vredefort-app` : Menghentikan sementara aplikasi.

---

## Langkah 6: Konfigurasi Nginx Reverse Proxy
Salin file konfigurasi Nginx yang telah disiapkan:

```bash
# 1. Buat file konfigurasi Nginx
sudo nano /etc/nginx/sites-available/mf035.my.id
```

Tempelkan isi konfigurasi berikut:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mf035.my.id www.mf035.my.id;

    # Batas ukuran upload file (disesuaikan dengan upload PDF/Excel/DWG di aplikasi)
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}
```

Simpan file (`Ctrl + O`, `Enter`, lalu `Ctrl + X`).

Aktifkan konfigurasi dan restart Nginx:

```bash
# 2. Buat symlink ke sites-enabled
sudo ln -s /etc/nginx/sites-available/mf035.my.id /etc/nginx/sites-enabled/

# 3. Hapus default config jika ada (opsional)
sudo rm -f /etc/nginx/sites-enabled/default

# 4. Tes apakah sintaks konfigurasi Nginx valid
sudo nginx -t

# 5. Reload Nginx
sudo systemctl reload nginx
```

---

## Langkah 7: Pasang SSL HTTPS Gratis (Let's Encrypt Certbot)
Agar domain Anda aman dengan gembok hijau (`https://mf035.my.id`), jalankan:

```bash
sudo certbot --nginx -d mf035.my.id -d www.mf035.my.id
```

- Masukkan email Anda untuk notifikasi sertifikat.
- Pilih `Y` untuk menyetujui Terms of Service.
- Certbot akan otomatis mengedit konfigurasi Nginx untuk mengalihkan seluruh lalu lintas HTTP ke HTTPS.

Sertifikat SSL Let's Encrypt akan diperbarui secara otomatis sebelum kedaluwarsa.

---

## Langkah 8: Konfigurasi Firewall (UFW) untuk Keamanan VPS
Aktifkan firewall agar VPS Anda terlindungi:

```bash
# Buka port SSH, HTTP, dan HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Aktifkan firewall
sudo ufw enable
```

---

## Ringkasan Alur Kerja Pembaruan (Update Code) di Masa Depan
Jika Anda ingin memperbarui fitur di VPS:

```bash
cd /var/www/mf035.my.id
# 1. Update source code (git pull atau upload file baru)
git pull origin main

# 2. Install dependencies (bila ada paket baru)
npm install

# 3. Build frontend
npm run build

# 4. Restart aplikasi PM2 tanpa downtime
pm2 restart vredefort-app
```

Website Anda di **https://mf035.my.id** sekarang telah aktif sepenuhnya, aman dengan HTTPS, dan berjalan 24 jam nonstop di latar belakang (*background service*).
