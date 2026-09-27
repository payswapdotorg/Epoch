// NAMED POSITIVE: the software vocabulary bundle — every family is typed,
// sorted, duplicate-free data; the bundle seals and verifies; the families
// carry the pack identity.
import { describe, expect, it } from 'vitest';
import {
  SOFTWARE_CONSTRAINT_DESCRIPTORS,
  SOFTWARE_COST_CLASSIFICATIONS,
  SOFTWARE_DEPLOYMENT_ENVIRONMENTS,
  SOFTWARE_ENTITY_BINDINGS,
  SOFTWARE_MEASUREMENT_METHODS,
  SOFTWARE_OUTCOME_TYPES,
  SOFTWARE_VERIFICATION_METHODS,
  SOFTWARE_WORK_ITEMS,
  sealVocabularyBundle,
  softwareVocabularyBundle,
  verifyVocabularyBundle,
} from '../src/index';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

describe('NAMED POSITIVE: the vocabulary bundle seals and verifies', () => {
  it('the default bundle seals (pack data invariant holds) and carries a canonical digest', () => {
    const bundle = softwareVocabularyBundle();
    expect(bundle.contentDigest).toMatch(DIGEST_PATTERN);
    expect(bundle.packId).toBe('software.core');
    expect(bundle.packVersion).toBe('1.0.0');
  });

  it('the default bundle round-trips through verification', () => {
    const bundle = softwareVocabularyBundle();
    const verified = verifyVocabularyBundle(JSON.parse(JSON.stringify(bundle)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(bundle);
    }
  });

  it('a caller-assembled bundle with the pack families seals and verifies', () => {
    const sealed = sealVocabularyBundle({
      schema: 'epoch.pack-software.vocabulary-bundle',
      schemaVersion: 1,
      packId: 'software.core',
      packVersion: '1.0.0',
      entityBindings: [...SOFTWARE_ENTITY_BINDINGS],
      workItems: [...SOFTWARE_WORK_ITEMS],
      measurementMethods: [...SOFTWARE_MEASUREMENT_METHODS],
      costClassifications: [...SOFTWARE_COST_CLASSIFICATIONS],
      verificationMethods: [...SOFTWARE_VERIFICATION_METHODS],
      constraintDescriptors: [...SOFTWARE_CONSTRAINT_DESCRIPTORS],
      outcomeTypes: [...SOFTWARE_OUTCOME_TYPES],
      deploymentEnvironments: [...SOFTWARE_DEPLOYMENT_ENVIRONMENTS],
    });
    expect(sealed.ok).toBe(true);
  });
});

describe('NAMED POSITIVE: every vocabulary family is sorted, duplicate-free typed data', () => {
  const families: readonly [string, readonly { readonly id: string }[]][] = [
    ['entityBindings', SOFTWARE_ENTITY_BINDINGS.map((b) => ({ id: b.bindingId }))],
    ['workItems', SOFTWARE_WORK_ITEMS.map((b) => ({ id: b.workItemId }))],
    ['measurementMethods', SOFTWARE_MEASUREMENT_METHODS.map((b) => ({ id: b.methodId }))],
    ['costClassifications', SOFTWARE_COST_CLASSIFICATIONS.map((b) => ({ id: b.classId }))],
    ['verificationMethods', SOFTWARE_VERIFICATION_METHODS.map((b) => ({ id: b.methodId }))],
    ['constraintDescriptors', SOFTWARE_CONSTRAINT_DESCRIPTORS.map((b) => ({ id: b.descriptorId }))],
    ['outcomeTypes', SOFTWARE_OUTCOME_TYPES.map((b) => ({ id: b.outcomeTypeId }))],
    ['deploymentEnvironments', SOFTWARE_DEPLOYMENT_ENVIRONMENTS.map((b) => ({ id: b.environmentId }))],
  ];

  it.each(families)('%s is sorted ascending and duplicate-free', (_name, entries) => {
    const ids = entries.map((entry) => entry.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the entity bindings cover the five software concepts', () => {
    const concepts = SOFTWARE_ENTITY_BINDINGS.map((binding) => binding.softwareConcept).sort();
    expect(concepts).toEqual(['environment', 'release-unit', 'repository', 'service', 'system']);
  });

  it('the work items cover epic/issue/task/change with their canonical anchors', () => {
    const kinds = SOFTWARE_WORK_ITEMS.map((item) => item.kind).sort();
    expect(kinds).toEqual(['change', 'epic', 'issue', 'task']);
    const epic = SOFTWARE_WORK_ITEMS.find((item) => item.kind === 'epic');
    expect(epic?.anchorKind).toBe('work-package');
    for (const kind of ['issue', 'task', 'change']) {
      const item = SOFTWARE_WORK_ITEMS.find((candidate) => candidate.kind === kind);
      expect(item?.anchorKind).toBe('activity');
    }
  });

  it('the measurement methods cover effort-hours and the three count bases', () => {
    const units = SOFTWARE_MEASUREMENT_METHODS.map((method) => method.unit).sort();
    expect(units).toEqual(['deliverable', 'deployment', 'environment', 'hour']);
    const effort = SOFTWARE_MEASUREMENT_METHODS.find((method) => method.unit === 'hour');
    expect(effort?.base).toBe('effort');
    expect(effort?.effortRule.rule).toBe('contingency');
  });

  it('the cost classifications cover the four software resource classes', () => {
    const classes = SOFTWARE_COST_CLASSIFICATIONS.map((c) => c.resourceClass).sort();
    expect(classes).toEqual(['engineering', 'infrastructure', 'licensing', 'operations']);
  });

  it('the verification methods cover the four software verification kinds', () => {
    const kinds = SOFTWARE_VERIFICATION_METHODS.map((m) => m.kind).sort();
    expect(kinds).toEqual(['deploy-gate', 'review-approval', 'slo-check', 'test-suite-pass']);
  });

  it('the deployment environments cover the four provider-neutral tiers', () => {
    const tiers = SOFTWARE_DEPLOYMENT_ENVIRONMENTS.map((e) => e.tier).sort();
    expect(tiers).toEqual(['development', 'integration', 'production', 'staging']);
  });
});
