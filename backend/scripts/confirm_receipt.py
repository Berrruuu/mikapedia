import os
import django
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
os.chdir(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from integration.models import IntegrationReceipt

print('DB path:', os.path.abspath('db.sqlite3'))
print('count:', IntegrationReceipt.objects.count())
for rec in IntegrationReceipt.objects.all():
    print(rec.id, rec.source, rec.event_id, rec.processed, rec.received_at)
