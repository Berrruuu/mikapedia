from .base import Rule, RuleResult


class DirectionRule(Rule):
    name = 'direction'

    def evaluate(self, signal) -> RuleResult:
        expected = signal.direction
        # No execution info at signal creation; assume pass for now
        # Future: compare to actual trades
        return RuleResult(name=self.name, passed=True, score=100, reason='Signal direction recorded')
