// NAMED POSITIVE: the roadmap projection — releases/tracks/milestones
// identity-mapped to canonical milestone ids (NEVER minted), grouped
// tracks over canonical anchors, deduplicated dependencies.
import { describe, expect, it } from 'vitest';
import { MILESTONE_STATUSES } from '@epoch/solution-delivery';
import {
  projectRoadmap,
  verifyRoadmapView,
} from '../src/index';
import { sealedProgram, sealedSolution } from './fixtures';

describe('NAMED POSITIVE: the roadmap view projects the sealed program', () => {
  const program = sealedProgram(sealedSolution());
  const roadmap = projectRoadmap(program);
  if (!roadmap.ok) {
    throw new Error('fixture roadmap failed to project');
  }
  const view = roadmap.value;

  it('the view carries the canonical tenant/solution/program identity', () => {
    expect(view.tenantId).toBe('tenant:globex');
    expect(view.solutionId).toBe('solution:checkout-service');
    expect(view.programId).toBe('program:checkout-service-v1');
    expect(view.title).toBe('Software roadmap');
    expect(view.stageVocabulary['realize']).toBe('Build & Deploy');
  });

  it('every releaseId IS a canonical milestone id — identities are never minted', () => {
    const milestoneIds = new Set(program.milestones.map((milestone) => milestone.milestoneId));
    expect(view.releases).toHaveLength(program.milestones.length);
    for (const release of view.releases) {
      expect(milestoneIds.has(release.releaseId)).toBe(true);
      expect(release.releaseId).toBe(release.milestoneId);
    }
  });

  it('the milestones row family is identity-mapped with software status terms', () => {
    expect(view.milestones.map((milestone) => milestone.milestoneId)).toEqual([
      'milestone:data-migration-complete',
      'milestone:production-release',
      'milestone:staging-release',
    ]);
    const byId = new Map(view.milestones.map((milestone) => [milestone.milestoneId, milestone]));
    expect(byId.get('milestone:staging-release')?.status).toBe('reached');
    expect(byId.get('milestone:staging-release')?.statusTerm).toBe('Shipped');
    expect(byId.get('milestone:production-release')?.status).toBe('planned');
    expect(byId.get('milestone:production-release')?.statusTerm).toBe('Planned');
  });

  it('the releases carry their linked work packages', () => {
    const staging = view.releases.find((release) => release.releaseId === 'milestone:staging-release');
    expect(staging?.workPackageIds).toEqual(['work-package:release-rollout']);
    const migration = view.releases.find(
      (release) => release.releaseId === 'milestone:data-migration-complete',
    );
    expect(migration?.workPackageIds).toEqual(['work-package:data-migration']);
  });

  it('the tracks group by canonical solution-line anchors (never minted)', () => {
    const trackIds = view.tracks.map((track) => track.trackId);
    expect(trackIds).toEqual([
      'line:checkout-ui',
      'line:data-migration',
      'line:environment-capacity',
      'line:service-api',
    ]);
    const serviceApi = view.tracks.find((track) => track.trackId === 'line:service-api');
    expect(serviceApi?.trackKind).toBe('solution-line');
    expect(serviceApi?.workPackageIds).toEqual([
      'work-package:api-build',
      'work-package:release-rollout',
    ]);
    expect(serviceApi?.milestoneIds).toEqual([
      'milestone:production-release',
      'milestone:staging-release',
    ]);
  });

  it('the dependencies are deduplicated canonical edges', () => {
    expect(view.summary.dependencyCount).toBe(view.dependencies.length);
    const keys = view.dependencies.map(
      (dependency) => `${dependency.predecessorActivityId}->${dependency.successorActivityId}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('activity:api-tests->activity:deploy-staging');
    expect(keys).toContain('activity:provision-staging->activity:deploy-staging');
  });

  it('the summary counts the canonical state', () => {
    expect(view.summary).toEqual({
      workPackageCount: 5,
      activityCount: 13,
      milestoneCount: 3,
      releaseCount: 3,
      trackCount: 4,
      dependencyCount: view.dependencies.length,
      milestoneStatusCounts: { planned: 1, reached: 2, missed: 0 },
    });
    expect(view.summary.milestoneStatusCounts).toEqual({
      planned: 1,
      reached: 2,
      missed: 0,
    });
  });

  it('the view round-trips through verification', () => {
    const verified = verifyRoadmapView(JSON.parse(JSON.stringify(view)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(view);
    }
  });

  it('every milestone status is one of the universal W036 statuses (unchanged)', () => {
    for (const milestone of view.milestones) {
      expect(MILESTONE_STATUSES).toContain(milestone.status);
    }
  });
});

describe('NAMED NEGATIVE: the roadmap projection rejects malformed inputs', () => {
  it('a tampered program seal is rejected (digest-mismatch)', () => {
    const program = sealedProgram(sealedSolution());
    const tampered = { ...program, title: 'Tampered programme' };
    const roadmap = projectRoadmap(tampered);
    expect(roadmap.ok).toBe(false);
    if (!roadmap.ok) {
      expect(roadmap.error.code).toBe('digest-mismatch');
    }
  });

  it('a non-object input is a validation error, never a crash', () => {
    const roadmap = projectRoadmap('not-a-program' as never);
    expect(roadmap.ok).toBe(false);
  });
});
