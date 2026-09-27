// Round-trip serialization + digest verification for every public
// sealed type: policies, projections, audit records, and events
// (seal -> JSON -> parse -> verify -> digest equality; tamper ->
// digest-mismatch). Redaction markers round-trip inside projections.
import { describe, expect, it } from 'vitest';
import {
  evaluateProjection,
  sealAccessProjectionEvent,
  sealProjectionPolicy,
  verifySealedAccessProjectionEvent,
  verifySealedAuthorizedProjection,
  verifySealedProjectionAudit,
  verifySealedProjectionPolicy,
  accessStreamIdOf,
} from '../src/index';
import { unwrap, accessRequest, allowContext, sealedDecision } from './helpers';
import {
  CLIENT,
  HOST,
  PROGRAM_ID,
  ROLE_CLIENT,
  TENANT,
  T3,
  sealedProgram,
  standardPolicyContent,
} from './fixtures';

const PROGRAM = sealedProgram();
const CANONICAL = { objectClass: 'program-of-work' as const, record: PROGRAM };

function roundTrip<T>(sealed: T): T {
  return JSON.parse(JSON.stringify(sealed)) as T;
}

describe('policy round-trip (seal -> JSON -> verify)', () => {
  it('a sealed policy survives serialization and verifies', () => {
    const sealed = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const parsed = roundTrip(sealed);
    const verified = unwrap(verifySealedProjectionPolicy(parsed));
    expect(verified).toEqual(sealed);
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });

  it('a serialized tampered policy is digest-mismatch', () => {
    const sealed = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const tampered = { ...roundTrip(sealed), title: 'A tampered title' };
    const result = verifySealedProjectionPolicy(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});

describe('projection + audit round-trip (seal -> JSON -> verify)', () => {
  function releasedPair() {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    return unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
        policy: unwrap(sealProjectionPolicy(standardPolicyContent())),
        record: CANONICAL,
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
  }

  it('a sealed projection (with redaction markers) survives serialization and verifies', () => {
    const result = releasedPair();
    if (result.outcome !== 'released') throw new Error('expected released');
    const parsed = roundTrip(result.projection);
    const verified = unwrap(verifySealedAuthorizedProjection(parsed));
    expect(verified).toEqual(result.projection);
    expect(verified.contentDigest).toBe(result.projection.contentDigest);
    const marker = verified.entries.find((entry) => entry.kind === 'redacted');
    expect(marker).toBeDefined();
    if (marker !== undefined && marker.kind === 'redacted') {
      expect(marker.clause.policyId).toBe('policy:tower-retrofit-access');
      expect(marker.redactionClass).toMatch(
        /^(commercial-sensitive|supplier-sensitive|evidence-scoped|principal-identifying|policy-scoped|task-scoped)$/,
      );
    }
  });

  it('a serialized tampered projection is digest-mismatch', () => {
    const result = releasedPair();
    if (result.outcome !== 'released') throw new Error('expected released');
    const tampered = {
      ...roundTrip(result.projection),
      objectDigest: 'f'.repeat(64),
    };
    const verification = verifySealedAuthorizedProjection(tampered);
    expect(verification.ok).toBe(false);
    if (!verification.ok) expect(verification.error.code).toBe('digest-mismatch');
  });

  it('a sealed audit record survives serialization and verifies', () => {
    const result = releasedPair();
    if (result.outcome !== 'released') throw new Error('expected released');
    const parsed = roundTrip(result.audit);
    const verified = unwrap(verifySealedProjectionAudit(parsed));
    expect(verified.contentDigest).toBe(result.audit.contentDigest);
  });

  it('a serialized tampered audit record is digest-mismatch', () => {
    const result = releasedPair();
    if (result.outcome !== 'released') throw new Error('expected released');
    const tampered = { ...roundTrip(result.audit), outcome: 'denied' as const };
    const verification = verifySealedProjectionAudit(tampered);
    expect(verification.ok).toBe(false);
    if (!verification.ok) expect(verification.error.code).toBe('digest-mismatch');
  });
});

describe('event round-trip (seal -> JSON -> verify)', () => {
  it('a sealed access-projection event survives serialization and verifies', () => {
    const sealed = unwrap(
      sealAccessProjectionEvent({
        schemaVersion: 1,
        streamId: accessStreamIdOf(PROGRAM_ID),
        sequence: 1,
        tenantId: TENANT,
        actor: HOST,
        causalParent: null,
        payload: {
          discriminator: 'access-projection:policy-registered',
          data: {
            policyId: 'policy:tower-retrofit-access',
            revision: 1,
            policyDigest: 'a'.repeat(64),
            status: 'active',
            bindingCount: 4,
          },
        },
        occurredAt: T3,
      }),
    );
    const parsed = roundTrip(sealed);
    const verified = unwrap(verifySealedAccessProjectionEvent(parsed));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
    expect(verified.payload.discriminator).toBe('access-projection:policy-registered');
  });

  it('a serialized tampered event is digest-mismatch', () => {
    const sealed = unwrap(
      sealAccessProjectionEvent({
        schemaVersion: 1,
        streamId: accessStreamIdOf(PROGRAM_ID),
        sequence: 1,
        tenantId: TENANT,
        actor: HOST,
        causalParent: null,
        payload: {
          discriminator: 'access-projection:state-projected',
          data: { policyCount: 1, recordCount: 1, projectionCount: 0, auditCount: 0 },
        },
        occurredAt: T3,
      }),
    );
    const tampered = { ...roundTrip(sealed), sequence: 2 };
    const verification = verifySealedAccessProjectionEvent(tampered);
    expect(verification.ok).toBe(false);
    if (!verification.ok) expect(verification.error.code).toBe('digest-mismatch');
  });
});
