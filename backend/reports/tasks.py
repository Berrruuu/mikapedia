from celery import shared_task
from audit_logs.utils import create_audit


@shared_task(bind=True)
def generate_report_task(self, report_id: int):
    try:
        from reports.models import Report
        from reports.service import generate_report
        rpt = Report.objects.get(id=report_id)
        generate_report(rpt)
        try:
            create_audit(action='report.generated', category='report', severity='info', target=rpt)
        except Exception:
            pass
    except Exception:
        try:
            create_audit(action='report.generate_failed', category='report', severity='high', metadata={'report_id': report_id})
        except Exception:
            pass
        raise
