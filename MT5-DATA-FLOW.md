# MT5 Data Flow - Penjelasan Lengkap

## 🔄 Bagaimana Data MT5 Bekerja

### Scenario 1: SIMULATION MODE (Current - Tanpa EA)

```
┌─────────────────────────────────────────────────────────────┐
│ USER: Login & Save MT5 Credentials di Website               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: POST /api/v1/mt5/credentials/                      │
│   1. Create MT5Account di database                          │
│   2. Encrypt password                                       │
│   3. Call sync_account()                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: MT5Service.sync_account()                          │
│                                                             │
│   if MT5_USE_SIMULATION == True:  ← ✅ HOSTINGER (LINUX)   │
│       └─> _simulate_full_snapshot()                         │
│            └─> Generate FAKE data:                          │
│                 • Balance: ~$10,000 (random)                │
│                 • Equity: Balance + random float            │
│                 • Positions: 0-3 fake positions             │
│                 • Login: Your real login number             │
│                 • Status: "connected"                       │
│                 • isDemo: True                              │
│                                                             │
│   else:  ← ❌ TIDAK WORK DI LINUX                          │
│       └─> mt5.initialize()  ← MetaTrader5 package          │
│            └─> Connect ke MT5 terminal                      │
│                 └─> Get REAL data                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: mt5_accounts table                                │
│   - login: 7724091 (REAL)                                   │
│   - balance: 10234.56 (FAKE - simulated)                    │
│   - equity: 10189.23 (FAKE - simulated)                     │
│   - status: "connected"                                     │
│   - isDemo: True                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Display di /trader/mt5                            │
│   ✅ Login: 7724091 (REAL)                                  │
│   ❌ Balance: $10,234.56 (FAKE - tidak sama dengan MT5)     │
│   ❌ Positions: 0-3 fake positions (tidak real)             │
│   ⚠️  Data berubah-ubah setiap refresh (random)             │
└─────────────────────────────────────────────────────────────┘
```

**Ini yang kamu alami sekarang!** ⬆️

---

### Scenario 2: REAL DATA MODE (Dengan EA)

```
┌─────────────────────────────────────────────────────────────┐
│ WINDOWS PC: MT5 Terminal Running                            │
│   - Login: 7724091                                          │
│   - Balance: $5,432.10 (REAL)                               │
│   - Positions: 2 open (XAUUSD, EURUSD)                      │
│   - EA MikapediaReporter.mq5 attached                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Every 1 second (OnTick)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ EA: Build JSON Payload                                      │
│   {                                                         │
│     "token": "...",                                         │
│     "login": 7724091,                                       │
│     "balance": 5432.10,    ← REAL from MT5                 │
│     "equity": 5401.23,      ← REAL from MT5                │
│     "positions": [          ← REAL from MT5                │
│       {                                                     │
│         "ticket": 123456,                                   │
│         "symbol": "XAUUSD",                                 │
│         "type": "BUY",                                      │
│         "volume": 0.1,                                      │
│         "profit": -30.87,   ← REAL floating P/L            │
│         ...                                                 │
│       }                                                     │
│     ]                                                       │
│   }                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS POST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: POST /api/v1/mt5/ea-report/                        │
│   1. Validate EA_TOKEN                                      │
│   2. Find MT5Account by login                               │
│   3. Update account with REAL data:                         │
│      - balance = 5432.10                                    │
│      - equity = 5401.23                                     │
│      - status = "connected"                                 │
│   4. Update positions table (delete old, insert new)        │
│   5. Save to database                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: mt5_accounts table                                │
│   - login: 7724091 (REAL)                                   │
│   - balance: 5432.10 (REAL ✅)                              │
│   - equity: 5401.23 (REAL ✅)                               │
│   - floating_pnl: -30.87 (REAL ✅)                          │
│   - open_positions: 2 (REAL ✅)                             │
│   - last_sync: 2026-08-31 16:30:45 (just now)              │
│   - status: "connected"                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ WebSocket Broadcast
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Real-time Update via WebSocket                    │
│   ✅ Login: 7724091 (REAL)                                  │
│   ✅ Balance: $5,432.10 (REAL - sama dengan MT5!)           │
│   ✅ Equity: $5,401.23 (REAL)                               │
│   ✅ Floating P/L: -$30.87 (REAL)                           │
│   ✅ Positions: 2 open (REAL - XAUUSD BUY, EURUSD SELL)     │
│   ✅ Data update every 1 second (real-time!)                │
└─────────────────────────────────────────────────────────────┘
```

**Ini yang kamu inginkan!** ⬆️

---

## 🎯 Kenapa Muncul Data Simulasi?

### 1. Backend Setting
```python
# backend/.env.production
MT5_USE_SIMULATION=True  ← Ini menyebabkan data fake!
```

### 2. No EA Data
Backend belum pernah terima data real dari EA, jadi:
- Database hanya punya data simulasi
- Setiap sync, backend generate data fake baru
- Frontend display data fake tersebut

### 3. Simulation Logic
```python
# backend/mt5/service.py
def sync_account(account):
    if MT5_USE_SIMULATION:  # ← True di Hostinger
        return _simulate_full_snapshot()  # ← Generate fake data
    else:
        return mt5.account_info()  # ← Real data (tidak work di Linux)
```

---

## ✅ Cara Fix: Install EA

### Quick Summary:

1. **Copy EA** ke `MQL5/Experts/`
2. **Compile** (F7)
3. **Whitelist URL** (`https://mikapedia.online`)
4. **Set EA_TOKEN** (dari backend `.env`)
5. **Attach EA** ke chart
6. **Wait 1-2 seconds**
7. **Refresh website** → Data sekarang REAL! ✅

### Verify EA Working:

**MT5 Expert Tab:**
```
✅ [Mikapedia] Data synced — 2 positions, 0 pending orders, 5 deals
```

**Backend Logs:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep "ea_report"
# Should show: ea_report received: login=7724091, status=ok
```

**Database:**
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "
SELECT login, balance, equity, last_sync FROM mt5_accounts;
"
# Balance should match your MT5!
```

**Frontend:**
- Open `/trader/mt5`
- Balance, equity, positions harus sama dengan MT5 real!
- Data update every 1 second (real-time)

---

## 📊 Comparison Table

| Aspect | Simulation Mode | EA Mode (Real) |
|--------|-----------------|----------------|
| Data Source | Backend generates | MT5 Terminal |
| Accuracy | Fake (~$10k) | 100% Real |
| Login Number | Real (from credentials) | Real |
| Balance | Fake (random) | Real (from MT5) |
| Positions | Fake (0-3 random) | Real (actual positions) |
| Updates | On API call only | Real-time (every 1s) |
| Setup Required | None | EA installation |
| Use Case | Development/testing | Production |
| Works on Linux? | Yes | No (need EA on Windows) |

---

## 🚀 Next Steps

**Option 1: Install EA (RECOMMENDED for Production)**
- Follow `EA-INSTALLATION-GUIDE.md`
- Data akan real sesuai MT5 kamu
- Update real-time every 1 second

**Option 2: Keep Simulation (for Testing)**
- Data tetap fake
- Good untuk development/demo
- Tidak butuh Windows MT5

**Option 3: Windows VPS** (if no trader PC available)
- Sewa Windows VPS
- Install MT5 terminal
- Run EA 24/7
- Cost: ~$15-30/month

---

## ❓ FAQ

### Q: Kenapa tidak pakai MetaTrader5 Python package di server?
**A:** Package itu Windows-only. Hostinger pakai Linux. Jadi tidak bisa.

### Q: Kenapa tidak pakai Wine?
**A:** Wine kompleks, tidak stabil, overhead tinggi. EA approach jauh lebih simple & reliable.

### Q: Apa simulation mode berguna?
**A:** Ya! Untuk development & testing tanpa perlu MT5 real.

### Q: Berapa lama EA kirim data?
**A:** Every 1 second (configurable via REPORT_EVERY parameter).

### Q: Bisa multiple accounts?
**A:** Ya! Install 1 EA per MT5 account. Backend otomatis identify by login number.

### Q: Kalau EA error gimana?
**A:** Check Expert tab di MT5 untuk error log. Backend tetap show last synced data (not updating).

---

**Kesimpulan:** Data simulasi muncul karena `MT5_USE_SIMULATION=True` dan belum ada EA. Install EA untuk data real! 🚀
