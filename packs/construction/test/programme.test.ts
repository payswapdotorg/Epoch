// NAMED POSITIVE: the construction programme projection — milestones and
// activities project with the construction vocabulary; dependencies fold
// uniquely; determinism.
import { describe, expect, it } from 'vitest';
import {
  projectConstructionProgramme,
  verifyConstructionProgrammeView,
  CONSTRUCTION_STAGE_VOCABULARY,
} from '../src/index';
import { warehouseChain } from './fixtures';

describe('NAMED POSITIVE: the construction programme view', () => {
  const chain = warehouseChain();
  const programme = projectConstructionProgramme(chain.program);

  it('the six activities project identity-mapped to the canonical activity ids', () => {
    expect(programme.ok).toBe(true);
    if (!programme.ok) return;
    expect(programme.value.activities).toHaveLength(6);
    const canonicalIds = chain.program.workPackages.flatMap((workPackage) =>
      workPackage.activities.map((activity) => activity.activityId),
    );
    expect(programme.value.activities.map((activity) => activity.activityId)).toEqual(
      [...canonicalIds].sort(),
    );
    for (const activity of programme.value.activities) {
      const canonical = chain.program.workPackages
        .flatMap((workPackage) => workPackage.activities)
        .find((candidate) => candidate.activityId === activity.activityId)!;
      expect(activity.title).toBe(canonical.title);
      expect(activity.plannedQuantity).toEqual(canonical.plannedQuantity);
      expect(activity.actualProgress).toBe(canonical.actualProgress);
    }
  });

  it('the activities carry the construction realization vocabulary', () => {
    if (!programme.ok) return;
    for (const activity of programme.value.activities) {
      expect(activity.realizationTerm).toBe('Construction');
    }
    expect(programme.value.realizationTerms).toEqual({ 'construction-build': 'Construction' });
  });

  it('the milestones project with the construction status vocabulary', () => {
    if (!programme.ok) return;
    expect(programme.value.milestones.map((milestone) => milestone.milestoneId)).toEqual([
      'milestone:foundations-complete',
      'milestone:frame-complete',
      'milestone:practical-completion',
    ]);
    const byId = new Map(programme.value.milestones.map((milestone) => [milestone.milestoneId, milestone]));
    expect(byId.get('milestone:foundations-complete')?.status).toBe('reached');
    expect(byId.get('milestone:foundations-complete')?.statusTerm).toBe('Achieved');
    expect(byId.get('milestone:frame-complete')?.status).toBe('planned');
    expect(byId.get('milestone:frame-complete')?.statusTerm).toBe('Programmed');
    expect(byId.get('milestone:practical-completion')?.statusTerm).toBe('Programmed');
  });

  it('the stage vocabulary rides on the view (the universal stages, construction terms)', () => {
    if (!programme.ok) return;
    expect(programme.value.stageVocabulary).toEqual({ ...CONSTRUCTION_STAGE_VOCABULARY });
    expect(programme.value.stageVocabulary['realize']).toBe('Construction');
  });

  it('dependencies fold as the DEDUPLICATED edges, sorted by (predecessor, successor)', () => {
    if (!programme.ok) return;
    expect(programme.value.dependencies).toEqual([
      { predecessorActivityId: 'activity:excavation-bulk', successorActivityId: 'activity:foundation-concrete' },
      { predecessorActivityId: 'activity:facade-install', successorActivityId: 'activity:door-install' },
      { predecessorActivityId: 'activity:floor-deck-install', successorActivityId: 'activity:facade-install' },
      { predecessorActivityId: 'activity:foundation-concrete', successorActivityId: 'activity:steel-erection' },
      { predecessorActivityId: 'activity:steel-erection', successorActivityId: 'activity:floor-deck-install' },
    ]);
    expect(programme.value.summary.dependencyCount).toBe(5);
  });

  it('the summary counts the work packages, activities, milestones and statuses', () => {
    if (!programme.ok) return;
    expect(programme.value.summary).toEqual({
      workPackageCount: 4,
      activityCount: 6,
      milestoneCount: 3,
      dependencyCount: 5,
      milestoneStatusCounts: { planned: 2, reached: 1, missed: 0 },
    });
  });

  it('the view carries the tenant id of its input program and verifies through JSON', () => {
    if (!programme.ok) return;
    expect(programme.value.tenantId).toBe(chain.program.tenantId);
    expect(programme.value.programId).toBe(chain.program.programId);
    const verified = verifyConstructionProgrammeView(JSON.parse(JSON.stringify(programme.value)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(programme.value);
    }
  });

  it('identical inputs yield the identical digest (replay)', () => {
    const second = projectConstructionProgramme(chain.program);
    if (programme.ok && second.ok) {
      expect(second.value).toEqual(programme.value);
      expect(second.value.contentDigest).toBe(programme.value.contentDigest);
    } else {
      expect(programme.ok).toBe(true);
      expect(second.ok).toBe(true);
    }
  });

  it('activities carry their verification gate ids (canonical gate references)', () => {
    if (!programme.ok) return;
    const byId = new Map(programme.value.activities.map((activity) => [activity.activityId, activity]));
    expect(byId.get('activity:excavation-bulk')?.gateIds).toEqual(['gate:formation-inspection']);
    expect(byId.get('activity:foundation-concrete')?.gateIds).toEqual(['gate:foundation-measurement']);
    expect(byId.get('activity:door-install')?.gateIds).toEqual(['gate:door-commissioning']);
    expect(byId.get('activity:floor-deck-install')?.gateIds).toEqual([]);
  });
});
