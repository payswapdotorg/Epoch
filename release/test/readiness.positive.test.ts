// THE POSITIVE EVIDENCE of the release-kit model (W035): the golden path
// from scope to replayable publication. Every acceptance-relevant
// behavior gets a named test; the negative/recovery companions live in
// readiness.negative.test.ts / readiness.recovery.test.ts.
import { describe, expect, it } from 'vitest';
import {
  checklistIdOf,
  deriveReleaseChecklist,
  evaluateReleaseReadiness,
  evidenceDigestOf,
  foldReleaseEvents,
  manifestIdOf,
  notesIdOf,
  releaseEventStreamIdOf,
  sealReleaseEvent,
  sealReleaseManifest,
  sealReleaseNotes,
  sealScope,
  verifyChecklistDigest,
  verifyEvaluationDigest,
  verifyManifestDigest,
  verifyNotesDigest,
  verifyReleaseEventDigest,
  verifyScopeDigest,
  computeChecklistDigest,
  checklistContent,
  type ReleaseEventRecord,
} from '../src/index';
import {
  ACTOR,
  ACTOR_REF,
  BUYER,
  DIGEST_E,
  T,
  VENDOR,
  completeAllItems,
  referenceEvidence,
  referenceNotes,
  referenceScope,
  sealedReferenceScope,
} from './helpers';

describe('scope admission (positive)', () => {
  it('the reference scope seals, verifies, and round-trips its digest', () => {
    const scope = sealedReferenceScope();
    const verified = verifyScopeDigest(scope);
    expect(verified.ok).toBe(true);
    expect(verified.ok && verified.value.digest).toBe(scope.digest);
  });

  it('the derived ids are deterministic (checklist + notes)', () => {
    expect(checklistIdOf('release:e1-program-1')).toBe('rc:e1-program-1');
    expect(notesIdOf('release:e1-program-1')).toBe('notes:e1-program-1');
    expect(releaseEventStreamIdOf('release:e1-program-1')).toBe('stream:release-e1-program-1');
  });
});

describe('checklist derivation (positive)', () => {
  it('derives every expected item in fixed domain order with stable ids', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    const items = derived.value.items;
    // 3 battery + 2 benchmarks + 1 notes + 4 sdk pins + 1 examples + 4 marketplace.
    expect(items).toHaveLength(15);
    expect(items.map((item) => item.itemId)).toEqual([
      'item:1:battery-command-green-pnpm-install',
      'item:2:battery-command-green-pnpm-check',
      'item:3:battery-command-green-pnpm-exec-turbo-run-typecheck-lint-test-build',
      'item:4:benchmark-budget-within-solution-admission',
      'item:5:benchmark-budget-within-program-fold',
      'item:6:notes-published-e1-program-1',
      'item:7:sdk-contract-synced-adapter-sdk',
      'item:8:sdk-contract-synced-capability-registry',
      'item:9:sdk-contract-synced-extension-sdk',
      'item:10:sdk-contract-synced-marketplace',
      'item:11:sdk-examples-green-examples-sdk',
      'item:12:listing-chain-verified-stress-suite',
      'item:13:entitlement-flip-verified-grant-001',
      'item:14:usage-fold-verified-grant-001',
      'item:15:revenue-provenance-complete-stress-suite',
    ]);
    expect(items.every((item) => item.evidence === null && item.completedAt === null)).toBe(true);
  });

  it('derivation is replay-stable: identical scope -> identical checklist digest', () => {
    const first = deriveReleaseChecklist(sealedReferenceScope());
    const second = deriveReleaseChecklist(sealedReferenceScope());
    expect(first.ok && second.ok && first.value.digest).toBe(second.ok ? second.value.digest : '');
  });

  it('the checklist carries provenance derived from the scope digest', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    expect(derived.ok && derived.value.provenance.derivedFrom).toEqual([scope.digest]);
    expect(derived.ok && derived.value.provenance.method).toBe('derive-release-checklist');
  });
});

describe('checklist completion (positive)', () => {
  it('completion is an immutable transition with typed evidence recorded', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const firstItem = derived.value.items[0]!;
    const evidence = referenceEvidence(firstItem.checkKind, firstItem.subject);
    const completed = completeAllItems(derived.value);
    const completedItem = completed.items[0]!;
    expect(completedItem.evidence).toEqual(evidence);
    expect(completedItem.completedAt).toBe(T[1]);
    expect(completedItem.completedBy).toBe(ACTOR);
    // The PRIOR checklist is unchanged (exact-revision record).
    expect(derived.value.items[0]!.completedAt).toBeNull();
    expect(completed.digest).not.toBe(derived.value.digest);
    expect(verifyChecklistDigest(completed).ok).toBe(true);
  });

  it('completing every item yields a fully-complete checklist', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    expect(completed.items.every((item) => item.completedAt !== null && item.evidence !== null)).toBe(true);
  });
});

describe('readiness evaluation (positive)', () => {
  it('an incomplete checklist evaluates blocked with typed open items', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const evaluation = evaluateReleaseReadiness(derived.value);
    expect(evaluation.ok && evaluation.value.verdict).toBe('blocked');
    if (!evaluation.ok) return;
    expect(evaluation.value.openItems).toHaveLength(15);
    expect(evaluation.value.openItems[0]!.checkKind).toBe('battery-command-green');
    expect(evaluation.value.summary.find((entry) => entry.domain === 'release')).toEqual({
      domain: 'release',
      total: 6,
      complete: 0,
    });
  });

  it('the fully-completed checklist evaluates ready with an empty open list', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const evaluation = evaluateReleaseReadiness(completed);
    expect(evaluation.ok && evaluation.value.verdict).toBe('ready');
    if (!evaluation.ok) return;
    expect(evaluation.value.openItems).toEqual([]);
    expect(evaluation.value.completeItems).toBe(15);
    expect(evaluation.value.totalItems).toBe(15);
    expect(evaluation.value.checklistDigest).toBe(completed.digest);
    expect(verifyEvaluationDigest(evaluation.value).ok).toBe(true);
  });
});

describe('release notes (positive)', () => {
  it('notes seal, verify, and cite across the closed citation kinds', () => {
    const notes = sealReleaseNotes(referenceNotes());
    expect(notes.ok).toBe(true);
    if (!notes.ok) return;
    expect(notes.value.notesId).toBe('notes:e1-program-1');
    const verified = verifyNotesDigest(notes.value);
    expect(verified.ok).toBe(true);
    const citations = notes.value.sections[0]!.citations.map((citation) => citation.kind);
    expect(citations).toEqual(['surface', 'work-order', 'pull-request', 'budget', 'test', 'document']);
  });
});

describe('release manifest (positive)', () => {
  it('a ready checklist seals a manifest rolling the evidence up per domain', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const notes = sealReleaseNotes(referenceNotes());
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: completed, notes: notes.value, provenance: {
      actor: ACTOR_REF,
      method: 'seal-release-manifest',
      instant: T[9]!,
      derivedFrom: [scope.digest],
    } });
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) return;
    const value = manifest.value;
    expect(value.releaseId).toBe('release:e1-program-1');
    expect(value.revision).toBe(scope.revision);
    expect(value.battery).toHaveLength(3);
    expect(value.battery[0]!.command).toBe('pnpm install');
    expect(value.benchmarks).toEqual([
      { budgetId: 'budget:solution-admission', overall: 'within-budget', verdictDigest: expect.any(String) },
      { budgetId: 'budget:program-fold', overall: 'within-budget', verdictDigest: expect.any(String) },
    ]);
    expect(value.sdk).toEqual([
      { surfaceId: 'adapter-sdk', contractVersion: '1.0.0' },
      { surfaceId: 'capability-registry', contractVersion: '1.0.0' },
      { surfaceId: 'extension-sdk', contractVersion: '1.0.0' },
      { surfaceId: 'marketplace', contractVersion: '1.0.0' },
    ]);
    expect(value.marketplace).toHaveLength(4);
    expect(value.notesRef).toEqual({ notesId: 'notes:e1-program-1', notesDigest: notes.value.digest });
    expect(value.checklistDigest).toBe(completed.digest);
    expect(value.readyAt).toBe(T[9]!);
    expect(manifestIdOf(value.digest)).toMatch(/^manifest:[0-9a-f]{16}$/);
    expect(verifyManifestDigest(value).ok).toBe(true);
  });
});

describe('release events + fold (positive)', () => {
  it('the readiness journal replays through the deterministic fold', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const completed = completeAllItems(derived.value);
    const evaluation = evaluateReleaseReadiness(completed);
    if (!evaluation.ok) throw new Error(evaluation.error.message);
    const notes = sealReleaseNotes(referenceNotes());
    if (!notes.ok) throw new Error(notes.error.message);
    const manifest = sealReleaseManifest({ scope, checklist: completed, notes: notes.value, provenance: {
      actor: ACTOR_REF,
      method: 'seal-release-manifest',
      instant: T[9]!,
      derivedFrom: [scope.digest],
    } });
    if (!manifest.ok) throw new Error(manifest.error.message);

    const streamId = releaseEventStreamIdOf('release:e1-program-1');
    const records: ReleaseEventRecord[] = [];
    const push = (data: unknown, occurredAt: string): void => {
      const sealed = sealReleaseEvent({
        schemaVersion: 1,
        streamId,
        sequence: records.length + 1,
        tenantId: VENDOR,
        actor: 'principal:release-bot',
        causalParent: records.length > 0 ? { streamId, sequence: records.length } : null,
        payload: { discriminator: 'release:readiness', data },
        occurredAt,
      });
      if (!sealed.ok) throw new Error(sealed.error.message);
      expect(verifyReleaseEventDigest(sealed.value).ok).toBe(true);
      records.push(sealed.value);
    };
    push({ kind: 'checklist-derived', releaseId: 'release:e1-program-1', checklistId: completed.checklistId, checklistDigest: derived.value.digest, itemCount: 15 }, T[0]);
    for (const item of completed.items) {
      push({
        kind: 'item-completed',
        releaseId: 'release:e1-program-1',
        checklistId: completed.checklistId,
        itemId: item.itemId,
        checkKind: item.checkKind,
        evidenceDigest: evidenceDigestOf(item.evidence!),
        completedAt: item.completedAt!,
        completedBy: item.completedBy!,
      }, item.completedAt!);
    }
    push({
      kind: 'readiness-evaluated',
      releaseId: 'release:e1-program-1',
      checklistId: completed.checklistId,
      verdict: evaluation.value.verdict,
      completeItems: evaluation.value.completeItems,
      totalItems: evaluation.value.totalItems,
      evaluationDigest: evaluation.value.digest,
    }, T[9]);
    push({
      kind: 'release-published',
      releaseId: 'release:e1-program-1',
      manifestId: manifestIdOf(manifest.value.digest),
      manifestDigest: manifest.value.digest,
      revision: manifest.value.revision,
      label: manifest.value.label,
    }, T[9]);

    const folded = foldReleaseEvents(records);
    expect(folded.ok).toBe(true);
    if (!folded.ok) return;
    expect(folded.value.eventCount).toBe(18);
    expect(folded.value.derived?.itemCount).toBe(15);
    expect(folded.value.completedItems).toHaveLength(15);
    expect(folded.value.evaluation?.verdict).toBe('ready');
    expect(folded.value.published?.manifestDigest).toBe(manifest.value.digest);
    expect(folded.value.published?.revision).toBe(scope.revision);
  });

  it('the fold is input-order independent (replay over shuffled records)', () => {
    const scope = sealedReferenceScope();
    const derived = deriveReleaseChecklist(scope);
    if (!derived.ok) throw new Error(derived.error.message);
    const streamId = releaseEventStreamIdOf('release:e1-program-1');
    const records = [1, 2, 3].map((sequence) => {
      const sealed = sealReleaseEvent({
        schemaVersion: 1,
        streamId,
        sequence,
        tenantId: BUYER,
        actor: 'principal:release-bot',
        causalParent: sequence > 1 ? { streamId, sequence: sequence - 1 } : null,
        payload: {
          discriminator: 'release:readiness',
          data: {
            kind: sequence === 1 ? 'checklist-derived' : sequence === 2 ? 'item-completed' : 'readiness-evaluated',
            releaseId: 'release:e1-program-1',
            ...(sequence === 1
              ? { checklistId: 'rc:e1-program-1', checklistDigest: derived.value.digest, itemCount: 15 }
              : sequence === 2
                ? {
                    checklistId: 'rc:e1-program-1',
                    itemId: 'item:1:battery-command-green-pnpm-install',
                    checkKind: 'battery-command-green',
                    evidenceDigest: DIGEST_E,
                    completedAt: T[1],
                    completedBy: ACTOR,
                  }
                : {
                    checklistId: 'rc:e1-program-1',
                    verdict: 'blocked',
                    completeItems: 1,
                    totalItems: 15,
                    evaluationDigest: DIGEST_E,
                  }),
          },
        },
        occurredAt: T[sequence]!,
      });
      if (!sealed.ok) throw new Error(sealed.error.message);
      return sealed.value;
    });
    const forward = foldReleaseEvents(records);
    const reversed = foldReleaseEvents([...records].reverse());
    expect(forward.ok && reversed.ok).toBe(true);
    expect(JSON.stringify(forward.ok ? forward.value : null)).toBe(JSON.stringify(reversed.ok ? reversed.value : null));
  });
});

describe('scope <-> checklist <-> evaluation digest chain (positive)', () => {
  it('the content accessor round-trips through re-sealing', () => {
    const derived = deriveReleaseChecklist(sealedReferenceScope());
    if (!derived.ok) throw new Error(derived.error.message);
    const content = checklistContent(derived.value);
    expect(computeChecklistDigest(content)).toBe(derived.value.digest);
  });

  it('sealing the same scope content twice derives identical digests', () => {
    const first = sealScope(referenceScope());
    const second = sealScope(referenceScope());
    expect(first.ok && second.ok && first.value.digest).toBe(second.ok ? second.value.digest : '');
  });
});
