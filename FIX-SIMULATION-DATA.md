# 🎯 Fix: Data Simulasi → Data Real

## Masalah
Website menampilkan data simulasi (fake), bukan data real dari MT5 akun kamu.

## Root Cause
- Backend mode: `MT5_USE_SIMULATION=True` (Linux tidak support MT5 package)
- Belum ada EA yang push data real
- Database hanya punya data simulasi

## ✅ Solusi: Install EA (5 Menit)

### Step 1: Download EA Token (30 detik)

```bash
# SSH ke VPS
ssh root@srv1936514.prod.hosts.ooklaserver.net

# Check token
cd ~/mikapedia
cat backend/.env | grep EA_INTEGRATION_TOKEN

# COPY token ini! (tanpa EA_INTEGRATION_TOKEN=)
# Example: WIyu2iegq4bMzplIeLCHq7uOgyPZyXozEYpwsKrA2fc
```

### Step 2: Copy EA File (1 menit)

1. Di komputer kamu, lokasi EA:
   ```
   c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\backend\scripts\MikapediaReporter.mq5
   ```

2. Copy file tersebut ke MT5:
   ```
   C:\Users\[YourName]\AppData\Roaming\MetaQuotes\Terminal\[RandomID]\MQL5\Experts\
   ```

   **Cara cepat:**
   - Buka MT5
   - Tekan `Ctrl+Shift+D` (File Explorer terbuka)
   - Navigate: `MQL5\Experts\`
   - Paste file `MikapediaReporter.mq5` di sini

### Step 3: Compile EA (30 detik)

1. Tekan `F4` di MT5 (MetaEditor terbuka)
2. Navigator → Double-click `MikapediaReporter.mq5`
3. Tekan `F7` (Compile)
4. Check hasil:
   ```
   0 error(s), 0 warning(s)  ✅
   ```

### Step 4: Whitelist URL (1 menit)

1. MT5 → `Tools` → `Options`
2. Tab `Expert Advisors`
3. ☑ **Allow algorithmic trading**
4. ☑ **Allow WebRequest for listed URL:**
5. Tambahkan:
   ```
   https://mikapedia.online
   ```
6. Klik `OK`

### Step 5: Attach EA (1 menit)

1. Buka chart apa saja (recommended: XAUUSD M15)
2. Navigator → Expand `Expert Advisors`
3. **Drag** `MikapediaReporter` ke chart
4. Dialog muncul → **Tab Inputs**:
   ```
   BACKEND_URL:  https://mikapedia.online/api/v1/mt5/ea-report/
   EA_TOKEN:     [PASTE TOKEN DARI STEP 1] ⚠️
   REPORT_EVERY: 1
   ```
5. **Tab Common**:
   - ☑ Allow algo trading
   - ☑ Allow WebRequest
6. Klik `OK`

### Step 6: Verify EA Running (30 detik)

**Check Expert tab (bawah chart):**
```
╔════════════════════════════════════════════════════════════╗
║  MIKAPEDIA TOMS EA Reporter v2.10                          ║
╚════════════════════════════════════════════════════════════╝
✓ Account: 7724091
✓ Server: ICMarkets-Live01
✓ Broker: IC Markets
✓ Backend: https://mikapedia.online/api/v1/mt5/ea-report/
────────────────────────────────────────────────────────────
→ Sending initial report...
✅ [Mikapedia] Data synced — 2 positions, 0 pending orders
```

**Check icon di chart (pojok kanan atas):**
- 😊 = EA running OK ✅
- ❌ = EA error ❌

**Check AutoTrading button (toolbar):**
- Harus **HIJAU** (enabled)

### Step 7: Refresh Website (10 detik)

1. Buka https://mikapedia.online/trader/mt5
2. **Hard refresh:** `Ctrl+Shift+R` (Windows) atau `Cmd+Shift+R` (Mac)
3. **Check data:**
   - ✅ Balance harus sama dengan MT5!
   - ✅ Equity harus sama dengan MT5!
   - ✅ Positions harus sama dengan MT5!
   - ✅ Data update real-time (every 1 second)

---

## ✅ Success Checklist

- [ ] EA token copied dari VPS
- [ ] EA file di `MQL5/Experts/`
- [ ] Compiled with 0 errors
- [ ] URL whitelisted (`https://mikapedia.online`)
- [ ] EA attached ke chart
- [ ] EA_TOKEN parameter filled
- [ ] Expert tab shows "✅ Data synced"
- [ ] Website shows real balance (sama dengan MT5)
- [ ] AutoTrading button GREEN

---

## 🐛 Troubleshooting

### EA Log: "WebRequest error (-1)"

**Problem:** URL not whitelisted

**Fix:**
1. Tools → Options → Expert Advisors
2. ☑ Allow WebRequest for listed URL
3. Add: `https://mikapedia.online`
4. Restart MT5
5. Attach EA lagi

### EA Log: "HTTP 403 FORBIDDEN"

**Problem:** EA_TOKEN salah

**Fix:**
1. Right-click chart → Expert Advisors → MikapediaReporter → Properties
2. Tab Inputs → EA_TOKEN → paste correct token
3. OK

### EA Log: "HTTP 404 NOT FOUND"

**Problem:** Backend down atau URL salah

**Check:**
```bash
# Browser: https://mikapedia.online/api/health/
# Should return: {"status": "ok"}

# VPS logs:
docker compose -f docker-compose.prod.yml logs backend --tail=50
```

### Website Still Shows Fake Data

**Possible causes:**

1. **Browser cache:**
   - Hard reload: `Ctrl+Shift+R`
   - Or use Incognito mode

2. **EA not sending:**
   - Check Expert tab → should have "✅ Data synced"
   - Check AutoTrading button → should be GREEN

3. **Database not updated:**
   ```bash
   # Check database
   docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT login, balance, last_sync FROM mt5_accounts;"
   
   # last_sync should be recent (within 1 minute)
   ```

4. **Wrong account:**
   - Make sure kamu login sebagai user yang benar
   - Check MT5 login number di website vs MT5 terminal

---

## 📊 Before vs After

### Before (Simulation):
```
Website /trader/mt5:
├─ Login:    7724091 ✅
├─ Balance:  $10,234.56 ❌ (fake, random)
├─ Equity:   $10,189.23 ❌ (fake, random)
├─ Positions: 2 ❌ (fake, random)
└─ Status:   Connected (but fake data)
```

### After (EA Installed):
```
Website /trader/mt5:
├─ Login:    7724091 ✅
├─ Balance:  $5,432.10 ✅ (real, from MT5)
├─ Equity:   $5,401.23 ✅ (real, from MT5)
├─ Positions: 2 ✅ (real: XAUUSD BUY, EURUSD SELL)
└─ Status:   Connected (with real data!)
```

---

## 🎯 Key Points

1. **Simulation = Fake Data**
   - Backend generates random data
   - Balance ~$10k (not real)
   - Positions are fake

2. **EA = Real Data**
   - Push real data from MT5 terminal
   - 100% accurate
   - Update every 1 second

3. **EA Runs on Windows Only**
   - MT5 terminal must be running
   - EA attached to any chart
   - Send data via HTTPS to backend

4. **Backend (Linux) = Receiver**
   - Cannot connect to MT5 directly
   - Receive data from EA
   - Store in database
   - Broadcast to frontend via WebSocket

---

## ⏱️ Total Time: ~5 Minutes

1. Get token: 30s
2. Copy EA: 1m
3. Compile: 30s
4. Whitelist: 1m
5. Attach: 1m
6. Verify: 30s
7. Refresh website: 10s

**Total:** 4m 40s ✅

---

## 🚀 What's Next?

Once EA is working:

1. **Monitor for 24 hours** - ensure stable
2. **Test with trades** - open/close positions, verify synced
3. **Check real-time updates** - website updates without refresh
4. **Install on other accounts** (if needed) - 1 EA per account
5. **Optimize** - set REPORT_EVERY=5 if 1s is too frequent

---

## 📞 Still Need Help?

If EA installed but still shows fake data:

1. Screenshot Expert tab (EA logs)
2. Screenshot website `/trader/mt5`
3. Run diagnostic:
   ```bash
   ./test-mt5-flow.sh your@email.com password 7724091
   ```
4. Send all to developer

---

**Remember:** Simulation mode is BY DESIGN for Linux servers. EA is THE solution for real data! 🎯
