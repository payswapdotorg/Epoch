// @epoch/constraint-language — shared test fixtures.
import { compileConstraint } from '../src';
import type { AuthoredConstraint, CompiledConstraint, EvaluationContext } from '../src';

type HardConstraint = Extract<AuthoredConstraint, { class: 'hard' }>;
type SoftConstraint = Extract<AuthoredConstraint, { class: 'soft' }>;
type ResourceConstraint = Extract<AuthoredConstraint, { class: 'resource' }>;
type SafetyConstraint = Extract<AuthoredConstraint, { class: 'safety' }>;
type EpistemicConstraint = Extract<AuthoredConstraint, { class: 'epistemic' }>;
type AuthorityConstraint = Extract<AuthoredConstraint, { class: 'authority' }>;

export const hardConstraint: HardConstraint = {
  languageVersion: '1.0.0',
  id: 'pressure-below-max',
  version: '1.0.0',
  title: 'Pressure below maximum',
  tags: ['physics'],
  severity: 'critical',
  inputs: [
    { name: 'pressure', type: 'number', description: 'Chamber pressure in bar' },
    { name: 'region', type: 'enum', values: ['eu', 'us'] },
  ],
  class: 'hard',
  predicate: { node: 'lt', left: { node: 'input', name: 'pressure' }, right: { node: 'lit', type: 'number', value: 10 } },
  appliesWhen: { node: 'eq', left: { node: 'input', name: 'region' }, right: { node: 'lit', type: 'string', value: 'eu' } },
};

export const softConstraint: SoftConstraint = {
  languageVersion: '1.0.0',
  id: 'prefer-low-cost',
  version: '1.1.0',
  inputs: [{ name: 'cost', type: 'number' }],
  class: 'soft',
  predicate: { node: 'lt', left: { node: 'input', name: 'cost' }, right: { node: 'lit', type: 'number', value: 100 } },
  weight: 5,
};

export const resourceConstraint: ResourceConstraint = {
  languageVersion: '1.0.0',
  id: 'budget-hours',
  version: '2.0.1',
  inputs: [{ name: 'spent', type: 'number' }, { name: 'cap', type: 'number' }],
  class: 'resource',
  usage: { node: 'input', name: 'spent' },
  limit: { node: 'input', name: 'cap' },
  unit: 'hours',
};

export const safetyConstraint: SafetyConstraint = {
  languageVersion: '1.0.0',
  id: 'guardrail-mounted',
  version: '1.0.0',
  inputs: [{ name: 'guardrailMounted', type: 'boolean' }],
  class: 'safety',
  predicate: { node: 'input', name: 'guardrailMounted' },
  regulations: ['OSHA-1926.501', 'EN-ISO-14122'],
};

export const epistemicConstraint: EpistemicConstraint = {
  languageVersion: '1.0.0',
  id: 'confidence-and-evidence',
  version: '1.0.0',
  inputs: [
    { name: 'confidence', type: 'number' },
    { name: 'evidence', type: 'record' },
  ],
  class: 'epistemic',
  confidence: { node: 'input', name: 'confidence' },
  threshold: { node: 'lit', type: 'number', value: 0.8 },
  evidenceInput: 'evidence',
  requiredEvidence: [
    { kind: 'measurement', minCount: 2 },
    { kind: 'certification', minCount: 1 },
  ],
};

export const authorityConstraint: AuthorityConstraint = {
  languageVersion: '1.0.0',
  id: 'deploy-permission',
  version: '1.0.0',
  inputs: [{ name: 'permissions', type: 'list' }],
  class: 'authority',
  permissionsInput: 'permissions',
  allOf: ['deploy:prod'],
  anyOf: ['approval:safety', 'approval:exec'],
};

export function compiledOf(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) {
    throw new Error(`fixture failed to compile: ${JSON.stringify(outcome.errors)}`);
  }
  return outcome.compiled;
}

export function contextOf(inputs: Record<string, unknown>): EvaluationContext {
  return { inputs: inputs as EvaluationContext['inputs'] };
}
