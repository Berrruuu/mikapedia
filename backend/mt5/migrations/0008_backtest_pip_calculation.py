from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mt5', '0007_backtest_journals'),
    ]

    operations = [
        migrations.AddField(
            model_name='backtestjournal',
            name='symbol',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='backtestjournal',
            name='lot_size',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='backtestjournal',
            name='pip_value_usd_per_lot',
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=16, null=True),
        ),
    ]
