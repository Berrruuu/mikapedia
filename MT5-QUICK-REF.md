# MT5 Quick Reference Card

## 🚀 Quick Commands

### Deploy Latest Changes
```bash
cd ~/mikapedia
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache frontend backend
docker compose -f docker-compose.prod.yml up -d
```

### Run Diagnostic
```bash
./diagnose-mt5.sh trader@test.com password123
```

### Check Logs
```bash
# MT5 related logs
docker compose -f docker-compose.prod.yml logs backend | grep -i mt5

# Recent errors
docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep -i error

# All backend logs (last 100 lines)
docker compose -f docker-compose.prod.yml logs backend --tail=100
```

### Database Quick Check
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT id, login, status, balance FROM mt5_accounts;"
```

### Restart Services
```bash
# Restart backend only
docker compose -f docker-compose.prod.yml restart backend

# Restart all
docker compose -f docker-compose.prod.yml restart
```

## 🔍 Browser Console Commands

### Check API Config
```javascript
console.log('API_BASE:', API_BASE);
```

### Manual Test MT5 API
```javascript
// Get auth token from localStorage
const token = localStorage.getItem('access_token');

// Test MT5 me endpoint
fetch('https://mikapedia.online/api/v1/mt5/me/', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Check WebSocket
```javascript
// Network tab → Filter: WS
// Should see: wss://mikapedia.online/ws/
// Status: 101 Switching Protocols
```

## 📍 Important URLs

- **Frontend**: https://mikapedia.online/trader/mt5
- **Login**: https://mikapedia.online/login
- **API Base**: https://mikapedia.online/api
- **MT5 Me**: https://mikapedia.online/api/v1/mt5/me/
- **Credentials**: https://mikapedia.online/api/v1/mt5/credentials/
- **EA Report**: https://mikapedia.online/api/v1/mt5/ea-report/

## 🐛 Common Error Messages

### "No MT5 account configured"
- **Meaning**: No MT5Account in database for this user
- **Fix**: Save credentials via form

### "NameError: name 'time' is not defined"
- **Meaning**: Missing import in backend
- **Fix**: Already fixed in `backend/mt5/service.py`

### "Mixed Content: requested insecure resource"
- **Meaning**: Frontend using HTTP in HTTPS page
- **Fix**: Already fixed in `src/lib/api.ts`

### "404 Not Found"
- **Meaning**: Normal before first save OR MT5 endpoint wrong
- **Fix**: Check if using `/v1/mt5/me/` (with v1) not `/mt5/me/`

## ✅ Health Check

### Backend is OK if:
```bash
curl -s https://mikapedia.online/api/health/ | jq .
# Should return: {"status": "ok"}
```

### Frontend is OK if:
```bash
curl -I https://mikapedia.online/ 
# Should return: HTTP/2 200
```

### Database is OK if:
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "SELECT 1;"
# Should return: 1
```

## 🎯 Expected Behavior

### First Visit (Before Save)
1. User opens `/trader/mt5`
2. API calls `/v1/mt5/me/` → Returns 404
3. Frontend shows: "Connect MT5 Account" form
4. Console logs: "→ No MT5 account found (expected before first save)"

### After Save Credentials
1. User clicks "Save & Connect"
2. API calls `/v1/mt5/credentials/` → Returns MT5Account
3. Frontend updates account state
4. Account info displays
5. Auto-refresh starts (every 1 second)
6. Console logs: "✓ MT5: Account data received"

### During Operation
1. Every 1 second: POST `/v1/mt5/{id}/sync/`
2. Backend fetches latest data (simulation or real)
3. WebSocket broadcasts update
4. All connected clients receive update
5. UI updates without page reload

## 📋 Files Modified

### Backend
- `backend/mt5/service.py` - Added `import time`
- `backend/.env.production` - Set `MT5_USE_SIMULATION=True`

### Frontend
- `src/lib/api.ts` - HTTPS detection + debug logging
- `src/lib/auth.tsx` - HTTPS detection
- `src/routes/trader.mt5.tsx` - Enhanced error handling + auto-refresh
- `src/routes/admin.signals.index.tsx` - SSR HTTPS fix

### Documentation
- `MT5-TROUBLESHOOT.md` - Comprehensive troubleshooting
- `CARA-HUBUNGKAN-MT5.md` - User guide (Indonesian)
- `MT5-DEBUG-SUMMARY.md` - Debug summary
- `diagnose-mt5.sh` - Automated diagnostic script

## 🔐 Environment Variables

```bash
# Backend .env.production
MT5_USE_SIMULATION=True              # Use simulation on Linux
MT5_ENCRYPTION_KEY=...               # For encrypting passwords
EA_INTEGRATION_TOKEN=...             # For EA authentication
```

## 📞 Emergency Contacts

**If website is down:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100
docker compose -f docker-compose.prod.yml restart
```

**If database is corrupt:**
```bash
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms
# Run SQL repairs
```

**If nothing works:**
```bash
# Nuclear option - rebuild everything
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

---

**Keep this card handy for quick troubleshooting!** 🚀
