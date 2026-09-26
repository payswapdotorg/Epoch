// NAMED NEGATIVES (ProgramOfWork): schedule CYCLE rejected; dependency
// mirror inconsistency (schedule-integrity-rejected); dangling activity /
// work-package references; vendor fields; tampered digest.
import { describe, expect, it } from 'vitest';
import { buildProgramOfWork, verifySealedProgramOfWork } from '../src/index';
import { programContent, sealedProgram, sealedV1 } from './fixtures';

describe('NAMED NEGATIVE: schedule CYCLE rejected (schedule-cycle-rejected)', () => {
  it('a two-activity dependency cycle is rejected with the cycle path', () => {
    const v1 = sealedV1();
    const content = programContent(v1) as {
      workPackages: Array<Record<string, unknown>>;
    };
    const activities = content.workPackages[0]!.activities as Array<Record<string, unknown>>;
    const excavate = activities.find((a) => a['activityId'] === 'activity:excavate')!;
    const brace = activities.find((a) => a['activityId'] === 'activity:brace-frame')!;
    // excavate -> brace (existing) plus brace -> excavate (new): a cycle.
    // (activities stay sorted by activityId: brace-frame < excavate)
    const cyclical = [
      { ...brace, predecessors: ['activity:excavate'], successors: ['activity:excavate'] },
      { ...excavate, predecessors: ['activity:brace-frame'], successors: ['activity:brace-frame'] },
    ];
    const built = buildProgramOfWork({
      ...content,
      workPackages: [
        { ...content.workPackages[0]!, activities: cyclical },
      ],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('schedule-cycle-rejected');
      if (built.error.code === 'schedule-cycle-rejected') {
        expect(built.error.cycle.length).toBeGreaterThanOrEqual(2);
        expect(built.error.cycle).toContain('activity:excavate');
        expect(built.error.cycle).toContain('activity:brace-frame');
      }
    }
  });

  it('a self-dependency is rejected as a cycle', () => {
    const v1 = sealedV1();
    const content = programContent(v1) as {
      workPackages: Array<Record<string, unknown>>;
    };
    const activities = content.workPackages[0]!.activities as Array<Record<string, unknown>>;
    const brace = activities.find((a) => a['activityId'] === 'activity:brace-frame')!;
    const selfLoop = [
      { ...brace, predecessors: ['activity:brace-frame', 'activity:excavate'] },
      ...activities.filter((a) => a['activityId'] !== 'activity:brace-frame'),
    ];
    const built = buildProgramOfWork({
      ...content,
      workPackages: [{ ...content.workPackages[0]!, activities: selfLoop }],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('schedule-cycle-rejected');
    }
  });
});

describe('NAMED NEGATIVE: dependency mirror inconsistency (schedule-integrity-rejected)', () => {
  it('a successor that does not mirror the predecessor is rejected', () => {
    const v1 = sealedV1();
    const content = programContent(v1) as {
      workPackages: Array<Record<string, unknown>>;
    };
    const activities = content.workPackages[0]!.activities as Array<Record<string, unknown>>;
    const excavate = activities.find((a) => a['activityId'] === 'activity:excavate')!;
    const broken = [
      // brace-frame no longer lists excavate as predecessor...
      { ...activities.find((a) => a['activityId'] === 'activity:brace-frame')!, predecessors: [] },
      { ...excavate, successors: ['activity:brace-frame'] },
    ];
    const built = buildProgramOfWork({
      ...content,
      workPackages: [{ ...content.workPackages[0]!, activities: broken }],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('schedule-integrity-rejected');
    }
  });
});

describe('NAMED NEGATIVE: dangling program references (dangling-reference-rejected)', () => {
  it('an unknown predecessor id is rejected', () => {
    const v1 = sealedV1();
    const content = programContent(v1) as {
      workPackages: Array<Record<string, unknown>>;
    };
    const activities = content.workPackages[0]!.activities as Array<Record<string, unknown>>;
    const brace = activities.find((a) => a['activityId'] === 'activity:brace-frame')!;
    const dangling = [
      { ...brace, predecessors: ['activity:ghost'], successors: [] },
      ...activities.filter((a) => a['activityId'] !== 'activity:brace-frame'),
    ];
    const built = buildProgramOfWork({
      ...content,
      workPackages: [{ ...content.workPackages[0]!, activities: dangling }],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('dangling-reference-rejected');
      if (built.error.code === 'dangling-reference-rejected') {
        expect(built.error.referenceId).toBe('activity:ghost');
      }
    }
  });

  it('an activity whose declared work package mismatches its owner is rejected', () => {
    const v1 = sealedV1();
    const content = programContent(v1) as {
      workPackages: Array<Record<string, unknown>>;
    };
    const activities = content.workPackages[0]!.activities as Array<Record<string, unknown>>;
    const excavate = activities.find((a) => a['activityId'] === 'activity:excavate')!;
    const misplaced = [
      {
        ...activities.find((a) => a['activityId'] === 'activity:brace-frame')!,
        predecessors: [],
        successors: [],
      },
      { ...excavate, workPackageId: 'work-package:elsewhere', predecessors: [], successors: [] },
    ];
    const built = buildProgramOfWork({
      ...content,
      workPackages: [{ ...content.workPackages[0]!, activities: misplaced }],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('dangling-reference-rejected');
      if (built.error.code === 'dangling-reference-rejected') {
        expect(built.error.referenceKind).toBe('work-package');
      }
    }
  });

  it('a milestone referencing an unknown activity is rejected', () => {
    const v1 = sealedV1();
    const content = programContent(v1) as Record<string, unknown>;
    const built = buildProgramOfWork({
      ...content,
      milestones: [
        {
          milestoneId: 'milestone:ghost',
          title: 'Ghost milestone',
          activityIds: ['activity:ghost'],
          status: 'planned',
          evidence: [],
        },
      ],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('dangling-reference-rejected');
    }
  });
});

describe('NAMED NEGATIVE: vendor fields (vendor-fields-rejected)', () => {
  it('unknown structural fields on the program are rejected', () => {
    const v1 = sealedV1();
    const built = buildProgramOfWork({
      ...programContent(v1),
      primaveraProjectCode: 'P6-XYZ',
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe('vendor-fields-rejected');
    }
  });
});

describe('NAMED NEGATIVE: tampered program digest (digest-mismatch)', () => {
  it('a sealed program with edited content is rejected', () => {
    const program = sealedProgram(sealedV1());
    const tampered = { ...program, title: 'edited programme' };
    const verified = verifySealedProgramOfWork(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});
