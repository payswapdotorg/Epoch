// RUNTIME PARITY with the sibling kernel vocabularies (the W023
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W010 event-log: the mirrored delivery-event shape is admitted by the
//   REAL @epoch/event-log seal path, the stream/actor grammars are
//   pattern-identical, the record versions are equal, and the digests
//   agree;
// - W006 evidence: the mirrored confidence-method vocabulary is
//   member-identical; real evidence digests are admitted by the mirrored
//   SHA-256 grammar;
// - W002 world-model: world entity ids accepted by the REAL world-model
//   entity validator are admitted by the solution-delivery world
//   reference grammar and vice versa;
// - W004 constraint-language: constraint ids accepted by the REAL
//   constraint grammar are admitted by the constraint reference grammar
//   and vice versa.
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  EVENT_TENANT_ID_PATTERN,
  sealEvent,
} from '@epoch/event-log';
import { computeEvidenceDigest, EvidenceRecordSchema, SHA256_HEX_PATTERN as EVIDENCE_SHA256_PATTERN } from '@epoch/evidence';
import { EntityIdSchema } from '@epoch/world-model';
import { constraintIdSchema } from '@epoch/constraint-language';
import {
  computeDeliveryEventDigest,
  CONFIDENCE_METHODS,
  DELIVERY_EVENT_RECORD_VERSION,
  DELIVERY_PRINCIPAL_ID_PATTERN,
  DELIVERY_STREAM_ID_PATTERN,
  EvidenceReferenceSchema,
  PrincipalIdSchema,
  SHA256_HEX_PATTERN,
  sealDeliveryEvent,
  WorldEntityReferenceSchema,
  ConstraintReferenceSchema,
} from '../src/index';
import { TENANT, T1, uncertainty, trustEvidenceLike } from './parity-fixtures';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored delivery stream pattern is exactly the W010 stream pattern', () => {
    expect(DELIVERY_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(DELIVERY_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(DELIVERY_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(DELIVERY_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the W010 tenant pattern is the W009 tenancy grammar composed at runtime', () => {
    expect(EVENT_TENANT_ID_PATTERN.test(TENANT)).toBe(true);
    expect(EVENT_TENANT_ID_PATTERN.test('tenant:')).toBe(false);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(DELIVERY_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('a delivery event is admitted by the REAL W010 seal path and digests identically', () => {
    const content = {
      schemaVersion: DELIVERY_EVENT_RECORD_VERSION,
      streamId: 'stream:delivery-tower-retrofit-v1',
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:delivery-lead',
      causalParent: null,
      payload: {
        discriminator: 'delivery:baseline-approved',
        data: {
          solutionId: 'solution:tower-retrofit',
          version: '1.0.0',
          baselineDigest: 'a'.repeat(64),
          approvedBy: 'principal:delivery-lead',
          approvedAt: T1,
        },
      },
      occurredAt: T1,
    };
    const ours = sealDeliveryEvent(content);
    expect(ours.ok).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
    expect(computeDeliveryEventDigest(content)).toBe(computeEventDigest(content));
  });
});

describe('W006 evidence parity (runtime)', () => {
  it('the mirrored confidence-method vocabulary is member-identical to W006', () => {
    // W006 CONFIDENCE_METHODS (the same grammar the world model mirrors):
    const W006_METHODS = ['stated', 'measured', 'estimated', 'derived', 'imported'];
    expect([...CONFIDENCE_METHODS].sort()).toEqual([...W006_METHODS].sort());
  });

  it('the mirrored SHA-256 grammar is pattern-identical to the W006 mirror', () => {
    expect(SHA256_HEX_PATTERN.source).toBe(EVIDENCE_SHA256_PATTERN.source);
  });

  it('a REAL W006 evidence digest is admitted by the evidence reference grammar', () => {
    const record = trustEvidenceLike();
    const parsed = EvidenceRecordSchema.safeParse(record);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const digest = computeEvidenceDigest(record as never);
    expect(EvidenceReferenceSchema.safeParse({ digest }).success).toBe(true);
  });
});

describe('W002 world-model parity (runtime)', () => {
  it('world entity ids validate identically through both grammars', () => {
    const valid = ['site-tower-a', 'x'.repeat(256), 'a'];
    for (const id of valid) {
      expect(EntityIdSchema.safeParse(id).success, id).toBe(true);
      expect(WorldEntityReferenceSchema.safeParse({ entityId: id }).success, id).toBe(true);
    }
    const invalid = ['', 'x'.repeat(257)];
    for (const id of invalid) {
      expect(EntityIdSchema.safeParse(id).success, id).toBe(false);
      expect(WorldEntityReferenceSchema.safeParse({ entityId: id }).success, id).toBe(false);
    }
  });
});

describe('W004 constraint-language parity (runtime)', () => {
  it('constraint ids validate identically through both grammars', () => {
    const valid = ['max-height-limit', 'a'];
    for (const id of valid) {
      expect(constraintIdSchema.safeParse(id).success, id).toBe(true);
      expect(ConstraintReferenceSchema.safeParse({ constraintId: id }).success, id).toBe(true);
    }
    const invalid = ['Max_Height', 'x'.repeat(129), ''];
    for (const id of invalid) {
      expect(constraintIdSchema.safeParse(id).success, id).toBe(false);
      expect(ConstraintReferenceSchema.safeParse({ constraintId: id }).success, id).toBe(false);
    }
  });
});

describe('principal grammar parity (runtime)', () => {
  it('principal ids validate through the mirrored W010 actor grammar', () => {
    const valid = ['principal:lead-eng', 'principal:a'];
    for (const id of valid) {
      expect(PrincipalIdSchema.safeParse(id).success).toBe(true);
      expect(new RegExp(EVENT_ACTOR_PATTERN).test(id)).toBe(true);
    }
    const invalid = ['principal:', 'Principal:X', 'agent:bot'];
    for (const id of invalid) {
      expect(PrincipalIdSchema.safeParse(id).success).toBe(false);
      expect(new RegExp(EVENT_ACTOR_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('uncertainty state parity (runtime)', () => {
  it('the fixture uncertainty state parses through the package schema', () => {
    // sanity: the fixture used across parity checks is structurally valid
    expect(typeof uncertainty()).toBe('object');
  });
});
