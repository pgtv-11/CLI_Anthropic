// First-pass lexicon screen for captured communications. Triggers human review
// when bilingual phrases of concern appear. Claude Haiku is layered on top
// of this screen in F1 — the LLM never replaces it.

export interface LexiconRule {
  id: string;
  pattern: RegExp;
  language: 'en' | 'pt-BR' | 'es' | 'all';
  ruleAnchors: readonly string[];
  severity: 'low' | 'medium' | 'high';
}

export const LEXICON_RULES: readonly LexiconRule[] = [
  {
    id: 'guaranteed-return-en',
    pattern: /\b(guaranteed|risk[- ]free|sure[- ]thing|cant lose|can't lose)\b/i,
    language: 'en',
    ruleAnchors: ['FINRA 2210', 'FINRA 2010'],
    severity: 'high',
  },
  {
    id: 'guaranteed-return-pt',
    pattern: /\b(retorno garantido|garantido|sem risco|certeza de ganho)\b/i,
    language: 'pt-BR',
    ruleAnchors: ['FINRA 2210'],
    severity: 'high',
  },
  {
    id: 'pump-language-pt',
    pattern: /\b(vai bombar|dica quente|papel furado|moonshot)\b/i,
    language: 'pt-BR',
    ruleAnchors: ['FINRA 2210', 'FINRA 5210'],
    severity: 'medium',
  },
  {
    id: 'inside-information-en',
    pattern: /\b(inside info|insider tip|non[- ]public)\b/i,
    language: 'en',
    ruleAnchors: ['SEC 10b-5'],
    severity: 'high',
  },
  {
    id: 'pii-leak',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    language: 'all',
    ruleAnchors: ['Reg S-P'],
    severity: 'medium',
  },
];

export interface LexiconHit {
  ruleId: string;
  excerpt: string;
  ruleAnchors: readonly string[];
  severity: 'low' | 'medium' | 'high';
}

export function screen(text: string, language: 'en' | 'pt-BR' | 'es' | 'unknown'): LexiconHit[] {
  const hits: LexiconHit[] = [];
  for (const rule of LEXICON_RULES) {
    if (rule.language !== 'all' && rule.language !== language && language !== 'unknown') continue;
    const m = rule.pattern.exec(text);
    if (m) {
      hits.push({
        ruleId: rule.id,
        excerpt: text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20),
        ruleAnchors: rule.ruleAnchors,
        severity: rule.severity,
      });
    }
  }
  return hits;
}
