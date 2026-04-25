"""Regulatory Knowledge Base (P6) — Claude-powered Q&A over FINRA/SEC corpus.

Design principles:
* The model **assists** compliance staff. It never decides.
* Every assertive sentence must carry a rule anchor (e.g. ``[FINRA 3110(b)(1)]``).
* Anchors must come from the retrieved chunks; hallucinated citations are blocked.
* All inputs and outputs are logged via the audit SDK with prompt/response hashes.
* The corpus is versioned by effective date — a query can be replayed against a
  past rulebook bundle for reproducibility (P7).
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from typing import Any

import anthropic
from pydantic import BaseModel

from .citation_guard import GuardResult, guard

CLAUDE_REASONING_MODEL = "claude-sonnet-4-5"
CLAUDE_TRIAGE_MODEL = "claude-haiku-4-5"

SYSTEM_PROMPT = """You are an internal regulatory research assistant for Avenue Securities LLC, a US broker-dealer registered with SEC and FINRA.

You operate strictly within these rules:

1. You do NOT give legal advice. You summarize what the regulatory text says.
2. Every factual assertion must be followed by an inline citation in square brackets
   that anchors to the retrieved corpus, e.g. [FINRA 3110(b)(1)] or [SEC 17 CFR 240.17a-4(f)].
3. You may only cite anchors that appear in the provided <corpus> chunks.
   If a needed rule is not in the corpus, say so and stop.
4. Use neutral descriptive language ("the rule states", "the rule requires").
   NEVER say "you should", "we recommend", "you must do", or anything resembling legal advice.
5. When asked about effective-date specifics, rely solely on the bundle's
   `effective_from`/`effective_to` metadata in the corpus chunks.
6. If the question is operational (e.g. "what should we do") rather than research,
   refuse: "This service summarizes rules; operational decisions belong to a
   licensed compliance officer."

Output format: prose with inline anchors, then a final line `CITATIONS:` listing
all anchors used.
"""


@dataclass(frozen=True)
class CorpusChunk:
    anchor: str
    text: str
    bundle_version: str
    effective_from: str
    effective_to: str | None


class RagQuery(BaseModel):
    question: str
    bundle_version: str | None = None
    actor: str
    actor_role: str
    request_id: str
    session_id: str


class RagAnswer(BaseModel):
    answer: str
    citations: list[str]
    bundle_version: str
    model: str
    prompt_hash: str
    response_hash: str
    guard: dict[str, Any]


class CorpusRetriever:
    """Retrieve top-K chunks from the rulebook vector store."""

    def search(self, query: str, bundle_version: str, k: int = 8) -> list[CorpusChunk]:
        raise NotImplementedError


class RagService:
    def __init__(
        self,
        retriever: CorpusRetriever,
        anthropic_client: anthropic.Anthropic | None = None,
        active_bundle_version: str | None = None,
    ) -> None:
        self._retriever = retriever
        self._client = anthropic_client or anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self._active_bundle_version = active_bundle_version or os.environ.get(
            "RULEBOOK_BUNDLE_VERSION", "unknown"
        )

    def ask(self, query: RagQuery) -> RagAnswer:
        bundle = query.bundle_version or self._active_bundle_version
        chunks = self._retriever.search(query.question, bundle_version=bundle)
        allowed_anchors = {c.anchor for c in chunks}

        corpus_block = "\n\n".join(
            f"<chunk anchor=\"{c.anchor}\" effective_from=\"{c.effective_from}\">\n{c.text}\n</chunk>"
            for c in chunks
        )
        user_prompt = (
            f"<corpus bundle_version=\"{bundle}\">\n{corpus_block}\n</corpus>\n\n"
            f"<question>{query.question}</question>"
        )

        prompt_hash = _sha256(SYSTEM_PROMPT + "\n" + user_prompt)

        message = self._client.messages.create(
            model=CLAUDE_REASONING_MODEL,
            max_tokens=1500,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = "".join(b.text for b in message.content if b.type == "text")
        response_hash = _sha256(text)

        guard_result: GuardResult = guard(text, allowed_anchors)

        if not guard_result.accepted:
            text = (
                "[guardrail] The model response failed citation/safety checks "
                f"({', '.join(guard_result.reasons)}). Refer to a compliance officer."
            )

        citations = sorted(
            {m.strip("[]").strip() for m in _extract_anchors(text)} & allowed_anchors
        )

        return RagAnswer(
            answer=text,
            citations=citations,
            bundle_version=bundle,
            model=CLAUDE_REASONING_MODEL,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            guard={"accepted": guard_result.accepted, "reasons": list(guard_result.reasons)},
        )


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _extract_anchors(text: str) -> list[str]:
    from .citation_guard import CITATION_RE

    return [m.group(0) for m in CITATION_RE.finditer(text)]
