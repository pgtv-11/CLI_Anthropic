"""FastAPI entrypoint for the regulatory RAG service."""

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status

from .rag import CorpusChunk, CorpusRetriever, RagAnswer, RagQuery, RagService

app = FastAPI(title="Avenue Regulatory RAG", version="0.1.0")


class _OpenSearchRetriever(CorpusRetriever):
    """Production retriever — backed by OpenSearch k-NN over rulebook embeddings.

    Wired to a real OpenSearch index in F6. The shape below is illustrative.
    """

    def __init__(self, host: str, index: str) -> None:
        self.host = host
        self.index = index

    def search(self, query: str, bundle_version: str, k: int = 8) -> list[CorpusChunk]:
        # Implementation deferred to F6: query OpenSearch with hybrid BM25 + k-NN,
        # filter by bundle_version, return top-k as CorpusChunk.
        raise NotImplementedError("Implemented in F6 — swap for production wiring.")


def _service() -> RagService:
    retriever = _OpenSearchRetriever(
        host=os.environ.get("OPENSEARCH_HOST", "localhost:9200"),
        index=os.environ.get("RULEBOOK_INDEX", "rulebook-corpus"),
    )
    return RagService(retriever=retriever)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/ask", response_model=RagAnswer)
def ask(q: RagQuery, svc: RagService = Depends(_service)) -> RagAnswer:
    try:
        return svc.ask(q)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="rulebook-corpus not yet indexed (F6)",
        )
