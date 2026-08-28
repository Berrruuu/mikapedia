import sqlite3
from pathlib import Path
import os

root = Path(__file__).resolve().parents[1]
backend = root / 'backend'
for path in [root / 'db.sqlite3', backend / 'db.sqlite3']:
    print('---', path)
    print('exists', path.exists())
    if not path.exists():
        continue
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    rows = cur.fetchall()
    print('tables', [r[0] for r in rows])
    try:
        cur.execute('SELECT COUNT(*) FROM integration_receipts')
        print('integration_receipts count', cur.fetchone()[0])
    except Exception as e:
        print('integration_receipts error', e)
    cur.close()
    con.close()
print('cwd', os.getcwd())
