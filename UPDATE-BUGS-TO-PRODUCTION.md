# 🐛 Update Bug Fixes ke Production

## Bug yang Diperbaiki

### Bug #1: User Login 401 Error ✅
**File**: `backend/users/serializers.py`  
**Issue**: User baru yang dibuat oleh admin tidak bisa login (401 Unauthorized)  
**Fix**: Set username correctly saat user creation

### Bug #2: Trade Model NameError ✅
**File**: `backend/mt5/signal_matcher.py`  
**Issue**: `NameError: name 'Trade' is not defined` di _detect_rogue_trades  
**Fix**: Added missing import `from mt5.models import Trade`

---

## 🚀 Quick Update ke Production

### Opsi 1: Via Git (Recommended)

#### Di Komputer Lokal:

```bash
# Navigate ke project
cd "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main"

# Check files changed
git status

# Add fixed files
git add backend/users/serializers.py
git add backend/mt5/signal_matcher.py

# Commit
git commit -m "Fix: Login 401 error & Trade model import issue"

# Push
git push origin main
```

#### Di VPS (Production):

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

# Navigate ke project
cd /var/www/mika-ops-hub

# Pull latest changes
git pull origin main

# Restart backend (hot reload)
docker compose -f docker-compose.prod.yml restart backend

# Monitor logs
docker compose -f docker-compose.prod.yml logs -f backend
```

---

### Opsi 2: Upload via SCP (Alternative)

#### Di Komputer Lokal (PowerShell):

```powershell
# Upload kedua file yang sudah diperbaiki
scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\backend\users\serializers.py" root@YOUR_VPS_IP:/var/www/mika-ops-hub/backend/users/serializers.py

scp "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\backend\mt5\signal_matcher.py" root@YOUR_VPS_IP:/var/www/mika-ops-hub/backend/mt5/signal_matcher.py
```

#### Di VPS:

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

# Restart backend
cd /var/www/mika-ops-hub
docker compose -f docker-compose.prod.yml restart backend

# Monitor logs
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## ✅ Verifikasi Fixes

### 1. Check Backend Running Without Errors

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP

cd /var/www/mika-ops-hub

# Check logs - should NOT see NameError anymore
docker compose -f docker-compose.prod.yml logs --tail=100 backend | grep -i "nameerror\|trade"

# Check for successful signal matching
docker compose -f docker-compose.prod.yml logs --tail=50 backend | grep "signal_matcher"
```

**Expected**: 
- ❌ No more `NameError: name 'Trade' is not defined`
- ✅ Signal matcher running successfully
- ✅ Rogue trade detection working

### 2. Test User Login Fix

1. Login ke admin panel: `https://mikapedia.online`
2. Create new user:
   - Email: `newtest@example.com`
   - Password: `TestPass123!`
   - First Name: Test
   - Last Name: User
3. Logout
4. Login dengan user baru
5. **Expected**: ✅ Login berhasil

### 3. Monitor EA Reports

```bash
# Watch for MT5 EA report processing
docker compose -f docker-compose.prod.yml logs -f backend | grep "ea_report"

# Should see successful processing, no NameError
```

---

## 🔍 Check for Other Errors

```bash
# Check for any Python errors in last 200 lines
docker compose -f docker-compose.prod.yml logs --tail=200 backend | grep -i "error\|exception\|traceback"

# Check for 401 authentication errors
docker compose -f docker-compose.prod.yml logs --tail=100 backend | grep "401"

# Check backend health
docker compose -f docker-compose.prod.yml ps backend
```

---

## 📊 After Update Checklist

- [ ] Backend restarted successfully
- [ ] No NameError in logs
- [ ] Signal matcher working
- [ ] EA reports processing correctly
- [ ] New users can be created
- [ ] New users can login (no 401)
- [ ] No new errors in logs
- [ ] Website responding normally

---

## 🚨 Rollback (If Needed)

If issues occur:

```bash
# SSH ke VPS
ssh root@YOUR_VPS_IP
cd /var/www/mika-ops-hub

# Rollback via git
git log --oneline -5
git reset --hard PREVIOUS_COMMIT_HASH

# Restart backend
docker compose -f docker-compose.prod.yml restart backend
```

---

## 💡 Quick One-Liner Update

```bash
# On VPS
cd /var/www/mika-ops-hub && git pull && docker compose -f docker-compose.prod.yml restart backend && docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

---

## 📝 Summary

**Total Files Changed**: 2
- `backend/users/serializers.py` - Login fix
- `backend/mt5/signal_matcher.py` - Import fix

**Deployment Time**: ~1 minute  
**Downtime**: ~5 seconds (restart only)  
**Risk Level**: Low (bug fixes only, no database changes)

---

**Updated**: September 1, 2026  
**Status**: Ready to deploy ✅
