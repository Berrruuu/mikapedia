from datetime import date
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from . import service as report_service
from .pdf_generator import (
    generate_execution_pdf, generate_attendance_pdf,
    generate_leaderboard_pdf, generate_compliance_pdf, generate_session_pdf,
)
from .excel_generator import (
    generate_execution_xlsx, generate_attendance_xlsx,
    generate_leaderboard_xlsx, generate_compliance_xlsx, generate_session_xlsx,
)
from common.response import success_response
from common.permissions import IsOwnerOrAdmin


def _get_params(request) -> tuple[str, date | None]:
    period   = request.query_params.get('period', 'daily')
    date_str = request.query_params.get('date')
    ref_date = None
    if date_str:
        try:
            ref_date = date.fromisoformat(date_str)
        except ValueError:
            pass
    return period, ref_date


def _export_response(fmt: str, data_fn, pdf_fn, xlsx_fn, filename_base: str):
    """Helper: returns PDF or Excel HttpResponse"""
    if fmt == 'pdf':
        content = pdf_fn(data_fn())
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="{filename_base}.pdf"'
    else:
        content = xlsx_fn(data_fn())
        resp = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        resp['Content-Disposition'] = f'attachment; filename="{filename_base}.xlsx"'
    return resp


# ─── Data endpoints (JSON) ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def execution_report(request):
    period, ref = _get_params(request)
    return success_response(report_service.get_execution_report(period, ref))


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def attendance_report(request):
    period, ref = _get_params(request)
    return success_response(report_service.get_attendance_report(period, ref))


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def compliance_report(request):
    period, ref = _get_params(request)
    return success_response(report_service.get_compliance_report(period, ref))


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def leaderboard(request):
    period, ref = _get_params(request)
    return success_response(report_service.get_leaderboard(period, ref))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def session_report(request):
    _, ref = _get_params(request)
    return success_response(report_service.get_session_report(ref))


# ─── Export endpoints ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def export_execution(request):
    period, ref = _get_params(request)
    fmt = request.query_params.get('format', 'xlsx')
    data = report_service.get_execution_report(period, ref)
    if fmt == 'pdf':
        return _export_response(
            'pdf', lambda: data,
            generate_execution_pdf, generate_execution_xlsx,
            f"execution_{period}_{data['start']}"
        )
    content = generate_execution_xlsx(data)
    resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="execution_{period}_{data["start"]}.xlsx"'
    return resp


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def export_attendance(request):
    period, ref = _get_params(request)
    fmt = request.query_params.get('format', 'xlsx')
    data = report_service.get_attendance_report(period, ref)
    if fmt == 'pdf':
        content = generate_attendance_pdf(data)
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="attendance_{period}_{data["start"]}.pdf"'
        return resp
    content = generate_attendance_xlsx(data)
    resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="attendance_{period}_{data["start"]}.xlsx"'
    return resp


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def export_leaderboard(request):
    period, ref = _get_params(request)
    fmt = request.query_params.get('format', 'xlsx')
    data = report_service.get_leaderboard(period, ref)
    if fmt == 'pdf':
        content = generate_leaderboard_pdf(data, period)
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="leaderboard_{period}.pdf"'
        return resp
    content = generate_leaderboard_xlsx(data, period)
    resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="leaderboard_{period}.xlsx"'
    return resp


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def export_compliance(request):
    period, ref = _get_params(request)
    fmt = request.query_params.get('format', 'xlsx')
    data = report_service.get_compliance_report(period, ref)
    if fmt == 'pdf':
        content = generate_compliance_pdf(data)
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="compliance_{period}_{data["start"]}.pdf"'
        return resp
    content = generate_compliance_xlsx(data)
    resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="compliance_{period}_{data["start"]}.xlsx"'
    return resp


@api_view(['GET'])
@permission_classes([IsOwnerOrAdmin])
def export_session(request):
    _, ref = _get_params(request)
    fmt = request.query_params.get('format', 'xlsx')
    data = report_service.get_session_report(ref)
    if fmt == 'pdf':
        content = generate_session_pdf(data)
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="session_{data["sessionDate"]}.pdf"'
        return resp
    content = generate_session_xlsx(data)
    resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="session_{data["sessionDate"]}.xlsx"'
    return resp
