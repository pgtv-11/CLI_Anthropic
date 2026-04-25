"""Scenario runner — replays executions against a registered set of scenarios.

The runner is intentionally pure (no I/O): it returns alerts. The caller
persists them into the surveillance datastore and triggers the triage workflow.
This split makes deterministic backtesting trivial.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from ..scenarios.base import Alert, Execution, Scenario


@dataclass(frozen=True)
class RunResult:
    bundle_version: str
    alerts: list[Alert]


class SurveillanceRunner:
    def __init__(self, scenarios: Iterable[Scenario], bundle_version: str) -> None:
        self._scenarios = list(scenarios)
        self._bundle_version = bundle_version

    def run(self, executions: Iterable[Execution]) -> RunResult:
        execs = list(executions)
        alerts: list[Alert] = []
        for s in self._scenarios:
            alerts.extend(s.evaluate(execs))
        return RunResult(bundle_version=self._bundle_version, alerts=alerts)
