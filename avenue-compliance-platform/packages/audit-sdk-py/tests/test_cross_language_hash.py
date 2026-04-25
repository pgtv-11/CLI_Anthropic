"""Cross-language compatibility vectors for canonical_json + sha256_hex.

These vectors are duplicated verbatim in the TypeScript SDK
(`packages/audit-sdk/src/cross_language.test.ts`). Any divergence breaks the
hash chain across services and is a Round-2 regression.

The expected canonical strings reflect what BOTH Node's ``JSON.stringify`` and
Python's ``json.dumps(ensure_ascii=False, sort_keys=True, separators=...)``
produce; the SHA-256 in turn hashes the UTF-8 byte representation of that
string.
"""

import hashlib

from avenue_audit import canonical_json, sha256_hex


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


VECTORS = [
    ({"b": 1, "a": 2}, '{"a":2,"b":1}'),
    ([3, 1, 2], "[3,1,2]"),
    ({"k": "Ítalo"}, '{"k":"Ítalo"}'),
    ({"k": None, "x": []}, '{"k":null,"x":[]}'),
    ({"unicode": "açaí 🇧🇷"}, '{"unicode":"açaí 🇧🇷"}'),
]


def test_canonical_json_matches_expected():
    for inp, expected_json in VECTORS:
        assert canonical_json(inp) == expected_json, (inp, expected_json)


def test_sha256_canonical_matches_utf8_hash():
    for inp, expected_json in VECTORS:
        assert sha256_hex(canonical_json(inp)) == _sha(expected_json)
