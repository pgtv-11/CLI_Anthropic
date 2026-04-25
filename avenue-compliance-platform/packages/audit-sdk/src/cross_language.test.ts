// Cross-language compatibility vectors. Mirrors
// packages/audit-sdk-py/tests/test_cross_language_hash.py — any divergence
// breaks the hash chain between the TS and Python SDKs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, sha256Hex } from './hash.js';

// Both Node's JSON.stringify and Python's json.dumps(ensure_ascii=False)
// emit non-ASCII characters as literal UTF-8, NOT \uXXXX. The SHA-256 layer
// then hashes the UTF-8 byte representation, which is identical across SDKs.
const VECTORS: ReadonlyArray<readonly [unknown, string]> = [
  [{ b: 1, a: 2 }, '{"a":2,"b":1}'],
  [[3, 1, 2], '[3,1,2]'],
  [{ k: 'Ítalo' }, '{"k":"Ítalo"}'],
  [{ k: null, x: [] }, '{"k":null,"x":[]}'],
  [{ unicode: 'açaí 🇧🇷' }, '{"unicode":"açaí 🇧🇷"}'],
];

test('canonical JSON matches expected for each vector', () => {
  for (const [inp, expected] of VECTORS) {
    assert.equal(canonicalJson(inp), expected, JSON.stringify(inp));
  }
});

test('sha256 of canonical form is stable per vector', () => {
  for (const [inp, expected] of VECTORS) {
    assert.equal(sha256Hex(canonicalJson(inp)), sha256Hex(expected));
  }
});
