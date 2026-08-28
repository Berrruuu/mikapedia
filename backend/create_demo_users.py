from users.models import User

USERS = [
    {
        'email': 'admin@mikapedia.com', 'password': 'admin123',
        'first_name': 'Rania', 'last_name': 'Pratama',
        'role': 'admin', 'is_staff': True, 'is_superuser': True,
        'employee_id': 'EMP-001', 'department': 'Operations', 'position': 'Administrator',
    },
    {
        'email': 'trader@mikapedia.com', 'password': 'trader123',
        'first_name': 'Arif', 'last_name': 'Wibowo',
        'role': 'trader',
        'employee_id': 'EMP-002', 'department': 'Trading Desk', 'position': 'Senior Trader',
        'mt5_account_number': '279684672', 'mt5_broker_name': 'Exness',
        'mt5_broker_server': 'MT5Trial8',
    },
    {
        'email': 'dewi@mikapedia.com', 'password': 'trader123',
        'first_name': 'Dewi', 'last_name': 'Kartika',
        'role': 'trader',
        'employee_id': 'EMP-003', 'department': 'Trading Desk', 'position': 'Trader',
        'mt5_account_number': 'MT5-7724092', 'mt5_broker_name': 'ICMarkets',
        'mt5_broker_server': 'ICMarkets-Live01',
    },
]

for data in USERS:
    password = data.pop('password')
    email = data['email']
    user, created = User.objects.get_or_create(email=email, defaults={**data, 'username': email})
    if created:
        user.set_password(password)
        user.save()
        print(f'✓ Created: {email}')
    else:
        print(f'  Exists:  {email}')

print('\nDemo users ready!')
