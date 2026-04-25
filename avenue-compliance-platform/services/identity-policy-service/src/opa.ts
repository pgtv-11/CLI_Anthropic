import { z } from 'zod';

// Thin client over the OPA decision API. Every authorization check goes
// through this client; deny is the default and missing context fails closed.

export const PolicyDecisionSchema = z.object({
  allow: z.boolean(),
  denies: z.array(z.string()).default([]),
  examinerOverride: z.boolean().default(false),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export interface PolicyInput {
  subject: { id: string; roles: string[]; crd?: string };
  action: string;
  resource: { kind: string; id: string; [key: string]: unknown };
  context: { now: string; requestId: string; examinerSession?: { id: string; expiresAt: string; watermark: string } };
}

export class OpaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async evaluate(path: string, input: PolicyInput): Promise<PolicyDecision> {
    const res = await this.fetcher(`${this.baseUrl}/v1/data/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) {
      // Fail-closed — never allow on infrastructure error.
      return { allow: false, denies: [`opa_unreachable:${res.status}`], examinerOverride: false };
    }
    const json = (await res.json()) as { result?: unknown };
    const parsed = PolicyDecisionSchema.safeParse(json.result);
    if (!parsed.success) {
      return { allow: false, denies: ['opa_decision_malformed'], examinerOverride: false };
    }
    return parsed.data;
  }
}

export class CompositePolicyEngine {
  constructor(private readonly opa: OpaClient) {}

  /**
   * Authorize a request through three independent OPA bundles.
   *
   * Order: examiner-mode → SoD → RBAC. **All three** must allow; any deny is
   * terminal. The SoD bundle internally references RBAC (via
   * ``data.avenue.rbac.allow``) so a single-bundle deployment still works,
   * but we evaluate RBAC explicitly here as defence-in-depth: if one bundle
   * is misconfigured or unloaded, the other still enforces.
   */
  async authorize(input: PolicyInput): Promise<PolicyDecision> {
    if (input.subject.roles.includes('examiner_external')) {
      const examiner = await this.opa.evaluate('avenue/examiner', input);
      if (!examiner.allow) return examiner;
    }
    const sod = await this.opa.evaluate('avenue/sod', input);
    if (!sod.allow) return sod;
    const rbac = await this.opa.evaluate('avenue/rbac', input);
    if (!rbac.allow) return rbac;
    return { allow: true, denies: [], examinerOverride: false };
  }
}
