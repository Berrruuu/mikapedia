# 🚀 Quick Fix - Frontend 502 Error

## ⚡ Langkah Cepat (5 Menit)

### Di VPS/Hostinger:

```bash
# 1. Masuk ke direktori project
cd /path/to/mika-ops-hub-main

# 2. Pull update terbaru
git pull

# 3. Stop container frontend
docker compose -f docker-compose.prod.yml stop frontend

# 4. Rebuild frontend tanpa cache
docker compose -f docker-compose.prod.yml build --no-cache frontend

# 5. Start ulang frontend
docker compose -f docker-compose.prod.yml up -d frontend

# 6. Monitor logs (Ctrl+C untuk keluar)
docker compose -f docker-compose.prod.yml logs -f frontend
```

### ✅ Expected Output di Logs:

```
frontend_1  | VITE v8.x.x  ready in 843 ms
frontend_1  | 
frontend_1  | ➜  Local:   http://0.0.0.0:3000/
frontend_1  | ➜  Network: http://172.18.0.5:3000/
frontend_1  | ➜  press h + enter to show help
```

### ✅ Verify:

```bash
# Cek semua container UP
docker compose -f docker-compose.prod.yml ps

# Test dari dalam nginx
docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx) wget -q -O- http://frontend:3000 | head -20

# Test dari browser
curl https://mikapedia.online/
```

---

## 🔴 Jika Masih Restart Loop

### Check logs untuk error:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 frontend
```

### Common Errors:

**1. Cannot find module 'dist/server/index.js'**
```bash
# Masuk ke container (jika masih running)
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q frontend) sh
ls -la dist/
ls -la dist/server/
exit

# Jika folder kosong, rebuild
docker compose -f docker-compose.prod.yml build --no-cache frontend
```

**2. npm ci failed / network timeout**
```bash
# Build locally dulu, lalu copy
npm ci
npm run build

# Copy hasil build ke Dockerfile manual atau build ulang
```

**3. Memory error saat build**
```bash
# Check memory
free -h

# Jika kurang dari 1GB free, tambah swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Rebuild
docker compose -f docker-compose.prod.yml build --no-cache frontend
```

**4. Port 3000 sudah digunakan**
```bash
# Check apa yang pakai port 3000
sudo lsof -i :3000
# atau
ss -tulpn | grep 3000

# Kill process jika ada
sudo kill -9 <PID>
```

---

## 🆘 Alternative: Deploy Frontend di Luar Docker

Jika Docker masih bermasalah, deploy manual:

```bash
# Install Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Build dan run
cd /path/to/mika-ops-hub-main
npm ci
npm run build
npm run preview -- --host 0.0.0.0 --port 3000 &

# Buat systemd service (optional, untuk auto-restart)
sudo nano /etc/systemd/system/mikapedia-frontend.service
```

Isi service file:
```ini
[Unit]
Description=Mikapedia Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/mika-ops-hub-main
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mikapedia-frontend
sudo systemctl start mikapedia-frontend
sudo systemctl status mikapedia-frontend
```

---

## 📞 Still Error? Run Debug Script

```bash
chmod +x debug-frontend.sh
./debug-frontend.sh > debug-output.txt
cat debug-output.txt
```

Kirim output `debug-output.txt` untuk analisis lebih lanjut.

---

## ✅ Checklist Deployment

- [ ] Git pull berhasil
- [ ] Docker build berhasil (tanpa error)
- [ ] Container frontend status = UP (healthy)
- [ ] Logs menampilkan "VITE ready in XXX ms"
- [ ] `docker exec nginx wget http://frontend:3000` berhasil
- [ ] Browser bisa akses https://mikapedia.online/
- [ ] Tidak ada 502 Bad Gateway

---

## 🎯 What Changed?

### Dockerfile.frontend:
- ✅ Fix: Added `import time` di service.py (backend)
- ✅ Fix: Changed CMD dari `node dist/server/server.js` → `node --conditions=react-server dist/server/index.js`
- ✅ Fix: Added production dependencies install (`npm ci --omit=dev`)
- ✅ Fix: Copy `.vinxi` folder for TanStack Start runtime

### docker-compose.prod.yml:
- ✅ Added healthcheck untuk frontend
- ✅ Increased start_period ke 40s (build frontend butuh waktu)

### Backend .env.production:
- ✅ Changed `MT5_USE_SIMULATION=True` (Linux tidak support MetaTrader5)
