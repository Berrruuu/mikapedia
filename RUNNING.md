# MIKAPEDIA TOMS — Cara Menjalankan

## Quick Start

### Terminal 1 — Backend (Django + WebSocket)
```bash
cd backend
.\venv\Scripts\Activate.ps1     # Windows PowerShell
# atau: source venv/bin/activate  # Linux/Mac

# Jalankan dengan Daphne (ASGI — wajib untuk WebSocket)
daphne -p 8000 config.asgi:application

# Atau pakai Django dev server (HTTP only, WebSocket tidak aktif)
# python manage.py runserver 8000
```

### Terminal 2 — Frontend (React + Vite)
```bash
npm run dev
# Buka http://localhost:5173
```

---

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mikapedia.com | admin123 |
| Trader | trader@mikapedia.com | trader123 |

---

## WebSocket

Server: `ws://localhost:8000/ws/live/?token=<JWT>`

### Message Types
| Type | Direction | Description |
|------|-----------|-------------|
| `signal_update` | Server→Client | TradingView signal baru/diupdate |
| `mt5_update` | Server→Client | MT5 account/posisi diupdate |
| `attendance_update` | Server→Client | Check-in/validasi kehadiran |
| `notification` | Server→Client | Notifikasi sistem baru |
| `dashboard_stats` | Server→Client | KPI dashboard refresh |
| `compliance_update` | Server→Client | Compliance record diupdate |
| `ping` | Client→Server | Keepalive |
| `pong` | Server→Client | Respon keepalive |

### Channel Groups
- `broadcast` — semua user terautentikasi
- `admin_room` — admin only
- `trader_{uuid}` — per-trader

---

## TradingView Webhook

**URL**: `POST http://localhost:8000/api/signals/webhook/`

**Pine Script Alert Body**:
```json
{
  "secret": "mikapedia-tv-secret-2026",
  "symbol": "{{ticker}}",
  "pair": "XAUUSD",
  "direction": "{{strategy.order.action}}",
  "timeframe": "{{interval}}",
  "strategy": "Fibonacci Strategy v6",
  "fib_entry": 0.5,
  "take_profit": {{strategy.order.price}},
  "stop_loss": {{strategy.position_avg_price}},
  "fib_0236": 2394.2,
  "fib_0500": 2402.7,
  "fib_0618": 2408.4,
  "max_entry_minutes": 10,
  "expiry_minutes": 60
}
```

---

## MetaTrader 5

- Windows: install MT5 terminal, set `MT5_USE_SIMULATION=False` di `.env`
- Non-Windows/Dev: set `MT5_USE_SIMULATION=True` (default) → data simulasi otomatis

## Redis (Channels)

For production real-time WebSocket scaling, the project supports Redis as the
Channels backing store. By default the project will use the in-memory layer
for local development. To enable Redis, set the `REDIS_URL` environment variable
to your Redis instance (example below).

Example (run Redis locally with Docker):

```bash
docker run -d --name redis-local -p 6379:6379 redis:7
export REDIS_URL=redis://127.0.0.1:6379
# Then run Daphne as above
```

The `backend/requirements.txt` already includes `channels-redis`.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login/` | None | Login → JWT |
| GET | `/api/auth/me/` | JWT | Current user |
| POST | `/api/auth/logout/` | JWT | Logout + blacklist token |
| POST | `/api/auth/forgot-password/` | None | Request reset token |
| POST | `/api/auth/reset-password/` | None | Reset via token |
| POST | `/api/auth/change-password/` | JWT | Change password |
| GET | `/api/users/` | Admin | List all users |
| POST | `/api/users/` | Admin | Create user |
| PATCH | `/api/users/{id}/` | JWT | Update user |
| POST | `/api/signals/webhook/` | Secret | TradingView webhook |
| GET | `/api/signals/` | JWT | List signals |
| POST | `/api/attendance/checkin/` | JWT | Check-in dengan selfie |
| GET | `/api/attendance/today/` | JWT | Status hari ini |
| GET | `/api/attendance/summary/` | Admin | Summary + semua records |
| PATCH | `/api/attendance/{id}/validate/` | Admin | Override status |
| POST | `/api/mt5/credentials/` | JWT | Set MT5 credentials |
| GET | `/api/mt5/me/` | JWT | Akun MT5 sendiri |
| POST | `/api/mt5/{id}/sync/` | JWT | Manual sync |
| POST | `/api/mt5/sync-all/` | Admin | Sync semua akun |
| GET | `/api/mt5/summary/` | Admin | KPI summary |
| GET | `/api/compliance/` | JWT | Compliance records |
| GET | `/api/notifications/` | JWT | Notifications |
| PATCH | `/api/notifications/{id}/mark_read/` | JWT | Mark dibaca |
| GET | `/api/audit-logs/` | Admin | Audit logs |
| GET/PATCH | `/api/settings/` | Admin | System settings |

---

## Environment Variables (`.env`)

```
SECRET_KEY=...
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3
JWT_SECRET_KEY=...
CORS_ALLOWED_ORIGINS=http://localhost:5173
TRADINGVIEW_WEBHOOK_SECRET=mikapedia-tv-secret-2026
MT5_USE_SIMULATION=True
MT5_ENCRYPTION_KEY=  # auto-generated from SECRET_KEY if empty
```
