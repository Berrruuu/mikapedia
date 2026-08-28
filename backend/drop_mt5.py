from django.db import connection
c = connection.cursor()
for t in ['mt5_deals', 'mt5_orders', 'mt5_positions', 'mt5_accounts']:
    c.execute(f'DROP TABLE IF EXISTS {t}')
    print(f'Dropped {t}')
