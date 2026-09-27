// NAMED POSITIVE: construction outcome schemas — practical completion and
// defects liability as projections over the universal outcome records.
import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_OUTCOME_TYPES,
  ConstructionOutcomeViewSchema,
  digestOutcomeViews,
  projectConstructionOutcomes,
} from '../src/index';
import { outcomeRecords } from './fixtures';

describe('NAMED POSITIVE: the construction outcome projection', () => {
  it('the fixture outcome records project with the construction vocabulary', () => {
    const views = projectConstructionOutcomes(outcomeRecords(), CONSTRUCTION_OUTCOME_TYPES);
    expect(views.map((view) => view.recordId)).toEqual([
      'outcome:defects-residual',
      'outcome:handover',
      'outcome:practical-completion',
    ]);
    const byId = new Map(views.map((view) => [view.recordId, view]));
    expect(byId.get('outcome:practical-completion')?.universalOutcomeKind).toBe('accepted');
    expect(byId.get('outcome:practical-completion')?.constructionOutcomeTypeIds).toEqual([
      'construction.outcome.practical-completion',
    ]);
    expect(byId.get('outcome:practical-completion')?.constructionTitles).toEqual([
      'Practical completion',
    ]);
    expect(byId.get('outcome:defects-residual')?.constructionOutcomeTypeIds).toEqual([
      'construction.outcome.defects-liability',
    ]);
    expect(byId.get('outcome:handover')?.constructionOutcomeTypeIds).toEqual([
      'construction.outcome.handover',
    ]);
  });

  it('the universal outcome kind is NEVER rewritten by the projection', () => {
    const records = outcomeRecords();
    const views = projectConstructionOutcomes(records, CONSTRUCTION_OUTCOME_TYPES);
    for (const view of views) {
      const record = records.find((candidate) => candidate.recordId === view.recordId)!;
      const outcome = record as { payload: { outcomeKind: string } };
      expect(view.universalOutcomeKind).toBe(outcome.payload.outcomeKind);
    }
  });

  it('an outcome record with NO construction binding still projects (SN1.0 partial data)', () => {
    const views = projectConstructionOutcomes(outcomeRecords(), []);
    expect(views).toHaveLength(3);
    for (const view of views) {
      expect(view.constructionOutcomeTypeIds).toEqual([]);
      expect(view.constructionTitles).toEqual([]);
    }
  });

  it('non-outcome records are ignored by the fold', () => {
    const views = projectConstructionOutcomes([], CONSTRUCTION_OUTCOME_TYPES);
    expect(views).toEqual([]);
  });

  it('the fold is deterministic under record-order permutation', () => {
    const records = outcomeRecords();
    const forward = projectConstructionOutcomes(records, CONSTRUCTION_OUTCOME_TYPES);
    const backward = projectConstructionOutcomes([...records].reverse(), CONSTRUCTION_OUTCOME_TYPES);
    expect(backward).toEqual(forward);
    expect(digestOutcomeViews(backward)).toBe(digestOutcomeViews(forward));
  });

  it('every projected view parses through the outcome-view schema (round-trip shape)', () => {
    const views = projectConstructionOutcomes(outcomeRecords(), CONSTRUCTION_OUTCOME_TYPES);
    for (const view of views) {
      const parsed = ConstructionOutcomeViewSchema.safeParse(JSON.parse(JSON.stringify(view)));
      expect(parsed.success, view.recordId).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual(view);
      }
    }
  });
});
