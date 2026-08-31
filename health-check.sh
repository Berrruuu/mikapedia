#!/bin/bash
# MIKAPEDIA TOMS - Health Check Script
# Verifikasi semua services berjalan dengan baik

echo "======================================"
echo "  MIKAPEDIA TOMS - Health Check"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# ──────────────────────────────────────────────────────────────────────────────
echo "1. Checking Docker Containers..."
echo "──────────────────────────────────────────────────────────────────────────────"

if ! command -v docker &> /dev/null; then
    check_fail "Docker not installed"
else
    check_pass "Docker installed"
    
    # Check containers
    CONTAINERS=("db" "redis" "backend" "frontend" "nginx" "celery-worker" "celery-beat")
    for container in "${CONTAINERS[@]}"; do
        STATUS=$(docker compose -f docker-compose.prod.yml ps -q "$container" 2>/dev/null)
        if [ -z "$STATUS" ]; then
            check_fail "Container $container: Not found"
        else
            RUNNING=$(docker inspect -f '{{.State.Running}}' "$STATUS" 2>/dev/null)
            if [ "$RUNNING" == "true" ]; then
                HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$STATUS" 2>/dev/null)
                if [ "$HEALTH" == "healthy" ] || [ "$HEALTH" == "" ]; then
                    check_pass "Container $container: Running"
                elif [ "$HEALTH" == "starting" ]; then
                    check_warn "Container $container: Starting..."
                else
                    check_fail "Container $container: Unhealthy ($HEALTH)"
                fi
            else
                check_fail "Container $container: Stopped"
            fi
        fi
    done
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "2. Checking Network Connectivity..."
echo "──────────────────────────────────────────────────────────────────────────────"

# Backend health
BACKEND_HEALTH=$(docker exec $(docker compose -f docker-compose.prod.yml ps -q backend 2>/dev/null) wget -q -O- http://localhost:8000/api/v1/auth/status 2>/dev/null)
if [ -n "$BACKEND_HEALTH" ]; then
    check_pass "Backend API: Responding"
else
    check_fail "Backend API: Not responding"
fi

# Frontend health
FRONTEND_HEALTH=$(docker exec $(docker compose -f docker-compose.prod.yml ps -q nginx 2>/dev/null) wget -q -O- http://frontend:3000 2>/dev/null | head -c 50)
if [ -n "$FRONTEND_HEALTH" ]; then
    check_pass "Frontend: Responding"
else
    check_fail "Frontend: Not responding"
fi

# Nginx health
if curl -f -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null | grep -q "301\|302\|200"; then
    check_pass "Nginx: Responding on port 80"
else
    check_fail "Nginx: Not responding on port 80"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "3. Checking Database..."
echo "──────────────────────────────────────────────────────────────────────────────"

DB_CHECK=$(docker exec $(docker compose -f docker-compose.prod.yml ps -q db 2>/dev/null) pg_isready -U mikapedia 2>/dev/null)
if echo "$DB_CHECK" | grep -q "accepting connections"; then
    check_pass "PostgreSQL: Accepting connections"
else
    check_fail "PostgreSQL: Not accepting connections"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "4. Checking Redis..."
echo "──────────────────────────────────────────────────────────────────────────────"

REDIS_CHECK=$(docker exec $(docker compose -f docker-compose.prod.yml ps -q redis 2>/dev/null) redis-cli ping 2>/dev/null)
if [ "$REDIS_CHECK" == "PONG" ]; then
    check_pass "Redis: Responding"
else
    check_fail "Redis: Not responding"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "5. Checking Logs for Errors..."
echo "──────────────────────────────────────────────────────────────────────────────"

# Frontend errors
FRONTEND_ERRORS=$(docker compose -f docker-compose.prod.yml logs --tail=50 frontend 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
if [ "$FRONTEND_ERRORS" -eq 0 ]; then
    check_pass "Frontend logs: No recent errors"
elif [ "$FRONTEND_ERRORS" -lt 5 ]; then
    check_warn "Frontend logs: $FRONTEND_ERRORS errors found"
else
    check_fail "Frontend logs: $FRONTEND_ERRORS errors found"
fi

# Backend errors
BACKEND_ERRORS=$(docker compose -f docker-compose.prod.yml logs --tail=50 backend 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
if [ "$BACKEND_ERRORS" -eq 0 ]; then
    check_pass "Backend logs: No recent errors"
elif [ "$BACKEND_ERRORS" -lt 5 ]; then
    check_warn "Backend logs: $BACKEND_ERRORS errors found"
else
    check_fail "Backend logs: $BACKEND_ERRORS errors found"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "6. Checking Disk Space..."
echo "──────────────────────────────────────────────────────────────────────────────"

DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage: ${DISK_USAGE}% (healthy)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    check_warn "Disk usage: ${DISK_USAGE}% (monitor closely)"
else
    check_fail "Disk usage: ${DISK_USAGE}% (critical)"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "7. Checking Memory..."
echo "──────────────────────────────────────────────────────────────────────────────"

if command -v free &> /dev/null; then
    MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
    MEM_TOTAL=$(free -m | awk 'NR==2 {print $2}')
    MEM_PERCENT=$((100 - (MEM_AVAILABLE * 100 / MEM_TOTAL)))
    
    if [ "$MEM_PERCENT" -lt 80 ]; then
        check_pass "Memory usage: ${MEM_PERCENT}% (healthy)"
    elif [ "$MEM_PERCENT" -lt 90 ]; then
        check_warn "Memory usage: ${MEM_PERCENT}% (monitor closely)"
    else
        check_fail "Memory usage: ${MEM_PERCENT}% (critical)"
    fi
else
    check_warn "Memory check: free command not available"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "8. Checking SSL Certificate..."
echo "──────────────────────────────────────────────────────────────────────────────"

if [ -f "/etc/letsencrypt/live/mikapedia.online/fullchain.pem" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/mikapedia.online/fullchain.pem 2>/dev/null | cut -d= -f2)
    if [ -n "$CERT_EXPIRY" ]; then
        EXPIRY_DATE=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null)
        CURRENT_DATE=$(date +%s)
        DAYS_LEFT=$(( ($EXPIRY_DATE - $CURRENT_DATE) / 86400 ))
        
        if [ "$DAYS_LEFT" -gt 30 ]; then
            check_pass "SSL Certificate: Valid ($DAYS_LEFT days left)"
        elif [ "$DAYS_LEFT" -gt 7 ]; then
            check_warn "SSL Certificate: Expiring soon ($DAYS_LEFT days left)"
        else
            check_fail "SSL Certificate: Expiring very soon ($DAYS_LEFT days left)"
        fi
    else
        check_warn "SSL Certificate: Cannot read expiry date"
    fi
else
    check_warn "SSL Certificate: Not found (using self-signed?)"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "9. Checking External Access..."
echo "──────────────────────────────────────────────────────────────────────────────"

# Check if domain is accessible
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://mikapedia.online 2>/dev/null)
    if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
        check_pass "Website accessible (HTTP $HTTP_CODE)"
    else
        check_fail "Website not accessible (HTTP $HTTP_CODE)"
    fi
else
    check_warn "curl not installed, skipping external access check"
fi

echo ""
echo "======================================"
echo "  Summary"
echo "======================================"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All systems operational!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ System operational with warnings${NC}"
    exit 0
else
    echo -e "${RED}✗ System has errors - please investigate${NC}"
    echo ""
    echo "Quick commands to investigate:"
    echo "  docker compose -f docker-compose.prod.yml ps"
    echo "  docker compose -f docker-compose.prod.yml logs -f"
    echo "  ./debug-frontend.sh"
    exit 1
fi
