from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mt5', '0005_add_order_type_cancelled'),
    ]

    operations = [
        migrations.AddField(
            model_name='mt5deal',
            name='position_id',
            field=models.BigIntegerField(db_index=True, default=0),
        ),
        migrations.AddField(
            model_name='mt5deal',
            name='pip_size',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
