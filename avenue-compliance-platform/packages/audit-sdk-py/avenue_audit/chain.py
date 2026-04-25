"""Audit client + chain verification. Pairs with the TS audit-sdk."""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Literal, Optional, Protocol

from pydantic import BaseModel, Field, field_validator

from .hash import GENESIS_HASH, canonical_json, hash_payload, sha256_hex

AuditAction = Literal[
    "CREATE",
    "READ",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
    "EXPORT",
    "APPROVE",
    "REJECT",
    "OVERRIDE",
    "ESCALATE",
    "SUBMIT_FILING",
    "EXAMINER_QUERY",
    "LLM_ASSIST",
]


class _Target(BaseModel):
    kind: str = Field(min_length=1)
    id: str = Field(min_length=1)


class _LlmContext(BaseModel):
    model: str
    prompt_hash: str
    response_hash: str


Outcome = Literal["SUCCESS", "HANDLER_ERROR", "POLICY_DENY", "UNKNOWN"]


class AuditEventInput(BaseModel):
    actor: str = Field(min_length=1)
    actor_role: str = Field(min_length=1)
    actor_crd: Optional[str] = None
    action: AuditAction
    target: _Target
    before: Optional[dict[str, Any]] = None
    after: Optional[dict[str, Any]] = None
    request_id: str
    session_id: str
    ip: str = Field(min_length=1)
    user_agent: Optional[str] = None
    rule_version_id: Optional[str] = None
    outcome: Optional[Outcome] = None
    outcome_details: Optional[dict[str, Any]] = None
    llm_context: Optional[_LlmContext] = None

    @field_validator("actor_crd")
    @classmethod
    def _crd_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.isdigit():
            raise ValueError("actor_crd must be numeric (FINRA CRD #)")
        return v


@dataclass
class AuditEvent:
    event_id: str
    ts: str
    actor: str
    actor_role: str
    actor_crd: Optional[str]
    action: AuditAction
    target: dict[str, str]
    before_hash: Optional[str]
    after_hash: Optional[str]
    outcome: Optional[Outcome]
    outcome_hash: Optional[str]
    request_id: str
    session_id: str
    ip: str
    user_agent: Optional[str]
    rule_version_id: Optional[str]
    llm_context: Optional[dict[str, str]]
    prev_chain_hash: str
    chain_hash: str = field(default="")


class AuditSink(Protocol):
    def append(self, event: AuditEvent) -> None: ...


class ChainHeadStore(Protocol):
    def get(self) -> str: ...
    def compare_and_set(self, prev: str, next_: str) -> bool: ...


class InMemoryChainHead:
    def __init__(self) -> None:
        self._head = GENESIS_HASH
        self._lock = threading.Lock()

    def get(self) -> str:
        with self._lock:
            return self._head

    def compare_and_set(self, prev: str, next_: str) -> bool:
        with self._lock:
            if self._head != prev:
                return False
            self._head = next_
            return True


class InMemorySink:
    def __init__(self) -> None:
        self.events: list[AuditEvent] = []

    def append(self, event: AuditEvent) -> None:
        self.events.append(event)


class AuditClient:
    def __init__(
        self,
        sinks: list[AuditSink],
        head: ChainHeadStore,
        clock: Callable[[], datetime] | None = None,
        max_retries: int = 5,
    ) -> None:
        if not sinks:
            raise ValueError("audit-sdk: at least one sink required")
        self._sinks = sinks
        self._head = head
        self._clock = clock or (lambda: datetime.now(tz=timezone.utc))
        self._max_retries = max_retries

    def record(self, raw: AuditEventInput | dict[str, Any]) -> AuditEvent:
        parsed = raw if isinstance(raw, AuditEventInput) else AuditEventInput(**raw)
        event_id = str(uuid.uuid4())
        ts = self._clock().astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        before_hash = hash_payload(parsed.before) if parsed.before else None
        after_hash = hash_payload(parsed.after) if parsed.after else None
        if parsed.outcome_details is not None:
            outcome_hash: Optional[str] = hash_payload(
                {"outcome": parsed.outcome, "details": parsed.outcome_details}
            )
        elif parsed.outcome is not None:
            outcome_hash = hash_payload({"outcome": parsed.outcome})
        else:
            outcome_hash = None

        for _ in range(self._max_retries):
            prev = self._head.get()
            partial = {
                "event_id": event_id,
                "ts": ts,
                "actor": parsed.actor,
                "actor_role": parsed.actor_role,
                "actor_crd": parsed.actor_crd,
                "action": parsed.action,
                "target": parsed.target.model_dump(),
                "before_hash": before_hash,
                "after_hash": after_hash,
                "outcome": parsed.outcome,
                "outcome_hash": outcome_hash,
                "request_id": parsed.request_id,
                "session_id": parsed.session_id,
                "ip": parsed.ip,
                "user_agent": parsed.user_agent,
                "rule_version_id": parsed.rule_version_id,
                "llm_context": parsed.llm_context.model_dump() if parsed.llm_context else None,
                "prev_chain_hash": prev,
            }
            chain_hash = sha256_hex(canonical_json(partial))
            event = AuditEvent(**partial, chain_hash=chain_hash)
            if not self._head.compare_and_set(prev, chain_hash):
                continue
            for sink in self._sinks:
                sink.append(event)
            return event
        raise RuntimeError("audit-sdk: chain head contention exceeded retries")


def verify_chain(events: list[AuditEvent]) -> tuple[bool, Optional[str]]:
    prev = GENESIS_HASH
    for ev in events:
        if ev.prev_chain_hash != prev:
            return False, ev.event_id
        rest = {k: v for k, v in asdict(ev).items() if k != "chain_hash"}
        recomputed = sha256_hex(canonical_json(rest))
        if recomputed != ev.chain_hash:
            return False, ev.event_id
        prev = ev.chain_hash
    return True, None
