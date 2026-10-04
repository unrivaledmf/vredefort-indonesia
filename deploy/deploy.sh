#!/usr/bin/env bash

# Script Otomatisasi Setup & Update Server VREDEFORT INDONESIA
# Domain: mf035.my.id | IP: 202.10.37.170

set -e

echo "=== [1/4] Menginstall dependencies ==="
npm install

echo "=== [2/4] Melakukan build frontend production ==="
npm run build

echo "=== [3/4] Menyiapkan direktori log ==="
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2 2>/dev/null || true

echo "=== [4/4] Memulai / Merestart aplikasi di PM2 ==="
if pm2 describe vredefort-app > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo "=== SUKSES: Aplikasi aktif dan berjalan untuk https://mf035.my.id ==="
