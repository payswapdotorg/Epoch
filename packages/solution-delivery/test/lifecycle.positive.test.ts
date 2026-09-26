// POSITIVE: the universal lifecycle — typed stage records + typed
// transitions including branch/pause/resume/loop/overlap; the derived
// pause/resume status; the pack-profile admission (DP1.0).
import { describe, expect, it } from 'vitest';
import {
  admitLifecycleStage,
  admitLifecycleTransition,
  admitPackProfile,
  foldLifecycleStages,
  stageStatusOf,
  UNIVERSAL_LIFECYCLE_STAGES,
  type DeliveryResult,
  type LifecycleGraph,
} from '../src/index';
import { PRINCIPAL, T1, T2, T3, TENANT } from './fixtures';

function must<T>(result: DeliveryResult<T>): T {
  if (!result.ok) {
    throw new Error(`unexpected admission failure: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function graph(): LifecycleGraph {
  return { tenantId: TENANT, solutionId: 'solution:tower-retrofit', stages: [], transitions: [] };
}

function stage(recordId: string, stageName: string, overrides: Record<string, unknown> = {}) {
  return {
    schema: 'epoch.solution-delivery.lifecycle-stage',
    schemaVersion: 1,
    recordId,
    tenantId: TENANT,
    subject: {
      solutionId: 'solution:tower-retrofit',
      subjectKind: 'solution-package',
      subjectId: 'solution:tower-retrofit',
    },
    stage: stageName,
    enteredAt: T1,
    enteredBy: PRINCIPAL,
    ...overrides,
  };
}

function transition(recordId: string, relation: string, from: string, to: string) {
  return {
    schema: 'epoch.solution-delivery.lifecycle-transition',
    schemaVersion: 1,
    recordId,
    tenantId: TENANT,
    subject: {
      solutionId: 'solution:tower-retrofit',
      subjectKind: 'solution-package',
      subjectId: 'solution:tower-retrofit',
    },
    relation,
    fromStageRecordId: from,
    toStageRecordId: to,
    recordedAt: T2,
    recordedBy: PRINCIPAL,
  };
}

describe('lifecycle stage records', () => {
  it('admits a stage record for each of the eleven universal stages', () => {
    let lifecycle = graph();
    let index = 0;
    for (const stageName of UNIVERSAL_LIFECYCLE_STAGES) {
      lifecycle = must(
        admitLifecycleStage(lifecycle, stage(`stage:${String(index).padStart(2, '0')}`, stageName)),
      );
      index += 1;
    }
    expect(lifecycle.stages).toHaveLength(11);
  });

  it('exact re-admission is idempotent', () => {
    const first = admitLifecycleStage(graph(), stage('stage:understand', 'understand'));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = admitLifecycleStage(first.value, stage('stage:understand', 'understand'));
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.stages).toHaveLength(1);
    }
  });
});

describe('typed transitions (projections, never a linear FSM)', () => {
  it('precedes: forward flow between different stages', () => {
    let lifecycle = graph();
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:understand', 'understand')));
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:decide', 'decide')));
    const result = admitLifecycleTransition(
      lifecycle,
      transition('transition:u-d', 'precedes', 'stage:understand', 'stage:decide'),
    );
    expect(result.ok).toBe(true);
  });

  it('branch: an alternative path from one stage', () => {
    let lifecycle = graph();
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:decide', 'decide')));
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:alt-a', 'plan')));
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:alt-b', 'plan')));
    const branched = admitLifecycleTransition(
      lifecycle,
      transition('transition:branch-a', 'branch', 'stage:decide', 'stage:alt-a'),
    );
    expect(branched.ok).toBe(true);
    if (!branched.ok) return;
    const alsoBranched = admitLifecycleTransition(
      branched.value,
      transition('transition:branch-b', 'branch', 'stage:decide', 'stage:alt-b'),
    );
    expect(alsoBranched.ok).toBe(true);
  });

  it('overlap: concurrent active stages', () => {
    let lifecycle = graph();
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:realize', 'realize')));
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:observe', 'observe')));
    const result = admitLifecycleTransition(
      lifecycle,
      transition('transition:overlap', 'overlap', 'stage:realize', 'stage:observe'),
    );
    expect(result.ok).toBe(true);
  });

  it('pause and resume: self-relations parking and resuming a stage (derived status)', () => {
    let lifecycle = graph();
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:plan', 'plan')));
    expect(stageStatusOf(lifecycle, 'stage:plan')).toBe('active');
    const paused = must(
      admitLifecycleTransition(
        lifecycle,
        transition('transition:pause-plan', 'pause', 'stage:plan', 'stage:plan'),
      ),
    );
    expect(stageStatusOf(paused, 'stage:plan')).toBe('paused');
    // while paused, the stage record itself is untouched:
    expect(paused.stages.find((s) => s.recordId === 'stage:plan')!.enteredAt).toBe(T1);
    const resumed = must(
      admitLifecycleTransition(paused, {
        ...transition('transition:resume-plan', 'resume', 'stage:plan', 'stage:plan'),
        recordedAt: T3,
      }),
    );
    expect(stageStatusOf(resumed, 'stage:plan')).toBe('active');
  });

  it('loop: backward re-entry (verify -> realize)', () => {
    let lifecycle = graph();
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:realize', 'realize')));
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:verify', 'verify')));
    lifecycle = must(
      admitLifecycleStage(lifecycle, stage('stage:realize-2', 'realize', { enteredAt: T3 })),
    );
    const result = admitLifecycleTransition(
      lifecycle,
      transition('transition:loop-back', 'loop', 'stage:verify', 'stage:realize-2'),
    );
    expect(result.ok).toBe(true);
  });

  it('the fold projects stages with derived statuses and relations deterministically', () => {
    let lifecycle = graph();
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:understand', 'understand')));
    lifecycle = must(admitLifecycleStage(lifecycle, stage('stage:decide', 'decide')));
    lifecycle = must(
      admitLifecycleTransition(
        lifecycle,
        transition('transition:u-d', 'precedes', 'stage:understand', 'stage:decide'),
      ),
    );
    const folded = foldLifecycleStages(lifecycle);
    expect(folded).toHaveLength(2);
    // stages fold sorted by record id: stage:decide < stage:understand
    expect(folded[0]!.stage).toBe('decide');
    expect(folded[0]!.relationsIn).toEqual([
      { relation: 'precedes', fromStageRecordId: 'stage:understand' },
    ]);
    expect(folded[1]!.stage).toBe('understand');
    expect(folded[1]!.relationsOut).toEqual([
      { relation: 'precedes', toStageRecordId: 'stage:decide' },
    ]);
  });
});

describe('domain pack profiles (DP1.0)', () => {
  it('admits a conformant pack profile bound to the universal lifecycle', () => {
    const profile = {
      schema: 'epoch.solution-delivery.pack-profile',
      schemaVersion: 1,
      packId: 'construction.core',
      packVersion: '1.2.0',
      tenantId: TENANT,
      supportedLifecycleVersion: '1.0.0',
      stageVocabulary: {
        understand: 'Survey',
        decide: 'Design development',
        plan: 'Construction programming',
        acquire: 'Procurement',
        realize: 'Execution',
        observe: 'Field observation',
        actualize: 'Progress actualization',
        verify: 'Inspection & testing',
        forecast: 'Programme forecast',
        close: 'Handover',
        learn: 'Lessons learned',
      },
      projectionRules: [
        { projection: 'acquisition', presentation: 'Procurement register' },
        { projection: 'program-of-work', presentation: 'Construction programme' },
        { projection: 'realization', presentation: 'Site execution log' },
        { projection: 'schedule', presentation: 'BOQ quantity/cost schedule' },
      ],
      measurementNote: 'Quantities in BOQ conventions; unit costs per trade rate library',
      capabilityDependencies: ['capability.cad-geometry'],
    };
    const admitted = admitPackProfile(profile);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.stageVocabulary['realize']).toBe('Execution');
      expect(admitted.value.projectionRules).toHaveLength(4);
    }
  });
});
