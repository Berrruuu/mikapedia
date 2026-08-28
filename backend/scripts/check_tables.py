import sqlite3
p = r'c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\\backend\\db.sqlite3'
con = sqlite3.connect(p)
cur = con.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
rows = cur.fetchall()
print('tables:')
for r in rows:
    print(' -', r[0])
try:
    cur.execute('SELECT COUNT(*) FROM integration_receipts')
    print('integration_receipts count:', cur.fetchone()[0])
except Exception as e:
    print('integration_receipts error:', e)
cur.close()
con.close()
