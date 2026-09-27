// W017 acceptance: the authoring surface — optional, foundation-backed,
// PROJECTIONS. Typed proposals through the kernel-seam shapes (R30
// action-type reference), zero shell authority: status is always
// `proposed`, authority attempts are typed authority-violations, and
// cross-tenant proposals are denied (R12).
import { describe, expect, it } from 'vitest';
import { ControlIntentSchema } from '@epoch/experience-protocol';
import {
  admitProposalForTenant,
  parseAuthoringProposal,
  proposeAuthoring,
  rejectAuthoringAuthority,
  sealAuthoringProposal,
  verifyAuthoringProposal,
} from '../src/index';
import { PRINCIPAL, TENANT_A, TENANT_B, expectFailure } from './fixtures';

const AUTHORING_INPUT = {
  proposalId: 'ap-0001',
  sessionId: 'dss-alpha-1',
  windowId: 'win-alpha',
  actor: PRINCIPAL,
  actionType: { id: 'world.view.annotate', version: '1.0.0' },
  parameters: { note: 'reference annotation' },
  rationale: 'operator intent',
  tenantScope: { tenantId: TENANT_A },
  proposedAtMs: 60,
} as const;

describe('typed authoring proposals', () => {
  it('builds a sealed, content-addressed proposal with status "proposed"', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    expect(proposal.ok).toBe(true);
    if (proposal.ok) {
      expect(proposal.value.status).toBe('proposed');
      expect(proposal.value.provenance.origin).toBe('desktop-authoring-surface');
      expect(proposal.value.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyAuthoringProposal(proposal.value)).toBe(true);
    }
  });

  it('uses the R30 kernel-seam action-type shape (parses as a control intent)', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    expect(ControlIntentSchema.safeParse(proposal.value.actionType).success).toBe(true);
  });

  it('identical inputs produce the identical digest (determinism)', () => {
    const a = proposeAuthoring(AUTHORING_INPUT);
    const b = proposeAuthoring(AUTHORING_INPUT);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.digest).toBe(b.value.digest);
    }
  });

  it('round-trip: seal -> JSON -> parse -> identical proposal', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    const parsed = parseAuthoringProposal(JSON.parse(JSON.stringify(proposal.value)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(proposal.value);
    }
  });

  it('tamper detection: a mutated proposal fails the digest gate', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    expectFailure(parseAuthoringProposal({ ...proposal.value, rationale: 'tampered' }), 'digest-mismatch');
  });

  it('version skew fails fast (version-unsupported)', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    expectFailure(
      parseAuthoringProposal({ ...proposal.value, protocolVersion: '2.0.0' }),
      'version-unsupported',
    );
  });

  it('unknown (vendor/authority) fields are rejected on the strict record', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    // An approval smuggled as an unknown field: the strict object rejects
    // it (the schema gate fires before the digest gate).
    const smuggled = { ...proposal.value, approvedBy: 'someone' };
    expectFailure(parseAuthoringProposal(smuggled), 'malformed-record');
    // Reseated so the digest is VALID: the strict record still rejects it
    // — the rejection is structural, not incidental.
    const { digest: _d, ...content } = smuggled;
    void _d;
    const resealed = sealAuthoringProposal(content as never);
    expectFailure(parseAuthoringProposal(resealed), 'malformed-record');
  });

  it('rejects malformed authoring intents at build time (malformed-record)', () => {
    expectFailure(
      proposeAuthoring({ ...AUTHORING_INPUT, actionType: { id: 'not-qualified', version: '1.0.0' } }),
      'malformed-record',
    );
    expectFailure(
      proposeAuthoring({ ...AUTHORING_INPUT, actor: 'not-a-principal' }),
      'malformed-record',
    );
  });
});

describe('the authoring authority guard (the shell holds NO authority)', () => {
  it('rejects self-approval attempts with the typed authority-violation', () => {
    expectFailure(
      rejectAuthoringAuthority({ kind: 'self-approve', proposalId: 'ap-0001' }),
      'authority-violation',
    );
  });

  it('rejects self-execution attempts with the typed authority-violation', () => {
    expectFailure(
      rejectAuthoringAuthority({ kind: 'self-execute', proposalId: 'ap-0001' }),
      'authority-violation',
    );
  });

  it('rejects authority claims with the typed authority-violation', () => {
    expectFailure(rejectAuthoringAuthority({ kind: 'claim-authority' }), 'authority-violation');
  });

  it('rejects kernel-state embed attempts with the typed authority-violation', () => {
    expectFailure(rejectAuthoringAuthority({ kind: 'embed-kernel-state' }), 'authority-violation');
  });

  it('the proposal schema admits ONLY the "proposed" status (no approve/execute vocabulary exists)', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    // A record claiming an executed status: resealed with valid digest,
    // the literal status gate still rejects it.
    const { digest: _d, ...content } = { ...proposal.value, status: 'executed' };
    void _d;
    const forged = sealAuthoringProposal(content as never);
    expectFailure(parseAuthoringProposal(forged), 'malformed-record');
  });
});

describe('authoring tenant isolation (R12)', () => {
  it('admits a proposal for its own tenant', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    const admitted = admitProposalForTenant(proposal.value, TENANT_A);
    expect(admitted.ok).toBe(true);
  });

  it('denies a proposal submitted for another tenant (cross-tenant-denied)', () => {
    const proposal = proposeAuthoring(AUTHORING_INPUT);
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    expectFailure(admitProposalForTenant(proposal.value, TENANT_B), 'cross-tenant-denied');
  });
});
