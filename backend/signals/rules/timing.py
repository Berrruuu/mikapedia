from .base import Rule, RuleResult
from django.utils import timezone
from datetime import datetime, time


class TimingRule(Rule):
    name = 'timing'

    def evaluate(self, signal) -> RuleResult:
        # Ensure issued_at/timeframe and max_entry_time make sense.
        try:
            issued = signal.issued_at
            max_entry = signal.max_entry_time
        except Exception:
            return RuleResult(name=self.name, passed=False, score=0, reason='Missing timing fields')

        # If max_entry_time before issued_at, it's invalid
        try:
            if max_entry < issued:
                return RuleResult(name=self.name, passed=False, score=0, reason='max_entry_time before issued_at')
        except Exception:
            return RuleResult(name=self.name, passed=False, score=0, reason='Invalid time fields')

        return RuleResult(name=self.name, passed=True, score=100, reason='Timing OK', details={'issued_at': str(issued), 'max_entry_time': str(max_entry)})
