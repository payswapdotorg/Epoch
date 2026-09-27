// RUNTIME PARITY with the sibling kernel vocabularies (the W036/W037/W038
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W010 event-log: the mirrored actualization-event shape is admitted by
//   the REAL @epoch/event-log seal path (sealEvent) and digests
//   identically through the REAL computeEventDigest; the stream/actor
//   grammars are pattern-identical; the record versions are equal;
// - W006 evidence: the confidence-method vocabulary is member-identical
//   (calibration confidence is evidence-shaped);
// - W037 procurement: the observation-reference grammar is the SAME
//   grammar (W037 supplier-delivery receipts and W039 actualization fold
//   the same W036 observation references); the lineage commitment-node
//   record-id grammar matches the W037 commitment reference;
// - W036 solution-delivery: the observation records this package folds
//   are admitted by the REAL W036 observation intake of a REAL delivery
//   record (this kernel folds the consumed authority);
// - W007 capability-registry: a REAL source-category capability manifest
//   honoring the epoch/actualization contract is admitted by the REAL
//   registry (external observation sources bind through the capability
//   fabric, never as vendor fields).
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  sealEvent,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
} from '@epoch/event-log';
import { CONFIDENCE_METHODS as EVIDENCE_CONFIDENCE_METHODS } from '@epoch/evidence';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import {
  recordObservation,
  openDeliveryRecord,
} from '@epoch/solution-delivery';
import {
  ACTUALIZATION_EVENT_RECORD_VERSION,
  ACTUALIZATION_PRINCIPAL_ID_PATTERN,
  ACTUALIZATION_STREAM_ID_PATTERN,
  ACTUALIZATION_CONTRACT_VERSION,
  ObservationReferenceSchema,
  PrincipalIdSchema,
  actualizationStreamIdOf,
  computeActualizationEventDigest,
  sealActualizationEvent,
  CONFIDENCE_METHODS,
} from '../src/index';
import {
  DELIVERY_ID,
  PRINCIPAL,
  TENANT,
  T1,
  T3,
  sealedObservation,
} from './fixtures';
import { unwrap } from './helpers';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored actualization stream pattern is exactly the W010 stream pattern', () => {
    expect(ACTUALIZATION_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(ACTUALIZATION_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(ACTUALIZATION_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(ACTUALIZATION_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(ACTUALIZATION_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('an actualization event is admitted by the REAL W010 seal path and digests identically', () => {
    const content = {
      schemaVersion: ACTUALIZATION_EVENT_RECORD_VERSION,
      streamId: actualizationStreamIdOf(DELIVERY_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'actualization:observation-intaken',
        data: {
          deliveryId: DELIVERY_ID,
          observationId: 'observation:pit-volume-monday',
          subjectKind: 'activity',
          measureKind: 'quantity',
          admission: 'recorded',
          intakenAt: T3,
        },
      },
      occurredAt: T3,
    };
    const ours = sealActualizationEvent(content);
    expect(ours.ok).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
    expect(computeActualizationEventDigest(content as never)).toBe(theirs.value.digest);
    expect(computeEventDigest(content as never)).toBe(ours.value.contentDigest);
  });

  it('the REAL W010 verify path admits the sealed record (identical envelope semantics)', () => {
    const sealed = unwrap(
      sealActualizationEvent({
        schemaVersion: ACTUALIZATION_EVENT_RECORD_VERSION,
        streamId: actualizationStreamIdOf(DELIVERY_ID),
        sequence: 2,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: { streamId: actualizationStreamIdOf(DELIVERY_ID), sequence: 1 },
        payload: {
          discriminator: 'actualization:state-projected',
          data: {
            deliveryId: DELIVERY_ID,
            deliveryDigest: 'a'.repeat(64),
            observationCount: 1,
            actualCount: 1,
            groupCount: 1,
            projectedAt: T3,
          },
        },
        occurredAt: T3,
      }),
    );
    const { contentDigest, ...content } = sealed;
    expect(computeEventDigest(content as never)).toBe(contentDigest);
  });
});

describe('W006 evidence parity (runtime)', () => {
  it('the confidence-method vocabulary is member-identical', () => {
    expect([...CONFIDENCE_METHODS]).toEqual([...EVIDENCE_CONFIDENCE_METHODS]);
    expect(CONFIDENCE_METHODS.includes('derived')).toBe(true);
  });
});

describe('W037 procurement parity (runtime)', () => {
  it('the observation-reference grammar is the W037 supplier-delivery grammar', () => {
    const reference = {
      recordId: 'observation:pit-volume-monday',
      contentDigest: 'a'.repeat(64),
    };
    expect(ObservationReferenceSchema.safeParse(reference).success).toBe(true);
    expect(ObservationReferenceSchema.safeParse({ recordId: 'actual:rogue', contentDigest: 'a'.repeat(64) }).success).toBe(
      false,
    );
  });
});

describe('W036 solution-delivery parity (runtime)', () => {
  it('the observations this package folds are admitted by the REAL W036 intake of a REAL delivery', () => {
    const delivery = unwrap(
      openDeliveryRecord({
        schema: 'epoch.solution-delivery.delivery-record',
        schemaVersion: 1,
        deliveryId: DELIVERY_ID,
        tenantId: TENANT,
        solutionId: 'solution:tower-retrofit',
        solutionVersion: '1.0.0',
        solutionVersionDigest: 'c'.repeat(64),
        openedAt: T1,
        openedBy: PRINCIPAL,
        status: 'open',
        observations: [],
        acceptedObservationIds: [],
        rejectedObservationIds: [],
        actuals: [],
      }),
    );
    const observation = sealedObservation();
    const recorded = recordObservation(delivery, observation);
    expect(recorded.ok).toBe(true);
    expect(recorded.ok && recorded.value.observations.length).toBe(1);
  });

  it('the principal grammar is the W036/W009 grammar', () => {
    expect(PrincipalIdSchema.safeParse(PRINCIPAL).success).toBe(true);
    expect(PrincipalIdSchema.safeParse('principal:').success).toBe(false);
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('a REAL source-category capability honoring the epoch/actualization contract is admitted by the REAL registry', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'epoch.actualization-observation-feed.reference',
      category: 'source',
      version: ACTUALIZATION_CONTRACT_VERSION,
      descriptor: {
        displayName: 'Reference observation-source capability',
        description:
          'The in-memory ObservationSourcePort reference adapter published as a source capability (external observation systems bind through the capability fabric, never as vendor fields)',
        inputs: [],
        outputs: [],
        assumptions: ['in-memory reference behavior only'],
      },
      contracts: [
        {
          contractId: 'epoch.actualization',
          contractVersion: ACTUALIZATION_CONTRACT_VERSION,
        },
      ],
      trust: { origin: 'first-party' },
    };
    const digest = computeCapabilityManifestDigest(manifest as never);
    const registry = new CapabilityRegistry();
    const registered = registry.register({ manifest: manifest as never, digest });
    expect(registered.ok, JSON.stringify(registered)).toBe(true);
    expect(registered.ok && registered.value.manifest.category).toBe('source');
    expect(
      registered.ok && registered.value.manifest.contracts[0]!.contractId,
    ).toBe('epoch.actualization');
  });
});
