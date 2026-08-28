from .base import Rule, RuleResult


class StopLossRule(Rule):
    name = 'stop_loss'

    def evaluate(self, signal) -> RuleResult:
        try:
            sl = float(signal.stop_loss)
            entry = float(signal.fib_entry)
        except Exception:
            return RuleResult(name=self.name, passed=False, score=0, reason='Invalid numeric fields')

        if signal.direction == 'BUY':
            passed = sl < entry
        else:
            passed = sl > entry

        score = 100 if passed else 0
        reason = 'SL consistent with direction' if passed else 'SL inconsistent with direction'
        return RuleResult(name=self.name, passed=passed, score=score, reason=reason, details={'sl': sl, 'entry': entry})
