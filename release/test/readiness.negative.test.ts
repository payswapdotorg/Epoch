// THE NEGATIVE EVIDENCE of the release-kit model (W035): every typed
// refusal point of the contract, exercised precisely. Builders return
// loose JSON so single fields can be corrupted (the shared helpers
// pattern); every rejection is a typed VALUE (never a thrown exception).
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
  sealChecklist,
  verifyChecklistDigest,
  verifyEvaluationDigest,
  verifyManifestDigest,
  verifyNotesDigest,
  verifyReleaseEventDigest,
  verifyScopeDigest,
  checklistContent,
  type SealedReleaseChecklist,
} from '../src/index';
import {
  ACTOR_REF,
  DIGEST_A,
  T,
  completeAllItems,
  referenceEvidence,
  referenceNotes,
  referenceScope,
  sealedReferenceScope,
} from './helpers';

describe('scope admission (negative)', () => {
  it('a component whose surface prefix does not match its kind is rejected', () => {
    const scope = sealScope(
      referenceScope({
        components: [{ surface: 'packages/adapter-sdk', kind: 'service', description: 'mismatched kind.' }],
      }),
    );
    expect(scope.ok).toBe(false);
    if (!scope.ok) expect(scope.error.code).toBe('validation');
  });

  it('a non-40-hex revision is rejected', () => {
    const scope = sealScope(referenceScope({ revision: '39ce5b6' }));
    expect(scope.ok).toBe(false);
    if (!scope.ok) expect(scope.error.code).toBe('validation');
  });

  it('an empty battery is rejected', () => {
    const scope = sealScope(referenceScope({ battery: [] }));
    expect(scope.ok).toBe(false);
    if (!scope.ok) expect(scope.error.code).toBe('validation');
  });

  it('a component kind outside the W033 vocabulary is rejected', () => {
    const scope = sealScope(
      referenceScope({ components: [{ surface: 'docs/release', kind: 'documentation', description: 'not a kind.' }] }),
    );
    expect(scope.ok).toBe(false);
    if (!scope.ok) expect(scope.error.code).toBe('validation');
  });

  it('a tampered scope digest is the typed digest-mismatch rejection', () => {
    const scope = sealedReferenceScope();
    const tampered = { ...scope, label: 'E1.0/X1.0 Program Release 2' };
    const verified = verifyScopeDigest(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
      expect(verified.error.subject).toBe('release:e1-program-1');
    }
  });
});

describe('checklist derivation + completion (negative)', () => {
  it('deriving from a tampered scope is refused (digest verification first)', () => {
    const scope = sealedReferenceScope();
    const tampered = { ...scope, label: 'E1.0/X1.0 Program Release 2' };
    const derived = deriveReleaseChecklist(tampered);
    expect(derived.ok).toBe(false);
    if (!derived.ok) expect(derived.error.code).toBe('digest-mismatch');
  });

  it('completing an unknown item is the typed unknown-item rejection', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeChecklistItem(derived.value, 'item:99:does-not-exist', referenceEvidence('battery-command-green', 'pnpm install'), T[1], ACTOR_REF);
    expect(completed.ok).toBe(false);
    if (!completed.ok) expect(completed.error.code).toBe('unknown-item');
  });

  it('completing an already-complete item is the typed item-already-complete rejection', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const first = derived.value.items[0]!;
    const once = completeChecklistItem(derived.value, first.itemId, referenceEvidence(first.checkKind, first.subject), T[1], ACTOR_REF);
    if (!once.ok) throw new Error(once.error.message);
    const twice = completeChecklistItem(once.value, first.itemId, referenceEvidence(first.checkKind, first.subject), T[2], ACTOR_REF);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error.code).toBe('item-already-complete');
  });

  it('evidence of the WRONG kind is the typed evidence-rejected rejection', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const notesItem = derived.value.items.find((item) => item.checkKind === 'notes-published')!;
    const completed = completeChecklistItem(
      derived.value,
      notesItem.itemId,
      referenceEvidence('battery-command-green', 'pnpm install'),
      T[1],
      ACTOR_REF,
    );
    expect(completed.ok).toBe(false);
    if (!completed.ok) expect(completed.error.code).toBe('evidence-rejected');
  });

  it('a RED battery command (exit code != expected) is not admissible evidence', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const first = derived.value.items[0]!;
    const completed = completeChecklistItem(
      derived.value,
      first.itemId,
      referenceEvidence(first.checkKind, first.subject, { exitCode: 1 }),
      T[1],
      ACTOR_REF,
    );
    expect(completed.ok).toBe(false);
    if (!completed.ok) {
      expect(completed.error.code).toBe('evidence-rejected');
      expect(completed.error.message).toContain('exited 1');
    }
  });

  it('an OVER-BUDGET citation is not admissible evidence', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const benchmark = derived.value.items.find((item) => item.checkKind === 'benchmark-budget-within')!;
    const completed = completeChecklistItem(
      derived.value,
      benchmark.itemId,
      referenceEvidence(benchmark.checkKind, benchmark.subject, { overall: 'over-budget' }),
      T[1],
      ACTOR_REF,
    );
    expect(completed.ok).toBe(false);
    if (!completed.ok) expect(completed.error.code).toBe('validation');
  });

  it('a DRIFTED SDK contract pin (documented != actual) is not admissible evidence', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const sdkItem = derived.value.items.find((item) => item.checkKind === 'sdk-contract-synced')!;
    const completed = completeChecklistItem(
      derived.value,
      sdkItem.itemId,
      referenceEvidence(sdkItem.checkKind, sdkItem.subject, { documentedVersion: '0.9.0' }),
      T[1],
      ACTOR_REF,
    );
    expect(completed.ok).toBe(false);
    if (!completed.ok) {
      expect(completed.error.code).toBe('evidence-rejected');
      expect(completed.error.message).toContain('0.9.0');
    }
  });

  it('a false verification flag cannot be constructed (the schema forces literal true)', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const listingItem = derived.value.items.find((item) => item.checkKind === 'listing-chain-verified')!;
    const completed = completeChecklistItem(
      derived.value,
      listingItem.itemId,
      referenceEvidence(listingItem.checkKind, listingItem.subject, { chainVerified: false }),
      T[1],
      ACTOR_REF,
    );
    expect(completed.ok).toBe(false);
    if (!completed.ok) expect(completed.error.code).toBe('validation');
  });

  it('completing against a TAMPERED checklist is the typed digest-mismatch rejection', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const tampered: SealedReleaseChecklist = { ...derived.value, items: derived.value.items.slice(0, 1) };
    const first = derived.value.items[0]!;
    const completed = completeChecklistItem(tampered, first.itemId, referenceEvidence(first.checkKind, first.subject), T[1], ACTOR_REF);
    expect(completed.ok).toBe(false);
    if (!completed.ok) expect(completed.error.code).toBe('digest-mismatch');
  });

  it('a tampered sealed checklist fails verifyChecklistDigest', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const tampered = { ...completed, items: completed.items.slice(0, 5) };
    const verified = verifyChecklistDigest(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error.code).toBe('digest-mismatch');
  });
});

describe('readiness evaluation (negative)', () => {
  it('evaluating a tampered checklist is refused (digest verification first)', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const tampered = { ...derived.value, checklistId: 'rc:other-release' };
    const evaluation = evaluateReleaseReadiness(tampered);
    expect(evaluation.ok).toBe(false);
    if (!evaluation.ok) expect(evaluation.error.code).toBe('digest-mismatch');
  });

  it('a tampered sealed evaluation fails verifyEvaluationDigest', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const evaluation = evaluateReleaseReadiness(completed);
    if (!evaluation.ok) throw new Error(evaluation.error.message);
    const tampered = { ...evaluation.value, verdict: 'blocked' as const };
    const verified = verifyEvaluationDigest(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error.code).toBe('digest-mismatch');
  });
});

describe('notes admission (negative)', () => {
  it('a citation ref outside its kind grammar is rejected', () => {
    const notes = sealReleaseNotes(
      referenceNotes({
        sections: [{ heading: 'H', body: 'B', citations: [{ kind: 'work-order', ref: 'not-a-work-order' }] }],
      }),
    );
    expect(notes.ok).toBe(false);
    if (!notes.ok) expect(notes.error.code).toBe('validation');
  });

  it('a tampered notes digest is the typed digest-mismatch rejection', () => {
    const notes = sealReleaseNotes(referenceNotes());
    if (!notes.ok) throw new Error(notes.error.message);
    const tampered = { ...notes.value, title: 'A different title' };
    const verified = verifyNotesDigest(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error.code).toBe('digest-mismatch');
  });
});

describe('manifest sealing (negative)', () => {
  it('an INCOMPLETE checklist cannot seal a manifest (release-not-ready with open items)', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const notes = sealReleaseNotes(referenceNotes());
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: derived.value, notes: notes.value, provenance: {
      actor: ACTOR_REF, method: 'seal-release-manifest', instant: T[9]!, derivedFrom: [],
    } });
    expect(manifest.ok).toBe(false);
    if (!manifest.ok) {
      expect(manifest.error.code).toBe('release-not-ready');
      expect(manifest.error.openItems).toHaveLength(15);
    }
  });

  it('a checklist of a DIFFERENT release cannot seal the manifest', () => {
    const scope = sealedReferenceScope();
    const otherScope = sealedReferenceScope({ releaseId: 'release:other-release' });
    const derived = deriveReleaseChecklist(otherScope);
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const notes = sealReleaseNotes(referenceNotes({ releaseId: 'release:other-release' }));
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: completed, notes: notes.value, provenance: {
      actor: ACTOR_REF, method: 'seal-release-manifest', instant: T[9]!, derivedFrom: [],
    } });
    expect(manifest.ok).toBe(false);
    if (!manifest.ok) expect(manifest.error.code).toBe('validation');
  });

  it('notes of a DIFFERENT release cannot seal the manifest', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const notes = sealReleaseNotes(referenceNotes({ releaseId: 'release:other-release' }));
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: completed, notes: notes.value, provenance: {
      actor: ACTOR_REF, method: 'seal-release-manifest', instant: T[9]!, derivedFrom: [],
    } });
    expect(manifest.ok).toBe(false);
    if (!manifest.ok) expect(manifest.error.code).toBe('validation');
  });

  it('a tampered manifest fails verifyManifestDigest', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const notes = sealReleaseNotes(referenceNotes());
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: completed, notes: notes.value, provenance: {
      actor: ACTOR_REF, method: 'seal-release-manifest', instant: T[9]!, derivedFrom: [],
    } });
    if (!manifest.ok) throw new Error(manifest.error.message);
    const tampered = { ...manifest.value, revision: 'f'.repeat(40) };
    const verified = verifyManifestDigest(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error.code).toBe('digest-mismatch');
  });
});

describe('release events + fold (negative)', () => {
  it('an event with a non-contiguous sequence is rejected at fold', () => {
    const streamId = releaseEventStreamIdOf('release:e1-program-1');
    const mk = (sequence: number) => {
      const sealed = sealReleaseEvent({
        schemaVersion: 1,
        streamId,
        sequence,
        tenantId: 'tenant:acme-tools',
        actor: 'principal:release-bot',
        causalParent: null,
        payload: {
          discriminator: 'release:readiness',
          data: {
            kind: 'checklist-derived',
            releaseId: 'release:e1-program-1',
            checklistId: 'rc:e1-program-1',
            checklistDigest: DIGEST_A,
            itemCount: 15,
          },
        },
        occurredAt: T[0]!,
      });
      if (!sealed.ok) throw new Error(sealed.error.message);
      return sealed.value;
    };
    const folded = foldReleaseEvents([mk(1), mk(3)]);
    expect(folded.ok).toBe(false);
    if (!folded.ok) expect(folded.error.code).toBe('validation');
  });

  it('a fold over records from MULTIPLE streams is rejected', () => {
    const first = sealReleaseEvent({
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:e1-program-1'),
      sequence: 1,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: null,
      payload: {
        discriminator: 'release:readiness',
        data: { kind: 'checklist-derived', releaseId: 'release:e1-program-1', checklistId: 'rc:e1-program-1', checklistDigest: DIGEST_A, itemCount: 15 },
      },
      occurredAt: T[0]!,
    });
    const second = sealReleaseEvent({
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:other-release'),
      sequence: 1,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: null,
      payload: {
        discriminator: 'release:readiness',
        data: { kind: 'checklist-derived', releaseId: 'release:other-release', checklistId: 'rc:other-release', checklistDigest: DIGEST_A, itemCount: 15 },
      },
      occurredAt: T[1]!,
    });
    if (!first.ok || !second.ok) throw new Error('events must seal');
    const folded = foldReleaseEvents([first.value, second.value]);
    expect(folded.ok).toBe(false);
    if (!folded.ok) expect(folded.error.code).toBe('validation');
  });

  it('a fold over an EMPTY stream is rejected', () => {
    const folded = foldReleaseEvents([]);
    expect(folded.ok).toBe(false);
    if (!folded.ok) expect(folded.error.code).toBe('validation');
  });

  it('a tampered event digest is the typed digest-mismatch rejection', () => {
    const sealed = sealReleaseEvent({
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:e1-program-1'),
      sequence: 1,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: null,
      payload: {
        discriminator: 'release:readiness',
        data: { kind: 'checklist-derived', releaseId: 'release:e1-program-1', checklistId: 'rc:e1-program-1', checklistDigest: DIGEST_A, itemCount: 15 },
      },
      occurredAt: T[0]!,
    });
    if (!sealed.ok) throw new Error(sealed.error.message);
    const tampered = {
      event: {
        ...sealed.value.event,
        payload: {
          discriminator: 'release:readiness',
          data: { ...(sealed.value.event.payload.data as Record<string, unknown>), itemCount: 16 },
        },
      },
      contentDigest: sealed.value.contentDigest,
    };
    const verified = verifyReleaseEventDigest(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.error.code).toBe('digest-mismatch');
  });

  it('malformed event payload data (unknown family kind) is rejected at fold', () => {
    const sealed = sealReleaseEvent({
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:e1-program-1'),
      sequence: 1,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: null,
      payload: {
        discriminator: 'release:readiness',
        data: { kind: 'something-else', releaseId: 'release:e1-program-1' },
      },
      occurredAt: T[0]!,
    });
    // The ENVELOPE is the generic W010 shape — it seals; the TYPED family
    // parser rejects the unknown kind at replay (fail-closed fold).
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const folded = foldReleaseEvents([sealed.value]);
    expect(folded.ok).toBe(false);
    if (!folded.ok) {
      expect(folded.error.code).toBe('validation');
      expect(folded.error.message).toContain('release:readiness family');
    }
  });

  it('a foreign payload discriminator is rejected at fold (family parser)', () => {
    const sealed = sealReleaseEvent({
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:e1-program-1'),
      sequence: 1,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: null,
      payload: {
        discriminator: 'marketplace:usage',
        data: { kind: 'checklist-derived', releaseId: 'release:e1-program-1' },
      },
      occurredAt: T[0]!,
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const folded = foldReleaseEvents([sealed.value]);
    expect(folded.ok).toBe(false);
    if (!folded.ok) expect(folded.error.code).toBe('validation');
  });
});

describe('sealChecklist direct admission (negative)', () => {
  it('checklist content with an out-of-vocabulary check kind is rejected', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const content = checklistContent(derived.value);
    const sealed = sealChecklist({
      ...content,
      items: [{ ...content.items[0]!, checkKind: 'not-a-check-kind' }],
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) expect(sealed.error.code).toBe('validation');
  });
});
