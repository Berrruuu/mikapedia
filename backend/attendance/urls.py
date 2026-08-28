from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceViewSet,
    AttendanceShiftViewSet,
    AttendanceScheduleViewSet,
    AttendanceScheduleEntryViewSet,
)

router = DefaultRouter()
router.register(r'shifts', AttendanceShiftViewSet, basename='attendance-shifts')
router.register(r'schedules', AttendanceScheduleViewSet, basename='attendance-schedules')
router.register(r'schedule-entries', AttendanceScheduleEntryViewSet, basename='attendance-schedule-entries')
router.register(r'', AttendanceViewSet, basename='attendance')

urlpatterns = [path('', include(router.urls))]
