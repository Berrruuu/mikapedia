import os
import sqlite3
from pathlib import Path

backend_dir = Path(__file__).parent
path = backend_dir / 'db.sqlite3'
print('db path exists:', path.exists(), path)
conn = sqlite3.connect(path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='django_migrations';")
print('django_migrations table:', cur.fetchone())
cur.execute("SELECT name, applied FROM django_migrations WHERE app='attendance' ORDER BY applied;")
rows = cur.fetchall()
print('attendance migrations count:', len(rows))
for row in rows:
    print(row)
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance_schedules';")
print('attendance_schedules table:', cur.fetchone())
cur.execute('PRAGMA table_info(attendance_schedules)')
cols = [row[1] for row in cur.fetchall()]
print('columns:', cols)
conn.close()
