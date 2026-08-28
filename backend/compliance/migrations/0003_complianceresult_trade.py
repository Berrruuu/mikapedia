"""Placeholder migration to keep the compliance chain consistent.

The trade relation is already added in 0002, so re-adding it here causes
PostgreSQL to fail with a duplicate column error on fresh deployments.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('compliance', '0002_alter_compliancerecord_unique_together_and_more'),
    ]

    operations = []
