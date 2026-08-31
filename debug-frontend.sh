#!/bin/bash
# Debug script untuk troubleshoot frontend container yang restart

echo "==== FRONTEND CONTAINER DEBUG ===="
echo ""

echo "1. Container logs (last 50 lines):"
docker compose -f docker-compose.prod.yml logs --tail=50 frontend
echo ""

echo "2. Container status:"
docker compose -f docker-compose.prod.yml ps frontend
echo ""

echo "3. Inspect container (if running):"
FRONTEND_ID=$(docker compose -f docker-compose.prod.yml ps -q frontend)
if [ -n "$FRONTEND_ID" ]; then
  echo "   - Checking if port 3000 is listening inside container..."
  docker exec $FRONTEND_ID netstat -tuln 2>/dev/null || echo "   (netstat not available)"
  
  echo "   - Checking processes inside container..."
  docker exec $FRONTEND_ID ps aux
  
  echo "   - Checking dist directory structure..."
  docker exec $FRONTEND_ID ls -la dist/ 2>/dev/null || echo "   dist/ not found"
  docker exec $FRONTEND_ID ls -la dist/server/ 2>/dev/null || echo "   dist/server/ not found"
else
  echo "   Container is not running!"
fi
echo ""

echo "4. Network connectivity test:"
echo "   - Testing backend connection from nginx..."
NGINX_ID=$(docker compose -f docker-compose.prod.yml ps -q nginx)
if [ -n "$NGINX_ID" ]; then
  docker exec $NGINX_ID wget -q -O- http://backend:8000/api/v1/auth/status || echo "   Backend unreachable from nginx"
  docker exec $NGINX_ID wget -q -O- http://frontend:3000 || echo "   Frontend unreachable from nginx (THIS IS THE PROBLEM)"
fi
echo ""

echo "5. Docker compose service status:"
docker compose -f docker-compose.prod.yml ps
