from datetime import date, timedelta
from django.db import migrations, models


def set_schedule_date_range(apps, schema_editor):
    AttendanceSchedule = apps.get_model('attendance', 'AttendanceSchedule')
    today = date.today()
    end_date = today + timedelta(days=30)
    for schedule in AttendanceSchedule.objects.all():
        if schedule.start_date is None:
            schedule.start_date = today
        if schedule.end_date is None:
            schedule.end_date = end_date
        schedule.save(update_fields=['start_date', 'end_date'])


class Migration(migrations.Migration):
    dependencies = [
        ('attendance', '0005_create_default_attendance_shifts'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendanceschedule',
            name='start_date',
            field=models.DateField(null=True),
        ),
        migrations.AddField(
            model_name='attendanceschedule',
            name='end_date',
            field=models.DateField(null=True),
        ),
        migrations.RunPython(set_schedule_date_range, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='attendanceschedule',
            name='start_date',
            field=models.DateField(),
        ),
        migrations.AlterField(
            model_name='attendanceschedule',
            name='end_date',
            field=models.DateField(),
        ),
    ]
