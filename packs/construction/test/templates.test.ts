// NAMED POSITIVE: work templates — content addressing, round-trip,
// tamper detection, and the caller-side instantiation fold producing
// plan-compatible shapes admitted by the W036 buildProgramOfWork.
import { describe, expect, it } from 'vitest';
import { buildProgramOfWork } from '@epoch/solution-delivery';
import {
  constructionWorkTemplates,
  instantiateWorkTemplate,
  sealWorkTemplate,
  verifyWorkTemplate,
} from '../src/index';
import { programContent, sealedSolution, T3, T4 } from './fixtures';

describe('NAMED POSITIVE: the construction work-template catalog', () => {
  it('the catalog seals three templates, sorted by templateId', () => {
    const templates = constructionWorkTemplates();
    const ids = templates.map((template) => template.templateId);
    expect(ids).toEqual([
      'construction.template.envelope',
      'construction.template.substructure',
      'construction.template.superstructure',
    ]);
  });

  it('every catalog template verifies (content addressing)', () => {
    for (const template of constructionWorkTemplates()) {
      const verified = verifyWorkTemplate(template);
      expect(verified.ok, template.templateId).toBe(true);
    }
  });

  it('the catalog is deterministic across calls (same digests)', () => {
    expect(constructionWorkTemplates()).toEqual(constructionWorkTemplates());
  });

  it('a template round-trips through JSON', () => {
    for (const template of constructionWorkTemplates()) {
      const verified = verifyWorkTemplate(JSON.parse(JSON.stringify(template)));
      expect(verified.ok, template.templateId).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(template);
      }
    }
  });

  it('a tampered template digest fails verification (digest-mismatch)', () => {
    const template = constructionWorkTemplates()[0]!;
    const tampered = { ...template, title: 'Tampered title' };
    const verified = verifyWorkTemplate(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});

describe('NAMED POSITIVE: template instantiation (a caller-side fold, never a canonical write)', () => {
  it('an instantiated template admits through the W036 buildProgramOfWork (plan-compatible)', () => {
    const solution = sealedSolution();
    const template = constructionWorkTemplates().find(
      (candidate) => candidate.templateId === 'construction.template.substructure',
    )!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:template-substructure',
      title: 'Substructure works (from template)',
      activityIds: {
        excavate: 'activity:template-excavation',
        blind: 'activity:template-blinding',
        foundations: 'activity:template-foundations',
      },
      plannedStart: T3,
      plannedFinish: T4,
    });
    expect(instantiated.ok).toBe(true);
    if (instantiated.ok) {
      // The fold fills the predecessor/successor mirrors the kernel requires.
      const excavation = instantiated.value.activities.find(
        (activity) => activity.activityId === 'activity:template-excavation',
      )!;
      const blinding = instantiated.value.activities.find(
        (activity) => activity.activityId === 'activity:template-blinding',
      )!;
      expect(excavation.successors).toEqual(['activity:template-blinding']);
      expect(blinding.predecessors).toEqual(['activity:template-excavation']);
      expect(blinding.successors).toEqual(['activity:template-foundations']);
      // The instantiated package feeds the KERNEL admission path unchanged.
      const content = programContent(solution);
      const built = buildProgramOfWork({
        ...(content as Record<string, unknown>),
        workPackages: [instantiated.value],
        milestones: [],
      });
      expect(built.ok).toBe(true);
    }
  });

  it('instantiation is deterministic: the same params yield the identical fold', () => {
    const template = constructionWorkTemplates()[0]!;
    const params = {
      workPackageId: 'work-package:deterministic',
      title: 'Deterministic envelope package',
      activityIds: {
        'facade-walls': 'activity:facade-from-template',
        windows: 'activity:windows-from-template',
      },
    };
    expect(instantiateWorkTemplate(template, params)).toEqual(
      instantiateWorkTemplate(template, params),
    );
  });

  it('an unknown slot in activityIds is a typed validation error', () => {
    const template = constructionWorkTemplates()[0]!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:bad-slots',
      title: 'Bad slots',
      activityIds: { 'no-such-slot': 'activity:x' },
    });
    expect(instantiated.ok).toBe(false);
    if (!instantiated.ok) {
      expect(instantiated.error.code).toBe('validation');
    }
  });

  it('an incomplete slot coverage is a typed validation error', () => {
    const template = constructionWorkTemplates()[0]!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:incomplete',
      title: 'Incomplete coverage',
      activityIds: { 'facade-walls': 'activity:facade-only' },
    });
    expect(instantiated.ok).toBe(false);
    if (!instantiated.ok) {
      expect(instantiated.error.code).toBe('validation');
    }
  });

  it('a non-injective activityIds mapping is a typed validation error', () => {
    const template = constructionWorkTemplates()[0]!;
    const instantiated = instantiateWorkTemplate(template, {
      workPackageId: 'work-package:collapsed',
      title: 'Collapsed ids',
      activityIds: {
        'facade-walls': 'activity:same-id',
        windows: 'activity:same-id',
      },
    });
    expect(instantiated.ok).toBe(false);
    if (!instantiated.ok) {
      expect(instantiated.error.code).toBe('validation');
    }
  });

  it('a template whose slots carry a cycle is rejected at seal time', () => {
    const sealed = sealWorkTemplate({
      schema: 'epoch.pack-construction.work-template',
      schemaVersion: 1,
      templateId: 'construction.template.cyclic',
      templateVersion: '1.0.0',
      title: 'Cyclic template',
      realizationVariant: 'construction-build',
      activitySlots: [
        { slotId: 'a', title: 'A', predecessorSlots: ['b'] },
        { slotId: 'b', title: 'B', predecessorSlots: ['a'] },
      ],
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });
});
