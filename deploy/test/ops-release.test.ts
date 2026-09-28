/**
 * W033 evidence — RELEASE + ROLLBACK PROCEDURES: typed checklists with
 * provenance, derived from sealed plans/runs; completion gating and
 * round-trip.
 */
import { describe, expect, it } from 'vitest';
import {
  admitCompletedChecklist,
  completeChecklistItem,
  deserializeChecklist,
  opsUnwrap,
  releaseChecklistFor,
  rollbackChecklistFor,
  serializeChecklist,
  verifyChecklistDigest,
} from '@epoch/ops-kit';
import { unwrapOrThrow } from '@epoch/deploy-model';
import {
  ON_CALL,
  RELEASE_MANAGER,
  T6,
  T7,
  deployToProd,
  probesWithFailure,
  provenanceOf,
  referenceGatePolicy,
} from './helpers';

const WEB_APP_SET = ['cmp:web-app'] as const;

describe('release checklists (derived from plans)', () => {
  it('release-checklist-derived-from-plan: battery items + one item per plan step, deterministic', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const checklist = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));
    // 3 battery commands + 30 plan steps.
    expect(checklist.items).toHaveLength(3 + 30);
    expect(checklist.kind).toBe('release');
    expect(checklist.checklistId).toBe(`release:${plan.planId.slice('plan:'.length)}`);
    expect(checklist.items.filter((item) => item.gateCommand !== null)).toHaveLength(3);
    const again = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));
    expect(again.digest).toBe(checklist.digest);
    expect(serializeChecklist(again)).toBe(serializeChecklist(checklist));
  });

  it('release-checklist-completion-gated: an incomplete checklist refuses admission; completing admits', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const checklist = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));
    const refused = admitCompletedChecklist(checklist);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe('validation');
      expect(refused.error.message).toContain('not complete');
    }
    // Complete every item with caller-supplied instants + actors.
    let completed = checklist;
    for (const item of checklist.items) {
      completed = opsUnwrap(completeChecklistItem(completed, item.itemId, T7, ON_CALL.actorId));
    }
    const admitted = opsUnwrap(admitCompletedChecklist(completed));
    expect(admitted.items.every((item) => item.completedAt === T7 && item.completedBy === ON_CALL.actorId)).toBe(true);
  });

  it('checklist-item-double-completion-rejected: completing an item twice is a typed refusal', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const checklist = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));
    const once = opsUnwrap(completeChecklistItem(checklist, checklist.items[0]!.itemId, T7, ON_CALL.actorId));
    const twice = completeChecklistItem(once, checklist.items[0]!.itemId, T7, ON_CALL.actorId);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error.code).toBe('duplicate-record');
  });

  it('checklist-unknown-item-rejected', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const checklist = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));
    const result = completeChecklistItem(checklist, 'item:999:nowhere', T7, ON_CALL.actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });
});

describe('rollback checklists (derived from rolled-back runs)', () => {
  it('rollback-checklist-derived-from-run: one item per restored placement + verification items', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const run = unwrapOrThrow(
      deployToProd({ componentIds: WEB_APP_SET, healthProbes: probesWithFailure(plan, 'cmp:web-app', 'readiness probe timeout after 5000ms') }).run,
    );
    const checklist = opsUnwrap(rollbackChecklistFor(run, provenanceOf(ON_CALL, 'rollback-checklist', T6)));
    expect(checklist.kind).toBe('rollback');
    expect(checklist.runDigest).toBe(run.digest);
    // 1 trigger item + 6 restored placements + 2 verification items.
    expect(checklist.items).toHaveLength(1 + 6 + 2);
    // Complete the checklist + admit.
    let completed = checklist;
    for (const item of checklist.items) {
      completed = opsUnwrap(completeChecklistItem(completed, item.itemId, T7, RELEASE_MANAGER.actorId));
    }
    expect(opsUnwrap(admitCompletedChecklist(completed)).digest).not.toBe(checklist.digest);
  });

  it('rollback-checklist-refuses-deployed-run: a run without a rollback receipt has no rollback procedure', () => {
    const run = unwrapOrThrow(deployToProd({ componentIds: WEB_APP_SET }).run);
    const result = rollbackChecklistFor(run, provenanceOf(ON_CALL, 'rollback-checklist', T6));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });

  it('checklist-round-trip-digest-verified + tamper-rejected', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const checklist = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));
    const text = serializeChecklist(checklist);
    const restored = opsUnwrap(deserializeChecklist(text));
    expect(serializeChecklist(restored)).toBe(text);
    expect(opsUnwrap(verifyChecklistDigest(restored)).digest).toBe(checklist.digest);
    const tampered = { ...checklist, title: 'mutated after sealing' };
    const result = verifyChecklistDigest(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});
