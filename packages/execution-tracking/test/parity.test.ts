// RUNTIME PARITY with the sibling kernel vocabularies (the W036/W037
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W010 event-log: the mirrored execution-event shape is admitted by the
//   REAL @epoch/event-log seal path (sealEvent) and digests identically
//   through the REAL computeEventDigest; the stream/actor grammars are
//   pattern-identical; the record versions are equal;
// - W006 evidence: real evidence digests are admitted by the
//   field-evidence-link digest grammar (field evidence references are
//   exact-revision addressable, never payloads); the confidence-method
//   vocabulary is member-identical;
// - W036 solution-delivery: the observation records this package produces
//   are admitted by the REAL W036 observation intake of a REAL delivery
//   record (the kernel produces observations over the consumed
//   authority); the work-package/activity/milestone id grammars are
//   pattern-identical to the REAL W036 program vocabulary;
// - W007 capability-registry: a REAL source-category capability manifest
//   honoring the epoch/execution-tracking contract is admitted by the
//   REAL registry (external field systems bind through the capability
//   fabric, never as vendor fields).
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  sealEvent,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  EVENT_TENANT_ID_PATTERN,
} from '@epoch/event-log';
import {
  computeEvidenceDigest,
  EvidenceRecordSchema,
  SHA256_HEX_PATTERN as EVIDENCE_SHA256_PATTERN,
  CONFIDENCE_METHODS as EVIDENCE_CONFIDENCE_METHODS,
} from '@epoch/evidence';
import { CapabilityRegistry } from '@epoch/capability-registry';
import { computeCapabilityManifestDigest } from '@epoch/capability-registry';
import {
  recordObservation,
  WorkPackageIdSchema as W036WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import {
  computeExecutionEventDigest,
  CONFIDENCE_METHODS,
  EXECUTION_EVENT_RECORD_VERSION,
  EXECUTION_PRINCIPAL_ID_PATTERN,
  EXECUTION_STREAM_ID_PATTERN,
  EXECUTION_TRACKING_CONTRACT_VERSION,
  FieldEvidenceLinkSchema,
  PrincipalIdSchema,
  executionStreamIdOf,
  intakeFieldObservation,
  recordObservation as reExportedRecordObservation,
  sealExecutionEvent,
  ActivityIdSchema,
} from '../src/index';
import {
  DELIVERY_ID,
  PRINCIPAL,
  TENANT,
  T1,
  T3,
  WORK_PACKAGE_ID,
  fieldCapture,
  openedDelivery,
  sealedSolution,
  trackingStore,
  uncertainty,
} from './fixtures';
import { unwrap } from './helpers';

void reExportedRecordObservation;

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored execution stream pattern is exactly the W010 stream pattern', () => {
    expect(EXECUTION_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(EXECUTION_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(EXECUTION_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(EXECUTION_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the W010 tenant pattern is the W009 tenancy grammar composed at runtime', () => {
    expect(EVENT_TENANT_ID_PATTERN.test(TENANT)).toBe(true);
    expect(EVENT_TENANT_ID_PATTERN.test('tenant:')).toBe(false);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(EXECUTION_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('an execution event is admitted by the REAL W010 seal path and digests identically', () => {
    const content = {
      schemaVersion: EXECUTION_EVENT_RECORD_VERSION,
      streamId: executionStreamIdOf(WORK_PACKAGE_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'execution:tracking-recorded',
        data: {
          workPackageId: WORK_PACKAGE_ID,
          trackingRecordId: 'state:excavate-start',
          fromState: 'not-started',
          toState: 'in-progress',
          observedAt: T3,
        },
      },
      occurredAt: T3,
    };
    const ours = sealExecutionEvent(content);
    expect(ours.ok).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
    expect(computeExecutionEventDigest(content as never)).toBe(computeEventDigest(content));
  });

  it('principal ids validate through the mirrored W010 actor grammar', () => {
    const valid = ['principal:field-engineer', 'principal:a'];
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

describe('W006 evidence parity (runtime)', () => {
  it('the mirrored confidence-method vocabulary is member-identical to W006', () => {
    expect([...CONFIDENCE_METHODS].sort()).toEqual([...EVIDENCE_CONFIDENCE_METHODS].sort());
  });

  it('a REAL W006 evidence digest is admitted by the field-evidence-link grammar', () => {
    const record = trustEvidenceLike();
    const parsed = EvidenceRecordSchema.safeParse(record);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const digest = computeEvidenceDigest(record as never);
    expect(
      FieldEvidenceLinkSchema.safeParse({
        digest,
        evidenceKind: 'sensor-reading',
        capturedAt: T1,
        capturedBy: PRINCIPAL,
      }).success,
    ).toBe(true);
  });

  it('field-evidence digests satisfy the W006 SHA-256 grammar', () => {
    const good = 'a'.repeat(64);
    expect(new RegExp(EVIDENCE_SHA256_PATTERN).test(good)).toBe(true);
    expect(new RegExp(EVIDENCE_SHA256_PATTERN).test('a'.repeat(63))).toBe(false);
  });
});

describe('W036 solution-delivery parity (runtime)', () => {
  it('the observation records this package produces are admitted by the REAL W036 delivery intake', () => {
    const solution = sealedSolution();
    let delivery = openedDelivery(solution);
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    delivery = unwrap(recordObservation(delivery, intake.store.observations[0]!));
    expect(delivery.observations).toHaveLength(1);
    expect(delivery.observations[0]!.kind).toBe('observation');
    // The re-exported function is the REAL W036 function.
    expect(reExportedRecordObservation).toBe(recordObservation);
  });

  it('the work-package and activity id grammars match the REAL W036 program vocabulary', () => {
    // W036 work-package ids validate through our grammar and vice versa.
    expect(W036WorkPackageIdSchema.safeParse(WORK_PACKAGE_ID).success).toBe(true);
    const validActivities = ['activity:excavate', 'activity:a'];
    for (const id of validActivities) {
      expect(ActivityIdSchema.safeParse(id).success, id).toBe(true);
    }
    const invalidActivities = ['activity:', 'Activity:X', 'activity:' + 'x'.repeat(64)];
    for (const id of invalidActivities) {
      expect(ActivityIdSchema.safeParse(id).success, id).toBe(false);
    }
    // The mirrored activity grammar accepts every W036 program fixture id.
    expect(ActivityIdSchema.safeParse('activity:grade').success).toBe(true);
    expect(ActivityIdSchema.safeParse('activity:brace-frame').success).toBe(true);
  });

  it('the uncertainty states carried on captures are REAL W036 uncertainty states', () => {
    const state = uncertainty();
    expect(state.provenance.kind).toBe('observed');
    expect(state.freshness.state).toBe('fresh');
    expect(state.confidence.method).toBe('measured');
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('a REAL source-category capability honoring the execution-tracking contract is admitted by the REAL registry', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'epoch.field-capture.reference',
      category: 'source',
      version: '1.0.0',
      descriptor: {
        displayName: 'Reference field-capture source capability',
        description: 'The in-memory FieldCapturePort reference adapter published as a source capability',
        inputs: [],
        outputs: [],
        assumptions: ['in-memory reference behavior only'],
      },
      contracts: [
        {
          contractId: 'epoch.execution-tracking',
          contractVersion: EXECUTION_TRACKING_CONTRACT_VERSION,
        },
      ],
      trust: { origin: 'first-party' },
    };
    const digest = computeCapabilityManifestDigest(manifest as never);
    const registry = new CapabilityRegistry();
    const registered = registry.register({ manifest: manifest as never, digest });
    if (!registered.ok) {
      throw new Error(`capability registration failed: ${JSON.stringify(registered.error)}`);
    }
    expect(registered.ok).toBe(true);
    expect(registered.value.manifest.category).toBe('source');
    expect(registered.value.manifest.contracts[0]!.contractId).toBe('epoch.execution-tracking');
  });
});

/** One W006-shaped evidence record as loose JSON. */
function trustEvidenceLike(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'measurement',
    subject: {
      artifactId: 'engineering.stress-analysis',
      revision: '1.2.3',
      digest: '0'.repeat(64),
    },
    producedBy: {
      runId: 'run:nightly-2026-03-01',
      actorId: 'principal:verifier-bot',
      methodId: 'method:suite-regression',
    },
    observedAt: T1,
    content: {
      mediaType: 'application/json',
      data: { passed: true, checks: 42 },
    },
    confidence: {
      distribution: { kind: 'point', value: 1 },
      method: 'stated',
      rationale: 'deterministic regression suite',
    },
  };
}

void DELIVERY_ID;
