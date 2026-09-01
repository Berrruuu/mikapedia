# ✅ FEATURE: Rogue Trade Detection (Entry Tanpa Signal)

## 🎯 Problem

Trader membuka posisi **di luar signal** (tidak mengikuti signal dari TradingView), tapi sistem **tidak memberikan peringatan** compliance violation.

### Previous Behavior (Before Fix):

```
User buka posisi EURUSD BUY di MT5
→ EA push data ke backend
→ Signal matcher cari signal EURUSD BUY hari ini
→ Tidak ada signal yang match
→ Posisi TIDAK dievaluasi ❌
→ Tidak ada peringatan ❌
→ User bebas entry sesuka hati ❌
```

### New Behavior (After Fix):

```
User buka posisi EURUSD BUY di MT5
→ EA push data ke backend
→ Signal matcher cari signal EURUSD BUY hari ini
→ Tidak ada signal yang match
→ Detect sebagai "rogue trade" (entry tanpa signal) ✅
→ Create ComplianceResult dengan violation: "unauthorized_trade" ✅
→ Score: 0/100 ✅
→ Send notification: "⚠️ Entry Tanpa Signal — EURUSD" ✅
→ Create SOPWarning ✅
→ Update user.complianceScore ✅
```

---

## 🔧 Implementation

### File: `backend/mt5/signal_matcher.py`

Added new function: `_detect_rogue_trades(account, today, active_signals)`

**Logic:**

1. **Get all positions** from account
2. **Get all trades linked to signals** (legitimate trades)
3. **Find rogue positions**: positions NOT in legitimate list
4. **For each rogue position:**
   - Create `Trade` record without signal (`signal=None`)
   - Create `ComplianceResult` with:
     - `status = 'Unauthorized Trade'`
     - `score = 0`
     - `violations = ['unauthorized_trade']`
     - `coaching_note = 'Trader membuka posisi tanpa ada signal yang match...'`
   - Send `Notification` to trader:
     - Level: `danger`
     - Title: `⚠️ Entry Tanpa Signal — {symbol}`
     - Body: Explanation of violation
   - Create `SOPWarning` record
   - Recalculate `user.complianceScore` (30-day average)

**Called from:** `match_account_to_signals()` at the end of matching process

---

## 📋 Feature Details

### Violation Type: `unauthorized_trade`

- **Code:** `unauthorized_trade`
- **Label:** Entry Tanpa Signal
- **Score Deduction:** -100 (max penalty, score becomes 0)
- **Severity:** Danger (red alert)
- **SOP Rule:** Trader WAJIB hanya entry sesuai signal dari TradingView

### When It Triggers:

✅ **Detected as rogue trade:**
- User buka posisi XAUUSD BUY
- Tidak ada signal XAUUSD BUY hari ini
- → Rogue trade detected

✅ **Detected as rogue trade:**
- User buka posisi EURUSD SELL
- Ada signal EURUSD BUY (direction berbeda)
- → Position tidak match signal → Rogue trade

❌ **NOT detected as rogue trade:**
- User buka posisi XAUUSD BUY @ 2650
- Ada signal XAUUSD BUY dengan fib 0.236 @ 2650
- → Position match signal → Evaluated normally (bisa compliant atau ada violation lain)

---

## 🧪 Testing Scenarios

### Test 1: Entry Sesuai Signal (Normal Flow)

**Setup:**
1. Create signal: XAUUSD BUY, time: 10:00, max_entry: 10:05
2. Fib levels: 0.236=2650, 0.500=2655, 0.618=2660

**Action:**
1. Place BUY LIMIT @ 2650 di MT5 at 10:02
2. Wait for EA push

**Expected Result:**
- ✅ Trade created with `signal_id = X`
- ✅ ComplianceResult: `status='Compliant'`, `score=100`
- ✅ Notification: "✅ Eksekusi Signal #X Sesuai SOP"
- ✅ No rogue trade detected

---

### Test 2: Entry Wrong Direction (Violation but NOT Rogue)

**Setup:**
1. Signal exists: XAUUSD BUY

**Action:**
1. Place SELL @ 2650 di MT5

**Expected Result:**
- ✅ Trade created with `signal_id = X` (matched by symbol)
- ✅ ComplianceResult: `violations=['wrong_direction']`, `score=40`
- ✅ Notification: "⚠️ Pelanggaran SOP — Arah Salah"
- ❌ Not detected as rogue (symbol matches, just wrong direction)

---

### Test 3: Entry Tanpa Signal (ROGUE TRADE)

**Setup:**
1. No signal for EURUSD today
2. Or: Signal exists for XAUUSD only

**Action:**
1. Place BUY EURUSD @ 1.0950 di MT5

**Expected Result:**
- ✅ Trade created with `signal_id = None` (rogue marker)
- ✅ ComplianceResult:
  - `status = 'Unauthorized Trade'`
  - `score = 0`
  - `violations = ['unauthorized_trade']`
  - `coaching_note = 'Trader membuka posisi EURUSD BUY @ 1.0950 tanpa ada signal yang match...'`
- ✅ Notification:
  - Level: `danger`
  - Title: `⚠️ Entry Tanpa Signal — EURUSD`
  - Body: "Kamu membuka posisi EURUSD BUY @ 1.0950 tanpa mengikuti signal apapun..."
- ✅ SOPWarning created with `violation_type='unauthorized_trade'`
- ✅ user.complianceScore recalculated (will decrease)

---

### Test 4: Multiple Rogue Trades

**Setup:**
1. No signals today

**Action:**
1. Place BUY XAUUSD @ 2650
2. Place BUY EURUSD @ 1.0950
3. Place SELL GBPJPY @ 198.50

**Expected Result:**
- ✅ 3 Trade records created (all with `signal=None`)
- ✅ 3 ComplianceResults created (all unauthorized_trade)
- ✅ 3 Notifications sent to trader
- ✅ 3 SOPWarnings created
- ✅ user.complianceScore drops significantly (0% if only rogue trades today)

---

## 📊 Database Schema Impact

### Trade Model
- New records with `signal=None` indicate rogue trades
- `status='open'` or `'closed'` depending on position state

### ComplianceResult Model
- `signal` can be `NULL` for rogue trades
- `status='Unauthorized Trade'` for rogue trades
- `violations=['unauthorized_trade']`

### SOPWarning Model
- `violation_type='unauthorized_trade'`
- `severity='warning'` or `'danger'` (based on recent violation count)

---

## 🚀 Deployment

### Step 1: Commit Changes

```bash
git add backend/mt5/signal_matcher.py
git add backend/compliance/violations.py
git add FEAT-ROGUE-TRADE-DETECTION.md
git commit -m "feat: Detect rogue trades (entry without signal) as compliance violation

- Added _detect_rogue_trades() function to signal_matcher.py
- Detect positions that don't match any active signal
- Create ComplianceResult with unauthorized_trade violation (score=0)
- Send danger notification to trader immediately
- Create SOPWarning and update user compliance scores
- Prevents traders from entering trades outside of TradingView signals"

git push origin main
```

### Step 2: Deploy to Production

```bash
# SSH ke server
ssh user@mikapedia.online
cd ~/mikapedia

# Pull latest
git pull origin main

# Rebuild backend (only backend changed)
docker compose -f docker-compose.prod.yml up -d --build backend

# Or if using docker-compose V1:
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### Step 3: Monitor Logs

```bash
# Watch for rogue trade detections
docker compose -f docker-compose.prod.yml logs -f backend | grep -i "rogue\|unauthorized"

# Should see logs like:
# WARNING: Rogue trade detected: user=trader@example.com symbol=EURUSD direction=BUY entry=1.0950 ticket=123456
# WARNING: Detected 1 rogue trade(s) for user trader@example.com
```

---

## ✅ Verification

### Check 1: Run Diagnostic Script

```bash
docker compose -f docker-compose.prod.yml exec backend python diagnose_compliance.py
```

**Expected output:**
```
✅ Signals found
✅ MT5 accounts with positions found
✅ Trades found in database
✅ Compliance results found
✅ Violations detected
✅ Notifications sent
```

### Check 2: Test Rogue Trade

1. **Ensure no signals today**, or create a signal for a different pair
2. **Open position** in MT5 (pair yang tidak ada signalnya)
3. **Wait 1-2 seconds** for EA push
4. **Check notification** di website (bell icon)

**Expected:**
- ⚠️ Red notification: "Entry Tanpa Signal — {SYMBOL}"
- Click to see details

### Check 3: Verify Database

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from compliance.models import ComplianceResult
from mt5.models import Trade

# Check rogue trades
rogue_trades = Trade.objects.filter(signal__isnull=True, status='open')
print(f"Rogue trades: {rogue_trades.count()}")

for t in rogue_trades:
    print(f"  - {t.symbol} {t.direction} @ {t.entry_price} (ticket: {t.ticket})")

# Check unauthorized compliance results
unauthorized = ComplianceResult.objects.filter(violations__contains=['unauthorized_trade'])
print(f"\nUnauthorized trade violations: {unauthorized.count()}")

for r in unauthorized:
    print(f"  - User: {r.user.email}, Score: {r.score}, Status: {r.status}")
```

### Check 4: Verify Notification

```python
from notifications.models import Notification

# Check notifications
notifs = Notification.objects.filter(
    type='compliance',
    level='danger',
    title__icontains='Entry Tanpa Signal'
).order_by('-created_at')[:5]

print(f"Rogue trade notifications: {notifs.count()}")
for n in notifs:
    print(f"  - To: {n.recipient.email}")
    print(f"    Title: {n.title}")
    print(f"    Read: {n.read}")
```

---

## 🔍 Edge Cases Handled

### Edge Case 1: Trade Created Before Signal

**Scenario:**
- User opens position at 09:58
- Signal created via TradingView webhook at 10:00

**Handling:**
- At 09:58: Position detected as rogue (no signal yet)
- At 10:00: Signal matcher runs again
- Position matched to new signal
- Rogue ComplianceResult deleted/updated
- New ComplianceResult created (evaluated normally)

**Status:** Not yet implemented. Consider for future enhancement.

---

### Edge Case 2: Position Matched Later

**Scenario:**
- Position opened at 10:01, marked as rogue
- Signal created at 10:02 (late signal from TradingView)

**Handling:**
- Currently: Remains marked as rogue
- Future: Could re-evaluate when signal appears

**Status:** Current implementation marks as rogue permanently. Admin can manually dismiss warning if needed.

---

### Edge Case 3: All Positions Cancelled/Closed

**Scenario:**
- User opens 3 rogue positions
- User closes all within 5 minutes

**Handling:**
- Rogue detection triggers when positions are open
- ComplianceResult, Notification, and SOPWarning already created
- Closing positions doesn't remove violation (intentional)
- Violation remains in history for compliance scoring

---

## 📚 Related Files

### Modified:
- ✅ `backend/mt5/signal_matcher.py` - Added `_detect_rogue_trades()`
- ✅ `backend/compliance/violations.py` - Updated documentation

### Referenced:
- `backend/compliance/services.py` - ComplianceService
- `backend/compliance/models.py` - ComplianceResult, SOPWarning
- `backend/notifications/models.py` - Notification
- `backend/mt5/models.py` - Trade, MT5Position, MT5Account
- `backend/signals/models.py` - Signal

### Documentation:
- ✅ `FEAT-ROGUE-TRADE-DETECTION.md` - This file
- ✅ `COMPLIANCE-ENGINE-CHECK.md` - Diagnostic guide
- ✅ `backend/diagnose_compliance.py` - Diagnostic script

---

## 🎯 Success Criteria

After deployment, verify:

- [ ] User entry sesuai signal → Evaluated normally (compliant or other violations)
- [ ] User entry diluar signal → Detected as rogue trade
- [ ] Notification sent immediately (< 2 seconds after EA push)
- [ ] ComplianceResult created with score=0
- [ ] SOPWarning created
- [ ] user.complianceScore updated
- [ ] Admin can see rogue trades in compliance report
- [ ] Trader can see notification in bell icon
- [ ] Diagnostic script shows rogue trades detected

---

## 🔒 Security & Compliance

### Why This Matters:

1. **SOP Enforcement:** Traders MUST follow signals from TradingView
2. **Risk Management:** Unauthorized trades = unmanaged risk
3. **Accountability:** Every trade tracked and evaluated
4. **Coaching:** Immediate feedback helps traders learn
5. **Admin Visibility:** Admins can monitor rogue trade patterns
6. **Escalation:** Repeated violations → warnings → suspension

### Compliance Metrics:

- **complianceScore:** Rolling 30-day average (0-100)
- **executionRate:** % of signals executed
- **timingAccuracy:** % on-time entries
- **entryAccuracy:** % correct direction
- **lateEntries:** Count of late entries
- **rogueTrades:** Count of unauthorized entries (new metric)

---

## 📈 Future Enhancements

### Enhancement 1: Rogue Trade Analytics

Add dashboard widget showing:
- Total rogue trades per trader
- Rogue trade rate (rogue / total trades)
- Most common rogue pairs
- Time of day patterns

### Enhancement 2: Auto-Suspend After X Rogue Trades

Configuration in SystemSettings:
- `max_rogue_trades_per_week = 3`
- Auto-suspend trader account
- Require admin approval to reactivate

### Enhancement 3: Whitelist Pairs

Allow certain pairs to be traded without signals:
- Hedging positions
- Practice accounts
- Admin-approved exceptions

---

**Status: READY FOR DEPLOYMENT** ✅

**Impact:** High (prevents unauthorized trading)
**Risk:** Low (only adds detection, doesn't block trades)
**Rollback:** Easy (remove `_detect_rogue_trades()` call)
