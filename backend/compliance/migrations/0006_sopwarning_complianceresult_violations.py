"""Placeholder migration to keep the compliance chain consistent.

The earlier migration set already created the violations field and
SOPWarning model. Keeping this as an empty migration avoids re-running
those schema changes in fresh deployments.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('compliance', '0005_alter_complianceresult_unique_together_and_more'),
    ]

    operations = []
