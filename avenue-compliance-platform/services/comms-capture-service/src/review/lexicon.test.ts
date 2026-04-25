import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen } from './lexicon.js';

test('detects guaranteed-return phrasing in English', () => {
  const hits = screen('We have a guaranteed return on this product.', 'en');
  assert.ok(hits.some((h) => h.ruleId === 'guaranteed-return-en'));
});

test('detects pt-BR slang for hot tips', () => {
  const hits = screen('Essa ação vai bombar, dica quente do mercado.', 'pt-BR');
  assert.ok(hits.some((h) => h.ruleId === 'pump-language-pt'));
});

test('flags SSN-shaped PII regardless of language', () => {
  const hits = screen('Send to client ssn 123-45-6789 please', 'unknown');
  assert.ok(hits.some((h) => h.ruleId === 'pii-leak'));
});
