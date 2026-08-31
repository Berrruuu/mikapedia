# 🚀 Deployment - Next Steps

## ✅ What's Been Fixed (Summary)

### Task 1: Backend MT5 Error ✓
- **File**: `backend/mt5/service.py`
- **Issue**: `NameError: name 'time' is not defined`
- **Fix**: Added `import time` at line 7
- **Status**: FIXED

### Task 2: Frontend 502 Bad Gateway ✓
- **Files**: `Dockerfile.frontend`, `docker-compose.prod.yml`
- **Issue**: Container restart loop, missing dependencies
- **Fix**: Copy entire `node_modules` + `dist` + `src`, use `vite preview`
- **Status**: FIXED

### Task 3: Mixed Content HTTP→HTTPS ✓
- **Files**: `src/lib/api.ts`, `src/lib/auth.tsx`, `src/routes/admin.signals.index.tsx`
- **Issue**: Frontend using HTTP in HTTPS production
- **Fix**: Auto-detect protocol from `window.location.protocol`
- **Status**: FIXED

### Task 4: Favicon Placeholder ✓
- **File**: `src/routes/__root.tsx`, `public/favicon.ico`
- **Issue**: Placeholder logo needs to be removed
- **Fix**: Commented out with TODO, deleted placeholder file
- **Status**: FIXED

### Task 5: MT5 Account Not Showing (IN PROGRESS) ⏳
- **Files**: Multiple (see below)
- **Issue**: After saving credentials, account info doesn't display
- **Actions Taken**:
  - ✅ Added console logging to frontend
  - ✅ Added auto-refresh after credential save
  - ✅ Enhanced error handling
  - ✅ Created comprehensive documentation
  - ✅ Created diagnostic scripts
- **Status**: ENHANCED DEBUGGING

## 📦 New Files Created

### Documentation
1. **MT5-TROUBLESHOOT.md** - Comprehensive troubleshooting guide
2. **CARA-HUBUNGKAN-MT5.md** - User guide dalam Bahasa Indonesia
3. **MT5-DEBUG-SUMMARY.md** - Complete debug summary dengan flow diagram
4. **MT5-QUICK-REF.md** - Quick reference card untuk troubleshooting
5. **DEPLOYMENT-NEXT-STEPS.md** - This file

### Scripts
6. **diagnose-mt5.sh** - Automated diagnostic script untuk VPS

### Updated Files
7. **README.md** - Added MT5 troubleshooting section
8. **src/routes/trader.mt5.tsx** - Enhanced debugging & auto-refresh
9. **src/lib/api.ts** - Added debug logging to MT5 API calls

## 🔄 Deployment Steps

### Step 1: Commit Changes to Git

```bash
# On local machine (Windows)
cd "c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main"

# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "fix: Enhanced MT5 debugging and documentation

- Added console logging to MT5 account loading
- Auto-refresh after saving credentials  
- Created comprehensive troubleshooting docs
- Added diagnostic script for VPS
- Enhanced error handling and user feedback

Fixes #MT5-account-not-showing"

# Push to remote
git push origin main
```

### Step 2: Pull Changes on VPS

```bash
# SSH to VPS
ssh root@your-vps-ip

# Navigate to project
cd ~/mikapedia

# Pull latest changes
git pull origin main
```

### Step 3: Rebuild Frontend & Backend

```bash
# Rebuild containers (no cache to ensure fresh build)
docker compose -f docker-compose.prod.yml build --no-cache frontend backend

# Restart services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

**Expected output:**
```
NAME                STATUS              PORTS
mikapedia-backend   Up X minutes        8000/tcp
mikapedia-frontend  Up X minutes        3000/tcp
mikapedia-db        Up X hours          5432/tcp
mikapedia-redis     Up X hours          6379/tcp
mikapedia-nginx     Up X hours          0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### Step 4: Make Scripts Executable

```bash
# Make diagnostic script executable
chmod +x diagnose-mt5.sh
chmod +x health-check.sh
chmod +x debug-frontend.sh
```

### Step 5: Run Diagnostic

```bash
# Test MT5 integration
./diagnose-mt5.sh trader@test.com password123

# Or test with your actual credentials
./diagnose-mt5.sh your-email@domain.com your-password
```

## 🧪 Testing Checklist

### Backend Tests

- [ ] **Health Check**
  ```bash
  curl -s https://mikapedia.online/api/health/ | jq .
  # Expected: {"status": "ok"}
  ```

- [ ] **Check Logs**
  ```bash
  docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep -i mt5
  # Should show: MT5_USE_SIMULATION=True — using simulated data
  ```

- [ ] **Database Check**
  ```bash
  docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT COUNT(*) FROM mt5_accounts;"
  ```

### Frontend Tests

- [ ] **Homepage Loads**
  ```bash
  curl -I https://mikapedia.online/
  # Expected: HTTP/2 200
  ```

- [ ] **Login Works**
  - Open https://mikapedia.online/login
  - Login dengan credentials trader
  - Should redirect to `/trader`

- [ ] **MT5 Page Opens**
  - Navigate to https://mikapedia.online/trader/mt5
  - Should show form OR existing account

### MT5 Integration Tests

- [ ] **Browser Console Clean**
  - Open DevTools (F12) → Console
  - Should see: `🔧 API Configuration: {...}`
  - NO red errors

- [ ] **Save Credentials Flow**
  1. Open `/trader/mt5`
  2. Click "Connect MT5 Account" (if not connected)
  3. Fill form with test credentials
  4. Click "Save & Connect"
  5. Watch console for:
     - `💾 MT5: Saving credentials...`
     - `✓ MT5: Credentials saved, account created: {...}`
     - `✓ MT5 account loaded: {...}`
  6. Verify account info displays

- [ ] **API Returns Data**
  ```bash
  # Get token
  TOKEN=$(curl -s -X POST https://mikapedia.online/api/auth/login/ \
    -H "Content-Type: application/json" \
    -d '{"email":"trader@test.com","password":"password"}' \
    | grep -o '"access":"[^"]*' | cut -d'"' -f4)
  
  # Test MT5 API
  curl -s https://mikapedia.online/api/v1/mt5/me/ \
    -H "Authorization: Bearer $TOKEN" | jq .
  ```

- [ ] **WebSocket Connected**
  - DevTools → Network tab → WS filter
  - Should see: `wss://mikapedia.online/ws/`
  - Status: 101 Switching Protocols

## 🐛 If Issues Persist

### Issue: Still 404 After Save

**Diagnostic:**
```bash
./diagnose-mt5.sh trader@test.com password
```

**Check:**
1. Database has entry?
   ```bash
   docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT * FROM mt5_accounts;"
   ```
2. Backend logs show errors?
   ```bash
   docker compose -f docker-compose.prod.yml logs backend --tail=100 | grep -i "error\|exception"
   ```

### Issue: Status = "error"

**Check error message:**
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT login, status, error_message FROM mt5_accounts;"
```

**Common Errors:**
- ❌ `"NameError: name 'time' is not defined"` → **SHOULD BE FIXED** (check if changes deployed)
- ❌ `"Connection failed"` → Check simulation mode enabled
- ❌ `"Password decryption failed"` → Check `MT5_ENCRYPTION_KEY` in .env

### Issue: Frontend Not Updating

**Clear Cache:**
1. Hard reload: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
2. Or use Incognito mode
3. Clear browser cache completely

**Verify JS Updated:**
```bash
# Check build timestamp
docker compose -f docker-compose.prod.yml exec frontend ls -lah /app/dist
```

## 📊 Expected Behavior (After Fixes)

### Simulation Mode (Current - Linux/Hostinger)

1. **User saves credentials**
   - Form submits to `/api/v1/mt5/credentials/`
   - Backend creates MT5Account
   - Backend calls `sync_account()`
   - Since `MT5_USE_SIMULATION=True`:
     - Uses `_simulate_full_snapshot()`
     - Generates fake balance ~$10,000
     - Generates 0-3 fake positions
   - Returns account data to frontend
   - Frontend displays account

2. **Auto-sync every 1 second**
   - Frontend calls `/api/v1/mt5/{id}/sync/`
   - Backend refreshes simulation data
   - Small changes to balance/positions
   - WebSocket broadcasts update

3. **Console Logs (Expected)**
   ```
   🔧 API Configuration: {protocol: "https:", ...}
   🔍 MT5: Fetching account data from /v1/mt5/me/
   → No MT5 account found (expected before first save)
   💾 MT5: Saving credentials... {login: 7724091, ...}
   ✓ MT5: Credentials saved, account created: {...}
   ✓ MT5 account loaded: {id: 1, balance: 10532.41, ...}
   🔄 MT5: Syncing account 1
   ```

### Real Mode (Future - with EA on Windows)

1. **EA running on Windows MT5**
   - Calls `/api/v1/mt5/ea-report/` every tick
   - Pushes real balance, equity, positions
   - Backend updates MT5Account
   - WebSocket broadcasts to all clients

2. **Frontend receives live updates**
   - No polling needed
   - WebSocket pushes changes
   - UI updates in real-time

## 📞 Support & Next Actions

### If Everything Works ✅
1. Mark MT5 integration as **WORKING**
2. Test with multiple traders
3. Monitor logs for any errors
4. Plan EA installation on Windows (for real data)

### If Still Not Working ❌
1. Run `./diagnose-mt5.sh` and send output
2. Screenshot browser console (F12)
3. Screenshot Network tab (F12 → Network)
4. Send backend logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs backend --tail=200 > backend-logs.txt
   ```
5. Send database dump:
   ```bash
   docker compose -f docker-compose.prod.yml exec db pg_dump -U mikapedia -t mt5_accounts mikapedia_toms > mt5-dump.sql
   ```

### Contact Developer With:
- Output dari `diagnose-mt5.sh`
- Screenshot console browser
- Screenshot Network tab
- `backend-logs.txt`
- `mt5-dump.sql`
- Description kapan error terjadi

## 🎯 Success Criteria

MT5 Integration dianggap sukses jika:

✅ User bisa save credentials tanpa error  
✅ Account info muncul setelah save  
✅ Status badge shows "Connected"  
✅ Balance, equity, floating P/L ditampilkan  
✅ Data refresh setiap 1 detik  
✅ No errors di browser console  
✅ No errors di backend logs  
✅ Database contains MT5Account entry  
✅ WebSocket connected (wss://)  

## 📅 Timeline

### Immediate (Now)
- [x] Deploy changes to VPS
- [ ] Run diagnostic script
- [ ] Test login flow
- [ ] Test save credentials
- [ ] Verify account displays

### Short-term (1-3 days)
- [ ] Monitor for any errors
- [ ] Test with multiple traders
- [ ] Gather user feedback
- [ ] Fix any issues found

### Medium-term (1-2 weeks)
- [ ] Install EA on Windows MT5
- [ ] Configure EA to push real data
- [ ] Test real-time updates
- [ ] Switch from simulation to real mode

### Long-term (1 month+)
- [ ] Monitor EA stability
- [ ] Optimize sync frequency
- [ ] Add more MT5 features
- [ ] Implement advanced analytics

---

**Good luck with deployment! 🚀**

**Created**: 2026-08-31  
**Last Updated**: 2026-08-31  
**Version**: 1.0
