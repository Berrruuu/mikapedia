# 🔄 Push Fix Login 401 ke Production

Panduan untuk push fix login 401 yang sudah diperbaiki ke production server.

---

## 📋 Apa yang Sudah Diperbaiki?

File yang diubah:
- ✅ `backend/users/serializers.py` - Fixed `UserCreateSerializer.create()` method

Issue yang diperbaiki:
- ✅ User baru yang dibuat oleh admin tidak bisa login (401 Unauthorized)

---

## 🚀 Langkah Push ke Production

### Opsi 1: Push via Git (Recommended)

#### 1. Di Komputer Lokal (Windows)

```bash
# Navigate ke project directory
cd "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main"

# Check status
git status

# Add changed files
git add backend/users/serializers.py
git add FIX-LOGIN-401-ISSUE.md
git add DEPLOY-VPS-GUIDE.md
git add DEPLOY-CHEATSHEET.md
git add PUSH-FIX-TO-PRODUCTION.md
git add deploy-quick.sh

# Commit changes
git commit -m "Fix: Set username correctly when creating new user to prevent 401 login error"

# Push to repository
git push origin main
```

#### 2. Di VPS (Production Server)

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

# Navigate ke project directory
cd /var/www/mika-ops-hub

# Pull latest changes
git pull origin main

# Restart backend service (no rebuild needed, Python reloads automatically)
docker compose -f docker-compose.prod.yml restart backend

# Check logs to ensure restart successful
docker compose -f docker-compose.prod.yml logs -f backend
```

**Catatan**: Untuk file Python, tidak perlu rebuild Docker image karena code di-mount sebagai volume atau Django auto-reloads.

---

### Opsi 2: Upload Manual via SCP (Alternative)

Jika tidak menggunakan Git atau repository private:

#### 1. Di Komputer Lokal (Windows)

```powershell
# Upload file yang diubah menggunakan SCP
scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\backend\users\serializers.py" root@YOUR_VPS_IP:/var/www/mika-ops-hub/backend/users/serializers.py

# Upload dokumentasi
scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\FIX-LOGIN-401-ISSUE.md" root@YOUR_VPS_IP:/var/www/mika-ops-hub/
scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\DEPLOY-VPS-GUIDE.md" root@YOUR_VPS_IP:/var/www/mika-ops-hub/
scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\DEPLOY-CHEATSHEET.md" root@YOUR_VPS_IP:/var/www/mika-ops-hub/
scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\deploy-quick.sh" root@YOUR_VPS_IP:/var/www/mika-ops-hub/
```

#### 2. Di VPS

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

# Make deploy script executable
cd /var/www/mika-ops-hub
chmod +x deploy-quick.sh

# Restart backend service
docker compose -f docker-compose.prod.yml restart backend

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

---

### Opsi 3: Rebuild Container (Safe but Slower)

Jika ingin lebih aman dengan full rebuild:

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

# Navigate to project
cd /var/www/mika-ops-hub

# Pull changes (if using git)
git pull origin main

# Stop backend
docker compose -f docker-compose.prod.yml stop backend

# Rebuild backend
docker compose -f docker-compose.prod.yml build backend

# Start backend
docker compose -f docker-compose.prod.yml up -d backend

# Check status
docker compose -f docker-compose.prod.yml ps backend

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## ✅ Verifikasi Fix Berhasil

### 1. Check Backend Running

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps backend

# Should show: Up (healthy)
```

### 2. Test Create User

**Via Admin Panel:**

1. Login ke admin panel: `https://mikapedia.online`
2. Login dengan akun owner/admin
3. Go to Users page
4. Klik "Create New User"
5. Isi form:
   - Email: `testuser@example.com`
   - Password: `TestPassword123!`
   - First Name: `Test`
   - Last Name: `User`
   - Role: Trader
6. Klik "Create"

### 3. Test Login dengan User Baru

1. Logout dari admin
2. Go to login page: `https://mikapedia.online/login`
3. Login dengan:
   - Email: `testuser@example.com`
   - Password: `TestPassword123!`
4. **Expected**: Login berhasil, redirect ke trader dashboard
5. **Before fix**: 401 Unauthorized error

### 4. Check Logs (Optional)

```bash
# Check backend logs untuk request login
docker compose -f docker-compose.prod.yml logs --tail=50 backend | grep "auth.login"

# Should see successful login entries
```

---

## 🔧 Troubleshooting

### Fix Tidak Apply / Masih Error 401

**1. Check file sudah terupdate di VPS**

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

# Check file content
cd /var/www/mika-ops-hub
cat backend/users/serializers.py | grep -A 10 "def create"

# Should show the fixed version with:
#   email = validated_data.get('email')
#   validated_data['username'] = email
```

**2. Force restart backend**

```bash
cd /var/www/mika-ops-hub

# Stop
docker compose -f docker-compose.prod.yml stop backend

# Start
docker compose -f docker-compose.prod.yml up -d backend

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

**3. Full rebuild if still not working**

```bash
cd /var/www/mika-ops-hub

docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache backend
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

### User yang Sudah Dibuat Sebelum Fix

Jika sudah ada user yang dibuat sebelum fix dan tidak bisa login:

**Opsi 1: Reset Password via Admin**

1. Login sebagai admin/owner
2. Go to Users page
3. Klik user yang bermasalah
4. Klik "Reset Password"
5. Set password baru
6. User bisa login dengan password baru

**Opsi 2: Fix via Django Shell**

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

cd /var/www/mika-ops-hub

# Run Django shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

# Find users with empty or wrong username
users = User.objects.filter(username='') | User.objects.filter(username__isnull=True)

# Or find specific user
user = User.objects.get(email='problematic@example.com')

# Fix username
for user in users:
    user.username = user.email
    user.save()
    print(f"Fixed: {user.email}")

# Exit shell
exit()
```

---

## 📊 Monitoring Post-Deployment

### Check Error Logs (First 24 Hours)

```bash
# Check for any 401 errors
docker compose -f docker-compose.prod.yml logs backend | grep "401"

# Check for authentication errors
docker compose -f docker-compose.prod.yml logs backend | grep "authentication_failed"

# Check successful logins
docker compose -f docker-compose.prod.yml logs backend | grep "auth.login"
```

### Monitor Resource Usage

```bash
# Check if backend is healthy
docker compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats mika-ops-hub-backend-1
```

---

## 🔄 Rollback (If Needed)

Jika ada masalah setelah deploy fix:

### Rollback via Git

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

cd /var/www/mika-ops-hub

# View commit history
git log --oneline -5

# Rollback to previous commit
git reset --hard PREVIOUS_COMMIT_HASH

# Restart backend
docker compose -f docker-compose.prod.yml restart backend
```

### Rollback Manual

```bash
# Restore old file (if you have backup)
cp backend/users/serializers.py.backup backend/users/serializers.py

# Restart backend
docker compose -f docker-compose.prod.yml restart backend
```

---

## 📝 Checklist Deploy Fix

- [ ] File `backend/users/serializers.py` sudah diupdate di local
- [ ] Changes sudah di-commit ke git (or file ready to upload)
- [ ] Connected to VPS via SSH
- [ ] Latest code pulled/uploaded to VPS
- [ ] Backend service restarted
- [ ] Backend logs checked (no errors)
- [ ] Test: Create new user via admin panel
- [ ] Test: Login dengan user yang baru dibuat
- [ ] Login berhasil (no 401 error)
- [ ] Old problematic users fixed (if any)
- [ ] Monitoring logs untuk 24 jam pertama

---

## 🎯 Expected Result

✅ **Before Fix:**
- Admin membuat user baru
- User mencoba login
- ❌ Error: 401 Unauthorized
- User tidak bisa masuk

✅ **After Fix:**
- Admin membuat user baru
- User mencoba login
- ✅ Login berhasil
- User masuk ke dashboard sesuai role

---

## 📞 Support

Jika masih ada masalah:

1. **Check logs**: `docker compose -f docker-compose.prod.yml logs -f backend`
2. **Check file content**: `cat backend/users/serializers.py | grep -A 10 "def create"`
3. **Full restart**: `docker compose -f docker-compose.prod.yml restart`
4. **Review**: `FIX-LOGIN-401-ISSUE.md` untuk detail teknis

---

**Fix Date**: September 1, 2026  
**Priority**: High  
**Downtime**: None (hot reload)
