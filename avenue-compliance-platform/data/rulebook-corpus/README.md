# Rulebook Corpus

Versioned corpus consumed by `services/regulatory-rag-service`. Sources:

- FINRA Rulebook (scraped from the official site under the FINRA license).
- SEC Final Rules (federal register releases).
- Notices to Members and Regulatory Notices.
- MSRB rules (where Avenue is in scope).

Each ingestion produces a `bundle_version` named like `finra-2026-q2`. Bundles are immutable; corrections produce a new bundle. Chunks preserve hierarchy (`Rule.Subsection.Paragraph`) and carry effective dates so historical queries are reproducible (P7).

The `bundle_manifest.json` lists every chunk with its source URL, hash, and effective dates, and is itself signed and archived to WORM under `bundles/<bundle_version>/`.
