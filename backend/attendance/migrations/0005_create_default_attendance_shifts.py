from django.db import migrations


def create_default_attendance_shifts(apps, schema_editor):
    AttendanceShift = apps.get_model('attendance', 'AttendanceShift')
    AttendanceShift.objects.get_or_create(
        name='Session 1',
        defaults={
            'start_time': '05:00:00',
            'end_time': '10:00:00',
            'grace_minutes': 15,
            'is_active': True,
            'description': 'Early morning trader session',
        },
    )
    AttendanceShift.objects.get_or_create(
        name='Session 2',
        defaults={
            'start_time': '18:00:00',
            'end_time': '23:00:00',
            'grace_minutes': 15,
            'is_active': True,
            'description': 'Evening trader session',
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ('attendance', '0004_add_attendance_shift_schedule'),
    ]

    operations = [
        migrations.RunPython(create_default_attendance_shifts, reverse_code=migrations.RunPython.noop),
    ]
