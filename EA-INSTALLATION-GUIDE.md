# 📘 Panduan Install EA MikapediaReporter

## ✅ Perbaikan EA (v2.10)

### Yang Sudah Diperbaiki:

1. ❌ **URL Duplikat** → ✅ Fixed
   ```mql5
   // SALAH (versi lama):
   string url = BACKEND_URL + "/api/v1/mt5/ea-report/";
   // URL jadi: .../ea-webhook//api/v1/mt5/ea-report/ ❌
   
   // BENAR (versi baru):
   BACKEND_URL = "https://mikapedia.online/api/v1/mt5/ea-report/"
   WebRequest("POST", BACKEND_URL, ...)  // Langsung! ✅
   ```

2. ❌ **Token Validation** → ✅ Added
   - EA sekarang validate token saat OnInit()
   - Alert kalau token belum diset
   - Error logging detail untuk HTTP 403

3. ✅ **Better Error Handling**
   - Error -1: WebRequest not whitelisted
   - HTTP 403: Token salah
   - HTTP 404: Backend down / URL salah
   - HTTP 500: Server error
   - HTTP 200: Success (log every 30s)

4. ✅ **Enhanced Logging**
   - Startup info lengkap
   - Success rate tracking
   - Less spam (success log 30s interval)

## 📦 File EA Terbaru

File: `backend/scripts/MikapediaReporter.mq5`  
Version: 2.10  
Checksum: Updated 2026-08-31

## 🛠️ Step-by-Step Installation

### Step 1: Get EA_INTEGRATION_TOKEN dari Backend

```bash
# SSH ke VPS
ssh root@your-vps-ip

# Check token di .env
cd ~/mikapedia
cat backend/.env | grep EA_INTEGRATION_TOKEN

# Output: EA_INTEGRATION_TOKEN=your-secret-token-here
# COPY token ini (tanpa EA_INTEGRATION_TOKEN=)
```

### Step 2: Copy EA ke MT5

1. **Lokasi EA:**
   ```
   C:\Users\[YourName]\AppData\Roaming\MetaQuotes\Terminal\[RandomID]\MQL5\Experts\
   ```

2. **Cara cepat:**
   - Buka MT5
   - Tekan `Ctrl+Shift+D` → File Explorer terbuka
   - Navigate ke: `MQL5\Experts\`
   - Copy file `MikapediaReporter.mq5` ke sini

### Step 3: Compile EA

1. Buka MetaEditor (tekan `F4` di MT5)
2. Di Navigator, cari `MikapediaReporter.mq5`
3. Double-click untuk open
4. Tekan `F7` (Compile)
5. Check **Errors tab** di bawah:
   ```
   0 error(s), 0 warning(s)  ✅
   ```

### Step 4: Whitelist URL

1. MT5 → `Tools` → `Options`
2. Tab `Expert Advisors`
3. ☑ Centang: **Allow algorithmic trading**
4. ☑ Centang: **Allow WebRequest for listed URL:**
5. Tambahkan URL:
   ```
   https://mikapedia.online
   ```
6. Klik `OK`

**Screenshot reference:** (lihat screenshot di atas)

### Step 5: Attach EA ke Chart

1. Buka chart apa saja (recommended: XAUUSD M15)
2. Di Navigator, expand `Expert Advisors`
3. Drag `MikapediaReporter` ke chart
4. Dialog muncul → Tab `Inputs`:
   ```
   BACKEND_URL: https://mikapedia.online/api/v1/mt5/ea-report/
   EA_TOKEN: [PASTE TOKEN DARI STEP 1]  ⚠️ WAJIB!
   REPORT_EVERY: 1
   ```
5. Tab `Common`:
   - ☑ Allow algo trading
   - ☑ Allow WebRequest
6. Klik `OK`

### Step 6: Verify EA Running

1. **Check Expert tab (di bawah chart):**
   ```
   ╔════════════════════════════════════════════════════════════╗
   ║  MIKAPEDIA TOMS EA Reporter v2.10                          ║
   ╚════════════════════════════════════════════════════════════╝
   ✓ Account: 7724091
   ✓ Server: ICMarkets-Live01
   ✓ Broker: IC Markets
   ✓ Backend: https://mikapedia.online/api/v1/mt5/ea-report/
   ✓ Report interval: 1 second(s)
   ────────────────────────────────────────────────────────────
   → Sending initial report...
   ✅ [Mikapedia] Data synced — 2 positions, 0 pending orders, 5 deals
   ```

2. **Check icon di pojok kanan atas chart:**
   ```
   😊 = EA running OK
   ❌ = EA error / not running
   ```

3. **Check AutoTrading button (toolbar):**
   - Button harus **HIJAU** (enabled)
   - Kalau merah, klik untuk enable

## 🐛 Troubleshooting

### Error: WebRequest error (-1)

**Penyebab:** URL not whitelisted

**Solusi:**
```
1. Tools → Options → Expert Advisors
2. Centang "Allow WebRequest for listed URL"
3. Tambahkan: https://mikapedia.online
4. Restart MT5
5. Attach EA lagi
```

### Error: HTTP 403 FORBIDDEN

**Penyebab:** EA_TOKEN salah

**Solusi:**
```bash
# Cek token di VPS
cat backend/.env | grep EA_INTEGRATION_TOKEN

# Copy token yang benar
# Edit EA parameter:
# 1. Right-click chart → Expert Advisors → MikapediaReporter → Properties
# 2. Tab Inputs → EA_TOKEN → paste token baru
# 3. OK
```

### Error: HTTP 404 NOT FOUND

**Penyebab:** Backend down atau URL salah

**Cek:**
```bash
# Test backend dari browser
https://mikapedia.online/api/health/
# Harus return: {"status": "ok"}

# Cek backend logs
docker compose -f docker-compose.prod.yml logs backend --tail=50
```

### Error: HTTP 500 SERVER ERROR

**Penyebab:** Backend error (bug/crash)

**Cek backend logs:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i error
```

### EA Tidak Kirim Data

**Checklist:**
- [ ] AutoTrading button HIJAU?
- [ ] EA icon di chart 😊 (bukan ❌)?
- [ ] URL sudah di-whitelist?
- [ ] EA_TOKEN sudah benar?
- [ ] Internet connection OK?
- [ ] Backend responding? (test `/api/health/`)

**Force restart:**
```
1. Remove EA dari chart (drag keluar)
2. Close MT5
3. Open MT5
4. Attach EA lagi
```

## ✅ Verify EA Working

### Check 1: MT5 Expert Tab

Log harus ada:
```
✅ [Mikapedia] Data synced — X positions, Y pending orders, Z deals
```

Setiap ~30 detik (untuk menghindari spam log)

### Check 2: Backend Logs

```bash
# SSH ke VPS
docker compose -f docker-compose.prod.yml logs backend | grep "ea_report"

# Expected output:
# backend | INFO ea_report received: login=7724091, positions=2, status=ok
```

### Check 3: Database

```bash
# Check MT5Account di database
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "
SELECT login, status, balance, equity, last_sync 
FROM mt5_accounts 
ORDER BY last_sync DESC 
LIMIT 1;
"

# Expected:
#  login  | status    | balance  | equity   | last_sync
# --------|-----------|----------|----------|------------------
#  7724091| connected | 10234.50 | 10189.23 | 2026-08-31 15:30:45
```

### Check 4: Frontend

1. Login ke https://mikapedia.online/trader/mt5
2. Harus muncul:
   - ✅ Status: Connected
   - ✅ Balance, Equity, Floating P/L
   - ✅ Open Positions (kalau ada)
   - ✅ Data update real-time

## 📊 EA Performance

### Expected Behavior:

- **Frequency**: Send data every 1 second (configurable via REPORT_EVERY)
- **Payload size**: ~2-5 KB per request
- **Network usage**: ~2-5 KB/s = ~10-20 MB/hour
- **CPU usage**: <1%
- **Memory**: ~5 MB

### Logs (Normal Operation):

```
// Initial startup
╔════════════════════════════════════════════════════════════╗
║  MIKAPEDIA TOMS EA Reporter v2.10                          ║
╚════════════════════════════════════════════════════════════╝
✓ Account: 7724091
✓ Server: ICMarkets-Live01
... (startup info)

// Every 30 seconds
✅ [Mikapedia] Data synced — 2 positions, 0 pending orders, 5 deals
✅ [Mikapedia] Data synced — 2 positions, 0 pending orders, 5 deals

// On error (immediate log)
❌ [Mikapedia] HTTP 403 FORBIDDEN
   → EA_TOKEN salah! Cek parameter EA
   
// On close
────────────────────────────────────────────────────────────
✓ EA Reporter stopped. Reason: 0
╚════════════════════════════════════════════════════════════╝
```

## 🎯 Comparison: EA vs Simulation

| Feature | Simulation Mode | EA Mode (Real) |
|---------|-----------------|----------------|
| Data Source | Backend generates fake data | MT5 Terminal (real) |
| Accuracy | Fake (~$10k balance) | 100% accurate |
| Update Frequency | On-demand (API call) | Real-time (every tick) |
| Setup | No setup needed | EA installation required |
| Use Case | Development/testing | Production |
| Multiple Accounts | Not supported | Yes (1 EA per account) |

## 🚀 Next Steps

Once EA is installed and working:

1. **Monitor for 24 hours** - ensure no errors
2. **Test with real positions** - open/close trades, check if synced
3. **Check WebSocket updates** - frontend should update without refresh
4. **Install on multiple accounts** (if needed) - 1 EA per MT5 account
5. **Set REPORT_EVERY = 5** (optional) - reduce traffic if 1s is too frequent

## 📞 Support

Jika masih error setelah follow guide ini:

1. Screenshot Expert tab (log EA)
2. Screenshot EA parameters
3. Screenshot MT5 Options → Expert Advisors
4. Copy backend logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs backend --tail=100 > backend-ea-logs.txt
   ```
5. Send semua ke developer

---

**Version**: 2.10  
**Last Updated**: 2026-08-31  
**Status**: Production Ready ✅
