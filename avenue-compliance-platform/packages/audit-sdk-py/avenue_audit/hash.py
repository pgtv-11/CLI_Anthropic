"""Canonical hashing for audit events. Mirrors the TS implementation."""

from __future__ import annotations

import hashlib
import json
from typing import Any

GENESIS_HASH = "0" * 64


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def canonical_json(value: Any) -> str:
    """Deterministic JSON: keys sorted, no whitespace, literal UTF-8.

    Must produce byte-for-byte identical output to the TypeScript SDK's
    ``canonicalJson``. Node's ``JSON.stringify`` emits non-ASCII characters
    as literal UTF-8 (it does NOT escape to ``\\uXXXX``); we therefore use
    ``ensure_ascii=False`` so both SDKs hash identical UTF-8 byte sequences.
    A regression here would diverge the chain across languages — see the
    cross-language vector test.
    """
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def hash_payload(payload: Any) -> str:
    return sha256_hex(canonical_json(payload))
