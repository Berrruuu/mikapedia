# 🚀 Quick Deploy Cheatsheet - MIKAPEDIA TOMS

Command-command penting untuk deployment dan maintenance.

---

## 📦 Docker Compose Commands

```bash
# Navigate to project directory
cd /var/www/mika-ops-hub

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart frontend
docker compose -f docker-compose.prod.yml restart nginx

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Check status
docker compose -f docker-compose.prod.yml ps

# Remove everything (including volumes)
docker compose -f docker-compose.prod.yml down -v
```

---

## 🔄 Update & Redeploy

```bash
# Method 1: Full rebuild
cd /var/www/mika-ops-hub
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Method 2: Zero-downtime update (backend only)
git pull origin main
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --no-deps backend
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Method 3: Using quick script
./deploy-quick.sh
# Choose option 2 (Update & redeploy)
```

---

## 💾 Database Commands

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Create migrations (if you changed models)
docker compose -f docker-compose.prod.yml exec backend python manage.py makemigrations

# Django shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell

# Database shell (PostgreSQL)
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms

# Backup database
docker compose -f docker-compose.prod.yml exec db pg_dump -U mikapedia mikapedia_toms > backup_$(date +%Y%m%d).sql

# Restore database
docker compose -f docker-compose.prod.yml exec -T db psql -U mikapedia mikapedia_toms < backup.sql

# Reset database (DANGER!)
docker compose -f docker-compose.prod.yml exec db psql -U mikapedia -d mikapedia_toms -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

---

## 👤 User Management

```bash
# Create superuser
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# Create owner via shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User
owner = User.objects.create(
    username='owner@mikapedia.com',
    email='owner@mikapedia.com',
    first_name='Owner',
    last_name='Admin',
    role='owner',
    status='active',
    is_staff=True,
    is_superuser=True
)
owner.set_password('StrongPassword123!')
owner.save()
exit()
```

```bash
# Reset user password
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User
user = User.objects.get(email='user@example.com')
user.set_password('NewPassword123!')
user.save()
exit()
```

---

## 🔍 Debugging & Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View last 100 lines of backend logs
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# Follow specific service logs
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f db
docker compose -f docker-compose.prod.yml logs -f redis

# Check container status
docker compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats

# Inspect container
docker inspect mika-ops-hub-backend-1

# Execute command in container
docker compose -f docker-compose.prod.yml exec backend bash
docker compose -f docker-compose.prod.yml exec db bash
```

---

## 🌐 Nginx & SSL

```bash
# Test nginx config
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx

# Get SSL certificate (if not done yet)
sudo certbot certonly --standalone \
  -d mikapedia.online \
  -d www.mikapedia.online \
  --email your-email@example.com \
  --agree-tos

# Renew SSL certificate
sudo certbot renew

# Test SSL renewal
sudo certbot renew --dry-run

# Check certificate expiry
sudo certbot certificates
```

---

## 🧹 Cleanup & Maintenance

```bash
# Remove unused Docker images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove all unused data
docker system prune -a --volumes

# Clear Docker build cache
docker builder prune -a

# Check disk usage
df -h
docker system df -v

# Clean old logs (if getting too large)
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

---

## 📊 Monitoring

```bash
# Check service health
docker compose -f docker-compose.prod.yml ps

# Monitor resource usage
htop
docker stats

# Check disk space
df -h
du -sh /var/lib/docker
du -sh /var/www/mika-ops-hub

# Check memory
free -h

# Check open ports
sudo netstat -tulpn | grep LISTEN
sudo ss -tulpn | grep LISTEN

# Test website
curl -I https://mikapedia.online
curl https://mikapedia.online/api/health/
```

---

## 🔒 Security

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Check firewall status
sudo ufw status

# Enable firewall
sudo ufw enable

# Allow ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# Check SSH config
sudo nano /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart sshd

# Check fail2ban status
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

---

## 🔧 Git Commands

```bash
# Pull latest changes
cd /var/www/mika-ops-hub
git pull origin main

# Check status
git status

# View commit history
git log --oneline -10

# Reset to specific commit (DANGER!)
git reset --hard COMMIT_HASH

# Discard local changes
git reset --hard HEAD
git clean -fd
```

---

## 🚨 Emergency Commands

```bash
# Service not responding - restart
docker compose -f docker-compose.prod.yml restart backend

# Service crashed - check logs and restart
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker compose -f docker-compose.prod.yml restart backend

# 502 Bad Gateway
docker compose -f docker-compose.prod.yml restart backend nginx

# Database connection issues
docker compose -f docker-compose.prod.yml restart db backend

# Out of memory - restart everything
docker compose -f docker-compose.prod.yml restart

# Complete restart (if nothing works)
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Nuclear option (rebuild everything)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

---

## 📱 Quick Scripts

### Make deploy script executable

```bash
chmod +x deploy-quick.sh
```

### Run quick deploy menu

```bash
./deploy-quick.sh
```

### One-liner complete update

```bash
cd /var/www/mika-ops-hub && \
git pull && \
docker compose -f docker-compose.prod.yml down && \
docker compose -f docker-compose.prod.yml build --no-cache && \
docker compose -f docker-compose.prod.yml up -d && \
sleep 10 && \
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate && \
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput && \
echo "✓ Update completed!"
```

---

## 💡 Tips

1. **Always backup before major updates**
   ```bash
   ./deploy-quick.sh  # Choose option 8
   ```

2. **Check logs if something fails**
   ```bash
   docker compose -f docker-compose.prod.yml logs -f backend
   ```

3. **Monitor resource usage regularly**
   ```bash
   htop
   docker stats
   df -h
   ```

4. **Keep SSL certificates renewed**
   ```bash
   sudo certbot renew
   ```

5. **Update system regularly**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## 📞 Support

- Check logs first: `docker compose -f docker-compose.prod.yml logs -f`
- Verify services: `docker compose -f docker-compose.prod.yml ps`
- Test website: `curl -I https://mikapedia.online`
- Review full guide: `DEPLOY-VPS-GUIDE.md`

---

**Last Updated**: September 2026
