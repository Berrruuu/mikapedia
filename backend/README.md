# MIKAPEDIA TOMS — Django Backend

## Quick Start

```bash
cd backend

# 1. Create & activate virtual environment
python -m venv venv
venv\Scripts\Activate.ps1        # Windows
source venv/bin/activate          # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — set DB credentials etc.

# 4. Run migrations
python manage.py migrate

# 5. Create demo users
Get-Content create_demo_users.py | python manage.py shell

# 6. Start server
python manage.py runserver 8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Login — returns `{user, access, refresh}` |
| GET | `/api/auth/me/` | Current user |
| POST | `/api/auth/token/refresh/` | Refresh JWT |
| GET | `/api/dashboard/admin/` | Admin KPIs |
| GET | `/api/dashboard/trader/` | Trader KPIs |
| GET | `/api/signals/` | Signal list |
| GET | `/api/attendance/` | Attendance records |
| GET | `/api/mt5/` | MT5 accounts |
| GET | `/api/compliance/` | Compliance records |
| GET/PATCH | `/api/notifications/` | Notifications |
| GET | `/api/audit-logs/` | Audit logs |
| GET/PATCH | `/api/settings/` | System settings |
| GET | `/api/reports/session/` | Session report |
| GET | `/api/reports/attendance/` | Attendance report |
| GET | `/api/reports/compliance/` | Compliance report |

## Demo Accounts
- Admin: `admin@mikapedia.com` / `admin123`
- Trader: `trader@mikapedia.com` / `trader123`

## Stack
- Django 5.1 + DRF 3.15
- SQLite (dev) / PostgreSQL (prod)
- JWT via djangorestframework-simplejwt
- CORS via django-cors-headers
