"""Wash trading detector.

A wash trade is one in which a person, directly or indirectly, is on both sides
of a transaction with no change in beneficial ownership. We detect candidates
when two executions in the same symbol, similar quantity, and small time
window pair the same beneficial owner via account linkage.

Anchors: FINRA 5210, FINRA 6140, SEC 15c3-5; rule_version_id is bound at load time.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Iterable

from .base import Alert, Execution, Side


@dataclass(frozen=True)
class WashTradingConfig:
    scenario_version: str
    rule_version_id: str
    time_window_seconds: int
    qty_tolerance_pct: Decimal
    price_tolerance_pct: Decimal
    min_score: float
    rule_anchors: tuple[str, ...]


class AccountLinkage:
    """Beneficial-owner linkage map. In production: backed by KYC service."""

    def __init__(self, links: dict[str, str]) -> None:
        # account_id -> beneficial_owner_id
        self._links = links

    def beneficial_owner(self, account_id: str) -> str | None:
        return self._links.get(account_id)


class WashTradingScenario:
    scenario_id = "wash-trading"

    def __init__(self, cfg: WashTradingConfig, linkage: AccountLinkage) -> None:
        self.cfg = cfg
        self.scenario_version = cfg.scenario_version
        self._linkage = linkage

    def evaluate(self, executions: Iterable[Execution]) -> list[Alert]:
        by_symbol: dict[str, list[Execution]] = defaultdict(list)
        for ex in executions:
            by_symbol[ex.symbol].append(ex)

        alerts: list[Alert] = []
        window = timedelta(seconds=self.cfg.time_window_seconds)

        for symbol, execs in by_symbol.items():
            execs.sort(key=lambda e: e.executed_at)
            for i, a in enumerate(execs):
                for b in execs[i + 1 :]:
                    if b.executed_at - a.executed_at > window:
                        break
                    if a.side == b.side:
                        continue
                    if not self._qty_close(a.qty, b.qty):
                        continue
                    if not self._price_close(a.price, b.price):
                        continue
                    bo_a = self._linkage.beneficial_owner(a.account_id)
                    bo_b = self._linkage.beneficial_owner(b.account_id)
                    if bo_a is None or bo_a != bo_b:
                        continue
                    score = self._score(a, b)
                    if score < self.cfg.min_score:
                        continue
                    alerts.append(
                        Alert(
                            scenario_id=self.scenario_id,
                            scenario_version=self.scenario_version,
                            severity="high" if score >= 0.85 else "medium",
                            score=score,
                            rationale=(
                                f"Opposite-side executions in {symbol} "
                                f"within {self.cfg.time_window_seconds}s; "
                                f"both accounts mapped to beneficial owner {bo_a}."
                            ),
                            accounts=[a.account_id, b.account_id],
                            symbols=[symbol],
                            evidence_exec_ids=[a.exec_id, b.exec_id],
                            rule_anchors=list(self.cfg.rule_anchors),
                        )
                    )
        return alerts

    def _qty_close(self, x: Decimal, y: Decimal) -> bool:
        if max(x, y) == 0:
            return False
        diff = abs(x - y) / max(x, y)
        return diff <= self.cfg.qty_tolerance_pct

    def _price_close(self, x: Decimal, y: Decimal) -> bool:
        if max(x, y) == 0:
            return False
        diff = abs(x - y) / max(x, y)
        return diff <= self.cfg.price_tolerance_pct

    @staticmethod
    def _score(a: Execution, b: Execution) -> float:
        # Simple deterministic scoring; production augments with prior history.
        delta = (b.executed_at - a.executed_at).total_seconds()
        time_factor = max(0.0, 1.0 - delta / 60.0)
        qty_eq = 1.0 if a.qty == b.qty else 0.7
        return round(0.5 * time_factor + 0.4 * qty_eq + 0.1, 3)


def example_config() -> WashTradingConfig:
    """Default config used when YAML is absent — also a runnable reference."""
    return WashTradingConfig(
        scenario_version="2026.04.0",
        rule_version_id="finra-2026-q2",
        time_window_seconds=30,
        qty_tolerance_pct=Decimal("0.02"),
        price_tolerance_pct=Decimal("0.005"),
        min_score=0.6,
        rule_anchors=("FINRA 5210", "FINRA 6140", "SEC 15c3-5"),
    )
