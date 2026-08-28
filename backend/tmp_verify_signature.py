import os
import json
import hashlib
import hmac
import time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.test.client import RequestFactory
from django.conf import settings
from signals.webhook_utils import verify_signature
from signals.views import tradingview_webhook

payload = {
    'symbol': 'OANDA:XAUUSD',
    'pair': 'XAUUSD',
    'direction': 'BUY',
    'fib_entry': 0.5,
    'take_profit': 2412.4,
    'stop_loss': 2394.2,
    'max_entry_minutes': 10,
    'expiry_minutes': 60,
}
body = json.dumps(payload).encode('utf-8')
secret = settings.TRADINGVIEW_WEBHOOK_SECRET
sig = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
print('secret=', repr(secret))
print('sig=', sig)
rf = RequestFactory()
req = rf.post('/api/signals/webhook/', data=body, content_type='application/json', HTTP_X_SIGNATURE=sig, HTTP_X_TIMESTAMP=str(int(time.time())))
print('verify_signature=', verify_signature(req))
res = tradingview_webhook(req)
print('response_status=', res.status_code)
try:
    print('response_data=', res.data)
except Exception:
    print('response_content=', getattr(res, 'content', None))
