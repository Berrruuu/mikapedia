from django.urls import path
from . import views

urlpatterns = [
    # JSON data
    path('execution/',  views.execution_report,  name='report-execution'),
    path('attendance/', views.attendance_report,  name='report-attendance'),
    path('compliance/', views.compliance_report,  name='report-compliance'),
    path('leaderboard/',views.leaderboard,        name='report-leaderboard'),
    path('session/',    views.session_report,     name='report-session'),

    # Exports — add ?format=pdf or ?format=xlsx (default)
    path('export/execution/',  views.export_execution,  name='export-execution'),
    path('export/attendance/', views.export_attendance, name='export-attendance'),
    path('export/leaderboard/',views.export_leaderboard,name='export-leaderboard'),
    path('export/compliance/', views.export_compliance, name='export-compliance'),
    path('export/session/',    views.export_session,    name='export-session'),
]
