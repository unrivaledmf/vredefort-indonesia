#!/usr/bin/env bash
# Jalankan dari folder project di VPS:  bash update-vps.sh
set -e
echo "=== [1/3] npm install ==="
npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
echo "=== [2/3] npm run build ==="
npm run build
echo "=== [3/3] restart PM2 ==="
if pm2 describe vredefort-app > /dev/null 2>&1; then
  pm2 restart vredefort-app --update-env
else
  pm2 start ecosystem.config.cjs && pm2 save
fi
echo "SELESAI. Cek: pm2 logs vredefort-app --lines 30"
