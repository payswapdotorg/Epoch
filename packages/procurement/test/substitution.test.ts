// SUBSTITUTIONS: the constraint-evaluation gate — acceptance REQUIRES a
// constraint-evaluation reference (W004 policy shapes, opaque digest);
// `unevaluated-substitution-rejected` proven; the positive decision
// path carries the evaluation reference.
import { describe, expect, it } from 'vitest';
import {
  admitSubstitutionRequest,
  decideSubstitutionRequest,
  emptySubstitutionStore,
  sealSubstitutionRequest,
  verifySealedSubstitutionDecision,
} from '../src/index';
import { PO_ID, T7, T8, orderChain, unwrap } from './fixtures';

const { orders } = orderChain();

function substitutionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.substitution-request',
    schemaVersion: 1,
    substitutionId: 'substitution:anchor-bolts',
    tenantId: orders.orders[0]!.tenantId,
    poId: PO_ID,
    poVersionDigest: orders.orders[0]!.contentDigest,
    originalLines: [{ description: 'Anchor bolts M24', quantity: '80', unit: 'piece' }],
    substituteLines: [{ description: 'Anchor bolts M27', quantity: '80', unit: 'piece' }],
    requestedAt: T7,
    requestedBy: 'principal:procurement-lead',
    ...overrides,
  };
}

describe('substitutions with constraint evaluation', () => {
  it('a substitution request against the exact PO version is admitted', () => {
    const sealed = unwrap(sealSubstitutionRequest(substitutionContent()));
    const store = unwrap(admitSubstitutionRequest(orders, emptySubstitutionStore(), sealed));
    expect(store.requests).toHaveLength(1);
  });

  it('acceptance WITH the constraint-evaluation reference seals the decision record', () => {
    const request = unwrap(sealSubstitutionRequest(substitutionContent()));
    const store = unwrap(admitSubstitutionRequest(orders, emptySubstitutionStore(), request));
    const decision = unwrap(
      decideSubstitutionRequest(store.requests, {
        request,
        decision: 'accepted',
        constraintEvaluation: { evaluationDigest: 'c'.repeat(64), policyShapeRef: 'policy:material-spec' },
        decidedAt: T8,
        decidedBy: 'principal:chief-engineer',
      }),
    );
    expect(decision.decision).toBe('accepted');
    expect(decision.constraintEvaluation.evaluationDigest).toBe('c'.repeat(64));
    expect(decision.contentDigest).toHaveLength(64);
    expect(verifySealedSubstitutionDecision(decision).ok).toBe(true);
  });

  it('THE GATE: a substitution without an attached evaluation is unevaluated-substitution-rejected', () => {
    const request = unwrap(sealSubstitutionRequest(substitutionContent()));
    const store = unwrap(admitSubstitutionRequest(orders, emptySubstitutionStore(), request));
    const decision = decideSubstitutionRequest(store.requests, {
      request,
      decision: 'accepted',
      // NO constraintEvaluation attached.
      decidedAt: T8,
      decidedBy: 'principal:chief-engineer',
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.error.code).toBe('unevaluated-substitution-rejected');
    if (decision.error.code === 'unevaluated-substitution-rejected') {
      expect(decision.error.substitutionId).toBe('substitution:anchor-bolts');
    }
  });

  it('a malformed evaluation reference is validation (not a silent acceptance)', () => {
    const request = unwrap(sealSubstitutionRequest(substitutionContent()));
    const store = unwrap(admitSubstitutionRequest(orders, emptySubstitutionStore(), request));
    const decision = decideSubstitutionRequest(store.requests, {
      request,
      decision: 'accepted',
      constraintEvaluation: { evaluationDigest: 'not-a-digest' } as never,
      decidedAt: T8,
      decidedBy: 'principal:chief-engineer',
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.error.code).toBe('validation');
  });

  it('a request grounding a stale PO version digest is digest-mismatch; vendor fields rejected', () => {
    const stale = unwrap(sealSubstitutionRequest(substitutionContent({ poVersionDigest: '0'.repeat(64) })));
    const admitted = admitSubstitutionRequest(orders, emptySubstitutionStore(), stale);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');

    const withVendor = sealSubstitutionRequest(substitutionContent({ vendorApproval: 'vendor.example' }));
    expect(withVendor.ok).toBe(false);
    if (withVendor.ok) return;
    expect(withVendor.error.code).toBe('vendor-fields-rejected');
  });
});
