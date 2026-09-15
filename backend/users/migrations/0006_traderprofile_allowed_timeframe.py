from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0005_merge_0002_owner_0004_traderprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='traderprofile',
            name='allowed_timeframe',
            field=models.CharField(
                choices=[
                    ('1', 'M1'),
                    ('5', 'M5'),
                    ('15', 'M15'),
                    ('30', 'M30'),
                    ('60', 'H1'),
                    ('240', 'H4'),
                    ('D', 'D1'),
                ],
                default='15',
                max_length=10,
            ),
        ),
    ]
