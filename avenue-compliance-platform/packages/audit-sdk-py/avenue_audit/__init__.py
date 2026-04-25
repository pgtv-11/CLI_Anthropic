"""Avenue audit SDK — hash-chained immutable audit log (Python)."""

from .chain import (
    AuditClient,
    AuditEvent,
    AuditEventInput,
    AuditSink,
    ChainHeadStore,
    InMemoryChainHead,
    InMemorySink,
    verify_chain,
)
from .hash import GENESIS_HASH, canonical_json, hash_payload, sha256_hex

__all__ = [
    "AuditClient",
    "AuditEvent",
    "AuditEventInput",
    "AuditSink",
    "ChainHeadStore",
    "GENESIS_HASH",
    "InMemoryChainHead",
    "InMemorySink",
    "canonical_json",
    "hash_payload",
    "sha256_hex",
    "verify_chain",
]
