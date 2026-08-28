from django.test import TestCase
from django.utils import timezone

from attendance.models import (
    AttendanceRecord,
    AttendanceSchedule,
    AttendanceScheduleEntry,
    AttendanceShift,
)
from attendance.services import AttendanceService
from users.models import User


class AttendanceCoverAssignmentTests(TestCase):
    def setUp(self):
        self.service = AttendanceService()
        self.today = timezone.localdate()

        self.shift_a = AttendanceShift.objects.create(
            name='Morning Shift',
            start_time='08:00',
            end_time='12:00',
            grace_minutes=15,
            is_active=True,
        )
        self.shift_b = AttendanceShift.objects.create(
            name='Afternoon Shift',
            start_time='13:00',
            end_time='17:00',
            grace_minutes=15,
            is_active=True,
        )

        self.cover_trader = User.objects.create_user(
            username='cover_trader',
            email='cover@example.com',
            password='pass1234',
            role='trader',
        )
        self.covered_trader = User.objects.create_user(
            username='covered_trader',
            email='covered@example.com',
            password='pass1234',
            role='trader',
        )
        self.regular_trader = User.objects.create_user(
            username='regular_trader',
            email='regular@example.com',
            password='pass1234',
            role='trader',
        )

    def test_cover_trader_can_have_two_shifts_today(self):
        AttendanceSchedule.objects.create(
            user=self.cover_trader,
            shift=self.shift_a,
            start_date=self.today,
            end_date=self.today,
            is_active=True,
        )
        AttendanceScheduleEntry.objects.create(
            user=self.cover_trader,
            date=self.today,
            shift=self.shift_b,
            assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_COVER,
            cover_for=self.covered_trader,
        )

        shifts = self.service.get_schedule_shifts_for_user(self.cover_trader, self.today)
        self.assertEqual(len(shifts), 2)
        self.assertIn(self.shift_a, shifts)
        self.assertIn(self.shift_b, shifts)

        result = self.service.check_in(self.cover_trader, {'shift_id': self.shift_b.id})
        self.assertFalse(result['existing'])
        self.assertEqual(result['record'].shift, self.shift_b)
        self.assertEqual(AttendanceRecord.objects.filter(user=self.cover_trader, date=self.today).count(), 1)

    def test_non_cover_trader_cannot_use_two_shifts(self):
        AttendanceScheduleEntry.objects.create(
            user=self.regular_trader,
            date=self.today,
            shift=self.shift_a,
            assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_REGULAR,
        )
        AttendanceScheduleEntry.objects.create(
            user=self.regular_trader,
            date=self.today,
            shift=self.shift_b,
            assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_REGULAR,
        )

        shifts = self.service.get_schedule_shifts_for_user(self.regular_trader, self.today)
        self.assertEqual(len(shifts), 1)
        self.assertEqual(shifts[0], self.shift_a)

        with self.assertRaises(Exception):
            self.service.check_in(self.regular_trader, {'shift_id': self.shift_b.id})
