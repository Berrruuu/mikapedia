# 🚨 Frontend 502 Bad Gateway - Troubleshooting Guide

## Masalah: Frontend container restart loop dan nginx menampilkan 502

### Root Cause
TanStack Start build output tidak menghasilkan `dist/server/server.js` seperti yang diharapkan Dockerfile lama.

---

## ✅ Solusi 1: Gunakan Dockerfile baru (Recommended)

### Di server VPS:

```bash
# 1. Pull update terbaru
cd /path/to/mika-ops-hub-main
git pull

# 2. Stop semua container
docker compose -f docker-compose.prod.yml down

# 3. Rebuild frontend dengan Dockerfile baru
docker compose -f docker-compose.prod.yml build --no-cache frontend

# 4. Start ulang
docker compose -f docker-compose.prod.yml up -d

# 5. Monitor logs
docker compose -f docker-compose.prod.yml logs -f frontend
```

**Expected output:**
```
frontend_1  | VITE v8.x.x  ready in XXX ms
frontend_1  | 
frontend_1  | ➜  Local:   http://0.0.0.0:3000/
frontend_1  | ➜  Network: http://172.x.x.x:3000/
```

---

## ✅ Solusi 2: Gunakan vite preview (Fallback)

Jika Solusi 1 masih error, gunakan Dockerfile alternatif:

```bash
# Gunakan Dockerfile.frontend.preview
cp Dockerfile.frontend.preview Dockerfile.frontend

# Rebuild
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend

# Check logs
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## 🔍 Debugging

### 1. Cek logs frontend container

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

**Error yang umum:**
- `Error: Cannot find module 'dist/server/server.js'` → Gunakan Dockerfile baru
- `EADDRINUSE :::3000` → Port conflict (kemungkinan kecil)
- `Cannot find package '@tanstack/react-start'` → Dependencies tidak terinstall

### 2. Cek struktur file di dalam container

```bash
# Masuk ke container (jika sedang running)
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q frontend) sh

# Cek struktur dist/
ls -la dist/
ls -la dist/server/

# Cek apakah node_modules ada
ls node_modules/ | grep tanstack

# Cek proses yang running
ps aux

# Exit
exit
```

### 3. Test manual start

```bash
# Masuk ke container
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q frontend) sh

# Test berbagai command:
node dist/server/index.js
# atau
npx vite preview --host 0.0.0.0 --port 3000

# Lihat error yang muncul
```

### 4. Gunakan debug script

```bash
chmod +x debug-frontend.sh
./debug-frontend.sh
```

---

## 🔧 Quick Fixes

### Fix 1: Rebuild tanpa cache

```bash
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Fix 2: Pastikan environment variables

Di `docker-compose.prod.yml`, pastikan frontend service punya:

```yaml
frontend:
  environment:
    - NODE_ENV=production
    - HOST=0.0.0.0
    - PORT=3000
    - VITE_API_URL=https://mikapedia.online/api  # Tambahkan ini jika belum
```

### Fix 3: Healthcheck untuk frontend

Tambahkan healthcheck di docker-compose.prod.yml:

```yaml
frontend:
  # ... existing config ...
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 30s
```

---

## 📊 Verify Everything Works

```bash
# 1. Semua container harus UP
docker compose -f docker-compose.prod.yml ps

# Expected:
# backend    Up (healthy)
# frontend   Up (healthy)
# nginx      Up
# db         Up (healthy)
# redis      Up (healthy)

# 2. Nginx bisa reach frontend
docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx) wget -q -O- http://frontend:3000

# Should return HTML content

# 3. Test dari luar
curl https://mikapedia.online/
# Should return frontend HTML (not 502)

# 4. Check nginx logs
docker compose -f docker-compose.prod.yml logs --tail=50 nginx | grep frontend
# Should NOT have "connect() failed" or "upstream timed out"
```

---

## 🆘 Masih Error?

1. **Check memory VPS**: Frontend build butuh minimal 1GB RAM
   ```bash
   free -h
   # Jika kurang, tambahkan swap
   ```

2. **Check disk space**:
   ```bash
   df -h
   # Pastikan ada space untuk build
   ```

3. **Build locally dulu** (test apakah build berhasil):
   ```bash
   npm run build
   ls -la dist/
   # Pastikan dist/ ada dan terisi
   ```

4. **Alternative: Deploy frontend di luar Docker**
   ```bash
   # Di VPS, install Node.js
   npm ci
   npm run build
   npm run preview -- --host 0.0.0.0 --port 3000 &
   
   # Update nginx proxy_pass ke localhost:3000
   ```

---

## 📝 Common Errors & Solutions

| Error | Solusi |
|-------|--------|
| `502 Bad Gateway` | Frontend tidak jalan di port 3000. Cek logs. |
| `Cannot find module` | Dependencies tidak terinstall. Rebuild dengan `npm ci`. |
| `EADDRINUSE` | Port 3000 sudah dipakai. Kill process lain atau ganti port. |
| Container restart loop | CMD di Dockerfile salah. Gunakan Dockerfile baru. |
| `upstream timed out` di nginx | Frontend start lambat. Tambahkan healthcheck. |
| Build error di Docker | Memory kurang. Tambah RAM/swap atau build di lokal. |

---

## 📞 Contact

Jika masih ada masalah, kirim output dari:
```bash
./debug-frontend.sh > frontend-debug.log
```
