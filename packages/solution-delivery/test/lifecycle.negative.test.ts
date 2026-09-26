// NAMED NEGATIVES (lifecycle): the SECOND-LIFECYCLE-AUTHORITY pattern (a
// pack-style record that redefines stage semantics or claims a forbidden
// authority) is rejected with authority-violation-rejected; illegal
// relation shapes (lifecycle-conflict); dangling stage-record references;
// cross-tenant admission; version conflicts; vendor fields.
import { describe, expect, it } from 'vitest';
import {
  admitLifecycleStage,
  admitLifecycleTransition,
  admitPackProfile,
  classifyLifecycleAuthority,
  type LifecycleGraph,
} from '../src/index';
import { PRINCIPAL, T1, T2, TENANT, OTHER_TENANT } from './fixtures';

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

/** A complete stage vocabulary (DP1.0: display vocabulary for EACH universal stage). */
const FULL_VOCABULARY: Record<string, string> = {
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
};

describe('NAMED NEGATIVE: second lifecycle authority (authority-violation-rejected)', () => {
  it('a pack-style stage record with a NON-UNIVERSAL stage is rejected', () => {
    const packStyle = stage('stage:boq-gen', 'boq-generation');
    const admitted = admitLifecycleStage(graph(), packStyle);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
      if (admitted.error.code === 'authority-violation-rejected') {
        expect(admitted.error.encounteredStage).toBe('boq-generation');
      }
    }
  });

  it('a pack profile that invents stages is rejected', () => {
    const profile = {
      schema: 'epoch.solution-delivery.pack-profile',
      schemaVersion: 1,
      packId: 'construction.core',
      packVersion: '1.2.0',
      tenantId: TENANT,
      supportedLifecycleVersion: '1.0.0',
      stageVocabulary: {
        plan: 'Construction programming',
        'boq-generation': 'BOQ generation',
      },
      projectionRules: [{ projection: 'schedule', presentation: 'BOQ schedule' }],
    };
    const admitted = admitPackProfile(profile);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
    }
  });

  it('a pack profile that claims lifecycle authority is rejected (DP1.0 forbidden list)', () => {
    const profile = {
      schema: 'epoch.solution-delivery.pack-profile',
      schemaVersion: 1,
      packId: 'construction.core',
      packVersion: '1.2.0',
      tenantId: TENANT,
      supportedLifecycleVersion: '1.0.0',
      stageVocabulary: { plan: 'Construction programming' },
      projectionRules: [{ projection: 'schedule', presentation: 'BOQ schedule' }],
      lifecycleAuthority: true,
    };
    const admitted = admitPackProfile(profile);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
      if (admitted.error.code === 'authority-violation-rejected') {
        expect(admitted.error.field).toBe('lifecycleAuthority');
      }
    }
  });

  it('a pack profile claiming a mutable actual substitute is rejected', () => {
    const profile = {
      schema: 'epoch.solution-delivery.pack-profile',
      schemaVersion: 1,
      packId: 'construction.core',
      packVersion: '1.2.0',
      tenantId: TENANT,
      supportedLifecycleVersion: '1.0.0',
      stageVocabulary: { plan: 'Construction programming' },
      projectionRules: [{ projection: 'schedule', presentation: 'BOQ schedule' }],
      mutableActual: true,
    };
    const admitted = admitPackProfile(profile);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
    }
  });

  it('the authority classifier catches stage-redefining arrays', () => {
    const packStyle = {
      universalStages: ['understand', 'boq-generation', 'plan'],
    };
    const classified = classifyLifecycleAuthority(packStyle);
    expect(classified !== null).toBe(true);
    if (classified !== null) {
      expect(classified.code).toBe('authority-violation-rejected');
    }
  });
});

describe('NAMED NEGATIVE: illegal relation shapes (lifecycle-conflict)', () => {
  it('precedes between the SAME stage is rejected (same-stage re-entry is a loop)', () => {
    const first = admitLifecycleStage(graph(), stage('stage:plan', 'plan'));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const result = admitLifecycleTransition(
      first.value,
      transition('transition:same', 'precedes', 'stage:plan', 'stage:plan'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
    }
  });

  it('loop pointing FORWARD is rejected (forward flow is precedes)', () => {
    let lifecycle = graph();
    const first = admitLifecycleStage(lifecycle, stage('stage:plan', 'plan'));
    if (!first.ok) return;
    lifecycle = first.value;
    const second = admitLifecycleStage(lifecycle, stage('stage:realize', 'realize'));
    if (!second.ok) return;
    lifecycle = second.value;
    const result = admitLifecycleTransition(
      lifecycle,
      transition('transition:forward-loop', 'loop', 'stage:plan', 'stage:realize'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
    }
  });

  it('pausing an already-paused stage is rejected', () => {
    let lifecycle = graph();
    const first = admitLifecycleStage(lifecycle, stage('stage:plan', 'plan'));
    if (!first.ok) return;
    lifecycle = first.value;
    const paused = admitLifecycleTransition(
      lifecycle,
      transition('transition:pause-1', 'pause', 'stage:plan', 'stage:plan'),
    );
    if (!paused.ok) return;
    const again = admitLifecycleTransition(
      paused.value,
      transition('transition:pause-2', 'pause', 'stage:plan', 'stage:plan'),
    );
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('lifecycle-conflict');
    }
  });

  it('resuming an ACTIVE stage is rejected', () => {
    let lifecycle = graph();
    const first = admitLifecycleStage(lifecycle, stage('stage:plan', 'plan'));
    if (!first.ok) return;
    lifecycle = first.value;
    const result = admitLifecycleTransition(
      lifecycle,
      transition('transition:resume-active', 'resume', 'stage:plan', 'stage:plan'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
    }
  });

  it('overlap requires both stages active', () => {
    let lifecycle = graph();
    const first = admitLifecycleStage(lifecycle, stage('stage:realize', 'realize'));
    if (!first.ok) return;
    lifecycle = first.value;
    const second = admitLifecycleStage(lifecycle, stage('stage:observe', 'observe'));
    if (!second.ok) return;
    lifecycle = second.value;
    const paused = admitLifecycleTransition(
      lifecycle,
      transition('transition:pause-obs', 'pause', 'stage:observe', 'stage:observe'),
    );
    if (!paused.ok) return;
    const result = admitLifecycleTransition(
      paused.value,
      transition('transition:overlap-paused', 'overlap', 'stage:realize', 'stage:observe'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
    }
  });
});

describe('NAMED NEGATIVE: dangling stage-record references (dangling-reference-rejected)', () => {
  it('a transition referencing an unknown stage record is rejected', () => {
    let lifecycle = graph();
    const first = admitLifecycleStage(lifecycle, stage('stage:plan', 'plan'));
    if (!first.ok) return;
    lifecycle = first.value;
    const result = admitLifecycleTransition(
      lifecycle,
      transition('transition:ghost', 'precedes', 'stage:plan', 'stage:ghost'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('dangling-reference-rejected');
      if (result.error.code === 'dangling-reference-rejected') {
        expect(result.error.referenceKind).toBe('stage-record');
      }
    }
  });
});

describe('NAMED NEGATIVE: cross-tenant and version conflicts', () => {
  it('a stage record from another tenant is rejected', () => {
    const foreign = stage('stage:foreign', 'plan', { tenantId: OTHER_TENANT });
    const result = admitLifecycleStage(graph(), foreign);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
    }
  });

  it('the same stage record id with different content is rejected', () => {
    const first = admitLifecycleStage(graph(), stage('stage:plan', 'plan'));
    if (!first.ok) return;
    const mutated = admitLifecycleStage(
      first.value,
      stage('stage:plan', 'plan', { enteredAt: T2 }),
    );
    expect(mutated.ok).toBe(false);
    if (!mutated.ok) {
      expect(mutated.error.code).toBe('version-conflict');
    }
  });
});

describe('NAMED NEGATIVE: pack-profile version and vendor fields', () => {
  it('a pack profile targeting a different lifecycle version is rejected at the precise path', () => {
    const profile = {
      schema: 'epoch.solution-delivery.pack-profile',
      schemaVersion: 1,
      packId: 'construction.core',
      packVersion: '1.2.0',
      tenantId: TENANT,
      supportedLifecycleVersion: '2.0.0',
      stageVocabulary: FULL_VOCABULARY,
      projectionRules: [],
    };
    const admitted = admitPackProfile(profile);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('validation');
      if (admitted.error.code === 'validation') {
        expect(admitted.error.issues.some((issue) => issue.path === 'supportedLifecycleVersion')).toBe(true);
      }
    }
  });

  it('vendor fields on a pack profile are rejected', () => {
    const profile = {
      schema: 'epoch.solution-delivery.pack-profile',
      schemaVersion: 1,
      packId: 'construction.core',
      packVersion: '1.2.0',
      tenantId: TENANT,
      supportedLifecycleVersion: '1.0.0',
      stageVocabulary: FULL_VOCABULARY,
      projectionRules: [],
      revitTemplateId: 'rvt-123',
    };
    const admitted = admitPackProfile(profile);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('vendor-fields-rejected');
    }
  });
});
