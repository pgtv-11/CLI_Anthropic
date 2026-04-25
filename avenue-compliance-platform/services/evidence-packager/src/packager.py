"""Evidence Packager (P5).

Given a `case_id`, gather all versioned inputs, render a deterministic PDF/A
report + a signed JSON manifest, and archive the bundle to the WORM bucket.

Determinism is non-negotiable: re-running the packager against the same case
must produce a byte-identical output (modulo the signing timestamp). Examiners
verify integrity by recomputing the SHA-256 of each artifact in the manifest.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

# Whitelist for evidence-item filenames written into S3. Anything else is
# rejected — defence against path traversal (e.g. ``../manifest.json``) and
# S3 key injection that could overwrite manifest/signature siblings within
# the same prefix. WORM Object Lock prevents *deletion* but a fresh PUT to
# an existing key creates a new version, hiding the original from non-versioned
# reads — so input validation is the only safe layer.
_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9_.\-]{0,253}[A-Za-z0-9])?$")
_RESERVED_ITEM_NAMES = frozenset({"report.pdf", "manifest.json", "manifest.sig"})


def _validate_item_name(name: str) -> str:
    if not _SAFE_NAME_RE.match(name):
        raise ValueError(
            f"evidence-packager: unsafe item name {name!r}; "
            "must match [A-Za-z0-9][A-Za-z0-9_.-]*[A-Za-z0-9]"
        )
    if name in _RESERVED_ITEM_NAMES:
        raise ValueError(
            f"evidence-packager: item name {name!r} collides with a packager-managed artifact"
        )
    return name


@dataclass(frozen=True)
class EvidenceItem:
    name: str
    content_type: str
    bytes: bytes
    rule_version_id: str | None = None

    def __post_init__(self) -> None:
        _validate_item_name(self.name)


@dataclass(frozen=True)
class CaseDescriptor:
    case_id: str
    case_kind: str  # "surveillance_alert" | "sar" | "recommendation_event" | ...
    summary: str
    actors: list[dict[str, str]]
    timeline: list[dict[str, str]]
    items: list[EvidenceItem]
    # Frozen timestamp used as the PDF/A creation date so re-runs of the
    # packager against the same case produce byte-identical output (P7).
    # Examiners verify integrity by SHA-256 of the report — any drift breaks
    # the manifest signature.
    case_effective_at: datetime


class Signer(Protocol):
    def sign(self, payload: bytes) -> bytes: ...
    def public_key_pem(self) -> bytes: ...


class KmsSigner:
    """Production signer — backed by AWS KMS asymmetric key. Wired in F0."""

    def __init__(self, key_id: str) -> None:
        self.key_id = key_id

    def sign(self, payload: bytes) -> bytes:  # pragma: no cover — wired in F0
        raise NotImplementedError("Wire to boto3 KMS sign in F0")

    def public_key_pem(self) -> bytes:  # pragma: no cover
        raise NotImplementedError("Wire to boto3 KMS get_public_key in F0")


class WormStore(Protocol):
    def put(self, key: str, body: bytes, content_type: str) -> str: ...


def render_pdf(case: CaseDescriptor) -> bytes:
    """Render a deterministic case report. Pins all time-dependent metadata
    to ``case.case_effective_at`` so SHA-256 of the output is reproducible.
    """
    buf = io.BytesIO()
    # ReportLab's invariant=True forces deterministic PDF object IDs and
    # eliminates the random ID array; combined with a fixed creation date
    # below, this gives byte-identical output across runs.
    c = canvas.Canvas(buf, pagesize=LETTER, invariant=True)
    c.setTitle(f"Avenue Evidence — {case.case_id}")
    c.setAuthor("Avenue Compliance Platform")
    c.setSubject(f"{case.case_kind}/{case.case_id}")
    # Pin both the ``CreationDate`` and ``ModDate`` PDF metadata fields.
    fixed_str = case.case_effective_at.strftime("D:%Y%m%d%H%M%S+00'00'")
    c._doc.info.creationDate = fixed_str  # type: ignore[attr-defined]
    c._doc.info.modDate = fixed_str  # type: ignore[attr-defined]

    y = 750
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, y, f"Evidence Package — {case.case_id}")
    y -= 24
    c.setFont("Helvetica", 10)
    c.drawString(72, y, f"Kind: {case.case_kind}")
    y -= 14
    c.drawString(72, y, f"Summary: {case.summary[:120]}")
    y -= 24

    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Actors")
    y -= 16
    c.setFont("Helvetica", 10)
    for actor in case.actors:
        c.drawString(80, y, f"- {actor.get('id', '?')} ({actor.get('role', '?')})")
        y -= 12
    y -= 12

    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Timeline")
    y -= 16
    c.setFont("Helvetica", 10)
    for ev in case.timeline:
        c.drawString(80, y, f"{ev.get('ts', '?')} — {ev.get('event', '?')}")
        y -= 12
        if y < 80:
            c.showPage()
            y = 750

    y -= 12
    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Evidence items")
    y -= 16
    c.setFont("Helvetica", 10)
    for item in case.items:
        digest = hashlib.sha256(item.bytes).hexdigest()
        c.drawString(80, y, f"- {item.name} [{item.content_type}] sha256={digest[:16]}…")
        y -= 12
        if y < 80:
            c.showPage()
            y = 750

    c.save()
    return buf.getvalue()


def build_manifest(case: CaseDescriptor, pdf_digest: str) -> dict[str, Any]:
    items_manifest = [
        {
            "name": item.name,
            "content_type": item.content_type,
            "size": len(item.bytes),
            "sha256": hashlib.sha256(item.bytes).hexdigest(),
            "rule_version_id": item.rule_version_id,
        }
        for item in case.items
    ]
    # ``effective_at`` is the bitemporal anchor of the case (e.g., the alert
    # ts or the SAR draft ts). It drives PDF metadata and, here, the manifest
    # so that a second run produces an identical manifest byte sequence.
    effective_iso = case.case_effective_at.astimezone(timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )
    return {
        "version": 1,
        "case_id": case.case_id,
        "case_kind": case.case_kind,
        "summary": case.summary,
        "actors": case.actors,
        "timeline": case.timeline,
        "items": items_manifest,
        "report_pdf_sha256": pdf_digest,
        "effective_at": effective_iso,
    }


def package(
    case: CaseDescriptor,
    signer: Signer,
    store: WormStore,
) -> dict[str, str]:
    pdf_bytes = render_pdf(case)
    pdf_digest = hashlib.sha256(pdf_bytes).hexdigest()
    manifest = build_manifest(case, pdf_digest)
    manifest_bytes = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest_digest = hashlib.sha256(manifest_bytes).hexdigest()
    signature = signer.sign(manifest_bytes)

    base = f"evidence/{case.case_kind}/{case.case_id}"
    pdf_loc = store.put(f"{base}/report.pdf", pdf_bytes, "application/pdf")
    manifest_loc = store.put(f"{base}/manifest.json", manifest_bytes, "application/json")
    sig_loc = store.put(f"{base}/manifest.sig", signature, "application/octet-stream")

    for item in case.items:
        store.put(f"{base}/items/{item.name}", item.bytes, item.content_type)

    return {
        "report_pdf": pdf_loc,
        "manifest": manifest_loc,
        "signature": sig_loc,
        "manifest_sha256": manifest_digest,
        "report_pdf_sha256": pdf_digest,
    }


def verify(manifest_bytes: bytes, signature: bytes, public_key_pem: bytes) -> bool:
    pub = serialization.load_pem_public_key(public_key_pem)
    try:
        pub.verify(
            signature,
            manifest_bytes,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256(),
        )
        return True
    except Exception:
        return False
