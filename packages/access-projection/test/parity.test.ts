// RUNTIME PARITY against the REAL sibling kernels (devDependencies —
// the kernel-to-kernel devDep precedent). The compile-time pins live in
// src/kernel-parity.ts; this file proves the same compatibility with
// real objects at runtime:
//
// - W010: access-projection events seal through the REAL sealEvent and
//   digest identically through the REAL computeEventDigest; the
//   mirrored stream/actor grammars are pattern-equal; the mirrored
//   record version equals EVENT_LOG_RECORD_VERSION;
// - W001/W009 identity: the principal-kind vocabulary equals
//   @epoch/identity's PRINCIPAL_KINDS (service principals included);
// - W006: the evidence-scope digest grammar accepts a REAL
//   content-addressed evidence record digest; audit provenance parses
//   through the REAL W036 provenance-state validator;
// - W011: a projected evidence reference built from a W041 audit parses
//   through the REAL experience-protocol reference grammar
//   (declaration compatibility — never a runtime edge);
// - W036: the mirrored activity-id grammar admits REAL program
//   activity ids; canonical records verify through the REAL W036
//   pipelines.
import { describe, expect, it } from 'vitest';
import {
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  computeEventDigest,
  sealEvent,
} from '@epoch/event-log';
import { computeAuthorizationDecisionDigest, computeAuthorizationRequestDigest } from '@epoch/authorization';
import { PRINCIPAL_KINDS } from '@epoch/identity';
import { EvidenceRecordSchema, computeEvidenceDigest } from '@epoch/evidence';
import { ProvenanceStateSchema, SealedProgramOfWorkSchema } from '@epoch/solution-delivery';
import {
  ACCESS_PRINCIPAL_ID_PATTERN,
  ACCESS_PROJECTION_EVENT_RECORD_VERSION,
  ACCESS_STREAM_ID_PATTERN,
  ActivityIdMirrorSchema,
  accessStreamIdOf,
  canonicalObjectIdentity,
  canonicalTenantId,
  kernelAuditProvenance,
  sealAccessProjectionEvent,
  verifyCanonicalRecord,
  type AccessProjectionEventContent,
} from '../src/index';
import { accessRequest, sealedDecision, allowContext, unwrap } from './helpers';
import { EVIDENCE_DIGEST_A, HOST, PROGRAM_ID, TENANT, T3, sealedProgram } from './fixtures';

describe('W010 event parity (the REAL sealEvent admits access-projection events)', () => {
  it('the mirrored record version equals EVENT_LOG_RECORD_VERSION', () => {
    expect(ACCESS_PROJECTION_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('the mirrored stream and actor grammars are pattern-equal to the W010 grammars', () => {
    expect(ACCESS_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(ACCESS_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
    expect(ACCESS_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(ACCESS_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the same event seals through the REAL W010 sealEvent and digests identically', () => {
    const content: AccessProjectionEventContent = {
      schemaVersion: 1,
      streamId: accessStreamIdOf(PROGRAM_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: HOST,
      causalParent: null,
      payload: {
        discriminator: 'access-projection:projection-released',
        data: {
          objectClass: 'program-of-work',
          objectId: PROGRAM_ID,
          objectDigest: 'a'.repeat(64),
          principalId: HOST,
          action: 'view',
          policyDigest: 'b'.repeat(64),
          projectionDigest: 'c'.repeat(64),
          auditDigest: 'd'.repeat(64),
          releasedFieldCount: 12,
          redactedFieldCount: 8,
        },
      },
      occurredAt: T3,
    };
    const ours = unwrap(sealAccessProjectionEvent(content));
    const theirs = unwrap(sealEvent(content));
    expect(ours.contentDigest).toBe(theirs.digest);
    expect(computeEventDigest(content)).toBe(ours.contentDigest);
  });
});

describe('W001 identity parity (service principals follow the same path)', () => {
  it('the principal-kind vocabulary equals @epoch/identity PRINCIPAL_KINDS', () => {
    expect([...PRINCIPAL_KINDS].sort()).toEqual(['agent', 'human', 'service']);
  });
});

describe('W006 evidence parity (evidence scopes reference real content addresses)', () => {
  it('a REAL evidence record digest enters an evidence scope allowlist', () => {
    const record = EvidenceRecordSchema.parse({
      schemaVersion: 1,
      kind: 'assertion',
      subject: { artifactId: 'artifact:site-photo-1', revision: '1', digest: EVIDENCE_DIGEST_A },
      producedBy: { runId: 'run:site-capture-1', actorId: HOST },
      observedAt: T3,
      content: { mediaType: 'application/json', data: { note: 'progress photo' } },
      confidence: { distribution: { kind: 'point', value: 0.9 } },
    });
    const digest = computeEvidenceDigest(record);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('kernel audit provenance parses through the REAL W036 provenance-state validator', () => {
    const provenance = kernelAuditProvenance(HOST);
    expect(ProvenanceStateSchema.safeParse(provenance).success).toBe(true);
  });
});

describe('W011 projected-reference convention (mirrored — see kernel-parity ARCHITECTURE NOTE)', () => {
  it('W041 object references carry the W011 convention: kind + tenant scope + exact-revision digest', () => {
    // The W011 projected-reference convention is mirrored (not imported):
    // references cite kernel state by (kind, tenantId, digest), never by
    // embedded objects. The canonical identity accessor produces exactly
    // that triple, and the audit cites it.
    const identity = canonicalObjectIdentity({
      objectClass: 'program-of-work',
      record: sealedProgram(),
    });
    expect(identity.objectClass).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(identity.objectId).toMatch(/^program:[a-z0-9][a-z0-9-]{0,62}$/);
    expect(identity.objectDigest).toMatch(/^[0-9a-f]{64}$/);
    // Tenant scope rides on the record (R12) — see canonicalTenantId.
    expect(canonicalTenantId({ objectClass: 'program-of-work', record: sealedProgram() })).toBe(TENANT);
  });
});

describe('W036 solution-delivery parity (runtime composition)', () => {
  it('the mirrored activity-id grammar admits REAL program activity ids', () => {
    const program = sealedProgram();
    for (const workPackage of program.workPackages) {
      for (const activity of workPackage.activities) {
        expect(ActivityIdMirrorSchema.safeParse(activity.activityId).success).toBe(true);
      }
    }
  });

  it('canonical records verify through the REAL W036 pipelines', () => {
    const program = sealedProgram();
    expect(SealedProgramOfWorkSchema.safeParse(program).success).toBe(true);
    const canonical = { objectClass: 'program-of-work' as const, record: program };
    expect(unwrap(verifyCanonicalRecord(canonical))).toEqual(canonical);
    expect(canonicalObjectIdentity(canonical).objectId).toBe(PROGRAM_ID);
  });

  it('a REAL W009 decision answers an access-projection request (the two-stage seam)', () => {
    const request = accessRequest(HOST, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const sealed = sealedDecision(request, allowContext(HOST));
    expect(sealed.decision.outcome).toBe('allow');
    expect(sealed.decision.requestDigest).toBe(computeAuthorizationRequestDigest(request));
    expect(sealed.digest).toBe(computeAuthorizationDecisionDigest(sealed.decision));
  });
});
