from .base import Rule, RuleResult


class FibEntryRule(Rule):
    name = 'fib_entry'

    def evaluate(self, signal) -> RuleResult:
        # Accept common Fibonacci levels within tolerance
        allowed = {0.236, 0.382, 0.5, 0.618, 0.786}
        try:
            v = float(signal.fib_entry)
        except Exception:
            return RuleResult(name=self.name, passed=False, score=0, reason='Invalid fib entry')

        # Determine closeness to any allowed level
        tol = 0.03
        best = min(abs(v - a) for a in allowed)
        passed = best <= tol
        score = int((1 - min(best / tol, 1)) * 100) if passed else 0
        reason = 'within tolerance' if passed else 'entry not on allowed fib levels'
        return RuleResult(name=self.name, passed=passed, score=score, reason=reason, details={'value': v})
