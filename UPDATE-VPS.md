# 🔄 Update Sistem di VPS - Panduan Lengkap

> Panduan step-by-step untuk update perubahan kode ke production VPS

---

## 📋 Prerequisites

- Akses SSH ke VPS
- Git sudah terinstall di VPS
- Docker & Docker Compose sudah berjalan
- Repository sudah di-clone di VPS

---

## ⚡ Metode 1: Update Cepat (Recommended)

### Step 1: SSH ke VPS

```bash
ssh root@your-vps-ip
# atau
ssh username@your-vps-ip
```

### Step 2: Masuk ke Direktori Project

```bash
cd /path/to/mika-ops-hub
# Contoh: cd /root/mika-ops-hub
```

### Step 3: Pull Perubahan dari GitHub

```bash
# Pastikan di branch yang benar (main2)
git branch

# Pull perubahan terbaru
git pull origin main2
```

### Step 4: Rebuild & Restart Container Frontend

Karena perubahan hanya di frontend, kita cukup rebuild frontend saja:

```bash
# Rebuild frontend container
docker compose -f docker-compose.prod.yml build frontend

# Restart frontend container
docker compose -f docker-compose.prod.yml up -d frontend
```

### Step 5: Verifikasi Update Berhasil

```bash
# Cek status container
docker compose -f docker-compose.prod.yml ps

# Lihat logs frontend
docker compose -f docker-compose.prod.yml logs -f frontend

# Tekan Ctrl+C untuk keluar dari logs
```

### Step 6: Clear Browser Cache

- Buka browser
- Tekan `Ctrl + Shift + R` (Windows) atau `Cmd + Shift + R` (Mac)
- Atau clear browser cache secara manual

---

## 🔄 Metode 2: Full Restart (Jika Ada Masalah)

Jika Metode 1 tidak berhasil, gunakan full restart:

```bash
cd /path/to/mika-ops-hub

# Pull perubahan
git pull origin main2

# Stop semua container
docker compose -f docker-compose.prod.yml down

# Rebuild semua container (optional, jika ada perubahan dependency)
docker compose -f docker-compose.prod.yml build

# Start semua container
docker compose -f docker-compose.prod.yml up -d

# Cek status
docker compose -f docker-compose.prod.yml ps
```

---

## 🛠️ Metode 3: Selective Update (Advanced)

Jika hanya ingin update service tertentu:

### Frontend Only (Untuk perubahan UI/React):

```bash
git pull origin main2
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Backend Only (Untuk perubahan Django/Python):

```bash
git pull origin main2
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml restart backend celery-worker celery-beat
```

### Nginx Only (Untuk perubahan konfigurasi):

```bash
git pull origin main2
docker compose -f docker-compose.prod.yml build nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 🔍 Troubleshooting

### Issue 1: Container Tidak Start

```bash
# Cek logs untuk error
docker compose -f docker-compose.prod.yml logs frontend

# Force recreate container
docker compose -f docker-compose.prod.yml up -d --force-recreate frontend
```

### Issue 2: Perubahan Tidak Muncul

```bash
# Pastikan git pull berhasil
git status
git log --oneline -5

# Rebuild tanpa cache
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Issue 3: 502 Bad Gateway

```bash
# Cek apakah frontend benar-benar running
docker compose -f docker-compose.prod.yml ps

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx

# Jika masih error, rebuild frontend
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

---

## 📊 Useful Commands

### Monitoring

```bash
# Status semua container
docker compose -f docker-compose.prod.yml ps

# Logs real-time
docker compose -f docker-compose.prod.yml logs -f frontend

# Logs 100 baris terakhir
docker compose -f docker-compose.prod.yml logs --tail=100 frontend

# Resource usage
docker stats
```

### Debugging

```bash
# Masuk ke container frontend
docker compose -f docker-compose.prod.yml exec frontend sh

# Cek file di container
docker compose -f docker-compose.prod.yml exec frontend ls -la /app/dist

# Restart container tertentu
docker compose -f docker-compose.prod.yml restart frontend
```

### Cleanup (Jika Perlu)

```bash
# Remove unused images
docker image prune -f

# Remove unused volumes (HATI-HATI!)
docker volume prune -f

# Remove stopped containers
docker container prune -f
```

---

## ✅ Verification Checklist

Setelah update, pastikan:

- [ ] Container frontend status: `Up`
- [ ] Logs tidak ada error critical
- [ ] Website bisa diakses via browser
- [ ] Login masih berfungsi
- [ ] Icon muncul di mobile & desktop
- [ ] Dashboard cards tampil dengan benar

---

## 🚨 Rollback Plan (Jika Update Bermasalah)

Jika update menyebabkan error:

```bash
# 1. Kembali ke commit sebelumnya
git log --oneline -5
git checkout <commit-hash-sebelumnya>

# 2. Rebuild & restart
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend

# 3. Setelah stabil, update branch
git checkout main2
git pull origin main2
```

---

## 📝 Update Checklist untuk Commit Ini

Karena perubahan kali ini adalah **responsive icon fix**:

```bash
# 1. SSH ke VPS
ssh root@your-vps-ip

# 2. Masuk ke direktori
cd /root/mika-ops-hub  # sesuaikan path

# 3. Pull perubahan
git pull origin main2

# 4. Rebuild frontend
docker compose -f docker-compose.prod.yml build frontend

# 5. Restart frontend
docker compose -f docker-compose.prod.yml up -d frontend

# 6. Cek status
docker compose -f docker-compose.prod.yml ps

# 7. Lihat logs (optional)
docker compose -f docker-compose.prod.yml logs -f frontend

# 8. Test di browser (clear cache dulu!)
```

---

## 🎯 Expected Output

Setelah update berhasil, Anda akan melihat:

```
✅ Container frontend status: Up
✅ Health check: healthy
✅ Icon muncul di mobile & desktop
✅ Responsive layout bekerja dengan baik
✅ No console errors
```

---

## 💡 Pro Tips

1. **Backup Database Sebelum Update:**
   ```bash
   docker compose -f docker-compose.prod.yml exec db pg_dump -U mikapedia mikapedia_toms > backup.sql
   ```

2. **Test di Staging Dulu (Jika Ada):**
   Jika punya environment staging, test dulu sebelum update production

3. **Update di Off-Peak Hours:**
   Update saat traffic rendah untuk minimize impact

4. **Monitor Logs Setelah Update:**
   Pantau logs minimal 5-10 menit setelah update

5. **Clear CDN Cache (Jika Ada):**
   Jika menggunakan Cloudflare/CDN, purge cache

---

## 📞 Support

Jika ada masalah saat update:

1. Cek logs: `docker compose -f docker-compose.prod.yml logs -f frontend`
2. Cek status: `docker compose -f docker-compose.prod.yml ps`
3. Lihat [DEPLOY-TROUBLESHOOT.md](DEPLOY-TROUBLESHOOT.md)
4. Contact development team

---

**Last Updated:** January 2025  
**For Commit:** fix responsive icon display in StatCard
