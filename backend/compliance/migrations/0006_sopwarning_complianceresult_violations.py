"""
Manual migration to create sop_warnings table and add violations field
to compliance_records. This is needed because 0005 was faked due to
a constraint conflict.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compliance', '0005_alter_complianceresult_unique_together_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add violations JSONField to ComplianceResult
        migrations.AddField(
            model_name='complianceresult',
            name='violations',
            field=models.JSONField(blank=True, default=list, help_text='List of violation codes detected'),
        ),
        # Create SOPWarning table
        migrations.CreateModel(
            name='SOPWarning',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('violation_type', models.CharField(
                    choices=[
                        ('missed_signal', 'Signal Dilewati'),
                        ('wrong_direction', 'Arah Salah'),
                        ('late_entry', 'Entry Terlambat'),
                        ('no_stop_loss', 'Tidak Ada SL'),
                        ('no_take_profit', 'Tidak Ada TP'),
                        ('wrong_lot_size', 'Lot Size Salah'),
                        ('entry_out_of_zone', 'Entry di Luar Zona'),
                        ('multiple', 'Beberapa Pelanggaran'),
                    ],
                    max_length=30,
                )),
                ('severity', models.CharField(
                    choices=[('warning', 'Warning'), ('danger', 'Danger')],
                    default='warning',
                    max_length=10,
                )),
                ('message', models.TextField()),
                ('acknowledged', models.BooleanField(default=False)),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('compliance_result', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='warnings',
                    to='compliance.complianceresult',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sop_warnings',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'sop_warnings',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', 'acknowledged'], name='sop_warn_user_idx'),
                    models.Index(fields=['violation_type', 'severity'], name='sop_warn_type_idx'),
                ],
            },
        ),
    ]
