# MT5 Account Not Showing - Troubleshooting Guide

## Problem
After logging in and saving MT5 credentials on https://mikapedia.online/trader/mt5, the account information doesn't appear.

## Root Cause Analysis

### How MT5 Integration Works
1. **Linux/Hostinger Setup**: MetaTrader5 Python package is Windows-only, so backend uses **simulation mode** (`MT5_USE_SIMULATION=True`)
2. **Real Data Source**: Actual MT5 data comes from **EA (Expert Advisor)** running on Windows MT5 terminal
3. **EA Endpoint**: EA calls `/api/mt5/ea-report/` to push live position/balance data to backend
4. **Simulation Fallback**: Until EA is running, backend shows simulated data for testing

### What Happens When You Save Credentials

```mermaid
User enters credentials → POST /api/mt5/credentials/
  → Backend creates MT5Account
  → Backend calls sync_account()
    → On Windows: Connects to real MT5
    → On Linux: Returns simulated data
  → Returns MT5Account to frontend
  → Frontend displays account info
```

## Diagnostic Steps

### Step 1: Check Backend Logs
```bash
# SSH to VPS
ssh root@your-vps-ip

# Check if MT5 simulation is enabled
cd ~/mikapedia
docker compose -f docker-compose.prod.yml logs backend | grep "MT5_USE_SIMULATION"
# Should show: MT5_USE_SIMULATION=True — using simulated data

# Check MT5 endpoint logs
docker compose -f docker-compose.prod.yml logs backend | grep "mt5"
```

**Expected Output:**
```
backend  | INFO MT5_USE_SIMULATION=True — using simulated data
backend  | INFO MetaTrader5 not available — using simulated data
```

### Step 2: Test Backend API Directly

```bash
# Get auth token first
TOKEN=$(curl -s -X POST https://mikapedia.online/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"trader@test.com","password":"yourpassword"}' \
  | grep -o '"access":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# Test MT5 me endpoint
curl -s https://mikapedia.online/api/v1/mt5/me/ \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# If 404, no account exists yet
# If 200, shows account data
```

### Step 3: Save Credentials via API

```bash
# Save MT5 credentials (replace with real values)
curl -X POST https://mikapedia.online/api/v1/mt5/credentials/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "login": 7724091,
    "password": "your-mt5-password",
    "server": "ICMarkets-Live01",
    "broker": "ICMarkets"
  }' | jq .

# Should return full account object with balance, equity, etc
```

**Expected Response (Simulated Data):**
```json
{
  "id": 1,
  "login": 7724091,
  "accountNumber": "7724091",
  "server": "ICMarkets-Live01",
  "broker": "ICMarkets",
  "status": "connected",
  "isDemo": true,
  "balance": 10532.41,
  "equity": 10567.23,
  "floatingPnl": 34.82,
  "marginLevel": 1523.45,
  "drawdown": 0.34,
  "openPositions": 2,
  "pendingOrders": 0,
  "positions": [...]
}
```

### Step 4: Check Frontend Console

Open browser DevTools (F12) → Console tab:

```javascript
// Check API base URL
console.log('API_BASE:', window.location.protocol + '//' + window.location.hostname + '/api');

// Should show: https://mikapedia.online/api

// Check if WebSocket is connected
// Look for: WebSocket connection established
```

### Step 5: Check Database

```bash
# SSH to VPS
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms

# Check if MT5Account exists
SELECT id, login, account_number, status, balance, equity FROM mt5_accounts;

# Check user-account relationship
SELECT u.email, m.login, m.status FROM users_user u 
  LEFT JOIN mt5_accounts m ON u.id = m.user_id;

# Exit
\q
```

## Common Issues & Fixes

### Issue 1: 404 - No MT5 Account Found
**Symptom**: API returns `{"detail": "No MT5 account configured."}`

**Fix:**
```bash
# Check if account was created
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT * FROM mt5_accounts;"

# If empty, credentials save failed
# Check backend logs for errors
docker compose -f docker-compose.prod.yml logs backend --tail=100 | grep -i "error\|exception"
```

### Issue 2: Status = "error"
**Symptom**: Account exists but `status = 'error'`

**Check error message:**
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT login, status, error_message FROM mt5_accounts;"
```

**Common Errors:**
- `"NameError: name 'time' is not defined"` → **FIXED** in previous update
- `"MT5 connection failed"` → Simulation should work, check logs

### Issue 3: Frontend Not Refreshing
**Symptom**: Backend returns data but frontend shows "No account"

**Fix:** Clear browser cache and hard reload
```bash
# Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
# Or use Incognito mode
```

**Also check:** Network tab in DevTools
- Does `/api/v1/mt5/me/` return 200?
- Does response contain account data?

### Issue 4: WebSocket Not Updating
**Symptom**: Page loads but doesn't update live

**Check WebSocket:**
1. Open DevTools → Network tab
2. Filter: WS
3. Should see: `wss://mikapedia.online/ws/`
4. Status should be: 101 Switching Protocols

**Fix:** Restart backend
```bash
docker compose -f docker-compose.prod.yml restart backend
```

## Quick Fix Script

Create this file: `test-mt5-connection.sh`

```bash
#!/bin/bash

echo "=== MT5 Connection Test ==="
echo ""

# Get token
echo "Step 1: Login..."
TOKEN=$(curl -s -X POST https://mikapedia.online/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"'$1'","password":"'$2'"}' \
  | grep -o '"access":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi
echo "✓ Login successful"

# Check existing account
echo ""
echo "Step 2: Check existing MT5 account..."
RESPONSE=$(curl -s https://mikapedia.online/api/v1/mt5/me/ \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESPONSE" | grep -q '"id"'; then
  echo "✓ MT5 account found!"
  echo "$RESPONSE" | jq .
else
  echo "⚠ No MT5 account found (404 expected before first save)"
fi

# Save credentials (if provided)
if [ ! -z "$3" ]; then
  echo ""
  echo "Step 3: Save MT5 credentials..."
  curl -X POST https://mikapedia.online/api/v1/mt5/credentials/ \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "login": '$3',
      "password": "'$4'",
      "server": "'$5'",
      "broker": "'$6'"
    }' | jq .
fi

echo ""
echo "=== Test Complete ==="
```

**Usage:**
```bash
# Test existing account
./test-mt5-connection.sh "trader@test.com" "password"

# Save new credentials
./test-mt5-connection.sh "trader@test.com" "password" 7724091 "mt5pass" "ICMarkets-Live01" "ICMarkets"
```

## Expected Behavior

### ✓ Working Simulation Mode
1. User saves credentials → Backend creates MT5Account
2. Backend calls `sync_account()` → Uses `_simulate_full_snapshot()`
3. Returns simulated data: balance ~$10,000, 0-3 open positions
4. Frontend displays account with status "connected"
5. Every 1 second, frontend calls `/api/mt5/{id}/sync/` to refresh

### ✓ Working EA Mode (Future)
1. Windows PC runs MT5 terminal with EA installed
2. EA calls `/api/mt5/ea-report/` every tick/bar
3. Backend updates MT5Account with real data
4. WebSocket broadcasts update to all connected clients
5. Frontend receives live updates without polling

## Next Steps

1. **Test simulation mode** using the diagnostic steps above
2. **Verify frontend refresh** - check if account appears after save
3. **Check browser console** - any JavaScript errors?
4. **Review backend logs** - any Python exceptions?
5. **Install EA on Windows MT5** - for real data (future step)

## Contact Points

- **Backend API**: `https://mikapedia.online/api/v1/mt5/`
- **Frontend page**: `https://mikapedia.online/trader/mt5`
- **WebSocket**: `wss://mikapedia.online/ws/`
- **EA endpoint**: `https://mikapedia.online/api/v1/mt5/ea-report/`

---

**Last Updated**: 2026-08-31  
**Status**: Simulation mode enabled, EA integration pending
