from django.db.models import QuerySet
from django.utils import timezone

from .models import Signal


class SignalRepository:
    def get_queryset(self) -> QuerySet:
        return Signal.objects.all()

    def get_queryset_for_request(self, request) -> QuerySet:
        qs = self.get_queryset()
        date = request.query_params.get('date')
        if date:
            qs = qs.filter(session_date=date)
        elif not request.query_params.get('all'):
            qs = qs.filter(session_date=timezone.localdate())
        return qs

    def create(self, **kwargs) -> Signal:
        return Signal.objects.create(**kwargs)

    def update_status(self, signal: Signal, status: str) -> Signal:
        signal.status = status
        signal.save(update_fields=['status'])
        return signal
