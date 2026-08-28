from typing import List, Dict
from .base import RuleResult, Rule


class ComplianceEngine:
    def __init__(self, rules: List[Rule] | None = None):
        self.rules = rules or []

    def register(self, rule: Rule):
        self.rules.append(rule)

    def evaluate(self, signal) -> Dict:
        results: List[RuleResult] = []
        total_score = 0
        max_score = 0
        for r in self.rules:
            try:
                res = r.evaluate(signal)
            except Exception as e:
                res = RuleResult(name=getattr(r, 'name', r.__class__.__name__), passed=False, score=0, reason=str(e))
            results.append(res)
            total_score += res.score
            max_score += 100  # each rule normalized to 0-100

        overall = int((total_score / max_score) * 100) if max_score > 0 else 0
        return {
            'overall_score': overall,
            'rule_count': len(self.rules),
            'results': [r.__dict__ for r in results],
        }
