from datetime import date

from django.test import TestCase
from django.contrib.auth import get_user_model

from attendance.models import AttendanceShift, AttendanceScheduleEntry, AttendanceRecord
from . import service as report_service


class SessionReportAttendanceTests(TestCase):
	def setUp(self):
		User = get_user_model()
		# create two traders
		self.trader_a = User.objects.create_user(username='a', email='a@example.com', password='x', first_name='A', last_name='Trader', role='trader')
		self.trader_b = User.objects.create_user(username='b', email='b@example.com', password='x', first_name='B', last_name='Trader', role='trader')

		# shifts
		self.shift1 = AttendanceShift.objects.create(name='Session 1', start_time='09:00', end_time='12:00', grace_minutes=15)
		self.shift2 = AttendanceShift.objects.create(name='Session 2', start_time='19:00', end_time='22:00', grace_minutes=15)

		# trader A original shift1
		AttendanceScheduleEntry.objects.create(user=self.trader_a, date=date.today(), shift=self.shift1, assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_REGULAR)
		# trader A covers trader B on shift2
		AttendanceScheduleEntry.objects.create(user=self.trader_a, date=date.today(), shift=self.shift2, assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_COVER, cover_for=self.trader_b)
		# trader B original shift2 (will be covered)
		AttendanceScheduleEntry.objects.create(user=self.trader_b, date=date.today(), shift=self.shift2, assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_REGULAR)

		# create attendance records
		AttendanceRecord.objects.create(user=self.trader_a, date=date.today(), shift=self.shift1, status='Present')
		AttendanceRecord.objects.create(user=self.trader_a, date=date.today(), shift=self.shift2, status='Present')
		AttendanceRecord.objects.create(user=self.trader_b, date=date.today(), shift=self.shift2, status='Absent')

	def test_session_type_and_covers_present(self):
		report = report_service.get_attendance_report('daily', date.today())
		records = report['records']
		# find trader_a records
		a_records = [r for r in records if r['user__email'] == self.trader_a.email]
		self.assertEqual(len(a_records), 2)
		types = {r['shift']: r['session_type'] for r in a_records}
		# shift1 should be original, shift2 should be cover
		self.assertEqual(types.get('Session 1'), 'original')
		self.assertEqual(types.get('Session 2'), 'cover')
		# cover info present for Session 2
		cover_rec = next(r for r in a_records if r['shift'] == 'Session 2')
		self.assertIsNotNone(cover_rec.get('covers'))
		self.assertEqual(cover_rec['covers']['email'], self.trader_b.email)
