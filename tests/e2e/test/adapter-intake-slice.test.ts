// W031 Reference E2E slice 3 — ADAPTER INTAKE.
//
// The named E2E test for the external-adapter path (scenario
// definition: examples/e2e/scenarios/adapter-intake.ts). Named
// invariants:
//
//   1. ONE content, ONE address: the W028 document digest EQUALS the
//      W029 snapshot digest EQUALS the ingestion record's digest
//   2. provider vocabulary NEVER leaks past the adapter seam (the
//      neutral projection + the W036 observation carry none)
//   3. the observation flows through the W036 intake (delivery
//      authority path) with the external event digest as evidence
//   4. a cross-tenant observation is DENIED and the denial is AUDITABLE
//      (the sealed W009 decision verifies; the W036 correlation +
//      intake gates are typed)
//   5. the W028 evidence chain verifies against the REAL W006 store
//   6. determinism + round-trip
import { describe, expect, it } from 'vitest';
import {
  snapshotDigestOf,
  verifyProjection,
  GithubAdapterHost,
  referenceSnapshot,
  SOFTWARE_ENTITY_TYPES,
} from '@epoch/adapter-github';
import {
  admitDocumentDescriptor,
  computeDocumentDigest,
  documentArtifactId,
} from '@epoch/document-adapter';
import {
  admitExternalEvent,
  correlateExternalEvent,
  recordObservation,
  sealDistinctionRecord,
} from '@epoch/solution-delivery';
import { verifyAuthorizationDecisionDigest } from '@epoch/authorization';
import {
  ADAPTER_FOREIGN_TENANT,
  ADAPTER_TENANT,
  EXTERNAL_OBSERVATION_ID,
  runAdapterIntakeScenario,
  adapterIntakeDigestProjection,
} from '../../../examples/e2e/scenarios/adapter-intake';
import {
  expectCrossTenantDenied,
  expectNoProviderVocabulary,
  expectRoundTrip,
  expectScenarioDeterministic,
  expectTenantIsolationRejected,
  unwrap,
} from './helpers';

describe('adapter-intake-slice', () => {
  const { first: scenario } = expectScenarioDeterministic(
    runAdapterIntakeScenario,
    adapterIntakeDigestProjection,
    'adapter-intake',
  );

  it('ONE content, ONE address: the W029 snapshot digest is IDENTICAL at ingestion and projection', () => {
    const snapshotDigest = snapshotDigestOf(scenario.snapshot);
    expect(scenario.ingestion.snapshotDigest).toBe(snapshotDigest);
    expect(scenario.projection.source.digest).toBe(snapshotDigest);
  });

  it('the W028 document leg: the descriptor digest is COMPUTED (never claimed) and the mappings target the adapter\u2019s OWN neutral vocabulary', () => {
    // The digest recomputes exactly over the document content...
    expect(scenario.descriptor.digest).toBe(computeDocumentDigest(scenario.document));
    // ...the artifact id IS the digest...
    expect(documentArtifactId(scenario.descriptor.digest)).toBe(`doc:${scenario.descriptor.digest}`);
    // ...and every extracted mapping targets one of the adapter's OWN
    // projected entity types (the document teaches the same neutral
    // vocabulary the projection speaks).
    expect(scenario.candidates.length).toBe(3);
    for (const candidate of scenario.candidates) {
      expect(SOFTWARE_ENTITY_TYPES as readonly string[]).toContain(candidate.semanticTarget);
    }
    // The evidence chain anchors the SAME document digest.
    expect(scenario.evidenceChain.documentDigest).toBe(scenario.descriptor.digest);
  });

  it('provider vocabulary NEVER leaks past the adapter seam', () => {
    expectNoProviderVocabulary(scenario.projection, 'the neutral workspace projection');
    expectNoProviderVocabulary(scenario.observation, 'the W036 observation derived from the adapter path');
    expectNoProviderVocabulary(scenario.event.payload, 'the W036 external event payload');
  });

  it('the observation flows through the W036 intake with the external event digest as evidence', () => {
    expect(scenario.observation.recordId).toBe(EXTERNAL_OBSERVATION_ID);
    expect(scenario.observation.tenantId).toBe(ADAPTER_TENANT);
    // The observation's evidence is the EXACT external-event content
    // digest (traceability to the external report).
    const evidence = (scenario.observation.payload as { evidence: readonly { digest: string }[] }).evidence;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.digest).toMatch(/^[0-9a-f]{64}$/);
    // The observation is recorded in the delivery (the authority path)...
    expect(scenario.delivery.observations.map((observation) => observation.recordId)).toEqual([
      EXTERNAL_OBSERVATION_ID,
    ]);
    // ...and the projection verifies end-to-end (every digest recomputed).
    unwrap(verifyProjection(scenario.projection), 'projection verification');
  });

  it('the W028 evidence chain verifies against the REAL W006 store', () => {
    // Three stages emitted, three digests in the chain, every digest
    // resolves in the evidence store (verifyEvidenceChain ran in the
    // scenario; the store lookup is the cross-check).
    expect(scenario.evidenceChain.stages.length).toBe(3);
    for (const stage of scenario.evidenceChain.stages) {
      expect(scenario.evidence.has(stage.evidenceDigest)).toBe(true);
    }
    expect(scenario.evidenceChain.stages.map((stage) => stage.stage)).toEqual([
      'uploaded',
      'parsed',
      'candidates-extracted',
    ]);
  });

  it('a cross-tenant external event is DENIED at correlation (typed, R12)', () => {
    const foreignEvent = unwrap(
      admitExternalEvent({
        ...scenario.event,
        eventId: 'external-event:foreign-observation-1',
        tenantId: ADAPTER_FOREIGN_TENANT,
      }),
      'admit foreign external event',
    );
    expectCrossTenantDenied(
      correlateExternalEvent(scenario.request, foreignEvent),
      ADAPTER_TENANT,
      ADAPTER_FOREIGN_TENANT,
      'external event correlation',
    );
  });

  it('a cross-tenant observation is DENIED at the W036 intake (typed, R12)', () => {
    const foreignObservation = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
        recordId: 'observation:foreign-workspace-state',
        tenantId: ADAPTER_FOREIGN_TENANT,
        subject: scenario.observation.subject,
        measure: scenario.observation.measure,
        payload: scenario.observation.payload,
        recordedAt: scenario.observation.recordedAt,
        recordedBy: scenario.observation.recordedBy,
        uncertainty: scenario.observation.uncertainty,
      }),
      'seal the foreign observation',
    );
    expectCrossTenantDenied(
      recordObservation(scenario.delivery, foreignObservation),
      ADAPTER_TENANT,
      ADAPTER_FOREIGN_TENANT,
      'delivery observation intake',
    );
  });

  it('a cross-tenant document descriptor is DENIED at W028 admission (typed, R12)', () => {
    const foreignDescriptor = {
      ...scenario.descriptor,
      tenantScope: { tenantId: ADAPTER_FOREIGN_TENANT },
    };
    expectCrossTenantDenied(
      admitDocumentDescriptor(foreignDescriptor, { expectedTenantId: ADAPTER_TENANT }),
      ADAPTER_TENANT,
      ADAPTER_FOREIGN_TENANT,
      'document descriptor admission',
    );
  });

  it('a cross-tenant ingestion is DENIED at the W029 host (typed, R12)', () => {
    const host = new GithubAdapterHost({ expectedTenantId: ADAPTER_TENANT });
    expectTenantIsolationRejected(
      host.ingestSnapshot({
        tenantId: ADAPTER_FOREIGN_TENANT,
        payload: referenceSnapshot(),
        ingestedAt: '2026-05-04T11:00:00.000Z',
      }),
      ADAPTER_TENANT,
      ADAPTER_FOREIGN_TENANT,
      'provider snapshot ingestion',
    );
  });

  it('the cross-tenant denial is AUDITABLE (the sealed W009 decision verifies)', () => {
    const denial = scenario.crossTenantDenial.decision;
    expect(denial.outcome).toBe('deny');
    if (denial.outcome !== 'deny') throw new Error('unreachable');
    expect(denial.denial.code).toBe('cross-tenant-denied');
    // The SEALED decision is the audit record: digest-addressed,
    // tamper-evident, replayable.
    unwrap(verifyAuthorizationDecisionDigest(scenario.crossTenantDenial), 'denial digest verification');
    expect(scenario.crossTenantDenial.digest).toMatch(/^[0-9a-f]{64}$/);
    // The paired allow decision also verifies (the gate pair).
    expect(scenario.authorization.decision.outcome).toBe('allow');
    unwrap(verifyAuthorizationDecisionDigest(scenario.authorization), 'allow digest verification');
  });

  it('the scenario projection round-trips (serializes + digest-verifies)', () => {
    const projection = adapterIntakeDigestProjection(scenario);
    const digest = expectRoundTrip(projection, 'adapter-intake projection');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
