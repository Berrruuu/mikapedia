# 🚀 Panduan Deploy MIKAPEDIA TOMS ke VPS

Panduan lengkap untuk deploy aplikasi MIKAPEDIA Trading Operations Management System ke VPS (Hostinger atau VPS lainnya) menggunakan Docker.

---

## 📋 Prerequisites

### Di VPS Anda:
- Ubuntu 20.04/22.04 atau Debian 11/12
- Minimal 2GB RAM (recommended 4GB+)
- 20GB disk space
- Domain yang sudah mengarah ke IP VPS (contoh: `mikapedia.online`)
- Akses SSH root atau sudo

### Di Komputer Lokal:
- Git installed
- SSH client (PuTTY untuk Windows, atau terminal SSH)

---

## 🔧 Langkah 1: Persiapan VPS

### 1.1 Login ke VPS via SSH

```bash
ssh root@YOUR_VPS_IP
# atau
ssh username@YOUR_VPS_IP
```

### 1.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verifikasi Docker installed
docker --version

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verifikasi Docker Compose installed
docker compose version

# (Optional) Tambahkan user ke docker group agar tidak perlu sudo
sudo usermod -aG docker $USER
# Logout dan login lagi untuk apply perubahan
```

### 1.4 Install Git

```bash
sudo apt install git -y
git --version
```

---

## 📦 Langkah 2: Clone Repository ke VPS

### 2.1 Buat Directory untuk Aplikasi

```bash
mkdir -p /var/www
cd /var/www
```

### 2.2 Clone Repository

```bash
# Clone dari GitHub
git clone https://github.com/YOUR_USERNAME/mika-ops-hub.git
cd mika-ops-hub

# Atau jika menggunakan branch tertentu
git clone -b main https://github.com/YOUR_USERNAME/mika-ops-hub.git
cd mika-ops-hub
```

**ALTERNATIF**: Jika repository private atau Anda mengupload manual:

```bash
# Di komputer lokal, compress folder
tar -czf mika-ops-hub.tar.gz mika-ops-hub-main/

# Upload ke VPS menggunakan SCP
scp mika-ops-hub.tar.gz root@YOUR_VPS_IP:/var/www/

# Di VPS, extract
cd /var/www
tar -xzf mika-ops-hub.tar.gz
mv mika-ops-hub-main mika-ops-hub
cd mika-ops-hub
```

---

## ⚙️ Langkah 3: Konfigurasi Environment Variables

### 3.1 Setup Backend Environment

```bash
# Copy template production environment
cp backend/.env.production backend/.env

# Edit file .env
nano backend/.env
```

### 3.2 Edit Backend .env

Ganti nilai-nilai berikut (tekan `Ctrl+X`, `Y`, `Enter` untuk save):

```bash
# Django Core
SECRET_KEY=PUT_YOUR_STRONG_SECRET_KEY_HERE_MINIMUM_50_CHARS
DEBUG=False
ALLOWED_HOSTS=mikapedia.online,www.mikapedia.online,YOUR_VPS_IP

# PostgreSQL
DB_ENGINE=django.db.backends.postgresql
DB_NAME=mikapedia_toms
DB_USER=mikapedia
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE
DB_HOST=db
DB_PORT=5432

# JWT
JWT_SECRET_KEY=YOUR_JWT_SECRET_KEY_HERE_MINIMUM_50_CHARS
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# CORS
CORS_ALLOWED_ORIGINS=https://mikapedia.online,https://www.mikapedia.online
CSRF_TRUSTED_ORIGINS=https://mikapedia.online,https://www.mikapedia.online

# TradingView Webhook
TRADINGVIEW_WEBHOOK_SECRET=YOUR_TRADINGVIEW_SECRET

# MT5 (IMPORTANT for Linux/VPS)
MT5_USE_SIMULATION=True
MT5_ENCRYPTION_KEY=YOUR_MT5_ENCRYPTION_KEY

# Redis
REDIS_URL=redis://redis:6379/0

# EA Integration
EA_INTEGRATION_TOKEN=YOUR_EA_TOKEN_HERE

# SSL
SECURE_SSL_REDIRECT=True
```

**Generate Secret Keys**:
```bash
# Generate SECRET_KEY
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Generate JWT_SECRET_KEY (cara lain)
openssl rand -base64 64

# Generate EA_INTEGRATION_TOKEN
openssl rand -hex 32
```

### 3.3 Setup Docker Compose Environment

```bash
# Edit docker-compose environment variables (optional)
nano .env
```

Buat file `.env` di root project (jika belum ada):

```bash
# PostgreSQL
POSTGRES_DB=mikapedia_toms
POSTGRES_USER=mikapedia
POSTGRES_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE
```

**PENTING**: Password di `.env` root harus sama dengan `DB_PASSWORD` di `backend/.env`

---

## 🌐 Langkah 4: Setup Domain & SSL Certificate

### 4.1 Pastikan Domain Mengarah ke VPS

Tambahkan A Record di DNS provider Anda:

```
Type: A
Name: @
Value: YOUR_VPS_IP
TTL: 3600

Type: A
Name: www
Value: YOUR_VPS_IP
TTL: 3600
```

Tunggu propagasi DNS (5-30 menit). Test dengan:

```bash
ping mikapedia.online
```

### 4.2 Update Nginx Configuration

```bash
nano nginx/nginx.conf
```

Ganti `mikapedia.online` dengan domain Anda di semua tempat:

```nginx
server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;
```

### 4.3 Setup SSL dengan Let's Encrypt (Certbot)

#### Opsi A: Sebelum Docker Running (Recommended)

```bash
# Install certbot
sudo apt install certbot -y

# Buat directory untuk certbot
sudo mkdir -p /var/www/certbot

# Get certificate (standalone mode)
sudo certbot certonly --standalone \
  --preferred-challenges http \
  -d mikapedia.online \
  -d www.mikapedia.online \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# Certificate akan disimpan di:
# /etc/letsencrypt/live/mikapedia.online/fullchain.pem
# /etc/letsencrypt/live/mikapedia.online/privkey.pem
```

#### Opsi B: Setelah Docker Running (Webroot)

```bash
# Start docker tanpa SSL dulu
docker compose -f docker-compose.prod.yml up -d

# Get certificate
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d mikapedia.online \
  -d www.mikapedia.online \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### 4.4 Setup Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Crontab untuk auto-renewal (setiap hari jam 3 pagi)
sudo crontab -e
```

Tambahkan baris ini:

```
0 3 * * * certbot renew --quiet --post-hook "cd /var/www/mika-ops-hub && docker compose -f docker-compose.prod.yml restart nginx"
```

---

## 🐳 Langkah 5: Build & Run dengan Docker Compose

### 5.1 Build Images

```bash
cd /var/www/mika-ops-hub

# Build semua services
docker compose -f docker-compose.prod.yml build --no-cache
```

### 5.2 Start Services

```bash
# Start semua containers
docker compose -f docker-compose.prod.yml up -d

# Lihat logs
docker compose -f docker-compose.prod.yml logs -f

# Lihat status containers
docker compose -f docker-compose.prod.yml ps
```

### 5.3 Run Database Migrations

```bash
# Jalankan migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Collect static files (sudah dijalankan saat build, tapi run lagi untuk memastikan)
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

---

## 👤 Langkah 6: Buat Superuser (Owner)

```bash
# Buat superuser pertama kali
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# Atau menggunakan script custom
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

Di Django shell:

```python
from users.models import User

# Buat Owner
owner = User.objects.create(
    username='owner@mikapedia.com',
    email='owner@mikapedia.com',
    first_name='Owner',
    last_name='MIKAPEDIA',
    role='owner',
    status='active',
    is_staff=True,
    is_superuser=True
)
owner.set_password('YourStrongPassword123!')
owner.save()

print(f"Owner created: {owner.email}")
exit()
```

---

## 🔍 Langkah 7: Verifikasi Deployment

### 7.1 Check Services Status

```bash
# Lihat semua containers running
docker compose -f docker-compose.prod.yml ps

# Expected output:
# NAME                   STATUS              PORTS
# mika-ops-hub-db-1      Up (healthy)        5432/tcp
# mika-ops-hub-redis-1   Up (healthy)        6379/tcp
# mika-ops-hub-backend-1 Up                  8000/tcp
# mika-ops-hub-frontend-1 Up (healthy)       3000/tcp
# mika-ops-hub-nginx-1   Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# mika-ops-hub-celery-worker-1 Up           
# mika-ops-hub-celery-beat-1   Up
```

### 7.2 Test Website

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://mikapedia.online

# Test HTTPS
curl -I https://mikapedia.online

# Test API
curl https://mikapedia.online/api/health/
```

### 7.3 Test di Browser

1. Buka `https://mikapedia.online`
2. Login dengan akun owner yang dibuat
3. Test fitur-fitur utama

---

## 🔄 Langkah 8: Update/Redeploy

### 8.1 Pull Changes dari Git

```bash
cd /var/www/mika-ops-hub

# Pull latest changes
git pull origin main

# Atau jika upload manual
# Upload file baru dengan SCP dan extract
```

### 8.2 Rebuild & Restart

```bash
# Stop containers
docker compose -f docker-compose.prod.yml down

# Rebuild (jika ada perubahan code)
docker compose -f docker-compose.prod.yml build --no-cache

# Start lagi
docker compose -f docker-compose.prod.yml up -d

# Run migrations (jika ada)
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart frontend
```

### 8.3 Update Tanpa Downtime (Zero-Downtime)

```bash
# Rebuild service
docker compose -f docker-compose.prod.yml build backend

# Recreate service tanpa stop yang lain
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend

# Run migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

---

## 🐛 Troubleshooting

### Lihat Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f db

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Container Tidak Mau Start

```bash
# Check status
docker compose -f docker-compose.prod.yml ps -a

# Check resource usage
docker stats

# Restart service
docker compose -f docker-compose.prod.yml restart backend

# Rebuild from scratch
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Issues

```bash
# Connect to PostgreSQL
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms

# Backup database
docker compose -f docker-compose.prod.yml exec db pg_dump -U mikapedia mikapedia_toms > backup.sql

# Restore database
docker compose -f docker-compose.prod.yml exec -T db psql -U mikapedia mikapedia_toms < backup.sql
```

### 502 Bad Gateway

```bash
# Check backend is running
docker compose -f docker-compose.prod.yml ps backend

# Check backend logs
docker compose -f docker-compose.prod.yml logs backend

# Restart backend
docker compose -f docker-compose.prod.yml restart backend

# Check nginx config
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Port Already in Use

```bash
# Check what's using port 80/443
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Kill process
sudo kill -9 PID

# Or stop apache/nginx if installed
sudo systemctl stop apache2
sudo systemctl stop nginx
```

---

## 🔒 Security Best Practices

### 1. Firewall Setup (UFW)

```bash
# Install UFW
sudo apt install ufw -y

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (PENTING! Jangan lupa)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable UFW
sudo ufw enable

# Check status
sudo ufw status
```

### 2. Secure SSH

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Disable root login
PermitRootLogin no

# Disable password authentication (gunakan SSH key)
PasswordAuthentication no

# Restart SSH
sudo systemctl restart sshd
```

### 3. Fail2Ban (Block Brute Force)

```bash
# Install
sudo apt install fail2ban -y

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## 📊 Monitoring & Maintenance

### Check Resource Usage

```bash
# System resources
htop
df -h
free -h

# Docker resources
docker stats

# Disk usage by container
docker system df -v
```

### Clean Up Docker

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove all unused data
docker system prune -a --volumes
```

### Backup Strategy

```bash
# Backup script
nano /root/backup-mikapedia.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker compose -f /var/www/mika-ops-hub/docker-compose.prod.yml exec -T db \
  pg_dump -U mikapedia mikapedia_toms > $BACKUP_DIR/db_$DATE.sql

# Backup media files
tar -czf $BACKUP_DIR/media_$DATE.tar.gz -C /var/www/mika-ops-hub/backend media/

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /root/backup-mikapedia.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /root/backup-mikapedia.sh >> /var/log/backup-mikapedia.log 2>&1
```

---

## 📝 Checklist Deploy

- [ ] VPS siap (Ubuntu/Debian, 2GB+ RAM)
- [ ] Docker & Docker Compose installed
- [ ] Domain mengarah ke VPS IP
- [ ] Repository di-clone ke `/var/www/mika-ops-hub`
- [ ] `backend/.env` sudah dikonfigurasi dengan benar
- [ ] SSL certificate dari Let's Encrypt sudah didapat
- [ ] `nginx/nginx.conf` sudah disesuaikan dengan domain
- [ ] `docker compose build` berhasil
- [ ] `docker compose up -d` semua services running
- [ ] Database migrations sudah dijalankan
- [ ] Superuser/Owner sudah dibuat
- [ ] Website bisa diakses via HTTPS
- [ ] Login berhasil
- [ ] Firewall (UFW) sudah disetup
- [ ] Backup script sudah disetup
- [ ] Auto-renewal SSL sudah disetup

---

## 🆘 Support

Jika ada masalah:
1. Check logs: `docker compose -f docker-compose.prod.yml logs -f`
2. Check container status: `docker compose -f docker-compose.prod.yml ps`
3. Check system resources: `htop`, `df -h`
4. Review dokumentasi di folder project

---

**Deploy Date**: September 2026  
**Stack**: Django + React + PostgreSQL + Redis + Nginx + Docker  
**Domain**: mikapedia.online
