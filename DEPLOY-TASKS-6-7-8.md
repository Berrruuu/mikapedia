# Panduan Deploy - Tasks 6, 7, 8

## Yang Sudah Dipush ke GitHub

✅ 3 commits sudah dipush ke branch `main2`:
1. `fix: remove dummy data from audit logs, display real data from database`
2. `fix: remove dummy data from signal detail page, fetch real MT5 trades`
3. `feat: implement rogue trade detection for entry without signal`

---

## Deploy ke Server Hostinger

### Step 1: SSH ke Server
```bash
ssh root@srv1936514
# atau gunakan IP server Anda
```

### Step 2: Pull Update dari GitHub
```bash
cd ~/mikapedia
git pull origin main2
```

**Expected Output:**
```
remote: Enumerating objects: ...
remote: Counting objects: 100% ...
Updating xxx..xxx
Fast-forward
 backend/mt5/views.py                 | ...
 backend/mt5/urls.py                  | ...
 backend/mt5/signal_matcher.py        | ...
 backend/compliance/violations.py     | ...
 src/routes/admin.audit.tsx           | ...
 src/routes/admin.signals.$id.tsx     | ...
 FIX-AUDIT-LOGS-DUMMY-DATA.md        | ...
 FIX-DUMMY-DATA-SIGNAL-DETAIL.md     | ...
 FEAT-ROGUE-TRADE-DETECTION.md       | ...
 ... files changed, ... insertions(+), ... deletions(-)
```

### Step 3: Rebuild dan Restart Containers
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Expected Output:**
```
[+] Building ...
[+] Running 3/3
 ✔ Container mikapedia-db-1        Running
 ✔ Container mikapedia-backend-1   Started
 ✔ Container mikapedia-frontend-1  Started
```

### Step 4: Check Container Status
```bash
docker compose -f docker-compose.prod.yml ps
```

**Should show all containers as "Up":**
```
NAME                     STATUS
mikapedia-db-1          Up
mikapedia-backend-1     Up (healthy)
mikapedia-frontend-1    Up (healthy)
```

### Step 5: Check Logs (Optional)
```bash
# Check backend logs
docker compose -f docker-compose.prod.yml logs -f backend

# Check frontend logs
docker compose -f docker-compose.prod.yml logs -f frontend
```

Press `Ctrl+C` to exit logs.

---

## Verifikasi Setelah Deploy

### 1. Verifikasi Task 8: Audit Logs (Data Real)

1. **Buka browser**, akses:
   ```
   https://mikapedia.online/admin/audit
   ```

2. **Cek apakah masih ada data dummy**
   - ❌ TIDAK boleh ada: Rania Pratama, Arif Wibowo, Rendra Prakoso, dll
   - ✅ HARUS ada: Data real dari aktivitas sistem atau "Belum ada audit logs"

3. **Test dengan generate data baru**
   - Login/logout beberapa kali
   - Refresh halaman audit logs
   - Seharusnya muncul: "Admin signed in from xxx.xxx.xxx.xxx"

4. **Test filters**
   - Filter by severity: critical, warning, high, info
   - Filter by category: auth, signal, compliance, system
   - Search box: cari actor atau action

5. **Test export CSV**
   - Klik tombol "Export CSV"
   - Download file CSV
   - Verify data CSV adalah data real (bukan dummy)

---

### 2. Verifikasi Task 6: Signal Detail (MT5 Trades Real)

1. **Buka Signal Center**
   ```
   https://mikapedia.online/admin/signals
   ```

2. **Klik salah satu signal** untuk masuk ke detail page

3. **Scroll ke section "MT5 Linked Orders/Positions"**
   - ❌ TIDAK boleh ada: Ayu Pratama, Bima Surya, Citra Lestari
   - ✅ HARUS ada: 
     - Data real dari EA (nama trader real, ticket real, dll) ATAU
     - "Belum ada trader yang execute signal ini" (jika memang tidak ada)

4. **Jika ada trades real**, verify:
   - Ticket number sesuai dengan MT5
   - Trader name sesuai dengan user real
   - Symbol, volume, open price sesuai
   - Status (open/closed) sesuai

---

### 3. Verifikasi Task 7: Rogue Trade Detection

#### Test Case: Entry Manual Tanpa Signal

1. **Buka MT5 terminal** (komputer yang sudah install EA)

2. **Check current signals** di TradingView atau dashboard
   - Catat symbol dan direction yang TIDAK ada signalnya
   - Contoh: Jika XAUUSD tidak ada signal, gunakan XAUUSD untuk test

3. **Entry manual di MT5** (TANPA signal)
   ```
   Symbol: XAUUSD (atau symbol lain yang tidak ada signalnya)
   Direction: BUY atau SELL (bebas)
   Lot: 0.01 (untuk testing)
   ```

4. **Wait 1-2 seconds** (EA push data setiap 1 detik)

5. **Check Compliance Tab** di dashboard
   ```
   https://mikapedia.online/trader/compliance
   ```
   - ✅ HARUS muncul violation baru: **"Unauthorized Trade"**
   - Severity: Critical
   - Score: 0
   - Description: "Entry without valid signal"

6. **Check Notifications**
   - ✅ HARUS ada notifikasi danger:
     - "Rogue Trade Detected - Unauthorized Trade"
     - "Entry position tanpa signal yang valid"

7. **Check Audit Logs**
   ```
   https://mikapedia.online/admin/audit
   ```
   - ✅ HARUS ada log baru:
     - Category: compliance
     - Severity: critical
     - Action: "Compliance engine flagged unauthorized trade — [Trader Name] · XAUUSD"

8. **Check Compliance Score**
   ```
   https://mikapedia.online/trader/profile
   ```
   - ✅ Compliance score HARUS turun (dari nilai sebelumnya)

9. **Close position** untuk cleanup

#### Test Case: Entry dengan Signal (Violations Lain Masih Kerja)

1. **Wait for signal** dari TradingView atau create manual signal

2. **Entry dengan sengaja melanggar SOP**
   - Late entry (>2 menit setelah signal)
   - Wrong lot size (tidak sesuai dengan signal)
   - No stop loss

3. **Verify violations terdeteksi**
   - Late entry → warning, score 60
   - Wrong lot size → warning, score 70
   - No stop loss → danger, score 40

---

## Troubleshooting

### Issue: Audit Logs masih muncul dummy data

**Cek browser cache:**
```bash
# Clear browser cache dan hard reload
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

**Cek frontend container rebuild:**
```bash
docker compose -f docker-compose.prod.yml logs frontend | grep "Build"
```

**Force rebuild frontend:**
```bash
docker compose -f docker-compose.prod.yml stop frontend
docker compose -f docker-compose.prod.yml rm -f frontend
docker compose -f docker-compose.prod.yml up -d --build frontend
```

---

### Issue: Signal Detail masih muncul dummy data

**Cek backend logs:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep "trades_by_signal"
```

**Test endpoint manually:**
```bash
# Get signal ID first
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mikapedia.online/api/v1/signals/

# Then test trades endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mikapedia.online/api/v1/mt5/trades/?signal=SIGNAL_ID
```

**Should return:**
```json
[
  {
    "id": 1,
    "ticket": 12345,
    "symbol": "XAUUSD",
    "traderName": "Real Trader Name",
    ...
  }
]
```

---

### Issue: Rogue Trade tidak terdeteksi

**Cek EA connection:**
```bash
# Check backend logs for EA reports
docker compose -f docker-compose.prod.yml logs backend | grep "EA report"
```

**Cek compliance engine:**
```bash
# Run diagnostic script
docker compose -f docker-compose.prod.yml exec backend python backend/diagnose_compliance.py
```

**Check signal matcher:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep "signal_matcher"
```

**Verify position exists:**
```bash
# Check MT5 orders in database
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from mt5.models import MT5Order
from users.models import CustomUser

# Check if position was saved
trader = CustomUser.objects.get(username="YOUR_USERNAME")
positions = MT5Order.objects.filter(account=trader.mt5_account, status='open')
print(positions)

# Check if compliance result was created
from compliance.models import ComplianceResult
results = ComplianceResult.objects.filter(trade__account=trader.mt5_account).order_by('-created_at')[:5]
for r in results:
    print(f"{r.created_at} - {r.violation} - {r.level}")
```

---

### Issue: Container tidak start

**Check docker logs:**
```bash
docker compose -f docker-compose.prod.yml logs --tail=100
```

**Restart all containers:**
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

**Check disk space:**
```bash
df -h
```

**Clean old docker images:**
```bash
docker system prune -a
```

---

## Rollback (Jika Ada Masalah)

### Rollback ke commit sebelumnya:
```bash
cd ~/mikapedia
git log --oneline -10  # cek commit history
git checkout <COMMIT_HASH_SEBELUMNYA>
docker compose -f docker-compose.prod.yml up -d --build
```

### Atau revert specific commit:
```bash
git revert <COMMIT_HASH>
git push origin main2
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Monitoring Setelah Deploy

### 1. Monitor Container Health
```bash
# Real-time monitoring
watch docker compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats
```

### 2. Monitor Backend Logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep -E "ERROR|WARNING|compliance|signal_matcher"
```

### 3. Monitor EA Connection
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep "EA report"
```

Should see logs every 1 second:
```
backend-1  | EA report received from account 7724095
```

### 4. Monitor Compliance Events
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep "Compliance"
```

---

## Summary Checklist

### Deploy Checklist
- [ ] SSH ke server
- [ ] `git pull origin main2`
- [ ] `docker compose -f docker-compose.prod.yml up -d --build`
- [ ] Check container status (all Up)
- [ ] Check logs for errors

### Verification Checklist
- [ ] Audit Logs: NO dummy data (Rania, Arif, dll)
- [ ] Audit Logs: Show real data or empty state
- [ ] Signal Detail: NO dummy data (Ayu, Bima, Citra)
- [ ] Signal Detail: Show real trades or empty state
- [ ] Rogue Trade: Entry without signal → violation detected
- [ ] Rogue Trade: Notification sent to trader
- [ ] Rogue Trade: Audit log created
- [ ] Rogue Trade: Compliance score decreased
- [ ] Other violations: Still working (late entry, wrong lot, no SL)

### Monitoring Checklist
- [ ] All containers healthy
- [ ] EA pushing data every 1 second
- [ ] No errors in backend logs
- [ ] Frontend accessible
- [ ] Database connections working

---

**Status**: Ready to Deploy ✅

**Branch**: main2  
**Commits**: 3 commits  
**Files Changed**: 11 files  
**Documentation**: 5 MD files

**Contact**: Jika ada masalah saat deploy, check:
1. Container logs
2. Backend error logs
3. Frontend browser console
4. EA connection status
5. Database connection

**Emergency**: Jika critical error, lakukan rollback ke commit sebelumnya.
