"""
Test script untuk kirim webhook ke backend.
Jalankan: python tmp_send_webhook.py

Ganti BASE_URL dengan URL ngrok kamu yang aktif.
Cara dapat URL ngrok: jalankan `ngrok http 8000` lalu copy URL-nya.
"""
import json
import hmac
import hashlib
import time
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ─── GANTI INI dengan URL ngrok kamu yang aktif ───────────────────────────────
BASE_URL = 'https://brim-drudge-deafening.ngrok-free.dev'
# ─────────────────────────────────────────────────────────────────────────────

secret = 'mikapedia-tv-secret-2026'

payload = {
    'secret': secret,
    'symbol': 'OANDA:XAUUSD',
    'pair': 'XAUUSD',
    'direction': 'BUY',
    'timeframe': '15',
    'strategy': 'Seacrate',
    # bar_time = waktu candle close dari TradingView (WIB)
    'bar_time': datetime.now().strftime('%Y-%m-%d %H:%M'),
    'fib_entry': 0.5,
    'fib_0236': 4010.5,
    'fib_0500': 4008.2,
    'fib_0618': 4006.8,
    'take_profit': 4020.0,
    'stop_loss': 4002.0,
    'max_entry_minutes': 5,   # 5 menit max entry
}

body = json.dumps(payload).encode('utf-8')
sig = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()

# Coba kedua URL path (v1 dan legacy)
urls_to_try = [
    f'{BASE_URL}/api/v1/signals/webhook/',
    f'{BASE_URL}/api/signals/webhook/',
]

headers = {
    'Content-Type': 'application/json',
    'X-Signature': sig,
    'X-Timestamp': str(int(time.time())),
    'ngrok-skip-browser-warning': '1',  # skip ngrok browser warning page
}

for url in urls_to_try:
    print(f'\n─── Testing: {url}')
    req = Request(url, data=body, headers=headers, method='POST')
    try:
        with urlopen(req, timeout=30) as resp:
            print(f'✅ STATUS {resp.status}')
            print(resp.read().decode('utf-8'))
            break  # stop on first success
    except HTTPError as e:
        print(f'❌ STATUS {e.code}')
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f'❌ ERROR: {e}')
