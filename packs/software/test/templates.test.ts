// NAMED POSITIVE: work templates — the four software work-package
// templates (feature delivery, bugfix, migration, infrastructure change)
// seal and verify; instantiation is a caller-side fold producing
// PLAN-COMPATIBLE shapes (the W036 buildProgramOfWork admits them) —
// never a canonical write.
import { describe, expect, it } from 'vitest';
import { buildProgramOfWork, type WorkPackage } from '@epoch/solution-delivery';
import {
  instantiateWorkTemplate,
  sealWorkTemplate,
  softwareWorkTemplates,
  verifyWorkTemplate,
} from '../src/index';
import { sealedSolution, T1, T2 } from './fixtures';

const TEMPLATE_IDS = [
  'software.template.bugfix',
  'software.template.feature-delivery',
  'software.template.infrastructure-change',
  'software.template.migration',
];

describe('NAMED POSITIVE: the work-template catalog', () => {
  it('the catalog carries the four Work Order templates, sealed and sorted', () => {
    const templates = softwareWorkTemplates();
    expect(templates.map((template) => template.templateId)).toEqual(TEMPLATE_IDS);
    for (const template of templates) {
      expect(template.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('every template round-trips through seal -> JSON -> verify', () => {
    for (const template of softwareWorkTemplates()) {
      const verified = verifyWorkTemplate(JSON.parse(JSON.stringify(template)));
      expect(verified.ok, template.templateId).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(template);
      }
    }
  });

  it('the catalog is deterministic across calls', () => {
    expect(softwareWorkTemplates()).toEqual(softwareWorkTemplates());
  });

  it('the infrastructure-change template carries the infrastructure realization variant', () => {
    const infrastructure = softwareWorkTemplates().find(
      (template) => template.templateId === 'software.template.infrastructure-change',
    );
    expect(infrastructure?.realizationVariant).toBe('infrastructure-provisioning');
    const feature = softwareWorkTemplates().find(
      (template) => template.templateId === 'software.template.feature-delivery',
    );
    expect(feature?.realizationVariant).toBe('software-implementation-deployment');
  });

  it('a template with a cyclic slot graph fails to seal (validation)', () => {
    const sealed = sealWorkTemplate({
      schema: 'epoch.pack-software.work-template',
      schemaVersion: 1,
      templateId: 'software.template.cyclic',
      templateVersion: '1.0.0',
      title: 'Cyclic template',
      realizationVariant: 'software-implementation-deployment',
      activitySlots: [
        {
          slotId: 'a',
          title: 'A',
          predecessorSlots: ['b'],
        },
        {
          slotId: 'b',
          title: 'B',
          predecessorSlots: ['a'],
        },
      ],
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });
});

describe('NAMED POSITIVE: template instantiation (caller-side fold; NO canonical writes)', () => {
  it('the feature-delivery template instantiates into a plan-compatible work package', () => {
    const template = softwareWorkTemplates().find(
      (candidate) => candidate.templateId === 'software.template.feature-delivery',
    )!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:checkout-notifications',
      title: 'Checkout notifications feature',
      activityIds: {
        implement: 'activity:notifications-implement',
        specify: 'activity:notifications-specify',
        verify: 'activity:notifications-verify',
      },
      plannedStart: T1,
      plannedFinish: T2,
    });
    expect(instantiated.ok).toBe(true);
    if (!instantiated.ok) {
      throw new Error('fixture instantiation failed');
    }
    const workPackage: WorkPackage = instantiated.value;
    expect(workPackage.workPackageId).toBe('work-package:checkout-notifications');
    expect(workPackage.realizationVariant).toBe('software-implementation-deployment');
    expect(workPackage.activities).toHaveLength(3);
    // The dependency mirrors are filled: specify -> implement -> verify.
    const implement = workPackage.activities.find(
      (activity) => activity.activityId === 'activity:notifications-implement',
    )!;
    expect(implement.predecessors).toEqual(['activity:notifications-specify']);
    expect(implement.successors).toEqual(['activity:notifications-verify']);
    const specify = workPackage.activities.find(
      (activity) => activity.activityId === 'activity:notifications-specify',
    )!;
    expect(specify.successors).toEqual(['activity:notifications-implement']);
  });

  it('the instantiated package ADMITS through the W036 buildProgramOfWork (plan-compatible)', () => {
    const solution = sealedSolution();
    const template = softwareWorkTemplates().find(
      (candidate) => candidate.templateId === 'software.template.feature-delivery',
    )!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:checkout-notifications',
      title: 'Checkout notifications feature',
      activityIds: {
        implement: 'activity:notifications-implement',
        specify: 'activity:notifications-specify',
        verify: 'activity:notifications-verify',
      },
    });
    if (!instantiated.ok) {
      throw new Error('fixture instantiation failed');
    }
    const admitted = buildProgramOfWork({
      schema: 'epoch.solution-delivery.program-of-work',
      schemaVersion: 1,
      programId: 'program:checkout-notifications-v1',
      tenantId: solution.tenantId,
      solutionId: solution.solutionId,
      solutionVersion: solution.version,
      solutionVersionDigest: solution.contentDigest,
      title: 'Checkout notifications programme',
      workPackages: [instantiated.value],
      milestones: [],
      createdAt: T1,
      createdBy: 'principal:delivery-lead',
    });
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.workPackages[0]!.activities).toHaveLength(3);
    }
  });

  it('an unknown slot in activityIds is a typed validation error', () => {
    const template = softwareWorkTemplates()[0]!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:any',
      title: 'Any package',
      activityIds: {
        implement: 'activity:implement',
        specify: 'activity:specify',
        verify: 'activity:verify',
        unknown: 'activity:unknown',
      },
    });
    expect(instantiated.ok).toBe(false);
    if (!instantiated.ok) {
      expect(instantiated.error.code).toBe('validation');
    }
  });

  it('a slot MISSING from activityIds is a typed validation error', () => {
    const template = softwareWorkTemplates().find(
      (candidate) => candidate.templateId === 'software.template.feature-delivery',
    )!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:any',
      title: 'Any package',
      activityIds: {
        implement: 'activity:implement',
        specify: 'activity:specify',
      },
    });
    expect(instantiated.ok).toBe(false);
    if (!instantiated.ok) {
      expect(instantiated.error.code).toBe('validation');
    }
  });

  it('a non-injective activityIds mapping is rejected', () => {
    const template = softwareWorkTemplates().find(
      (candidate) => candidate.templateId === 'software.template.feature-delivery',
    )!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:any',
      title: 'Any package',
      activityIds: {
        implement: 'activity:same',
        specify: 'activity:same',
        verify: 'activity:same',
      },
    });
    expect(instantiated.ok).toBe(false);
  });
});
