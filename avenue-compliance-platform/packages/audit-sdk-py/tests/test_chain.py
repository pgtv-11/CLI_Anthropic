from datetime import datetime, timezone
from uuid import uuid4

from avenue_audit import (
    AuditClient,
    AuditEventInput,
    GENESIS_HASH,
    InMemoryChainHead,
    InMemorySink,
    verify_chain,
)


def _make_client():
    sink = InMemorySink()
    head = InMemoryChainHead()
    fixed = datetime(2026, 1, 1, tzinfo=timezone.utc)
    client = AuditClient(sinks=[sink], head=head, clock=lambda: fixed)
    return client, sink, head


def _sample(action: str = "CREATE") -> AuditEventInput:
    return AuditEventInput(
        actor="alice@avenue.us",
        actor_role="compliance_officer",
        action=action,  # type: ignore[arg-type]
        target={"kind": "sar", "id": "SAR-2026-0001"},
        request_id=str(uuid4()),
        session_id=str(uuid4()),
        ip="10.0.0.1",
    )


def test_first_event_chains_from_genesis():
    client, sink, _ = _make_client()
    ev = client.record(_sample())
    assert ev.prev_chain_hash == GENESIS_HASH
    assert sink.events[0].chain_hash == ev.chain_hash


def test_chain_continuity():
    client, sink, _ = _make_client()
    a = client.record(_sample("CREATE"))
    b = client.record(_sample("UPDATE"))
    assert b.prev_chain_hash == a.chain_hash
    ok, _ = verify_chain(sink.events)
    assert ok


def test_tamper_detection():
    client, sink, _ = _make_client()
    client.record(_sample("CREATE"))
    client.record(_sample("UPDATE"))
    sink.events[0].target = {"kind": "sar", "id": "TAMPERED"}
    ok, broken_at = verify_chain(sink.events)
    assert not ok and broken_at is not None
