# Fix: Sync Endpoint Tidak Overwrite Data EA

## 🎯 Problem

Setelah EA berhasil push data real ke backend, frontend masih call `/api/mt5/{id}/sync/` setiap 1 detik yang:
1. Trigger `sync_account()` 
2. Generate data simulasi (karena Linux tidak support MT5 package)
3. **Overwrite data real dari EA** dengan data fake

**Result:** Data di website terus berubah antara real (dari EA) dan fake (dari sync).

## ✅ Solution

### Change 1: Smart Sync - Skip Simulation jika Ada Data EA

**File:** `backend/mt5/services.py`

**Logic:**
```python
def sync_account(account):
    # Check if account has recent EA data (last_sync within 10 seconds)
    if account.last_sync:
        time_since_sync = timezone.now() - account.last_sync
        if time_since_sync < timedelta(seconds=10):
            # EA is actively pushing data
            # Skip simulation, just return current data
            return account
    
    # No recent EA data, proceed with normal sync
    # (simulation in production, real MT5 in Windows dev)
```

**Benefits:**
- ✅ EA data tidak di-overwrite
- ✅ Sync masih bisa dipanggil manual (button "Sync")
- ✅ Kalau EA stop kirim data >10s, fallback ke simulation/real sync

### Change 2: Disable Auto-Sync di Frontend

**File:** `src/routes/trader.mt5.tsx`

**Logic:**
```typescript
useEffect(() => {
  // DISABLED: EA + WebSocket sudah handle real-time updates
  // No need to poll sync endpoint every 1 second
  
  // If need to force sync (dev without EA), uncomment the interval
}, [account, handleSync]);
```

**Benefits:**
- ✅ Tidak ada polling unnecessary
- ✅ Reduce server load
- ✅ WebSocket handle real-time updates
- ✅ Manual sync button masih work

## 🔄 Data Flow Setelah Fix

### Scenario 1: EA Running (Production)

```
┌─────────────────────────────────────────────────────────────┐
│ MT5 Terminal (Windows) + EA                                  │
│   → Push data every 1 second                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: POST /api/v1/mt5/ea-report/                        │
│   1. Update MT5Account (balance, equity, positions)         │
│   2. Set last_sync = now()                                  │
│   3. Broadcast via WebSocket                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: WebSocket Listener                                 │
│   → Receive mt5_update event                                │
│   → Update UI with real data                                │
│   → NO polling to /sync/ endpoint                           │
└─────────────────────────────────────────────────────────────┘

✅ Result: Real data from EA, updated every 1 second
```

### Scenario 2: User Click "Sync" Button

```
┌─────────────────────────────────────────────────────────────┐
│ User: Click "Sync" button                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/mt5/{id}/sync/                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: sync_account()                                      │
│   → Check last_sync                                         │
│   → If synced < 10s ago (EA active):                        │
│       └─> Return current data (no overwrite) ✅             │
│   → If synced > 10s ago (EA stopped):                       │
│       └─> Proceed with simulation/real sync                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Display updated data                               │
└─────────────────────────────────────────────────────────────┘

✅ Result: Sync button safe to use, won't overwrite EA data
```

### Scenario 3: EA Stops (Connection Lost)

```
┌─────────────────────────────────────────────────────────────┐
│ MT5 Terminal: Disconnected / EA Error                        │
│   → No more POST to /ea-report/                             │
│   → last_sync not updated (>10s old)                        │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ After 10+ seconds
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ User: Click "Sync" button                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: sync_account()                                      │
│   → Check last_sync                                         │
│   → last_sync > 10s ago (EA inactive)                       │
│   → Proceed with simulation sync                            │
│   → Update with simulated data                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Shows simulated data                               │
│   ⚠️ Indicates EA might be disconnected                     │
└─────────────────────────────────────────────────────────────┘

✅ Result: Fallback to simulation if EA stops
```

## 🎯 Configuration

### Backend: Tune EA Data Freshness Window

**File:** `backend/mt5/services.py`

```python
# Current: 10 seconds
if time_since_sync < timedelta(seconds=10):
    # Skip simulation

# Adjust if needed:
# - 5 seconds: More aggressive (sync might overwrite EA data)
# - 30 seconds: More lenient (EA data stays longer)
```

**Recommended:** 10 seconds (default)
- EA sends every 1 second
- Allows up to 10 failed EA requests before fallback

### Frontend: Re-enable Polling (If Needed)

**File:** `src/routes/trader.mt5.tsx`

Uncomment the interval code jika butuh polling untuk testing tanpa EA:

```typescript
useEffect(() => {
  if (!account || account.status !== "connected") return;

  // Uncomment for polling (testing without EA):
  const interval = setInterval(() => {
    if (!syncingRef.current) {
      void handleSync();
    }
  }, 5000);  // Poll every 5 seconds

  return () => clearInterval(interval);
}, [account, handleSync]);
```

⚠️ **Warning:** Jangan enable di production kalau EA running (akan overwrite data jika EA delay >10s)

## ✅ Benefits

1. **EA Data Protected**
   - Sync endpoint tidak overwrite data real dari EA
   - Data konsisten dengan MT5 terminal

2. **Reduced Server Load**
   - No unnecessary polling every 1 second
   - WebSocket handle real-time updates

3. **Fallback Mechanism**
   - Kalau EA stop, auto fallback ke simulation setelah 10s
   - Manual sync button masih work

4. **Better UX**
   - Data tidak "jumping" antara real & fake
   - Smooth real-time updates via WebSocket

## 🚀 Deployment

1. **Commit changes**
   ```bash
   git add backend/mt5/services.py src/routes/trader.mt5.tsx
   git commit -m "fix: prevent sync endpoint from overwriting EA data"
   ```

2. **Deploy to VPS**
   ```bash
   git push origin main
   
   # On VPS:
   cd ~/mikapedia
   git pull origin main
   docker compose -f docker-compose.prod.yml build --no-cache backend frontend
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Verify**
   - EA masih kirim data (check Expert tab MT5)
   - Website shows real data (not simulation)
   - Click "Sync" button → data tidak berubah (EA active)
   - Stop EA → wait 10s → click "Sync" → shows simulation (fallback)

## 📊 Monitoring

### Check EA Activity

```bash
# Backend logs: EA reports
docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep ea_report

# Expected: POST /api/v1/mt5/ea-report/ every ~1 second
```

### Check Sync Behavior

```bash
# Backend logs: Sync skips
docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep "recent EA data"

# Expected: "Account X has recent EA data (synced Y ago), skipping simulation"
```

### Check Database

```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "
SELECT login, balance, last_sync, 
       EXTRACT(EPOCH FROM (NOW() - last_sync)) as seconds_since_sync 
FROM mt5_accounts;
"

# last_sync should be < 2 seconds ago if EA active
```

## ⚠️ Known Limitations

1. **10-Second Window**
   - If EA delay >10s, sync might overwrite
   - Tune window in code if needed

2. **Manual Sync During EA Downtime**
   - If EA down 5-10s, manual sync returns stale data
   - Wait >10s for fallback to simulation

3. **Multiple Browser Tabs**
   - WebSocket updates all tabs
   - No need to sync in each tab

---

**Version:** 1.0  
**Date:** 2026-08-31  
**Status:** Production Ready ✅
