# 📊 MIKAPEDIA TOMS - Trading Operations Management System

> Sistem manajemen operasional trading terintegrasi dengan MetaTrader 5, TradingView, dan real-time monitoring.

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-Production-green.svg)](https://mikapedia.online)
[![Django](https://img.shields.io/badge/Django-5.1-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://reactjs.org/)

---

## 🚀 Quick Links

| Document | Purpose |
|----------|---------|
| **[RUNNING.md](RUNNING.md)** | 🏃 Local development setup & API docs |
| **[FIXES-SUMMARY.md](FIXES-SUMMARY.md)** | 📋 Summary of all fixes applied |
| **[DEPLOY-QUICK-FIX.md](DEPLOY-QUICK-FIX.md)** | ⚡ Quick 5-minute deployment fix |
| **[DEPLOY-TROUBLESHOOT.md](DEPLOY-TROUBLESHOOT.md)** | 🔍 Comprehensive troubleshooting |
| **[VPS-COMMANDS.md](VPS-COMMANDS.md)** | 📚 Docker & VPS commands cheat sheet |

---

## 🎯 Features

### Core Modules
- ✅ **Authentication & Authorization** - JWT-based multi-role access (Admin/Trader)
- ✅ **Signal Management** - TradingView webhook integration untuk signal otomatis
- ✅ **MT5 Integration** - Real-time account monitoring & position tracking
- ✅ **Attendance System** - GPS + Selfie-based check-in dengan shift scheduling
- ✅ **Compliance Tracking** - Automated SOP compliance monitoring & scoring
- ✅ **Real-time Dashboard** - WebSocket-powered live updates
- ✅ **Audit Logs** - Comprehensive activity logging
- ✅ **Leaderboard** - Trader performance ranking

### Technical Highlights
- 🔄 **WebSocket** - Real-time notifications & updates via Django Channels
- 📊 **Live Charts** - TradingView integration dengan Recharts visualization
- 🔐 **Security** - JWT authentication, encrypted MT5 passwords, audit logging
- 🐳 **Docker** - Containerized deployment dengan Docker Compose
- 🌐 **Production Ready** - Nginx reverse proxy, PostgreSQL, Redis, SSL/TLS

---

## 🏗️ Architecture

```
┌─────────────┐     HTTPS      ┌─────────┐      ┌──────────┐
│   Browser   │ ◄────────────► │  Nginx  │ ◄──► │ Frontend │
│             │                 │         │      │ (React)  │
└─────────────┘                 └────┬────┘      └──────────┘
                                     │
                         ┌───────────┼───────────┐
                         │           │           │
                    ┌────▼────┐ ┌───▼────┐ ┌───▼─────┐
                    │ Backend │ │  DB    │ │  Redis  │
                    │(Django) │ │(Postgres)│ │ (Cache) │
                    └────┬────┘ └────────┘ └─────────┘
                         │
                    ┌────┼────┬────────┐
                    │         │        │
               ┌────▼───┐ ┌──▼──┐ ┌──▼──────┐
               │ Celery │ │ MT5 │ │TradingView│
               │ Worker │ │ EA  │ │ Webhook │
               └────────┘ └─────┘ └─────────┘
```

---

## 💻 Tech Stack

### Backend
- **Django 5.1** - Web framework
- **Django REST Framework** - API
- **Django Channels** - WebSocket
- **Celery** - Background tasks
- **PostgreSQL** - Database
- **Redis** - Cache & message broker
- **MetaTrader5** - MT5 Python API (Windows only)

### Frontend
- **React 19.2** - UI framework
- **TanStack Start** - React framework
- **TanStack Router** - Routing
- **TanStack Query** - Data fetching
- **Tailwind CSS 4** - Styling
- **Recharts** - Charts
- **Radix UI** - Components

### DevOps
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy & SSL termination
- **Let's Encrypt** - SSL certificates
- **GitHub** - Version control

---

## 🚀 Getting Started

### Prerequisites
- Python 3.13+
- Node.js 22+
- PostgreSQL 16+ (production)
- Redis 7+ (production)
- Docker & Docker Compose (production)

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/yourusername/mika-ops-hub.git
cd mika-ops-hub

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
daphne -p 8000 config.asgi:application

# 3. Frontend setup (new terminal)
npm install
npm run dev
```

📖 **Full details:** [RUNNING.md](RUNNING.md)

---

## 🐳 Production Deployment

### Quick Deploy to VPS

```bash
# 1. SSH to VPS
ssh user@your-vps-ip

# 2. Clone & configure
git clone https://github.com/yourusername/mika-ops-hub.git
cd mika-ops-hub
cp backend/.env.example backend/.env
nano backend/.env  # Update credentials

# 3. Deploy with Docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 4. Setup SSL (Let's Encrypt)
sudo certbot certonly --standalone -d yourdomain.com
```

📖 **Full guide:** [DEPLOY-QUICK-FIX.md](DEPLOY-QUICK-FIX.md)

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Quick Fix | Full Guide |
|-------|-----------|------------|
| Frontend 502 Bad Gateway | Rebuild frontend container | [DEPLOY-QUICK-FIX.md](DEPLOY-QUICK-FIX.md) |
| MT5 Credentials 500 Error | Update backend .env | [FIXES-SUMMARY.md](FIXES-SUMMARY.md) |
| Container restart loop | Check logs & rebuild | [DEPLOY-TROUBLESHOOT.md](DEPLOY-TROUBLESHOOT.md) |
| Database connection error | Check PostgreSQL status | [VPS-COMMANDS.md](VPS-COMMANDS.md) |

### Debug Commands

```bash
# View container status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend

# Run debug script
chmod +x debug-frontend.sh
./debug-frontend.sh
```

📖 **Comprehensive troubleshooting:** [DEPLOY-TROUBLESHOOT.md](DEPLOY-TROUBLESHOOT.md)

---

## 📚 Documentation Index

### For Developers
- [RUNNING.md](RUNNING.md) - Local development setup
- [AGENTS.md](AGENTS.md) - AI agent guidelines (Lovable)

### For DevOps
- [DEPLOY-QUICK-FIX.md](DEPLOY-QUICK-FIX.md) - Quick deployment steps
- [DEPLOY-TROUBLESHOOT.md](DEPLOY-TROUBLESHOOT.md) - Troubleshooting guide
- [VPS-COMMANDS.md](VPS-COMMANDS.md) - Docker commands cheat sheet
- [FIXES-SUMMARY.md](FIXES-SUMMARY.md) - Applied fixes summary

### Configuration Files
- `docker-compose.prod.yml` - Production stack
- `Dockerfile.frontend` - Frontend image
- `Dockerfile.frontend.preview` - Alternative frontend (fallback)
- `nginx/nginx.conf` - Nginx configuration
- `backend/.env.production` - Backend environment variables

---

## 🔐 Security

- ✅ JWT authentication dengan refresh tokens
- ✅ HTTPS/TLS dengan Let's Encrypt
- ✅ CORS & CSRF protection
- ✅ Password encryption (bcrypt)
- ✅ MT5 password encryption (Fernet)
- ✅ Rate limiting (Nginx)
- ✅ SQL injection protection (Django ORM)
- ✅ XSS protection (React)
- ✅ Audit logging semua admin actions

---

## 📊 System Requirements

### Development
- **RAM:** 4GB minimum
- **Disk:** 10GB free space
- **OS:** Windows 10/11, macOS, Linux

### Production (VPS/Hostinger)
- **RAM:** 2GB minimum (4GB recommended)
- **Disk:** 20GB free space
- **OS:** Ubuntu 20.04+ / Debian 11+
- **Network:** Static IP + domain name

---

## 🤝 Contributing

This is a proprietary project. Contributions are limited to authorized team members only.

For bug reports or feature requests, contact the development team.

---

## 📝 License

Proprietary - © 2024-2025 Mikapedia. All rights reserved.

---

## 📞 Support

- **Production URL:** https://mikapedia.online/
- **API Docs:** https://mikapedia.online/api/
- **Technical Issues:** Run `debug-frontend.sh` dan kirim output

---

## ✅ Project Status

- ✅ **Backend:** Fully functional
- ✅ **Frontend:** Deployed & stable
- ✅ **MT5 Integration:** Working (via EA on Windows)
- ✅ **TradingView Webhook:** Active
- ✅ **WebSocket:** Real-time updates working
- ✅ **Production:** Live at mikapedia.online

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Status:** 🟢 Production
