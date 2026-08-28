import sqlite3
p = r'c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\\backend\\db.sqlite3'
con = sqlite3.connect(p)
cur = con.cursor()
try:
    cur.execute('SELECT id, action, category, severity, metadata, created_at FROM audit_logs ORDER BY id DESC LIMIT 20')
    rows = cur.fetchall()
    for r in rows:
        print(r)
except Exception as e:
    print('error', e)
cur.close()
con.close()
