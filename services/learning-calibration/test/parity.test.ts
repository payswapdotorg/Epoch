// SERVICE-LEVEL PARITY: the learning:* events the host emits are
// admitted by the REAL @epoch/event-log seal path and digest
// identically (the W010 pin), and a REAL source-category capability
// manifest honoring the epoch/learning-calibration contract is admitted
// by the REAL W007 registry (external learning-record sources bind
// through the capability fabric, never as vendor fields).
import { describe, expect, it } from 'vitest';
import { computeEventDigest, sealEvent } from '@epoch/event-log';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import { LearningCalibrationRuntime } from '../src/runtime';
import { LEARNING_CALIBRATION_CONTRACT_VERSION } from '@epoch/learning-calibration';
import {
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T5,
  T6,
  allowContext,
  eligibleCandidates,
} from './helpers';
import { unwrap } from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };

describe('W010 event-log parity (service events)', () => {
  it('every host-emitted learning event digests identically through the REAL W010 kernel', () => {
    const runtime = new LearningCalibrationRuntime();
    for (const candidate of eligibleCandidates()) {
      unwrap(
        runtime.intakeLearningRecord({
          tenantId: TENANT,
          authorization: AUTH,
          candidate,
          intakenAt: T5,
        }),
      );
    }
    unwrap(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: { minor: '5', material: '20', severe: '50' },
        assembledAt: T6,
      }),
    );
    const stream = unwrap(
      runtime.eventStream({ tenantId: TENANT, authorization: AUTH, solutionId: SOLUTION_ID }),
    );
    expect(stream.length).toBeGreaterThanOrEqual(4);
    for (const event of stream) {
      const { contentDigest, ...content } = event;
      // The REAL W010 digest path recomputes the sealed digest.
      expect(computeEventDigest(content as never)).toBe(contentDigest);
      // The REAL W010 seal path admits the same content with the same digest.
      const theirs = sealEvent(content as never);
      expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
      if (!theirs.ok) return;
      expect(theirs.value.digest).toBe(contentDigest);
    }
  });
});

describe('W007 capability-registry parity (the record-source seam)', () => {
  it('a REAL source-category capability honoring the epoch/learning-calibration contract is admitted by the REAL registry', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'epoch.learning-record-feed.reference',
      category: 'source',
      version: LEARNING_CALIBRATION_CONTRACT_VERSION,
      descriptor: {
        displayName: 'Reference learning-record capability',
        description:
          'The in-memory LearningRecordSourcePort reference adapter published as a source capability (external learning-record systems bind through the capability fabric, never as vendor fields)',
        inputs: [],
        outputs: [],
        assumptions: ['in-memory reference behavior only'],
      },
      contracts: [
        {
          contractId: 'epoch.learning-calibration',
          contractVersion: LEARNING_CALIBRATION_CONTRACT_VERSION,
        },
      ],
      trust: { origin: 'first-party' },
    };
    const digest = computeCapabilityManifestDigest(manifest as never);
    const registry = new CapabilityRegistry();
    const registered = registry.register({ manifest: manifest as never, digest });
    expect(registered.ok, JSON.stringify(registered)).toBe(true);
    expect(registered.ok && registered.value.manifest.category).toBe('source');
  });
});
