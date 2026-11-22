import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mt5', '0006_mt5deal_position_and_pip_size'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BacktestJournal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('starting_balance', models.DecimalField(decimal_places=2, max_digits=16)),
                ('currency', models.CharField(default='USD', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='backtest_journals',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'backtest_journals',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='BacktestTrade',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('trade_date', models.DateTimeField()),
                ('session', models.CharField(
                    choices=[
                        ('ASIA', 'Asia'),
                        ('LONDON', 'London'),
                        ('NEWYORK', 'New York'),
                        ('MIDNIGHT', 'Midnight'),
                    ],
                    max_length=10,
                )),
                ('pips', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('net_pl', models.DecimalField(decimal_places=2, max_digits=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('journal', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='trades',
                    to='mt5.backtestjournal',
                )),
            ],
            options={
                'db_table': 'backtest_trades',
                'ordering': ['trade_date', 'created_at', 'id'],
            },
        ),
    ]
