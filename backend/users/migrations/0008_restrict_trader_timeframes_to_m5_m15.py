from django.db import migrations, models


def normalize_timeframes(apps, schema_editor):
    TraderProfile = apps.get_model('users', 'TraderProfile')
    TraderProfile.objects.exclude(allowed_timeframe__in=['5', '15']).update(allowed_timeframe='15')


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0007_restrict_trader_timeframes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='traderprofile',
            name='allowed_timeframe',
            field=models.CharField(
                choices=[
                    ('5', 'M5'),
                    ('15', 'M15'),
                ],
                default='15',
                max_length=10,
            ),
        ),
        migrations.RunPython(normalize_timeframes, migrations.RunPython.noop),
    ]
