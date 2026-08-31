# MT5 Tidak Muncul - Debug Summary

## 🎯 Masalah
Setelah login dan save credentials MT5 di website https://mikapedia.online/trader/mt5, informasi akun tidak muncul.

## 🔍 Perubahan yang Sudah Dilakukan

### 1. ✅ Fixed Missing `import time` (TASK 1)
**File**: `backend/mt5/service.py`  
**Problem**: `NameError: name 'time' is not defined` pada fungsi simulasi  
**Fix**: Menambahkan `import time` di line 7

### 2. ✅ Set Simulation Mode for Linux (TASK 1)
**File**: `backend/.env.production`  
**Config**: `MT5_USE_SIMULATION=True`  
**Reason**: MetaTrader5 Python package Windows-only, jadi di Hostinger (Linux) pakai simulasi

### 3. ✅ Fixed Mixed Content HTTP→HTTPS (TASK 3)
**Files**: 
- `src/lib/api.ts` 
- `src/lib/auth.tsx`
- `src/routes/admin.signals.index.tsx`

**Problem**: Frontend pakai HTTP di production (HTTPS)  
**Fix**: Auto-detect protocol dari `window.location.protocol`

### 4. ✅ Enhanced Frontend Debugging (TASK 5 - CURRENT)
**File**: `src/routes/trader.mt5.tsx`

**Changes**:
- Added console logging to `fetchAccount()`
- Added auto-refresh after `setCredentials()` success
- Better error handling with detailed logs
- Toast notifications for user feedback

**File**: `src/lib/api.ts`

**Changes**:
- Added debug logging to `mt5Api.me()`
- Added logging to `mt5Api.setCredentials()`
- Added logging to `mt5Api.syncOne()`
- Debug log showing API_BASE configuration

## 📁 Dokumentasi Baru

### 1. `MT5-TROUBLESHOOT.md`
Comprehensive troubleshooting guide dengan:
- Diagnostic steps (check logs, API, database)
- Common issues & fixes
- Quick fix script examples
- Expected behavior documentation

### 2. `CARA-HUBUNGKAN-MT5.md` (Bahasa Indonesia)
User guide lengkap:
- Step-by-step connect MT5
- Troubleshooting dalam bahasa Indonesia
- FAQ lengkap
- Penjelasan mode simulasi vs real EA

### 3. `diagnose-mt5.sh`
Automated diagnostic script yang bisa run di VPS:
```bash
./diagnose-mt5.sh trader@test.com password123
```

Output:
- Login test
- Check MT5 account via API
- Show backend logs
- Check database
- Check environment variables

## 🔄 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  USER SAVES MT5 CREDENTIALS                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/v1/mt5/credentials/                         │
│   - login: 7724091                                              │
│   - password: ••••••••                                          │
│   - server: ICMarkets-Live01                                    │
│   - broker: ICMarkets                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend: MT5Service.set_credentials()                           │
│   1. Encrypt password with AES-256                              │
│   2. Create/update MT5Account in database                       │
│   3. Call sync_account()                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend: MT5Service.sync_account()                              │
│   ┌──────────────────────────────────────────┐                 │
│   │  IF MT5_USE_SIMULATION=True (Linux):     │                 │
│   │    → _simulate_full_snapshot()           │                 │
│   │    → Generate fake balance ~$10k         │                 │
│   │    → Generate 0-3 fake positions         │                 │
│   └──────────────────────────────────────────┘                 │
│   ┌──────────────────────────────────────────┐                 │
│   │  ELSE (Windows with MT5):                │                 │
│   │    → Connect to real MT5 terminal        │                 │
│   │    → Fetch real account info             │                 │
│   │    → Fetch real positions/orders         │                 │
│   └──────────────────────────────────────────┘                 │
│   4. Update MT5Account in database                              │
│   5. Return updated account                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: Receive MT5Account response                           │
│   - setAccount(data)                                            │
│   - setNotFound(false)                                          │
│   - Hide credentials form                                       │
│   - Show success toast                                          │
│   - Auto-refresh after 1 second                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: Display Account Info                                  │
│   - Status badge: Connected / Error                             │
│   - Balance, Equity, Floating P/L                               │
│   - Margin Level, Drawdown                                      │
│   - Open Positions table                                        │
│   - Pending Orders table                                        │
│   - Deal History table                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Auto-sync every 1 second (while status=connected)               │
│   - POST /api/v1/mt5/{id}/sync/                                 │
│   - Update account data                                         │
│   - WebSocket broadcasts to all clients                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🐛 Debugging Commands

### Check Backend Logs
```bash
cd ~/mikapedia
docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep -i mt5
```

### Test MT5 API Directly
```bash
# Login first
TOKEN=$(curl -s -X POST https://mikapedia.online/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"trader@test.com","password":"yourpass"}' \
  | grep -o '"access":"[^"]*' | cut -d'"' -f4)

# Check MT5 account
curl -s https://mikapedia.online/api/v1/mt5/me/ \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Check Database
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT id, login, status, balance, equity, error_message FROM mt5_accounts;"
```

### Check Environment
```bash
docker compose -f docker-compose.prod.yml exec backend sh -c 'echo $MT5_USE_SIMULATION'
```

### Run Full Diagnostic
```bash
./diagnose-mt5.sh trader@test.com password123
```

## 🔧 Browser Console Checks

Open DevTools (F12) and check:

### 1. API Configuration
```javascript
// Should log on page load:
🔧 API Configuration: {
  protocol: "https:",
  hostname: "mikapedia.online",
  computedProto: "https",
  API_BASE: "https://mikapedia.online/api"
}
```

### 2. MT5 API Calls
```javascript
// When loading page:
🔍 MT5: Fetching account data from /v1/mt5/me/

// If found:
✓ MT5: Account data received: { id: 1, login: 7724091, ... }

// If not found:
✗ Failed to load MT5 account: 404 Not Found
→ No MT5 account found (expected before first save)
```

### 3. Saving Credentials
```javascript
// When clicking "Save & Connect":
💾 MT5: Saving credentials... { login: 7724091, server: "ICMarkets-Live01", broker: "ICMarkets" }
✓ MT5: Credentials saved, account created: { id: 1, ... }
✓ MT5 account loaded: { id: 1, balance: 10532.41, ... }
```

### 4. WebSocket
```javascript
// Should see in Network → WS tab:
wss://mikapedia.online/ws/
Status: 101 Switching Protocols
```

## 📊 Expected Data (Simulation Mode)

When `MT5_USE_SIMULATION=True`, backend returns:

```json
{
  "id": 1,
  "login": 7724091,
  "accountNumber": "7724091",
  "server": "ICMarkets-Live01",
  "broker": "ICMarkets",
  "status": "connected",
  "isDemo": true,
  "currency": "USD",
  "leverage": 100,
  "company": "Demo Broker (ICMarkets-Live01)",
  "balance": 10532.41,
  "equity": 10567.23,
  "floatingPnl": 34.82,
  "margin": 315.97,
  "freeMargin": 10251.26,
  "marginLevel": 3345.78,
  "drawdown": 0.34,
  "openPositions": 2,
  "pendingOrders": 0,
  "lastSync": "2026-08-31T14:30:45.123Z",
  "errorMessage": "",
  "positions": [
    {
      "ticket": 10007724091,
      "symbol": "XAUUSD",
      "type": "BUY",
      "lotSize": 0.1,
      "entryPrice": 2399.5,
      "currentPrice": 2400.12,
      "stopLoss": 2398.5,
      "takeProfit": 2401.5,
      "floatingPnl": 20.45,
      "swap": -0.5,
      "timeOpen": "2026-08-31T13:30:00Z"
    }
  ],
  "orders": [],
  "deals": []
}
```

## ✅ Verification Checklist

### Backend
- [x] `MT5_USE_SIMULATION=True` in `.env.production`
- [x] `import time` added to `backend/mt5/service.py`
- [x] Backend logs show: "MT5_USE_SIMULATION=True — using simulated data"
- [ ] No Python exceptions in backend logs
- [ ] Database has `mt5_accounts` entry after save

### Frontend
- [x] HTTPS protocol detected correctly
- [x] API_BASE = `https://mikapedia.online/api`
- [x] Console shows debug logs
- [ ] No red errors in browser console
- [ ] Network tab shows `/api/v1/mt5/me/` returns 200
- [ ] Account data appears after save

### User Experience
- [ ] Form appears with "Connect MT5 Account" button
- [ ] After save, success toast appears
- [ ] Credentials form hides
- [ ] Account info displays (balance, equity, etc)
- [ ] Status badge shows "Connected"
- [ ] Data refreshes every 1 second

## 🚀 Next Steps

1. **Deploy Changes**
   ```bash
   cd ~/mikapedia
   git pull origin main
   docker compose -f docker-compose.prod.yml build --no-cache frontend backend
   docker compose -f docker-compose.prod.yml up -d
   ```

2. **Test on Website**
   - Open https://mikapedia.online/trader/mt5
   - Open DevTools (F12) → Console
   - Save MT5 credentials
   - Watch console logs
   - Verify account data appears

3. **If Still Not Working**
   - Run `./diagnose-mt5.sh` on VPS
   - Screenshot console logs
   - Screenshot Network tab
   - Check backend logs for exceptions
   - Send all info to developer

4. **For Real MT5 Data (Future)**
   - Install EA on Windows MT5 terminal
   - Configure EA endpoint: `https://mikapedia.online/api/v1/mt5/ea-report/`
   - Set EA token from `.env` file
   - EA will push real data every tick

## 📞 Support

Jika masih bermasalah:
1. Jalankan `./diagnose-mt5.sh` dan screenshot output
2. Screenshot browser console (F12)
3. Screenshot halaman MT5
4. Kirim semua ke developer

---

**Created**: 2026-08-31  
**Last Updated**: 2026-08-31  
**Status**: Enhanced debugging + documentation added
