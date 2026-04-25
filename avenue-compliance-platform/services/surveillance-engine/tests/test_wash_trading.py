from datetime import datetime, timedelta, timezone
from decimal import Decimal

from scenarios.base import Execution, Side
from scenarios.wash_trading import (
    AccountLinkage,
    WashTradingScenario,
    example_config,
)


def _exec(exec_id: str, account: str, side: Side, qty: int, price: int, t: datetime, symbol="AAPL"):
    return Execution(
        exec_id=exec_id,
        order_id=f"O-{exec_id}",
        account_id=account,
        counter_account_id=None,
        symbol=symbol,
        side=side,
        qty=Decimal(qty),
        price=Decimal(price),
        executed_at=t,
        venue="NASDAQ",
    )


T0 = datetime(2026, 4, 1, 14, 30, tzinfo=timezone.utc)


def test_linked_accounts_opposite_sides_trigger_alert():
    cfg = example_config()
    linkage = AccountLinkage({"ACC-1": "BO-42", "ACC-2": "BO-42"}, version_id="kyc-2026-04-01")
    scenario = WashTradingScenario(cfg, linkage)
    execs = [
        _exec("E1", "ACC-1", Side.BUY, 100, 150, T0),
        _exec("E2", "ACC-2", Side.SELL, 100, 150, T0 + timedelta(seconds=5)),
    ]
    alerts = scenario.evaluate(execs)
    assert len(alerts) == 1
    assert alerts[0].severity in {"medium", "high"}
    assert "FINRA 5210" in alerts[0].rule_anchors


def test_unlinked_accounts_do_not_alert():
    cfg = example_config()
    linkage = AccountLinkage(
        {"ACC-1": "BO-42", "ACC-2": "BO-99"}, version_id="kyc-2026-04-01"
    )
    scenario = WashTradingScenario(cfg, linkage)
    execs = [
        _exec("E1", "ACC-1", Side.BUY, 100, 150, T0),
        _exec("E2", "ACC-2", Side.SELL, 100, 150, T0 + timedelta(seconds=5)),
    ]
    assert scenario.evaluate(execs) == []


def test_alert_carries_kyc_version_for_reproducibility():
    cfg = example_config()
    linkage = AccountLinkage({"ACC-1": "BO-42", "ACC-2": "BO-42"}, version_id="kyc-2026-04-01")
    scenario = WashTradingScenario(cfg, linkage)
    execs = [
        _exec("E1", "ACC-1", Side.BUY, 100, 150, T0),
        _exec("E2", "ACC-2", Side.SELL, 100, 150, T0 + timedelta(seconds=5)),
    ]
    [alert] = scenario.evaluate(execs)
    assert alert.data_version_id == "kyc-2026-04-01"


def test_outside_time_window_does_not_alert():
    cfg = example_config()
    linkage = AccountLinkage({"ACC-1": "BO-42", "ACC-2": "BO-42"}, version_id="kyc-2026-04-01")
    scenario = WashTradingScenario(cfg, linkage)
    execs = [
        _exec("E1", "ACC-1", Side.BUY, 100, 150, T0),
        _exec("E2", "ACC-2", Side.SELL, 100, 150, T0 + timedelta(minutes=5)),
    ]
    assert scenario.evaluate(execs) == []
