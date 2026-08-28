import os
import sqlite3
from pathlib import Path

print('cwd:', os.getcwd())
print('root exists:', Path('db.sqlite3').exists(), Path('db.sqlite3').resolve())
print('backend exists:', Path('backend/db.sqlite3').exists(), Path('backend/db.sqlite3').resolve())

for p in [Path('db.sqlite3'), Path('backend/db.sqlite3')]:
    print('===', p)
    if not p.exists():
        continue
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='django_migrations';")
        print('django_migrations table:', cur.fetchone())
        cur.execute("SELECT name, applied FROM django_migrations WHERE app='attendance' ORDER BY applied")
        rows = cur.fetchall()
        print('attendance migrations count:', len(rows))
        for row in rows:
            print(row)
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance_schedules';")
        print('attendance_schedules table:', cur.fetchone())
        cur.execute('PRAGMA table_info(attendance_schedules)')
        cols = [r[1] for r in cur.fetchall()]
        print('columns:', cols)
    except Exception as e:
        print('error reading', e)
    finally:
        conn.close()

try:
    from decouple import config
    print('DB_NAME from decouple:', config('DB_NAME', default='not-set'))
except Exception as e:
    print('decouple error', e)
