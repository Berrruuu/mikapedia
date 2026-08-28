from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from mt5.crypto import encrypt_password
from mt5.models import MT5Account


class Command(BaseCommand):
    help = 'Create or update an MT5Account for a user (encrypts password)'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='User email to attach MT5 account to')
        parser.add_argument('--login', required=True, type=int, help='MT5 login number')
        parser.add_argument('--password', required=True, help='MT5 account password (will be encrypted)')
        parser.add_argument('--server', required=True, help='Broker server name')
        parser.add_argument('--broker', required=False, default='', help='Broker display name')
        parser.add_argument('--account-number', required=False, default='', help='Display account number')

    def handle(self, *args, **options):
        User = get_user_model()
        email = options['email']
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f'User with email {email} not found')

        login = options['login']
        password = options['password']
        server = options['server']
        broker = options.get('broker') or ''
        account_number = options.get('account_number') or ''

        encrypted = encrypt_password(password)

        obj, created = MT5Account.objects.update_or_create(
            user=user,
            defaults={
                'login': login,
                'password_encrypted': encrypted,
                'server': server,
                'broker': broker,
                'account_number': account_number,
                'status': 'pending',
            }
        )

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} MT5Account for {email} (login={login})'))
