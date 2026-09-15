from django.db import migrations, models


def normalize_timeframes(apps, schema_editor):
    TraderProfile = apps.get_model('users', 'TraderProfile')
    TraderProfile.objects.exclude(allowed_timeframe__in=['1', '15']).update(allowed_timeframe='15')


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0006_traderprofile_allowed_timeframe'),
    ]

    operations = [
        migrations.AlterField(
            model_name='traderprofile',
            name='allowed_timeframe',
            field=models.CharField(
                choices=[
                    ('1', 'M1'),
                    ('15', 'M15'),
                ],
                default='15',
                max_length=10,
            ),
        ),
        migrations.RunPython(normalize_timeframes, migrations.RunPython.noop),
    ]
