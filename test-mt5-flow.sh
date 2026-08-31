#!/bin/bash
# Complete MT5 Flow Test Script
# Usage: ./test-mt5-flow.sh <email> <password> <mt5_login> <mt5_password> <mt5_server>

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     MIKAPEDIA TOMS - Complete MT5 Flow Test               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Usage: $0 <email> <password> [mt5_login] [mt5_password] [mt5_server]"
  echo ""
  echo "Examples:"
  echo "  # Test existing account only"
  echo "  $0 trader@test.com mypassword"
  echo ""
  echo "  # Test + save new credentials"
  echo "  $0 trader@test.com mypassword 7724091 mt5pass ICMarkets-Live01"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"
MT5_LOGIN="${3:-}"
MT5_PASSWORD="${4:-}"
MT5_SERVER="${5:-}"
BASE_URL="https://mikapedia.online/api"

echo "═══════════════════════════════════════════════════════════"
echo "STEP 1: Login Authentication"
echo "═══════════════════════════════════════════════════════════"
echo "→ Email: $EMAIL"
echo ""

LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/auth/login/" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$LOGIN_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ Login FAILED! HTTP $HTTP_STATUS"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi

TOKEN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['access'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ No access token in response!"
  echo "$BODY"
  exit 1
fi

echo "✅ Login successful"
echo "   Token: ${TOKEN:0:30}..."
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "STEP 2: Check Existing MT5 Account"
echo "═══════════════════════════════════════════════════════════"
echo ""

MT5_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/v1/mt5/me/" \
  -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$MT5_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$MT5_RESPONSE" | sed '/HTTP_STATUS/d')

echo "→ HTTP Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ MT5 Account Found!"
  echo ""
  echo "$BODY" | python3 -m json.tool
  
  # Extract key values
  ACCOUNT_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', 'N/A'))" 2>/dev/null)
  ACCOUNT_LOGIN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('login', 'N/A'))" 2>/dev/null)
  ACCOUNT_STATUS=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'N/A'))" 2>/dev/null)
  ACCOUNT_BALANCE=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('balance', 'N/A'))" 2>/dev/null)
  ACCOUNT_EQUITY=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('equity', 'N/A'))" 2>/dev/null)
  OPEN_POSITIONS=$(echo "$BODY" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('positions', [])))" 2>/dev/null)
  
  echo ""
  echo "──────────────────────────────────────────────────────────"
  echo "📊 Account Summary:"
  echo "──────────────────────────────────────────────────────────"
  echo "   ID:         $ACCOUNT_ID"
  echo "   Login:      $ACCOUNT_LOGIN"
  echo "   Status:     $ACCOUNT_STATUS"
  echo "   Balance:    \$$ACCOUNT_BALANCE"
  echo "   Equity:     \$$ACCOUNT_EQUITY"
  echo "   Positions:  $OPEN_POSITIONS"
  echo ""
  
  # Compare with MT5 real account if provided
  if [ ! -z "$MT5_LOGIN" ]; then
    echo "──────────────────────────────────────────────────────────"
    echo "⚖️  Comparison with Your MT5:"
    echo "──────────────────────────────────────────────────────────"
    echo "   Website Login: $ACCOUNT_LOGIN"
    echo "   Your MT5 Login: $MT5_LOGIN"
    
    if [ "$ACCOUNT_LOGIN" = "$MT5_LOGIN" ]; then
      echo "   ✅ LOGIN MATCH!"
    else
      echo "   ❌ LOGIN MISMATCH!"
      echo ""
      echo "   ⚠️  Website showing different account!"
      echo "   → Kemungkinan:"
      echo "      1. MT5 credentials belum disave di website"
      echo "      2. User login sebagai user lain"
      echo "      3. Database has old data"
    fi
    echo ""
  fi
  
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "⚠️  No MT5 Account Found (404)"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  echo ""
  
  if [ ! -z "$MT5_LOGIN" ]; then
    echo "→ Will try to save credentials in STEP 3..."
  else
    echo "ℹ️  To save MT5 credentials, run:"
    echo "   $0 $EMAIL <password> <mt5_login> <mt5_password> <mt5_server>"
  fi
  echo ""
else
  echo "❌ Unexpected Response!"
  echo ""
  echo "Response:"
  echo "$BODY"
  echo ""
fi

# STEP 3: Save Credentials (if provided)
if [ ! -z "$MT5_LOGIN" ] && [ ! -z "$MT5_PASSWORD" ] && [ ! -z "$MT5_SERVER" ]; then
  echo "═══════════════════════════════════════════════════════════"
  echo "STEP 3: Save MT5 Credentials"
  echo "═══════════════════════════════════════════════════════════"
  echo "→ Login: $MT5_LOGIN"
  echo "→ Server: $MT5_SERVER"
  echo ""
  
  SAVE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/v1/mt5/credentials/" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"login\":$MT5_LOGIN,\"password\":\"$MT5_PASSWORD\",\"server\":\"$MT5_SERVER\",\"broker\":\"\"}")
  
  HTTP_STATUS=$(echo "$SAVE_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  BODY=$(echo "$SAVE_RESPONSE" | sed '/HTTP_STATUS/d')
  
  echo "→ HTTP Status: $HTTP_STATUS"
  echo ""
  
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ Credentials Saved Successfully!"
    echo ""
    echo "$BODY" | python3 -m json.tool
    
    # Extract new account data
    NEW_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', 'N/A'))" 2>/dev/null)
    NEW_LOGIN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('login', 'N/A'))" 2>/dev/null)
    NEW_STATUS=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'N/A'))" 2>/dev/null)
    NEW_BALANCE=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('balance', 'N/A'))" 2>/dev/null)
    
    echo ""
    echo "──────────────────────────────────────────────────────────"
    echo "📊 New Account:"
    echo "──────────────────────────────────────────────────────────"
    echo "   ID:      $NEW_ID"
    echo "   Login:   $NEW_LOGIN"
    echo "   Status:  $NEW_STATUS"
    echo "   Balance: \$$NEW_BALANCE"
    echo ""
  else
    echo "❌ Failed to Save Credentials!"
    echo ""
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
  fi
fi

echo "═══════════════════════════════════════════════════════════"
echo "STEP 4: Backend Environment Check"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "→ Checking MT5_USE_SIMULATION..."
MT5_SIM=$(docker compose -f docker-compose.prod.yml exec -T backend sh -c 'echo $MT5_USE_SIMULATION' 2>/dev/null || echo "N/A")
echo "   MT5_USE_SIMULATION: $MT5_SIM"

if [ "$MT5_SIM" = "True" ] || [ "$MT5_SIM" = "true" ]; then
  echo "   ℹ️  Simulation mode ENABLED"
  echo "   → Backend will return simulated data"
  echo "   → For real data, install EA on Windows MT5"
else
  echo "   ⚠️  Simulation mode disabled or N/A"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "STEP 5: Database Check"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "→ Querying mt5_accounts table..."
docker compose -f docker-compose.prod.yml exec -T db psql -U mikapedia -d mikapedia_toms << 'EOF'
\x on
SELECT 
  m.id,
  u.email as user_email,
  m.login,
  m.server,
  m.status,
  m.balance,
  m.equity,
  m.floating_pnl,
  m.open_positions,
  m.last_sync,
  m.error_message
FROM mt5_accounts m
LEFT JOIN users_user u ON m.user_id = u.id
ORDER BY m.id DESC
LIMIT 3;
EOF

echo ""

echo "═══════════════════════════════════════════════════════════"
echo "STEP 6: Recent Backend Logs"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "→ Last 20 MT5-related log lines:"
docker compose -f docker-compose.prod.yml logs backend --tail=100 | grep -i "mt5" | tail -20 || echo "   (no MT5 logs found)"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 Summary:"
echo "   1. Login: $([ "$HTTP_STATUS" = "200" ] && echo "✅ OK" || echo "❌ FAILED")"
echo "   2. MT5 Account: $([ ! -z "$ACCOUNT_ID" ] && echo "✅ Found (ID: $ACCOUNT_ID)" || echo "⚠️ Not found")"
echo "   3. Database: Check output above"
echo "   4. Backend: Check logs above"
echo ""

if [ ! -z "$ACCOUNT_LOGIN" ] && [ ! -z "$MT5_LOGIN" ] && [ "$ACCOUNT_LOGIN" != "$MT5_LOGIN" ]; then
  echo "⚠️  ⚠️  ⚠️  ACCOUNT MISMATCH DETECTED! ⚠️  ⚠️  ⚠️"
  echo ""
  echo "   Website Login: $ACCOUNT_LOGIN"
  echo "   Your MT5 Login: $MT5_LOGIN"
  echo ""
  echo "Possible causes:"
  echo "   1. User belum save MT5 credentials"
  echo "   2. User login sebagai user yang salah"
  echo "   3. Multiple users sharing same email"
  echo "   4. Database has stale data"
  echo ""
  echo "Next steps:"
  echo "   → Save correct credentials:"
  echo "     $0 $EMAIL <password> $MT5_LOGIN <mt5_password> $MT5_SERVER"
  echo ""
fi

echo "For detailed troubleshooting, see:"
echo "   - MT5-TROUBLESHOOT.md"
echo "   - CARA-HUBUNGKAN-MT5.md"
echo ""
