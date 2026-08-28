import os
import sqlite3

path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')
print('db path exists:', os.path.exists(path), path)
conn = sqlite3.connect(path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance_schedules';")
print('attendance_schedules table:', cur.fetchone())
cur.execute('PRAGMA table_info(attendance_schedules)')
cols = [row[1] for row in cur.fetchall()]
print('columns:', cols)
conn.close()
