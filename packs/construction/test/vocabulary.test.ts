// NAMED POSITIVE: the construction vocabulary — entity bindings,
// measurement methods, cost classifications, verification methods,
// constraint descriptors, outcome types; the sealed vocabulary bundle
// (round-trip + digest + determinism).
import { describe, expect, it } from 'vitest';
import {
  classifyWorldEntity,
  CONSTRUCTION_COST_CLASSIFICATIONS,
  CONSTRUCTION_CONSTRAINT_DESCRIPTORS,
  CONSTRUCTION_ENTITY_BINDINGS,
  CONSTRUCTION_MEASUREMENT_METHODS,
  CONSTRUCTION_OUTCOME_TYPES,
  CONSTRUCTION_VERIFICATION_METHODS,
  constructionVocabularyBundle,
  CONSTRUCTION_RESOURCE_CLASSES,
  CONSTRUCTION_VERIFICATION_KINDS,
  CONSTRUCTION_CONCEPTS,
  sealVocabularyBundle,
  verifyVocabularyBundle,
} from '../src/index';
import { WORLD_ENTITIES } from './fixtures';

describe('NAMED POSITIVE: entity bindings (World Model vocabulary as typed data)', () => {
  it('the four construction concepts each carry a binding onto a W002 type key', () => {
    const concepts = CONSTRUCTION_ENTITY_BINDINGS.map((binding) => binding.constructionConcept);
    expect([...concepts].sort()).toEqual([...CONSTRUCTION_CONCEPTS].sort());
    for (const binding of CONSTRUCTION_ENTITY_BINDINGS) {
      expect(binding.entityTypeKey).toMatch(/^construction:(element|space|system|zone)$/);
      expect(binding.bindingId).toMatch(/^construction\.bind\./);
    }
  });

  it('classifyWorldEntity folds world entities onto their construction concepts', () => {
    for (const entity of WORLD_ENTITIES) {
      const classified = classifyWorldEntity(CONSTRUCTION_ENTITY_BINDINGS, entity);
      expect(classified.entityId).toBe(entity.id);
      expect(classified.concept).toBeDefined();
    }
    expect(classifyWorldEntity(CONSTRUCTION_ENTITY_BINDINGS, { id: 'x', type: 'construction:element' }).concept).toBe('element');
    expect(classifyWorldEntity(CONSTRUCTION_ENTITY_BINDINGS, { id: 'x', type: 'core:actor' }).concept).toBeUndefined();
  });
});

describe('NAMED POSITIVE: measurement methods (units + net/gross rules)', () => {
  it('the five measurement bases each carry a method with a code and a net/gross rule', () => {
    const bases = CONSTRUCTION_MEASUREMENT_METHODS.map((method) => method.base);
    expect([...bases].sort()).toEqual(['area', 'count', 'length', 'mass', 'volume']);
    for (const method of CONSTRUCTION_MEASUREMENT_METHODS) {
      expect(method.measurementCode).toMatch(/^construction\.measure\./);
      if (method.netGrossRule.rule === 'gross') {
        expect(Number(method.netGrossRule.allowanceFactor)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('the methods cover the BOQ units used by the fixture (m3, m2, number, tonne)', () => {
    const units = CONSTRUCTION_MEASUREMENT_METHODS.map((method) => method.unit);
    for (const unit of ['m3', 'm2', 'number', 'tonne', 'm']) {
      expect(units).toContain(unit);
    }
  });
});

describe('NAMED POSITIVE: cost/resource classifications', () => {
  it('the five construction resource classes each carry a classification record', () => {
    const classes = CONSTRUCTION_COST_CLASSIFICATIONS.map(
      (classification) => classification.resourceClass,
    );
    expect([...classes].sort()).toEqual([...CONSTRUCTION_RESOURCE_CLASSES].sort());
    for (const classification of CONSTRUCTION_COST_CLASSIFICATIONS) {
      expect(classification.costCode).toMatch(/^construction\.cost\.code\./);
    }
  });
});

describe('NAMED POSITIVE: verification-method descriptors (W006 conventions)', () => {
  it('the four construction verification kinds each carry a descriptor', () => {
    const kinds = CONSTRUCTION_VERIFICATION_METHODS.map((method) => method.kind);
    expect([...kinds].sort()).toEqual([...CONSTRUCTION_VERIFICATION_KINDS].sort());
    for (const method of CONSTRUCTION_VERIFICATION_METHODS) {
      expect(method.evidenceConvention).toMatch(/W006/);
      expect(method.methodId).toMatch(/^construction\.verify\./);
    }
  });
});

describe('NAMED POSITIVE: constraint descriptors (W004-compatible vocabulary)', () => {
  it('each descriptor carries a W004-grammar constraint id and a matching policy binding', () => {
    expect(CONSTRUCTION_CONSTRAINT_DESCRIPTORS.length).toBeGreaterThanOrEqual(5);
    for (const descriptor of CONSTRUCTION_CONSTRAINT_DESCRIPTORS) {
      expect(descriptor.constraintId).toMatch(/^[a-z][a-z0-9-]{0,127}$/);
      expect(descriptor.policyBinding.constraintId).toBe(descriptor.constraintId);
    }
  });
});

describe('NAMED POSITIVE: outcome types (projections over universal outcome kinds)', () => {
  it('practical completion and defects liability bind onto universal outcome kinds', () => {
    const byId = new Map(CONSTRUCTION_OUTCOME_TYPES.map((type) => [type.outcomeTypeId, type]));
    expect(byId.get('construction.outcome.practical-completion')?.universalOutcomeKind).toBe('accepted');
    expect(byId.get('construction.outcome.defects-liability')?.universalOutcomeKind).toBe('residual');
    expect(byId.get('construction.outcome.handover')?.universalOutcomeKind).toBe('handover');
  });
});

describe('NAMED POSITIVE: the sealed vocabulary bundle (round-trip + digest + determinism)', () => {
  it('the default bundle seals and verifies', () => {
    const bundle = constructionVocabularyBundle();
    expect(verifyVocabularyBundle(bundle).ok).toBe(true);
  });

  it('the bundle round-trips through JSON', () => {
    const bundle = constructionVocabularyBundle();
    const verified = verifyVocabularyBundle(JSON.parse(JSON.stringify(bundle)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(bundle);
    }
  });

  it('the bundle digest is deterministic across calls', () => {
    expect(constructionVocabularyBundle()).toEqual(constructionVocabularyBundle());
  });

  it('sealVocabularyBundle rejects an unsorted vocabulary (deterministic serialization)', () => {
    const bundle = constructionVocabularyBundle();
    const shuffled = {
      ...bundle,
      entityBindings: [...bundle.entityBindings].reverse(),
    } as unknown as Record<string, unknown>;
    delete (shuffled as Record<string, unknown>)['contentDigest'];
    const sealed = sealVocabularyBundle(shuffled);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('a tampered bundle digest fails verification (digest-mismatch)', () => {
    const bundle = constructionVocabularyBundle();
    const tampered = {
      ...bundle,
      measurementMethods: bundle.measurementMethods.map((method) =>
        method.methodId === 'construction.measure.area'
          ? { ...method, unit: 'm3' }
          : method,
      ),
    };
    const verified = verifyVocabularyBundle(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});
