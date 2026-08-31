# ✅ Deployment Checklist - Mikapedia TOMS

## 📋 Pre-Deployment

### 1. VPS Requirements
- [ ] Ubuntu 20.04+ atau Debian 11+ installed
- [ ] Minimal 2GB RAM (4GB recommended)
- [ ] Minimal 20GB disk space
- [ ] Static IP address assigned
- [ ] Domain name pointed to VPS IP
- [ ] SSH access configured

### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install certbot (for SSL)
sudo apt install certbot -y

# Install git
sudo apt install git -y
```
- [ ] Docker installed & running
- [ ] Docker Compose installed
- [ ] Certbot installed
- [ ] Git installed

---

## 🔐 Configuration

### 3. Clone Repository
```bash
cd /opt
sudo git clone https://github.com/yourusername/mika-ops-hub.git
sudo chown -R $USER:$USER mika-ops-hub
cd mika-ops-hub
```
- [ ] Repository cloned

### 4. Backend Environment
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Update these values:
- [ ] `SECRET_KEY` → Generate strong random key
- [ ] `JWT_SECRET_KEY` → Generate strong random key
- [ ] `DB_PASSWORD` → Change from default
- [ ] `MT5_ENCRYPTION_KEY` → Generate base64 key
- [ ] `EA_INTEGRATION_TOKEN` → Generate secure token
- [ ] `ALLOWED_HOSTS` → Add your domain
- [ ] `CORS_ALLOWED_ORIGINS` → Add your domain URL
- [ ] `CSRF_TRUSTED_ORIGINS` → Add your domain URL
- [ ] `MT5_USE_SIMULATION=True` (for Linux server)

**Generate keys:**
```bash
# SECRET_KEY
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# MT5_ENCRYPTION_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# EA_INTEGRATION_TOKEN
openssl rand -hex 32
```

### 5. SSL Certificate
```bash
# Stop any service using port 80
sudo systemctl stop nginx 2>/dev/null || true

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificate will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```
- [ ] SSL certificate obtained
- [ ] Certificate paths noted

### 6. Update nginx.conf
```bash
nano nginx/nginx.conf
```
- [ ] Replace `mikapedia.online` with your domain
- [ ] Verify SSL certificate paths

---

## 🚀 Deployment

### 7. Build & Start
```bash
cd /opt/mika-ops-hub

# Build all images
docker compose -f docker-compose.prod.yml build --no-cache

# Start services
docker compose -f docker-compose.prod.yml up -d

# Wait 60 seconds for services to start
sleep 60
```
- [ ] All images built successfully
- [ ] All containers started

### 8. Run Migrations
```bash
docker exec $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py migrate
```
- [ ] Migrations completed

### 9. Create Superuser
```bash
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py createsuperuser
```
- [ ] Admin user created

### 10. Collect Static Files
```bash
docker exec $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py collectstatic --noinput
```
- [ ] Static files collected

---

## ✅ Verification

### 11. Check Container Status
```bash
docker compose -f docker-compose.prod.yml ps
```
**Expected:** All containers should be `Up` and `healthy` (if healthcheck configured)

- [ ] db: Up (healthy)
- [ ] redis: Up (healthy)
- [ ] backend: Up
- [ ] frontend: Up (healthy)
- [ ] nginx: Up
- [ ] celery-worker: Up
- [ ] celery-beat: Up

### 12. Check Logs
```bash
# Frontend logs
docker compose -f docker-compose.prod.yml logs frontend | tail -20

# Backend logs
docker compose -f docker-compose.prod.yml logs backend | tail -20
```
**Expected:**
- Frontend: `VITE ready in XXX ms`
- Backend: `Uvicorn running on http://0.0.0.0:8000`
- [ ] No critical errors in logs

### 13. Test Internal Connectivity
```bash
# Backend from nginx
docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx) wget -q -O- http://backend:8000/api/v1/auth/status

# Frontend from nginx
docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx) wget -q -O- http://frontend:3000 | head -20
```
- [ ] Backend responds
- [ ] Frontend responds

### 14. Test External Access
```bash
# HTTP (should redirect to HTTPS)
curl -I http://yourdomain.com

# HTTPS
curl -I https://yourdomain.com

# API
curl https://yourdomain.com/api/v1/auth/status
```
- [ ] HTTP → HTTPS redirect works
- [ ] HTTPS loads successfully
- [ ] API responds correctly

### 15. Run Health Check
```bash
chmod +x health-check.sh
./health-check.sh
```
- [ ] Health check passes (0 errors)
- [ ] Warnings addressed (if any)

### 16. Test Website
Open browser and test:
- [ ] https://yourdomain.com loads
- [ ] Login page displays correctly
- [ ] Login with admin credentials works
- [ ] Admin dashboard loads
- [ ] Trader dashboard accessible
- [ ] No console errors in browser

---

## 🔧 Post-Deployment

### 17. Setup Auto-Renewal for SSL
```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e
```
Add this line:
```
0 3 * * * certbot renew --quiet && docker compose -f /opt/mika-ops-hub/docker-compose.prod.yml restart nginx
```
- [ ] SSL auto-renewal configured

### 18. Setup Monitoring
```bash
# Add health check to cron (every 5 minutes)
crontab -e
```
Add:
```
*/5 * * * * /opt/mika-ops-hub/health-check.sh >> /var/log/mikapedia-health.log 2>&1
```
- [ ] Health monitoring configured

### 19. Setup Backup
```bash
# Create backup script
cat > /opt/backup-mikapedia.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/mikapedia"
mkdir -p $BACKUP_DIR
docker exec $(docker compose -f /opt/mika-ops-hub/docker-compose.prod.yml ps -q db) pg_dump -U mikapedia mikapedia_toms | gzip > $BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup-mikapedia.sh

# Add to cron (daily at 2 AM)
sudo crontab -e
```
Add:
```
0 2 * * * /opt/backup-mikapedia.sh
```
- [ ] Daily database backup configured

### 20. Document Credentials
Create secure note with:
- [ ] VPS IP address
- [ ] SSH credentials
- [ ] Domain registrar access
- [ ] Django admin credentials
- [ ] Database credentials
- [ ] MT5 EA integration token
- [ ] TradingView webhook secret

---

## 📊 Performance Tuning (Optional)

### 21. Configure Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```
- [ ] Firewall configured

### 22. Setup Swap (if RAM < 4GB)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
- [ ] Swap configured

### 23. Optimize Docker
```bash
# Edit daemon.json
sudo nano /etc/docker/daemon.json
```
Add:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```
```bash
sudo systemctl restart docker
```
- [ ] Docker logging optimized

---

## 🎯 Final Checklist

### Production Ready
- [ ] All containers running healthy
- [ ] Website accessible via HTTPS
- [ ] Admin login works
- [ ] Trader login works
- [ ] No errors in logs
- [ ] SSL certificate valid
- [ ] Health check passes
- [ ] Backups configured
- [ ] Monitoring configured
- [ ] Credentials documented

### MT5 Integration (Windows Machine)
- [ ] MT5 terminal installed
- [ ] MikapediaReporter.mq5 compiled
- [ ] EA configured with correct credentials
- [ ] EA sending data to `/api/mt5/ea-report/`

### TradingView Integration
- [ ] Webhook URL configured: `https://yourdomain.com/api/signals/webhook/`
- [ ] Webhook secret matches backend `.env`
- [ ] Test signal sent successfully

---

## 🚨 Rollback Plan

If deployment fails:

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Restore from backup (if exists)
gunzip < /opt/backups/mikapedia/db_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i $(docker compose -f docker-compose.prod.yml ps -q db) \
  psql -U mikapedia -d mikapedia_toms

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

---

## 📞 Support

If stuck, check:
- [DEPLOY-TROUBLESHOOT.md](DEPLOY-TROUBLESHOOT.md) - Comprehensive troubleshooting
- [VPS-COMMANDS.md](VPS-COMMANDS.md) - Useful commands
- `./health-check.sh` - Run health diagnostics
- `./debug-frontend.sh` - Frontend-specific diagnostics

---

**Deployment Date:** ___________  
**Deployed By:** ___________  
**Domain:** ___________  
**VPS IP:** ___________
