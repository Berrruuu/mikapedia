#!/bin/bash

# MT5 Diagnostic Script
# Usage: ./diagnose-mt5.sh <email> <password>

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          MIKAPEDIA TOMS - MT5 Diagnostic Tool             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Usage: $0 <email> <password>"
  echo "   Example: $0 trader@test.com mypassword"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"
BASE_URL="https://mikapedia.online/api"

echo "🔐 Logging in as: $EMAIL"
echo ""

# Step 1: Login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login/" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "   Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Check MT5 account
echo "🔍 Checking MT5 account..."
echo ""

MT5_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/v1/mt5/me/" \
  -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$MT5_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$MT5_RESPONSE" | sed '/HTTP_STATUS/d')

echo "   HTTP Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ MT5 Account Found!"
  echo ""
  echo "$BODY" | python3 -m json.tool
  
  # Extract account details
  ACCOUNT_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | cut -d':' -f2)
  LOGIN=$(echo "$BODY" | grep -o '"login":[0-9]*' | cut -d':' -f2)
  STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  BALANCE=$(echo "$BODY" | grep -o '"balance":[0-9.]*' | cut -d':' -f2)
  
  echo ""
  echo "📊 Account Summary:"
  echo "   ID: $ACCOUNT_ID"
  echo "   Login: $LOGIN"
  echo "   Status: $STATUS"
  echo "   Balance: \$$BALANCE"
  
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "⚠️  No MT5 account found (this is normal before first save)"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool
  
else
  echo "❌ Unexpected response!"
  echo ""
  echo "Response:"
  echo "$BODY"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 3: Check backend logs
echo "📋 Recent backend logs (last 20 lines):"
echo ""
docker compose -f docker-compose.prod.yml logs backend --tail=20 | grep -i "mt5\|error\|exception" || echo "   (no MT5-related logs found)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 4: Check database
echo "🗄️  Database check:"
echo ""
docker compose -f docker-compose.prod.yml exec -T db psql -U mikapedia -d mikapedia_toms << EOF
SELECT 
  m.id,
  u.email,
  m.login,
  m.status,
  m.balance,
  m.equity,
  m.last_sync
FROM mt5_accounts m
LEFT JOIN users_user u ON m.user_id = u.id
ORDER BY m.id DESC
LIMIT 5;
EOF

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 5: Check environment
echo "🌍 Environment check:"
echo ""
docker compose -f docker-compose.prod.yml exec backend sh -c 'echo "MT5_USE_SIMULATION: $(printenv MT5_USE_SIMULATION)"'

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "✅ Diagnostic complete!"
echo ""
echo "Next steps:"
echo "  1. If 404 → Save MT5 credentials via website"
echo "  2. If status=error → Check error_message in database"
echo "  3. If no data → Check backend logs for Python exceptions"
echo "  4. Clear browser cache and reload page"
echo ""
