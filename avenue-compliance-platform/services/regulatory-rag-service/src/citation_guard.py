"""Citation guardrails for the regulatory RAG layer.

Enforces three properties before a Claude response is shown to a user:

1. Every assertive sentence in the response cites at least one rule anchor
   present in the retrieved context.
2. Cited anchors must have appeared in the supplied chunks (no LLM-fabricated
   citations).
3. Forbidden phrasing — anything that reads like legal advice — is rejected.

This is the second-line defence; the system prompt in `rag.py` is the first.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CITATION_RE = re.compile(
    r"\[(FINRA|SEC|MSRB|FinCEN|17 CFR|31 CFR)\s+[\w\.\-\(\)§ ]+?\]",
    re.IGNORECASE,
)

FORBIDDEN_PHRASES = (
    "you should",
    "we recommend",
    "i recommend",
    "this is legal advice",
    "as your attorney",
    "you must do",
    "you are required to",
)

ASSERT_SENTENCE_RE = re.compile(r"[^.!?\n]+[.!?]")


@dataclass(frozen=True)
class GuardResult:
    accepted: bool
    reasons: tuple[str, ...]


def _missing_citation_sentences(text: str) -> list[str]:
    bad: list[str] = []
    for sentence in ASSERT_SENTENCE_RE.findall(text):
        s = sentence.strip()
        if not s:
            continue
        # Strip leading bullet markers but still inspect the substantive
        # content — earlier versions skipped bullets entirely, which let
        # un-cited assertions slip through inside lists.
        if s.startswith(("- ", "* ", "• ")):
            s = s[2:].lstrip()
        if not s:
            continue
        if s.endswith("?"):
            continue
        if "according to" in s.lower() or "per " in s.lower() or "—" in s:
            if not CITATION_RE.search(s):
                bad.append(s)
        elif _looks_like_assertion(s) and not CITATION_RE.search(s):
            bad.append(s)
    return bad


def _looks_like_assertion(s: str) -> bool:
    lower = s.lower()
    triggers = (" must ", " requires ", " required ", " shall ", " prohibits ", " mandates ")
    return any(t in f" {lower} " for t in triggers)


def _hallucinated_citations(text: str, allowed_anchors: set[str]) -> list[str]:
    cited = {m.group(0).strip("[]").strip() for m in CITATION_RE.finditer(text)}
    normalized_allowed = {a.strip().lower() for a in allowed_anchors}
    return [c for c in cited if c.lower() not in normalized_allowed]


def _forbidden(text: str) -> list[str]:
    lower = text.lower()
    return [p for p in FORBIDDEN_PHRASES if p in lower]


def guard(response: str, allowed_anchors: set[str]) -> GuardResult:
    reasons: list[str] = []

    forbidden = _forbidden(response)
    if forbidden:
        reasons.append(f"forbidden_phrasing:{','.join(forbidden)}")

    missing = _missing_citation_sentences(response)
    if missing:
        reasons.append(f"missing_citation_in:{len(missing)}_assertions")

    halluc = _hallucinated_citations(response, allowed_anchors)
    if halluc:
        reasons.append(f"hallucinated_citations:{','.join(halluc)}")

    return GuardResult(accepted=not reasons, reasons=tuple(reasons))
