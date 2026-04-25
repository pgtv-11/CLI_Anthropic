"""Common types for surveillance scenarios."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Iterable, Protocol


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class Order:
    order_id: str
    account_id: str
    symbol: str
    side: Side
    qty: Decimal
    price: Decimal
    placed_at: datetime
    venue: str


@dataclass(frozen=True)
class Execution:
    exec_id: str
    order_id: str
    account_id: str
    counter_account_id: str | None
    symbol: str
    side: Side
    qty: Decimal
    price: Decimal
    executed_at: datetime
    venue: str


@dataclass(frozen=True)
class Alert:
    scenario_id: str
    scenario_version: str
    severity: str  # "low" | "medium" | "high"
    score: float
    rationale: str
    accounts: list[str]
    symbols: list[str]
    evidence_exec_ids: list[str]
    rule_anchors: list[str]


class Scenario(Protocol):
    scenario_id: str
    scenario_version: str

    def evaluate(self, executions: Iterable[Execution]) -> list[Alert]: ...
