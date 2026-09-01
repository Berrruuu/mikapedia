# 🔍 Compliance Engine Diagnostic Guide

## 🎯 Problem

User entry **di luar signal** (bukan following signal dari TradingView) tapi **tidak ada peringatan** compliance.

Expected behavior:
- User buka posisi tanpa signal → Violation: "Tidak ada signal yang match"
- User buka posisi dengan signal tapi wrong direction → Violation: "Arah salah"
- User buka posisi dengan signal tapi late → Violation: "Entry terlambat"
- **Notification dikirim ke trader** → tab Notifications
- **SOPWarning created** jika violation parah

## 🔬 Diagnostic Steps

### Step 1: Run Diagnostic Script

```bash
# SSH ke server
ssh user@mikapedia.online
cd ~/mikapedia

# Run script
docker compose -f docker-compose.prod.yml exec backend python diagnose_compliance.py

# Atau jika pakai docker-compose V1:
docker-compose -f docker-compose.prod.yml exec backend python diagnose_compliance.py
```

Script akan check:
1. ✅ Active signals today?
2. ✅ MT5 accounts & positions?
3. ✅ Trade records created?
4. ✅ Compliance results evaluated?
5. ✅ SOP warnings issued?
6. ✅ Notifications sent?

---

### Step 2: Understand the Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User buka posisi di MT5                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. EA detect position → Send to backend                          │
│    POST /api/v1/mt5/ea-report/                                   │
│    Body: { positions: [...], pending_orders: [...] }             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend create MT5Position record                             │
│    - account.positions.add(position)                             │
│    - account.open_positions += 1                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend call match_account_to_signals(account)                │
│    File: backend/mt5/views.py line 355                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Signal Matcher run                                            │
│    File: backend/mt5/signal_matcher.py                           │
│    Logic:                                                        │
│    - Get active signals today                                    │
│    - For each position:                                          │
│      - Match symbol (e.g., XAUUSD)                               │
│      - Match direction (BUY/SELL)                                │
│      - Check entry price in fib zone                             │
│      - Check time < max_entry_time                               │
│    - If match → Create Trade record + link to signal             │
│    - If no match → ???                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Compliance Evaluation                                         │
│    File: backend/compliance/services.py                          │
│    Method: sync_trade_to_compliance(trade)                       │
│    - Collect all trades for this signal (should be 3)            │
│    - Call evaluate_three_positions(trades, signal)               │
│    - Detect violations (incomplete, wrong direction, no SL, etc) │
│    - Calculate score (100 - deductions)                          │
│    - Create/update ComplianceResult                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. Post-Evaluation Actions                                       │
│    File: backend/compliance/services.py                          │
│    Method: _post_evaluate(result, report)                        │
│    - Recalculate user.complianceScore (30-day avg)               │
│    - Issue SOPWarning if violations severe                       │
│    - Send Notification to trader                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. Frontend display notification                                 │
│    User sees: "⚠️ Pelanggaran SOP — Signal #X"                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔎 Common Issues

### Issue 1: Tidak ada signal hari ini

**Symptom:**
- Diagnostic script shows: "No signals today"
- Entry di MT5 tidak di-match ke signal apapun
- Tidak ada compliance evaluation

**Root Cause:**
- Signal matcher hanya match posisi ke signal yang `session_date = TODAY`
- Jika tidak ada signal, matcher skip evaluation

**Solution:**
```bash
# Create test signal via Django admin or shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from signals.models import Signal
from django.utils import timezone

Signal.objects.create(
    session_date=timezone.localdate(),
    pair='XAUUSD',
    direction='BUY',
    time=timezone.localtime().time(),
    max_entry_time=(timezone.localtime() + timezone.timedelta(minutes=5)).time(),
    fib_0236=2650.00,
    fib_0500=2655.00,
    fib_0618=2660.00,
    stop_loss=2645.00,
    take_profit=2670.00,
    status='Pending',
)
```

---

### Issue 2: Position tidak di-match ke signal

**Symptom:**
- Diagnostic shows signals exist
- Diagnostic shows positions exist
- But no Trade records created with signal FK
- No compliance results

**Root Cause:**
- Symbol mismatch (e.g., position: "OANDA:XAUUSD", signal: "XAUUSD")
- Direction mismatch (position: SELL, signal: BUY → no match, not evaluated)
- Entry price out of zone
- Signal expired (current time > max_entry_time)

**Debug:**
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from mt5.signal_matcher import match_account_to_signals
from mt5.models import MT5Account

acc = MT5Account.objects.first()

# Manually trigger matcher with debug
import logging
logging.basicConfig(level=logging.DEBUG)

matched = match_account_to_signals(acc)
print(f"Matched: {matched}")

# Check what trades were created
from mt5.models import Trade
trades = Trade.objects.filter(account=acc)
for t in trades:
    print(f"Trade #{t.ticket}: {t.symbol} {t.direction} @ {t.entry_price}, Signal: #{t.signal_id}")
```

---

### Issue 3: Trade created but no compliance result

**Symptom:**
- Trade record exists with signal FK
- But no ComplianceResult created
- No violations detected

**Root Cause:**
- Compliance service not called
- Exception in evaluate_three_positions()
- Exception in ComplianceService

**Debug:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i "compliance\|violation"
```

Look for errors like:
- `ComplianceService failed for signal #X`
- `Failed to evaluate trade #X`

**Manual trigger:**
```python
from compliance.services import ComplianceService
from mt5.models import Trade

trade = Trade.objects.filter(signal__isnull=False).first()
if trade:
    svc = ComplianceService()
    result = svc.sync_trade_to_compliance(trade)
    print(f"Result: {result.status}, Score: {result.score}, Violations: {result.violations}")
```

---

### Issue 4: Compliance evaluated but no notification

**Symptom:**
- ComplianceResult created with violations
- But no Notification sent to trader
- User tidak melihat peringatan

**Root Cause:**
- Exception in `_notify_trader()` method
- Notification model import error
- recipient user not set correctly

**Debug:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep "notify_trader\|Notification"
```

**Manual test:**
```python
from compliance.models import ComplianceResult
from notifications.models import Notification

result = ComplianceResult.objects.filter(score__lt=100).first()
if result:
    # Check if notification exists
    notif = Notification.objects.filter(
        recipient=result.user,
        type='compliance',
    ).first()
    
    if notif:
        print(f"✅ Notification exists: {notif.title}")
    else:
        print("❌ No notification found")
        
        # Manually create
        Notification.objects.create(
            recipient=result.user,
            type='compliance',
            level='warning',
            title=f'⚠️ Pelanggaran SOP — Signal #{result.signal_id}',
            body=f'Violations: {result.violations}. Score: {result.score}/100',
        )
```

---

### Issue 5: Entry di luar signal → Apa yang seharusnya terjadi?

**Scenario:** User buka posisi XAUUSD BUY tapi tidak ada signal XAUUSD BUY hari ini.

**Expected Flow:**

1. **EA push data** → backend create MT5Position
2. **Signal matcher run:**
   - Loop active signals today
   - Try to match position to each signal
   - If symbol doesn't match → skip
   - If direction doesn't match → skip
   - If no signal match → **position NOT converted to Trade record with signal**
3. **Result:** Position exists in `MT5Position`, tapi **tidak ada Trade record** dengan signal FK
4. **Compliance:** **TIDAK DIEVALUASI** karena tidak ada Trade dengan signal

**🚨 PROBLEM IDENTIFIED:**

Compliance engine **hanya evaluate posisi yang match dengan signal**. 

Jika user entry **di luar signal** (tidak ada signal yang match), posisi tersebut **tidak dievaluasi sebagai violation**.

---

## 🔧 Solution: Detect "Rogue Trades"

Kita perlu menambahkan logic untuk detect **posisi yang tidak match dengan signal apapun** dan create violation.

### Approach 1: Mark "rogue" positions as violation

File: `backend/mt5/signal_matcher.py`

After matching loop, check if there are positions that weren't matched:

```python
def match_account_to_signals(account) -> int:
    # ... existing matching logic ...
    
    # NEW: Detect rogue trades (positions without matching signal)
    _detect_rogue_trades(account, today)
    
    return matched


def _detect_rogue_trades(account, today):
    """
    Detect positions opened without following any active signal.
    Create ComplianceResult with violation: "unauthorized_trade"
    """
    from compliance.models import ComplianceResult
    from compliance.services import ComplianceService
    
    # Get all positions from today
    positions = account.positions.all()
    
    # Get all trades that ARE linked to signals
    matched_tickets = set(Trade.objects.filter(
        account=account,
        signal__session_date=today,
        signal__isnull=False,
    ).values_list('ticket', flat=True))
    
    # Find rogue positions (not linked to any signal)
    rogue_positions = [p for p in positions if p.ticket not in matched_tickets]
    
    if not rogue_positions:
        return  # all good
    
    # Create violation for each rogue position
    for pos in rogue_positions:
        # Create Trade record without signal
        trade, _ = Trade.objects.update_or_create(
            account=account,
            ticket=pos.ticket,
            defaults={
                'user': account.user,
                'signal': None,  # no signal = rogue
                'symbol': pos.symbol,
                'direction': pos.type,
                'volume': pos.volume,
                'entry_price': pos.price_open,
                'stop_loss': pos.sl,
                'take_profit': pos.tp,
                'open_time': pos.time_open,
                'status': 'open',
                'pnl': pos.profit,
            }
        )
        
        # Create ComplianceResult with "unauthorized_trade" violation
        ComplianceResult.objects.update_or_create(
            user=account.user,
            signal=None,  # no signal
            trade=trade,
            defaults={
                'trader_profile': getattr(account.user, 'trader_profile', None),
                'status': 'Unauthorized Trade',
                'score': 0,
                'actual_direction': pos.type,
                'actual_entry': float(pos.price_open),
                'actual_entry_time': ComplianceService()._coerce_time(pos.time_open),
                'coaching_note': f'Trader membuka posisi {pos.symbol} {pos.type} tanpa ada signal yang match. '
                                 f'Entry diluar SOP.',
                'violations': ['unauthorized_trade'],
                'entry_count': 0,
            }
        )
        
        # Send notification
        from notifications.models import Notification
        Notification.objects.create(
            recipient=account.user,
            type='compliance',
            level='danger',
            title=f'⚠️ Entry Tanpa Signal — {pos.symbol}',
            body=f'Kamu membuka posisi {pos.symbol} {pos.type} @ {pos.price_open} tanpa mengikuti signal apapun. '
                 f'Ini melanggar SOP. Pastikan hanya entry sesuai signal dari TradingView.',
        )
        
        logger.warning('Rogue trade detected: user=%s symbol=%s ticket=%s',
                       account.user.email, pos.symbol, pos.ticket)
```

---

### Approach 2: Add to violations.py

Add new violation type:

File: `backend/compliance/violations.py`

```python
# At the top, add new violation code
VIOLATION_UNAUTHORIZED_TRADE = Violation(
    code='unauthorized_trade',
    label='Entry Tanpa Signal',
    deduction=100,
    note='Trader membuka posisi tanpa ada signal yang match. Entry diluar SOP.',
)
```

---

## 📋 Testing Plan

### Test 1: Entry sesuai signal (should be compliant)

1. Create signal: XAUUSD BUY, Fib 0.236 @ 2650
2. Place limit order BUY @ 2650 di MT5
3. Wait for EA push
4. **Expected:**
   - Trade created with signal FK
   - ComplianceResult: status='Compliant', score=100
   - Notification: "✅ Eksekusi Signal #X Sesuai SOP"

### Test 2: Entry wrong direction (should be violation)

1. Signal exists: XAUUSD BUY
2. Place SELL order di MT5
3. **Expected:**
   - Trade created with signal FK
   - ComplianceResult: violations=['wrong_direction'], score=40
   - Notification: "⚠️ Pelanggaran SOP — Arah Salah"

### Test 3: Entry tanpa signal (rogue trade)

1. No signal for EURUSD today
2. Place BUY EURUSD di MT5
3. **Expected:**
   - Trade created WITHOUT signal FK
   - ComplianceResult: violations=['unauthorized_trade'], score=0
   - Notification: "⚠️ Entry Tanpa Signal — EURUSD"

---

## 🚀 Implementation Steps

### Step 1: Add rogue trade detection

```bash
# Edit signal_matcher.py
vim backend/mt5/signal_matcher.py

# Add _detect_rogue_trades() function
# Call it at end of match_account_to_signals()
```

### Step 2: Test locally

```bash
python manage.py shell
```

```python
from mt5.signal_matcher import match_account_to_signals
from mt5.models import MT5Account

acc = MT5Account.objects.first()
match_account_to_signals(acc)

# Check results
from compliance.models import ComplianceResult
results = ComplianceResult.objects.filter(user=acc.user)
for r in results:
    print(f"{r.status}: {r.violations} (score: {r.score})")
```

### Step 3: Deploy

```bash
git add .
git commit -m "feat: Detect rogue trades (entry without signal) as compliance violation"
git push origin main

# Deploy
ssh user@mikapedia.online
cd ~/mikapedia
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build backend
```

### Step 4: Verify

```bash
# Run diagnostic again
docker compose -f docker-compose.prod.yml exec backend python diagnose_compliance.py

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend | grep "rogue\|unauthorized"
```

---

## ✅ Expected Outcome

After implementation:

1. **User entry sesuai signal** → Evaluated, compliant or violations detected
2. **User entry diluar signal** → Detected as "unauthorized_trade", violation issued
3. **Notification sent** to trader immediately
4. **SOPWarning created** if repeated violations
5. **User.complianceScore** updated (rolling 30-day average)

---

## 📚 Related Files

- ✅ `backend/mt5/signal_matcher.py` - Match positions to signals
- ✅ `backend/compliance/services.py` - Compliance evaluation
- ✅ `backend/compliance/violations.py` - Violation detection logic
- ✅ `backend/compliance/models.py` - ComplianceResult, SOPWarning
- ✅ `backend/notifications/models.py` - Notification
- ✅ `backend/diagnose_compliance.py` - Diagnostic script

---

**Status: NEEDS IMPLEMENTATION** 

Rogue trade detection belum diimplementasi. User entry diluar signal saat ini **tidak dievaluasi**.
