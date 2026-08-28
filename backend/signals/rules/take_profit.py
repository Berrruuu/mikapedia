from .base import Rule, RuleResult


class TakeProfitRule(Rule):
    name = 'take_profit'

    def evaluate(self, signal) -> RuleResult:
        # Basic sanity: TP must be greater than entry for BUY, lower for SELL
        try:
            tp = float(signal.take_profit)
            entry = float(signal.fib_entry)
        except Exception:
            return RuleResult(name=self.name, passed=False, score=0, reason='Invalid numeric fields')

        if signal.direction == 'BUY':
            passed = tp > entry
        else:
            passed = tp < entry

        score = 100 if passed else 0
        reason = 'TP consistent with direction' if passed else 'TP inconsistent with direction'
        return RuleResult(name=self.name, passed=passed, score=score, reason=reason, details={'tp': tp, 'entry': entry})
