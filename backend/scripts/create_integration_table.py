import sqlite3
p = r'c:\Users\HP\Downloads\mika-ops-hub-main-live-chart (1)\mika-ops-hub-main\\backend\\db.sqlite3'
con = sqlite3.connect(p)
cur = con.cursor()
cur.execute('''
CREATE TABLE IF NOT EXISTS integration_receipts (
    id integer PRIMARY KEY AUTOINCREMENT,
    source varchar(100) NOT NULL,
    event_id varchar(200),
    payload text,
    received_at datetime,
    processed boolean DEFAULT 0,
    processed_at datetime
);
''')
try:
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS integration_unique_source_event ON integration_receipts(source,event_id);")
except Exception:
    pass
con.commit()
cur.close()
con.close()
print('created table integration_receipts (if not exists)')
