# 🚀 DEPLOYMENT: Fix EA Data Overwrite

## ✅ Summary of Changes

**Problem:** Website menampilkan data simulasi (~$10k balance) alih-alih data real dari EA

**Root Cause:** Backend `sync_account()` menggenerate data simulasi yang menimpa data real dari EA

**Solution:** 
- Backend: `sync_account()` checks `MT5_USE_SIMULATION=True` → hanya baca database, tidak generate simulasi
- Frontend: Disable auto-sync/refresh yang trigger simulation

---

## 📋 Files Changed

### Backend
- ✅ `backend/mt5/services.py` - Modified `sync_account()` method

### Frontend  
- ✅ `src/routes/trader.mt5.tsx` - Disabled auto-sync on mount dan auto-refresh after save

### Documentation
- ✅ `FIX-COMPLETE-EA-ONLY-DATA.md` - Comprehensive documentation
- ✅ `DEPLOY-FIX-EA-DATA.md` - This file

---

## 🚀 Deployment Steps

### 1. Commit Changes

```bash
git add backend/mt5/services.py
git add src/routes/trader.mt5.tsx
git add FIX-COMPLETE-EA-ONLY-DATA.md
git add DEPLOY-FIX-EA-DATA.md

git commit -m "fix: Prevent simulation data from overwriting EA real data

- Backend: sync_account() checks MT5_USE_SIMULATION env var
- If True (production), skip simulation and only read from database
- Frontend: Disable auto-sync on mount and auto-refresh after save
- EA remains as sole source of real data via /api/v1/mt5/ea-report/
- Fixes issue where website shows ~$10k simulation instead of real MT5 data"

git push origin main
```

---

### 2. Deploy to Production (Hostinger VPS)

```bash
# SSH ke server
ssh user@mikapedia.online

# Navigate to project
cd /path/to/mika-ops-hub-main

# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend | grep -i mt5
```

**Expected logs:**
```
backend | INFO: MT5_USE_SIMULATION=True: Account 1 sync reads from database (EA is data source)
backend | INFO: EA data received for account 7724091
```

---

### 3. Verify Fix

#### A. Check Environment Variables
```bash
docker-compose -f docker-compose.prod.yml exec backend env | grep MT5
```

**Expected output:**
```
MT5_USE_SIMULATION=True
EA_INTEGRATION_TOKEN=mikapedia_prod_2026_7f9e2d1a6c3b8e4f
```

#### B. Test from Browser

1. Open https://mikapedia.online/
2. Login as trader
3. Navigate to `/trader/mt5`
4. Check current MT5 data:
   - **Before Fix:** Balance shows ~$10,000 (simulation)
   - **After Fix:** Balance shows your real MT5 balance

#### C. Test Save Credentials Flow

1. Click "Update Credentials" or "Connect MT5 Account"
2. Fill in your MT5 credentials
3. Click "Save & Connect"
4. **Expected:**
   - Status: "pending" 
   - Message: "Waiting for EA to push data..."
5. Wait 2-3 seconds
6. **Expected:**
   - Status: "connected"
   - Balance: Your real MT5 balance (NOT ~$10k)
   - Positions: Your real open positions
   - Everything matches your MT5 terminal

#### D. Test Manual Sync

1. Click "Sync" button
2. **Expected:**
   - Data does NOT change to simulation
   - Data remains as real EA data
   - Status remains "connected"

#### E. Check Database

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from mt5.models import MT5Account
from django.utils import timezone
from datetime import timedelta

# Get account
acc = MT5Account.objects.first()

# Print data
print(f"Account ID: {acc.id}")
print(f"Login: {acc.login}")
print(f"Balance: ${acc.balance}")
print(f"Equity: ${acc.equity}")
print(f"Status: {acc.status}")
print(f"Last sync: {acc.last_sync}")

# Check if last_sync is recent (EA is pushing data)
if acc.last_sync:
    time_since = timezone.now() - acc.last_sync
    print(f"Time since last sync: {time_since.total_seconds():.1f} seconds")
    
    if time_since < timedelta(seconds=10):
        print("✅ EA is actively pushing data!")
    else:
        print("⚠️ EA might not be running or data is stale")
else:
    print("⚠️ No sync data yet")

# Check if balance looks like simulation
if acc.balance and 9500 < acc.balance < 10500:
    print("⚠️ WARNING: Balance looks like simulation (~$10k)")
else:
    print("✅ Balance looks like real data")
```

---

### 4. Monitor EA

#### On Windows (where EA is running)

1. Open MT5
2. Check Experts tab (Ctrl+T)
3. **Expected logs every 1 second:**
   ```
   ✓ Data sent: 3 positions, 0 pending, 2 deals
   ```

4. **If you see errors:**
   - `-1`: URL not in whitelist → Add `https://mikapedia.online/api/v1/mt5/ea-report/` to Tools → Options → Expert Advisors → Allow WebRequest
   - `403`: Token salah → Check EA_TOKEN parameter matches `EA_INTEGRATION_TOKEN` in `.env.production`
   - `404`: URL salah atau backend down
   - `500`: Backend error → Check server logs

#### Check EA is attached
- EA name should appear at top-right of chart
- Smiley face icon (not sad face)
- "AutoTrading" button in toolbar should be ON (green)

---

### 5. Troubleshooting

#### Issue: Website still shows simulation data

**Diagnosis:**
```bash
# Check if env var is set correctly
docker-compose -f docker-compose.prod.yml exec backend bash -c 'echo $MT5_USE_SIMULATION'

# Should output: True
```

**If not True:**
```bash
# Edit .env.production
vim backend/.env.production

# Add or update:
MT5_USE_SIMULATION=True

# Restart
docker-compose -f docker-compose.prod.yml restart backend
```

**Check backend logs:**
```bash
docker-compose -f docker-compose.prod.yml logs backend | grep "sync_account"
```

**Expected:**
```
INFO: MT5_USE_SIMULATION=True: Account 1 sync reads from database (EA is data source)
```

**If you see:**
```
INFO: Account 1 has recent EA data (synced XXX ago), skipping simulation
```
This is from the OLD code. Restart backend to load new code.

---

#### Issue: EA not pushing data

**Check EA logs in MT5:**
- If no logs at all: EA not attached or AutoTrading OFF
- If `-1` error: URL not whitelisted
- If `403` error: Token mismatch
- If `404` error: URL typo or backend endpoint missing
- If `500` error: Backend error

**Verify EA parameters:**
```mql5
BACKEND_URL = "https://mikapedia.online/api/v1/mt5/ea-report/"
EA_TOKEN    = "mikapedia_prod_2026_7f9e2d1a6c3b8e4f"  // Match .env.production
REPORT_EVERY = 1
```

**Test EA endpoint manually:**
```bash
curl -X POST https://mikapedia.online/api/v1/mt5/ea-report/ \
  -H "Content-Type: application/json" \
  -d '{
    "token": "mikapedia_prod_2026_7f9e2d1a6c3b8e4f",
    "login": 7724091,
    "server": "ICMarkets-Live01",
    "broker": "ICMarkets",
    "balance": 1500.50,
    "equity": 1480.20,
    "floating_pnl": -20.30,
    "positions": [],
    "deals": []
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "login": 7724091,
    "positions_synced": 0,
    "signals_matched": 0
  }
}
```

---

#### Issue: WebSocket not connecting

**Check browser console:**
```
F12 → Console
```

**Expected:**
```
WebSocket connected to wss://mikapedia.online/ws/live/...
```

**If error:**
```
WebSocket connection to 'wss://...' failed
```

**Fix:**
```bash
# Check Daphne is running
docker-compose -f docker-compose.prod.yml ps backend

# Should show: Up

# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend | grep -i daphne

# Should see: Daphne running on 0.0.0.0:8000
```

**If Daphne not running:**
```bash
# Check Dockerfile.backend
# Should use CMD ["daphne", ...] not gunicorn

# Rebuild
docker-compose -f docker-compose.prod.yml up -d --build backend
```

---

### 6. Rollback (if needed)

If something goes wrong:

```bash
# On server
cd /path/to/mika-ops-hub-main

# Revert to previous commit
git log --oneline -5  # Find previous commit hash
git checkout <previous-commit-hash>

# Rebuild
docker-compose -f docker-compose.prod.yml up -d --build

# Or restore from backup
# (assuming you have backup of database)
```

---

## ✅ Success Criteria

### Must Pass:
1. ✅ User save MT5 credentials → website shows real balance (NOT ~$10k)
2. ✅ Click "Sync" button → data remains real (NOT change to simulation)
3. ✅ Open positions match MT5 terminal exactly
4. ✅ Balance/equity updates in real-time (every 1 second from EA)
5. ✅ Backend logs show "EA is data source" when sync is called

### Nice to Have:
1. ✅ No errors in browser console
2. ✅ WebSocket connected and receiving updates
3. ✅ EA logs show successful data push every 1 second
4. ✅ Database `last_sync` timestamp updates every 1 second

---

## 📊 Monitoring Commands

### Real-time logs
```bash
# Backend logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Filter MT5 logs only
docker-compose -f docker-compose.prod.yml logs -f backend | grep -i mt5

# Filter EA logs only
docker-compose -f docker-compose.prod.yml logs -f backend | grep "ea_report"
```

### Check account status
```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from mt5.models import MT5Account
from django.utils import timezone
for acc in MT5Account.objects.all():
    sync_age = (timezone.now() - acc.last_sync).total_seconds() if acc.last_sync else 9999
    print(f'Account {acc.login}: Balance=${acc.balance:.2f}, Last sync: {sync_age:.0f}s ago, Status: {acc.status}')
"
```

---

## 📝 Post-Deployment Checklist

After deployment, verify:

- [ ] Backend container is running: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Environment variable is set: `MT5_USE_SIMULATION=True`
- [ ] Website accessible: https://mikapedia.online/
- [ ] User can login successfully
- [ ] MT5 page loads without errors
- [ ] Existing MT5 account shows real data (if account exists)
- [ ] Can save new credentials successfully
- [ ] EA endpoint receives data: Check logs for "ea_report"
- [ ] Database updates with real data: Check `last_sync` timestamp
- [ ] WebSocket broadcasts updates: Check browser console
- [ ] Manual sync doesn't generate simulation: Click "Sync" button
- [ ] No ~$10k balance appears anywhere: All balances are real

---

## 🎯 Expected Outcome

**Before Fix:**
- User saves MT5 credentials
- Website shows Balance: $10,000.00 (simulation)
- User confused: "This is not my account!"

**After Fix:**
- User saves MT5 credentials  
- EA pushes real data within 1-2 seconds
- Website shows Balance: $1,500.50 (real from EA)
- User happy: "This matches my MT5 terminal!" ✅

---

## 📞 Support

If issues persist after deployment:

1. Collect logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs backend > backend.log
   docker-compose -f docker-compose.prod.yml logs frontend > frontend.log
   ```

2. Check EA logs in MT5 Experts tab

3. Take screenshot of:
   - Website MT5 page
   - MT5 terminal (showing real balance)
   - Browser console (F12)
   - Backend logs

4. Report issue with all logs and screenshots

---

**Status: READY FOR DEPLOYMENT** ✅

**Estimated Deployment Time:** 10-15 minutes

**Risk Level:** Low (changes only affect simulation mode, EA flow unchanged)

**Rollback Time:** 5 minutes (git checkout previous commit)
