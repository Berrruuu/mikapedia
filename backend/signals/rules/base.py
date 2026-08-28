from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class RuleResult:
    name: str
    passed: bool
    score: int
    reason: str | None = None
    details: Dict[str, Any] | None = None


class Rule:
    """Base class for a compliance rule.

    Implementations should override `evaluate(signal)` and return a `RuleResult`.
    """
    name = 'base'

    def evaluate(self, signal) -> RuleResult:
        raise NotImplementedError()
