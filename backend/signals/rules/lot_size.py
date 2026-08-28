from .base import Rule, RuleResult


class LotSizeRule(Rule):
    name = 'lot_size'

    def evaluate(self, signal) -> RuleResult:
        # Signals may include recommended lot info in webhook_payload
        payload = getattr(signal, 'webhook_payload', {}) or {}
        lot = payload.get('lot') or payload.get('lot_size')
        if lot is None:
            return RuleResult(name=self.name, passed=True, score=100, reason='No lot specified — pass')

        try:
            lot = float(lot)
        except Exception:
            return RuleResult(name=self.name, passed=False, score=0, reason='Invalid lot')

        # Simple sanity: lot should be >0 and <= 100
        passed = 0 < lot <= 100
        score = 100 if passed else 0
        reason = 'lot size acceptable' if passed else 'lot size out of bounds'
        return RuleResult(name=self.name, passed=passed, score=score, reason=reason, details={'lot': lot})
