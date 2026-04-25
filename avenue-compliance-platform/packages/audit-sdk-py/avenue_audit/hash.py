"""Canonical hashing for audit events. Mirrors the TS implementation."""

from __future__ import annotations

import hashlib
import json
from typing import Any

GENESIS_HASH = "0" * 64


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def canonical_json(value: Any) -> str:
    """Deterministic JSON: keys sorted, no whitespace. Must match the TS impl."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def hash_payload(payload: Any) -> str:
    return sha256_hex(canonical_json(payload))
