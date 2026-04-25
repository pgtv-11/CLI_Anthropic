from datetime import datetime, timezone

from src.packager import CaseDescriptor, EvidenceItem, build_manifest, render_pdf


def _case():
    return CaseDescriptor(
        case_id="ALT-2026-00001",
        case_kind="surveillance_alert",
        summary="Wash trading candidate in AAPL",
        actors=[{"id": "alice", "role": "compliance_officer"}],
        timeline=[{"ts": "2026-04-01T14:30:00Z", "event": "alert generated"}],
        items=[
            EvidenceItem(
                name="alert.json",
                content_type="application/json",
                bytes=b'{"alert_id":"ALT-1"}',
                rule_version_id="finra-2026-q2",
            )
        ],
        case_effective_at=datetime(2026, 4, 1, 14, 30, tzinfo=timezone.utc),
    )


def test_pdf_render_is_deterministic():
    case = _case()
    a = render_pdf(case)
    b = render_pdf(case)
    assert a == b, "PDF render must be byte-identical for the same case"


def test_manifest_pins_effective_at():
    case = _case()
    m = build_manifest(case, pdf_digest="deadbeef")
    assert m["effective_at"] == "2026-04-01T14:30:00Z"
    assert m["report_pdf_sha256"] == "deadbeef"
