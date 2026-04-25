import {
  evaluateRegBI,
  RegBIInput,
  RegBIResult,
  UnknownRuleVersionError,
} from './regbi_check.js';

// Handler-layer wrapper that converts an UnknownRuleVersionError into a
// structured policy-deny outcome. Without this mapping, the API gateway's
// audit middleware records HANDLER_ERROR for every unknown ruleVersionId,
// hiding the regulatory cause from examiners.
//
// Callers (gateway-bound recommendation submission) should:
//   1. Pass the input + auditCtx through this handler.
//   2. On `kind = 'denied'`, the gateway records POLICY_DENY with the
//      offending ruleVersionId in outcomeDetails and returns 403.
//   3. On `kind = 'evaluated'`, the gateway records SUCCESS with
//      thresholdsApplied.ruleVersionId for reproducibility.

export type HandlerResult =
  | { kind: 'evaluated'; result: RegBIResult }
  | { kind: 'denied'; reason: 'unknown-rule-version'; ruleVersionId: string };

export function handleRegBI(input: RegBIInput): HandlerResult {
  try {
    return { kind: 'evaluated', result: evaluateRegBI(input) };
  } catch (err) {
    if (err instanceof UnknownRuleVersionError) {
      return {
        kind: 'denied',
        reason: 'unknown-rule-version',
        ruleVersionId: err.ruleVersionId,
      };
    }
    throw err;
  }
}
