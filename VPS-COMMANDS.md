# 📋 VPS Management Commands Cheat Sheet

## 🐳 Docker Commands

### View All Containers
```bash
docker compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs

# Specific service
docker compose -f docker-compose.prod.yml logs frontend
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs nginx

# Follow logs (real-time)
docker compose -f docker-compose.prod.yml logs -f frontend

# Last N lines
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

### Restart Services
```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart frontend
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart nginx
```

### Stop/Start Services
```bash
# Stop all
docker compose -f docker-compose.prod.yml stop

# Stop specific
docker compose -f docker-compose.prod.yml stop frontend

# Start all
docker compose -f docker-compose.prod.yml up -d

# Start specific
docker compose -f docker-compose.prod.yml up -d frontend
```

### Rebuild Services
```bash
# Rebuild without cache
docker compose -f docker-compose.prod.yml build --no-cache frontend

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### Execute Commands Inside Container
```bash
# Get shell access
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q frontend) sh

# Run single command
docker exec $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py migrate
docker exec $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py createsuperuser
```

### View Resource Usage
```bash
docker stats
```

### Clean Up
```bash
# Remove stopped containers
docker compose -f docker-compose.prod.yml down

# Remove with volumes (⚠️ DANGER: deletes database)
docker compose -f docker-compose.prod.yml down -v

# Remove unused images
docker image prune -a

# Remove everything unused
docker system prune -a
```

---

## 🔍 Debugging Commands

### Check Port Usage
```bash
# Check what's using port 3000
sudo lsof -i :3000
ss -tulpn | grep 3000

# Check what's using port 80/443
sudo lsof -i :80
sudo lsof -i :443
```

### Test Network Connectivity
```bash
# From nginx to backend
docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx) wget -q -O- http://backend:8000/api/v1/auth/status

# From nginx to frontend
docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx) wget -q -O- http://frontend:3000

# From outside
curl http://localhost:80
curl https://mikapedia.online/
```

### Check Container Health
```bash
# View health status
docker compose -f docker-compose.prod.yml ps

# Inspect specific container
docker inspect $(docker compose -f docker-compose.prod.yml ps -q frontend)
```

### View Container Filesystem
```bash
# List files in container
docker exec $(docker compose -f docker-compose.prod.yml ps -q frontend) ls -la /app/dist/

# View file content
docker exec $(docker compose -f docker-compose.prod.yml ps -q frontend) cat /app/dist/server/index.js

# Check environment variables
docker exec $(docker compose -f docker-compose.prod.yml ps -q frontend) env
```

---

## 🔄 Update & Deploy

### Full Deployment Flow
```bash
# 1. Pull latest code
git pull

# 2. Stop all services
docker compose -f docker-compose.prod.yml down

# 3. Rebuild all
docker compose -f docker-compose.prod.yml build --no-cache

# 4. Start all
docker compose -f docker-compose.prod.yml up -d

# 5. View logs
docker compose -f docker-compose.prod.yml logs -f
```

### Quick Update (no rebuild)
```bash
git pull
docker compose -f docker-compose.prod.yml restart
```

### Update Backend Only
```bash
git pull
docker compose -f docker-compose.prod.yml build --no-cache backend celery-worker celery-beat
docker compose -f docker-compose.prod.yml up -d backend celery-worker celery-beat
```

### Update Frontend Only
```bash
git pull
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

---

## 🗄️ Database Commands

### Backup Database
```bash
# Create backup
docker exec $(docker compose -f docker-compose.prod.yml ps -q db) pg_dump -U mikapedia mikapedia_toms > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql
```

### Restore Database
```bash
# Stop backend first
docker compose -f docker-compose.prod.yml stop backend celery-worker celery-beat

# Restore
cat backup.sql | docker exec -i $(docker compose -f docker-compose.prod.yml ps -q db) psql -U mikapedia -d mikapedia_toms

# Start backend
docker compose -f docker-compose.prod.yml up -d backend celery-worker celery-beat
```

### Run Migrations
```bash
docker exec $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py migrate
```

### Create Superuser
```bash
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py createsuperuser
```

### Django Shell
```bash
docker exec -it $(docker compose -f docker-compose.prod.yml ps -q backend) python manage.py shell
```

---

## 📊 Monitoring

### View All Logs Since Start
```bash
docker compose -f docker-compose.prod.yml logs --since 1h
docker compose -f docker-compose.prod.yml logs --since 2024-01-01T00:00:00
```

### Monitor Resource Usage
```bash
# All containers
docker stats

# Specific container
docker stats $(docker compose -f docker-compose.prod.yml ps -q frontend)
```

### Check Disk Usage
```bash
# Docker disk usage
docker system df

# VPS disk usage
df -h

# Check specific directories
du -sh /var/lib/docker
```

### Check Memory
```bash
free -h
```

---

## 🔐 SSL Certificate (Let's Encrypt)

### Renew Certificate
```bash
# Stop nginx
docker compose -f docker-compose.prod.yml stop nginx

# Renew
sudo certbot renew

# Start nginx
docker compose -f docker-compose.prod.yml up -d nginx
```

### Check Certificate Expiry
```bash
sudo certbot certificates
```

---

## 🧹 Maintenance

### Clean Docker
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

### Rotate Logs
```bash
# View log sizes
docker compose -f docker-compose.prod.yml logs --tail=0 | wc -l

# Clear logs (careful!)
docker compose -f docker-compose.prod.yml logs > /dev/null
```

---

## 🚨 Emergency Commands

### Stop Everything
```bash
docker compose -f docker-compose.prod.yml stop
```

### Kill Everything
```bash
docker compose -f docker-compose.prod.yml kill
```

### Remove Everything (⚠️ DANGER)
```bash
docker compose -f docker-compose.prod.yml down -v
```

### Restart VPS
```bash
sudo reboot
```

---

## 📝 Useful Aliases (add to ~/.bashrc)

```bash
alias dc='docker compose -f docker-compose.prod.yml'
alias dcup='docker compose -f docker-compose.prod.yml up -d'
alias dcdown='docker compose -f docker-compose.prod.yml down'
alias dcps='docker compose -f docker-compose.prod.yml ps'
alias dclogs='docker compose -f docker-compose.prod.yml logs -f'
alias dcrestart='docker compose -f docker-compose.prod.yml restart'
alias dcbuild='docker compose -f docker-compose.prod.yml build --no-cache'
```

Then run:
```bash
source ~/.bashrc
```

Now you can use:
```bash
dcps           # View containers
dclogs         # View logs
dcrestart      # Restart all
```
