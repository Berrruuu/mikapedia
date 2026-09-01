# Quick Reference - Fixes Tasks 6, 7, 8

## TL;DR - Yang Sudah Diperbaiki

### ✅ Task 6: Signal Detail - MT5 Trades
**Sebelum**: Dummy data (Ayu Pratama, Bima Surya, Citra Lestari)  
**Sesudah**: Data real dari EA atau "Belum ada trader yang execute"

### ✅ Task 7: Rogue Trade Detection  
**Sebelum**: Entry tanpa signal tidak terdeteksi  
**Sesudah**: Entry tanpa signal → Violation "Unauthorized Trade" (critical, score 0)

### ✅ Task 8: Audit Logs
**Sebelum**: 15 dummy entries (Rania Pratama, Arif Wibowo, dll)  
**Sesudah**: Data real dari database atau "Belum ada audit logs"

---

## Deploy Command (Copy-Paste)

```bash
ssh root@srv1936514
cd ~/mikapedia
git pull origin main2
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Verifikasi Cepat

### 1. Audit Logs
```
URL: https://mikapedia.online/admin/audit
Cek: Tidak ada Rania Pratama, Arif Wibowo
Expected: Data real atau "Belum ada audit logs"
```

### 2. Signal Detail
```
URL: https://mikapedia.online/admin/signals/<id>
Section: MT5 Linked Orders/Positions
Cek: Tidak ada Ayu Pratama, Bima Surya, Citra Lestari
Expected: Data real atau "Belum ada trader yang execute"
```

### 3. Rogue Trade
```
Test: Entry manual di MT5 tanpa signal
Wait: 1-2 seconds
Check: /trader/compliance → "Unauthorized Trade" violation
Check: Notifications → Danger notification
Check: /admin/audit → Compliance event (critical)
```

---

## Troubleshooting One-Liners

### Hard reload browser (clear cache)
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Check container status
```bash
docker compose -f docker-compose.prod.yml ps
```

### View backend logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### Check EA connection
```bash
docker compose -f docker-compose.prod.yml logs backend | grep "EA report" | tail -10
```

### Restart containers
```bash
docker compose -f docker-compose.prod.yml restart
```

### Force rebuild
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Files Changed (4 commits)

### Commit 1: Audit Logs
- `src/routes/admin.audit.tsx` - Removed dummy data
- `FIX-AUDIT-LOGS-DUMMY-DATA.md`

### Commit 2: Signal Detail
- `backend/mt5/views.py` - Added trades_by_signal endpoint
- `backend/mt5/urls.py` - Added route
- `src/routes/admin.signals.$id.tsx` - Fetch real data
- `FIX-DUMMY-DATA-SIGNAL-DETAIL.md`

### Commit 3: Rogue Trade Detection
- `backend/mt5/signal_matcher.py` - Added _detect_rogue_trades()
- `backend/compliance/violations.py` - Added unauthorized_trade
- `FEAT-ROGUE-TRADE-DETECTION.md`
- `COMPLIANCE-ENGINE-CHECK.md`
- `backend/diagnose_compliance.py`

### Commit 4: Documentation
- `SUMMARY-FIXES-TASKS-6-7-8.md`
- `DEPLOY-TASKS-6-7-8.md`

---

## API Endpoints (New)

### MT5 Trades by Signal
```
GET /api/v1/mt5/trades/?signal=<signal_id>
```

### Audit Logs (Already Existed)
```
GET /api/v1/audit-logs/?severity=<>&category=<>&search=<>
```

---

## Compliance Violations (All Working)

| Violation | Score | Level | Trigger |
|-----------|-------|-------|---------|
| **unauthorized_trade** | 0 | critical | Entry tanpa signal (NEW!) |
| wrong_direction | 0 | critical | BUY saat signal SELL atau sebaliknya |
| no_stop_loss | 40 | danger | Entry tanpa SL |
| late_entry | 60 | warning | Entry >2 menit setelah signal |
| wrong_lot_size | 70 | warning | Lot tidak sesuai signal |
| stop_loss_wrong_ratio | 80 | warning | SL ratio tidak sesuai |

---

## Expected Behavior

### Skenario 1: Trader Entry dengan Signal (Normal)
1. TradingView kirim signal → Backend save
2. Trader entry di MT5 (sesuai signal)
3. EA push data → Backend save ke Trade & MT5Order
4. Compliance engine match trade dengan signal
5. Check violations (late entry, wrong lot, no SL, dll)
6. If violation → Create ComplianceResult, send notification

### Skenario 2: Trader Entry tanpa Signal (Rogue Trade)
1. Trader entry di MT5 (TIDAK ada signal)
2. EA push data → Backend save ke Trade & MT5Order
3. Compliance engine match trade dengan signal → **NO MATCH**
4. _detect_rogue_trades() → Detect position tanpa signal
5. Create ComplianceResult: violation=unauthorized_trade, score=0, level=critical
6. Send danger notification
7. Create SOPWarning
8. Update user.complianceScore

### Skenario 3: Admin Check Audit Logs
1. Admin open `/admin/audit`
2. Frontend fetch dari `/api/v1/audit-logs/`
3. Backend query AuditLog model dari database
4. Return real data (login events, signal events, compliance events)
5. Frontend display data real (BUKAN dummy data)

### Skenario 4: Admin Check Signal Detail
1. Admin open signal detail page
2. Frontend fetch dari `/api/v1/mt5/trades/?signal=<id>`
3. Backend query Trade model filtered by signal_id
4. Return real trades dari EA
5. Frontend display data real (BUKAN dummy data)

---

## Monitoring Commands

### Real-time logs
```bash
# All logs
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend

# Frontend only
docker compose -f docker-compose.prod.yml logs -f frontend

# Filter by keyword
docker compose -f docker-compose.prod.yml logs -f backend | grep -E "ERROR|WARNING"
```

### Check EA connection (should see logs every 1 second)
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep "EA report"
```

### Check compliance events
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep "Compliance"
```

### Check container health
```bash
watch docker compose -f docker-compose.prod.yml ps
```

### Check resource usage
```bash
docker stats
```

---

## Rollback (Emergency)

```bash
cd ~/mikapedia
git log --oneline -10
git checkout <PREVIOUS_COMMIT_HASH>
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Support Documentation

Untuk detail lengkap, lihat:

1. **SUMMARY-FIXES-TASKS-6-7-8.md** - Complete overview
2. **DEPLOY-TASKS-6-7-8.md** - Deployment guide dengan troubleshooting
3. **FIX-AUDIT-LOGS-DUMMY-DATA.md** - Audit logs fix details
4. **FIX-DUMMY-DATA-SIGNAL-DETAIL.md** - Signal detail fix details
5. **FEAT-ROGUE-TRADE-DETECTION.md** - Rogue trade detection details
6. **COMPLIANCE-ENGINE-CHECK.md** - Compliance diagnostic guide

---

## Status

**Branch**: main2 ✅  
**Commits**: 4 commits pushed ✅  
**Ready to Deploy**: YES ✅  

**Next Step**: Deploy ke server dengan command di atas ⬆️
