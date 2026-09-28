// THE RECOVERY EVIDENCE of the release-kit model (W035): readiness is
// DATA, so recovery is completing the missing items — no rewrite, no
// back-channel. The blocked -> ready transition, the tamper -> re-seal
// transition, and the replay reconstruction are all typed, deterministic
// paths exercised here.
import { describe, expect, it } from 'vitest';
import {
  completeChecklistItem,
  deriveReleaseChecklist,
  evaluateReleaseReadiness,
  evidenceDigestOf,
  foldReleaseEvents,
  manifestIdOf,
  releaseEventStreamIdOf,
  sealReleaseEvent,
  sealReleaseManifest,
  sealReleaseNotes,
  sealScope,
  verifyChecklistDigest,
  verifyManifestDigest,
  type CompletionEvidence,
  type ReleaseEventRecord,
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

describe('blocked -> ready recovery', () => {
  it('a blocked release recovers by completing the open items (no rewrite)', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);

    // Partially complete: only the three battery items.
    let partial = derived.value;
    for (const item of derived.value.items.slice(0, 3)) {
      const completed = completeChecklistItem(partial, item.itemId, referenceEvidence(item.checkKind, item.subject), T[1], ACTOR_REF);
      if (!completed.ok) throw new Error(completed.error.message);
      partial = completed.value;
    }
    const blocked = evaluateReleaseReadiness(partial);
    expect(blocked.ok && blocked.value.verdict).toBe('blocked');
    if (!blocked.ok) return;
    expect(blocked.value.openItems).toHaveLength(12);
    expect(blocked.value.completeItems).toBe(3);

    // RECOVERY: complete the remaining 12 items — same branch, same PR.
    let recovered = partial;
    let index = 4;
    for (const item of derived.value.items.slice(3)) {
      const completed = completeChecklistItem(recovered, item.itemId, referenceEvidence(item.checkKind, item.subject), T[Math.min(index, 9)]!, ACTOR_REF);
      if (!completed.ok) throw new Error(completed.error.message);
      recovered = completed.value;
      index += 1;
    }
    const ready = evaluateReleaseReadiness(recovered);
    expect(ready.ok && ready.value.verdict).toBe('ready');
    if (!ready.ok) return;
    expect(ready.value.completeItems).toBe(15);
    expect(ready.value.openItems).toEqual([]);
    // The recovered checklist still verifies (no history rewrite).
    expect(verifyChecklistDigest(recovered).ok).toBe(true);

    // The manifest now seals (the refusal point lifts).
    const notes = sealReleaseNotes(referenceNotes());
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: recovered, notes: notes.value, provenance: {
      actor: ACTOR_REF, method: 'seal-release-manifest', instant: T[9]!, derivedFrom: [],
    } });
    expect(manifest.ok).toBe(true);
    if (manifest.ok) expect(verifyManifestDigest(manifest.value).ok).toBe(true);
  });

  it('recovery is reproducible: the same completion sequence derives the same final digest', () => {
    const recoverOnce = (): string => {
      const derived = deriveReleaseChecklist(sealedReferenceScope());
      if (!derived.ok) throw new Error(derived.error.message);
      return completeAllItems(derived.value).digest;
    };
    expect(recoverOnce()).toBe(recoverOnce());
  });
});

describe('tamper -> re-seal recovery', () => {
  it('an amended scope re-seals to a verifiable record with a NEW digest', () => {
    const scope = sealedReferenceScope();
    const { digest: _stale, ...content } = { ...scope, label: 'E1.0/X1.0 Program Release 1 (amended)' };
    void _stale;
    const resealed = sealScope(content);
    expect(resealed.ok).toBe(true);
    if (!resealed.ok) return;
    expect(resealed.value.digest).not.toBe(scope.digest);
    expect(resealed.value.label).toBe('E1.0/X1.0 Program Release 1 (amended)');

    const derived = deriveReleaseChecklist(resealed.value);
    expect(derived.ok).toBe(true);
  });

  it('a re-derived checklist from the amended scope stays deterministic', () => {
    const amended = referenceScope({ label: 'E1.0/X1.0 Program Release 1 (amended)' });
    const first = sealScope(amended);
    const second = sealScope(amended);
    expect(first.ok && second.ok && first.value.digest).toBe(second.ok ? second.value.digest : '');
    const derivedFirst = deriveReleaseChecklist(first.ok ? first.value : sealedReferenceScope());
    const derivedSecond = deriveReleaseChecklist(second.ok ? second.value : sealedReferenceScope());
    expect(derivedFirst.ok && derivedSecond.ok && derivedFirst.value.digest).toBe(
      derivedSecond.ok ? derivedSecond.value.digest : '',
    );
  });
});

describe('event-stream recovery (replay reconstruction)', () => {
  it('the fold reconstructs readiness from the journal alone, in any input order', () => {
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

    const streamId = releaseEventStreamIdOf('release:e1-program-1');
    const records: ReleaseEventRecord[] = [];
    const evidenceDigest = (item: (typeof completed)['items'][number]): string => {
      if (item.evidence === null) throw new Error(`item "${item.itemId}" has no evidence`);
      return evidenceDigestOf(item.evidence as CompletionEvidence);
    };
    const push = (data: unknown, occurredAt: string): void => {
      const sealed = sealReleaseEvent({
        schemaVersion: 1,
        streamId,
        sequence: records.length + 1,
        tenantId: 'tenant:acme-tools',
        actor: 'principal:release-bot',
        causalParent: records.length > 0 ? { streamId, sequence: records.length } : null,
        payload: { discriminator: 'release:readiness', data },
        occurredAt,
      });
      if (!sealed.ok) throw new Error(sealed.error.message);
      records.push(sealed.value);
    };
    const pushItem = (item: (typeof completed)['items'][number]): void => {
      push({
        kind: 'item-completed',
        releaseId: 'release:e1-program-1',
        checklistId: completed.checklistId,
        itemId: item.itemId,
        checkKind: item.checkKind,
        evidenceDigest: evidenceDigest(item),
        completedAt: item.completedAt!,
        completedBy: item.completedBy!,
      }, item.completedAt!);
    };

    push({ kind: 'checklist-derived', releaseId: 'release:e1-program-1', checklistId: completed.checklistId, checklistDigest: derived.value.digest, itemCount: 15 }, T[0]);
    for (const item of completed.items.slice(0, 5)) {
      pushItem(item);
    }
    push({
      kind: 'readiness-evaluated',
      releaseId: 'release:e1-program-1',
      checklistId: completed.checklistId,
      verdict: 'blocked',
      completeItems: 5,
      totalItems: 15,
      evaluationDigest: manifest.value.digest,
    }, T[9]);

    // A PARTIAL journal (5 of 15 items) replays to a blocked state...
    const partialFold = foldReleaseEvents(records);
    expect(partialFold.ok).toBe(true);
    if (partialFold.ok) {
      expect(partialFold.value.evaluation?.verdict).toBe('blocked');
      expect(partialFold.value.completedItems).toHaveLength(5);
    }

    // ...and a JOURNAL EXTENSION (recovery) replays to the full state.
    for (const item of completed.items.slice(5)) {
      pushItem(item);
    }
    push({
      kind: 'readiness-evaluated',
      releaseId: 'release:e1-program-1',
      checklistId: completed.checklistId,
      verdict: 'ready',
      completeItems: 15,
      totalItems: 15,
      evaluationDigest: manifest.value.digest,
    }, T[9]);
    push({
      kind: 'release-published',
      releaseId: 'release:e1-program-1',
      manifestId: manifestIdOf(manifest.value.digest),
      manifestDigest: manifest.value.digest,
      revision: manifest.value.revision,
      label: manifest.value.label,
    }, T[9]);

    const fullFold = foldReleaseEvents(records);
    expect(fullFold.ok).toBe(true);
    if (!fullFold.ok) return;
    expect(fullFold.value.evaluation?.verdict).toBe('ready');
    expect(fullFold.value.completedItems).toHaveLength(15);
    expect(fullFold.value.published?.manifestDigest).toBe(manifest.value.digest);

    // The fold is input-order independent on the FULL journal too.
    const shuffled = foldReleaseEvents([...records].reverse());
    expect(JSON.stringify(shuffled.ok ? shuffled.value : null)).toBe(
      JSON.stringify(fullFold.ok ? fullFold.value : null),
    );
  });
});
