// THE DETERMINISM EVIDENCE of the release-kit model (W035): identical
// inputs derive identical outputs at every stage — scope digests,
// checklist derivations, completions, evaluations, manifests, events and
// folds — and the five SDK examples produce byte-identical digest
// projections across runs. Zero wall-clock, zero randomness, zero I/O
// (every instant is a fixed constant; the only file reads in the tree
// are the committed doc fixtures of contract-sync.test.ts).
import { describe, expect, it } from 'vitest';
import {
  completeChecklistItem,
  deriveReleaseChecklist,
  evaluateReleaseReadiness,
  foldReleaseEvents,
  releaseEventStreamIdOf,
  sealReleaseEvent,
  sealReleaseManifest,
  sealReleaseNotes,
  sealScope,
} from '../src/index';
import {
  ACTOR_REF,
  T,
  completeAllItems,
  referenceEvidence,
  referenceNotes,
  referenceScope,
  sealedReferenceScope,
} from './helpers';
import {
  adapterDigestProjection,
} from '../../examples/sdk/adapter-example';
import {
  capabilityRegistrationDigestProjection,
} from '../../examples/sdk/capability-registration';
import {
  extensionDigestProjection,
} from '../../examples/sdk/extension-example';
import {
  marketplaceListingDigestProjection,
} from '../../examples/sdk/marketplace-listing-example';
import {
  releaseReadinessDigestProjection,
} from '../../examples/sdk/release-readiness-example';

describe('kernel determinism (two full runs, byte-identical)', () => {
  it('scope -> checklist -> evaluation -> manifest derives identical digests on both runs', () => {
    const runOnce = (): { scope: string; derived: string; completed: string; evaluation: string; manifest: string } => {
      const scope = sealScope(referenceScope());
      if (!scope.ok) throw new Error(scope.error.message);
      const derived = deriveReleaseChecklist(scope.value);
      if (!derived.ok) throw new Error(derived.error.message);
      const completed = completeAllItems(derived.value);
      const evaluation = evaluateReleaseReadiness(completed);
      if (!evaluation.ok) throw new Error(evaluation.error.message);
      const notes = sealReleaseNotes(referenceNotes());
      if (!notes.ok) throw new Error(notes.error.message);
      const manifest = sealReleaseManifest({ scope: scope.value, checklist: completed, notes: notes.value, provenance: {
        actor: ACTOR_REF, method: 'seal-release-manifest', instant: T[9]!, derivedFrom: [],
      } });
      if (!manifest.ok) throw new Error(manifest.error.message);
      return {
        scope: scope.value.digest,
        derived: derived.value.digest,
        completed: completed.digest,
        evaluation: evaluation.value.digest,
        manifest: manifest.value.digest,
      };
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('the full event journal seals and folds identically on both runs', () => {
    const runOnce = (): string => {
      const scope = sealedReferenceScope();
      const derived = deriveReleaseChecklist(scope);
      if (!derived.ok) throw new Error(derived.error.message);
      const completed = completeAllItems(derived.value);
      const streamId = releaseEventStreamIdOf('release:e1-program-1');
      const records = [1, 2, 3].map((sequence) => {
        const sealed = sealReleaseEvent({
          schemaVersion: 1,
          streamId,
          sequence,
          tenantId: 'tenant:acme-tools',
          actor: 'principal:release-bot',
          causalParent: sequence > 1 ? { streamId, sequence: sequence - 1 } : null,
          payload: {
            discriminator: 'release:readiness',
            data: {
              kind: 'readiness-evaluated',
              releaseId: 'release:e1-program-1',
              checklistId: completed.checklistId,
              verdict: 'ready',
              completeItems: 15,
              totalItems: 15,
              evaluationDigest: 'e'.repeat(64),
            },
          },
          occurredAt: T[sequence]!,
        });
        if (!sealed.ok) throw new Error(sealed.error.message);
        return sealed.value;
      });
      const folded = foldReleaseEvents(records);
      if (!folded.ok) throw new Error(folded.error.message);
      return JSON.stringify(folded.value);
    };
    expect(runOnce()).toBe(runOnce());
  });

  it('item completions in the same sequence derive identical intermediate digests', () => {
    const runOnce = (): string[] => {
      const derived = deriveReleaseChecklist(sealedReferenceScope());
      if (!derived.ok) throw new Error(derived.error.message);
      const digests: string[] = [];
      let current = derived.value;
      let index = 1;
      for (const item of derived.value.items.slice(0, 5)) {
        const completed = completeChecklistItem(current, item.itemId, referenceEvidence(item.checkKind, item.subject), T[index]!, ACTOR_REF);
        if (!completed.ok) throw new Error(completed.error.message);
        current = completed.value;
        digests.push(current.digest);
        index += 1;
      }
      return digests;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('example determinism (the five SDK examples)', () => {
  it('the capability-registration example is byte-stable across runs', () => {
    expect(capabilityRegistrationDigestProjection()).toBe(capabilityRegistrationDigestProjection());
  });

  it('the adapter example is byte-stable across runs', () => {
    expect(adapterDigestProjection()).toBe(adapterDigestProjection());
  });

  it('the extension example is byte-stable across runs', () => {
    expect(extensionDigestProjection()).toBe(extensionDigestProjection());
  });

  it('the marketplace-listing example is byte-stable across runs', () => {
    expect(marketplaceListingDigestProjection()).toBe(marketplaceListingDigestProjection());
  });

  it('the release-readiness example is byte-stable across runs', () => {
    expect(releaseReadinessDigestProjection()).toBe(releaseReadinessDigestProjection());
  });
});
