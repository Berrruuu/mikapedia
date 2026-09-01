# Generated migration for adding owner role

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('owner', 'Owner'),
                    ('admin', 'Administrator'),
                    ('trader', 'Trader'),
                ],
                default='trader'
            ),
        ),
    ]
