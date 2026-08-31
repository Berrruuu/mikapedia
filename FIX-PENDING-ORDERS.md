# ✅ FIX: Pending Orders (Limit/Stop Orders) Tidak Muncul di Website

## 🎯 Masalah

User menaruh **limit order** di MT5, tapi pending order tidak muncul di website pada tab "Pending Orders".

## 🔍 Root Cause

EA (`MikapediaReporter.mq5`) sudah benar mengirim `pending_orders` data ke backend via endpoint `/api/v1/mt5/ea-report/`.

**Tapi backend ada bug:**
1. Backend menyimpan pending orders ke model `Trade` (untuk compliance tracking)
2. Backend **TIDAK** menyimpan pending orders ke model `MT5Order`
3. Frontend serializer (`MT5AccountSerializer`) mengambil data dari `account.orders` → model `MT5Order`
4. Karena `MT5Order` kosong → frontend tidak menampilkan pending orders

## 🔧 Solusi

File: `backend/mt5/views.py` - endpoint `ea_report()`

### Change 1: Save Pending Orders to MT5Order Model

**Before:**
```python
# Hanya save ke Trade model
Trade.objects.update_or_create(
    account=account,
    ticket=ticket,
    defaults={...}
)
```

**After:**
```python
# Save ke Trade model (untuk compliance)
Trade.objects.update_or_create(
    account=account,
    ticket=ticket,
    defaults={...}
)

# ALSO save ke MT5Order model (untuk frontend display)
from mt5.models import MT5Order
MT5Order.objects.update_or_create(
    account=account,
    ticket=ticket,
    defaults={
        'symbol': order.get('symbol', ''),
        'type': raw_type,  # "BUY LIMIT", "SELL LIMIT", etc.
        'volume': order.get('volume', 0),
        'price_open': order.get('price_open', 0),
        'sl': order.get('sl'),
        'tp': order.get('tp'),
        'comment': order.get('comment', ''),
        'magic': order.get('magic', 0),
        'time_setup': time_setup,
    }
)
```

### Change 2: Delete Cancelled/Executed Orders from MT5Order

**Before:**
```python
# Hanya update Trade model (mark as cancelled)
Trade.objects.filter(
    account=account,
    status='pending',
).exclude(ticket__in=pending_tickets_seen).update(
    status='cancelled',
    cancelled_at=tz.now(),
)
```

**After:**
```python
# Update Trade model (mark as cancelled)
Trade.objects.filter(
    account=account,
    status='pending',
).exclude(ticket__in=pending_tickets_seen).update(
    status='cancelled',
    cancelled_at=tz.now(),
)

# ALSO delete from MT5Order model (no longer pending)
from mt5.models import MT5Order
MT5Order.objects.filter(
    account=account,
).exclude(ticket__in=pending_tickets_seen).delete()
```

### Change 3: Update pending_orders Count

**Before:**
```python
account.open_positions = len(request.data.get('positions', []))
account.save(update_fields=['balance', 'equity', 'floating_pnl', 'status', 'last_sync', 'open_positions'])
```

**After:**
```python
account.open_positions = len(request.data.get('positions', []))
account.pending_orders = len(request.data.get('pending_orders', []))
account.save(update_fields=['balance', 'equity', 'floating_pnl', 'status', 'last_sync', 'open_positions', 'pending_orders'])
```

## ✅ Hasil Setelah Fix

### Flow Data Pending Orders:

```
1. User taruh LIMIT ORDER di MT5
   ↓
2. EA detect order via OrdersTotal() / OrderGetTicket()
   ↓
3. EA kirim ke backend:
   POST /api/v1/mt5/ea-report/
   Body: {
     ...
     "pending_orders": [
       {
         "ticket": 123456789,
         "symbol": "XAUUSD",
         "type": "BUY LIMIT",
         "volume": 0.10,
         "price_open": 2650.00,
         "sl": 2645.00,
         "tp": 2660.00,
         "time_setup": "2026-09-01T10:30:00"
       }
     ]
   }
   ↓
4. Backend save to:
   - MT5Order model (untuk frontend display)
   - Trade model (untuk compliance tracking)
   ↓
5. Backend update account.pending_orders count
   ↓
6. Backend broadcast via WebSocket
   ↓
7. Frontend receive update
   ↓
8. Website tampilkan di tab "Pending Orders" ✅
```

### User akan melihat:

**Tab "Pending Orders":**
```
┌────────────────────────────────────────────────────────────┐
│ Ticket      Symbol   Type        Lot   Price    SL    TP   │
├────────────────────────────────────────────────────────────┤
│ 123456789   XAUUSD   BUY LIMIT   0.10  2650.00  2645  2660 │
│ 123456790   EURUSD   SELL LIMIT  0.05  1.0950   1.10  1.09 │
└────────────────────────────────────────────────────────────┘
```

### Saat order executed/cancelled:

1. Order executed → menjadi position → muncul di tab "Open Positions"
2. Order cancelled → hilang dari tab "Pending Orders"
3. Backend auto-detect (EA tidak kirim ticket lagi) → delete dari MT5Order

## 🚀 Deployment

```bash
# 1. Commit
git add backend/mt5/views.py
git add FIX-PENDING-ORDERS.md
git commit -m "fix: Pending orders (limit/stop) not showing in frontend

- EA endpoint now saves pending orders to MT5Order model (not just Trade)
- Frontend serializer displays from account.orders (MT5Order model)
- Auto-delete cancelled/executed orders from MT5Order
- Update account.pending_orders count
- Fixes issue where limit orders placed in MT5 don't appear in website"

git push origin main

# 2. Deploy
ssh user@mikapedia.online
cd /path/to/mika-ops-hub-main
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build backend

# 3. Verify
# - Buka MT5 → Place limit order (XAUUSD, BUY LIMIT @ 2650)
# - Buka website → Tab "Pending Orders" → harus muncul!
```

## 🧪 Testing

### Test 1: Place Limit Order

1. Buka MT5
2. Click "New Order"
3. Type: "Pending Order"
4. Order Type: "Buy Limit"
5. Symbol: XAUUSD
6. Volume: 0.10
7. Price: 2650.00
8. SL: 2645.00
9. TP: 2660.00
10. Click "Place"

**Expected:**
- MT5: Order muncul di tab "Trade" dengan status "buy limit @ 2650.00"
- Website: Order muncul di tab "Pending Orders" dalam 1-2 detik ✅

### Test 2: Cancel Limit Order

1. Di MT5, klik kanan order → "Delete Order"
2. Confirm

**Expected:**
- MT5: Order hilang dari tab "Trade"
- Website: Order hilang dari tab "Pending Orders" dalam 1-2 detik ✅

### Test 3: Limit Order Executed

1. Place buy limit @ price yang akan kena
2. Tunggu price hit limit
3. Order executed → jadi position

**Expected:**
- MT5: Order hilang dari "Trade", muncul position baru
- Website: Order hilang dari "Pending Orders", muncul di "Open Positions" ✅

## 📋 Checklist Verification

Setelah deploy:

- [ ] Backend container rebuilt successfully
- [ ] Place limit order di MT5
- [ ] Order muncul di website tab "Pending Orders" dalam 1-2 detik
- [ ] Order info sesuai (symbol, type, volume, price, SL, TP)
- [ ] Cancel order di MT5 → hilang dari website
- [ ] Order executed → hilang dari pending, muncul di positions
- [ ] Counter "Pending Orders (X)" update sesuai jumlah order

## 🔍 Troubleshooting

### Issue: Order masih tidak muncul

**Diagnosis:**

```bash
# Check EA logs di MT5 Experts tab
# Harus ada: "✓ Data sent: X positions, Y pending, Z deals"
# Y harus > 0 jika ada limit order

# Check backend logs
docker compose -f docker-compose.prod.yml logs backend | grep "pending_orders"

# Should see: "pending_orders": [...]

# Check database
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from mt5.models import MT5Account, MT5Order

acc = MT5Account.objects.first()
print(f"Pending orders count: {acc.pending_orders}")

orders = MT5Order.objects.filter(account=acc)
print(f"MT5Order count: {orders.count()}")

for o in orders:
    print(f"Order {o.ticket}: {o.symbol} {o.type} @ {o.price_open}")
```

**Expected:**
- `acc.pending_orders` > 0
- `MT5Order.objects.count()` > 0
- Order details match MT5 terminal

**If not:**
- Check EA is attached and sending data
- Check backend received pending_orders in payload
- Check no errors in backend logs

## 📚 Related Files

- ✅ `backend/mt5/views.py` - EA endpoint (fixed)
- ✅ `backend/mt5/models.py` - MT5Order model (no changes)
- ✅ `backend/mt5/serializers.py` - MT5OrderSerializer (no changes)
- ✅ `src/routes/trader.mt5.tsx` - Frontend display (no changes)
- ✅ `backend/scripts/MikapediaReporter.mq5` - EA (already correct, no changes)

## ✅ Summary

**Problem:** Limit/stop orders di MT5 tidak muncul di website tab "Pending Orders"

**Root Cause:** Backend hanya save ke `Trade` model, tidak ke `MT5Order` model (yang digunakan frontend)

**Solution:** 
- EA endpoint save pending orders to both `Trade` and `MT5Order` models
- Delete cancelled/executed orders from `MT5Order`
- Update `account.pending_orders` count

**Result:** Limit orders yang ditaruh di MT5 langsung muncul di website dalam 1-2 detik! ✅

---

**Status: READY FOR DEPLOYMENT** ✅
