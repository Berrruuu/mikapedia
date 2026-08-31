#!/bin/bash
# Test EA Endpoint Manually

echo "Testing EA endpoint..."
echo ""

# Get token from .env
TOKEN=$(grep EA_INTEGRATION_TOKEN backend/.env | cut -d'=' -f2)

if [ -z "$TOKEN" ]; then
  echo "❌ EA_INTEGRATION_TOKEN not found in backend/.env"
  exit 1
fi

echo "Token: ${TOKEN:0:20}..."
echo ""

# Test payload (minimal)
PAYLOAD='{
  "token": "'$TOKEN'",
  "login": 7724091,
  "server": "ICMarkets-Live01",
  "broker": "IC Markets",
  "balance": 5000.00,
  "equity": 4950.00,
  "floating_pnl": -50.00,
  "positions": [],
  "pending_orders": [],
  "deals": []
}'

echo "Testing: https://mikapedia.online/api/v1/mt5/ea-report/"
curl -X POST "https://mikapedia.online/api/v1/mt5/ea-report/" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "─────────────────────────────────────────"
echo ""

echo "Testing (legacy): https://mikapedia.online/api/mt5/ea-report/"
curl -X POST "https://mikapedia.online/api/mt5/ea-report/" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "Done!"
