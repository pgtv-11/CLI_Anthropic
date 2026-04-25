"""Backward-compatibility test: v1 events (no outcome/outcome_hash in the
hash) must still verify against the current SDK.

This guards the schema-version dispatch in ``verify_chain``. A regression
here means archived audit logs would fail to verify after a v2 deploy.
"""

from avenue_audit import AuditEvent, GENESIS_HASH, verify_chain
from avenue_audit.chain import _V1_DROPPED_FROM_HASH
from avenue_audit.hash import canonical_json, sha256_hex


def _build_v1_event(prev: str) -> AuditEvent:
    body = {
        "event_id": "11111111-1111-4111-8111-111111111111",
        "ts": "2025-09-01T00:00:00Z",
        "actor": "alice",
        "actor_role": "compliance_officer",
        "actor_crd": None,
        "action": "CREATE",
        "target": {"kind": "sar", "id": "SAR-2025-0001"},
        "before_hash": None,
        "after_hash": None,
        "request_id": "22222222-2222-4222-8222-222222222222",
        "session_id": "33333333-3333-4333-8333-333333333333",
        "ip": "10.0.0.1",
        "user_agent": None,
        "rule_version_id": None,
        "llm_context": None,
        "prev_chain_hash": prev,
    }
    chain_hash = sha256_hex(canonical_json(body))
    return AuditEvent(
        schema_version=1,
        outcome=None,
        outcome_hash=None,
        chain_hash=chain_hash,
        **body,
    )


def test_v1_event_verifies():
    ev = _build_v1_event(GENESIS_HASH)
    ok, broken = verify_chain([ev])
    assert ok, broken


def test_v1_constant_excludes_expected_fields():
    assert {"chain_hash", "schema_version", "outcome", "outcome_hash"} == _V1_DROPPED_FROM_HASH
