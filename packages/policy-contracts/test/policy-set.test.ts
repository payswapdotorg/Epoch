// End-to-end policy-set evaluation: policies + target + context + resolver ->
// deterministic decision. This is the golden path W022 (Action Gateway) will
// wire up. Includes fail-closed behavior for unresolved bindings and throwing
// resolvers, and the contract-sync checks for the policy surface.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  compileConstraint,
  evaluatePolicySet,
  policyDocumentSchema,
} from '../src';
import type { CompiledConstraint, PolicyDocument } from '../src';
import type * as Contracts from '@epoch/contracts-constraints';

/** Strict type equality probe: compiles only when A and B are identical types. */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

const contractSyncChecks = {
  policyDocument: true as Equals<PolicyDocument, Contracts.PolicyDocument>,
} as const;

const hardAuthored = {
  languageVersion: '1.0.0',
  id: 'hard-budget',
  version: '1.0.0',
  inputs: [{ name: 'spend', type: 'number' }],
  class: 'hard',
  predicate: {
    node: 'lt',
    left: { node: 'input', name: 'spend' },
    right: { node: 'lit', type: 'number', value: 100 },
  },
};

const softAuthored = {
  languageVersion: '1.0.0',
  id: 'prefer-cheap',
  version: '1.0.0',
  inputs: [{ name: 'spend', type: 'number' }],
  class: 'soft',
  predicate: {
    node: 'lt',
    left: { node: 'input', name: 'spend' },
    right: { node: 'lit', type: 'number', value: 20 },
  },
  weight: 4,
};

function compileFixture(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

const compiledIndex: Record<string, CompiledConstraint> = {
  'hard-budget': compileFixture(hardAuthored),
  'prefer-cheap': compileFixture(softAuthored),
};

const resolver = (binding: { constraintId: string }) => compiledIndex[binding.constraintId];

const policies: PolicyDocument[] = [
  {
    languageVersion: '1.0.0',
    id: 'tenant-spend-policy',
    version: '1.0.0',
    name: 'Tenant spend policy',
    enabled: true,
    applicability: { tenantId: 'tenant-1', actionKinds: ['deploy'] },
    bindings: [{ constraintId: 'hard-budget' }],
    precedence: { tier: 'tenant', rank: 5 },
    composition: 'additive',
  },
  {
    languageVersion: '1.0.0',
    id: 'workspace-preferences',
    version: '1.0.0',
    name: 'Workspace preferences',
    enabled: true,
    applicability: { workspaceId: 'ws-1' },
    bindings: [{ constraintId: 'prefer-cheap' }],
    precedence: { tier: 'workspace', rank: 1 },
    composition: 'additive',
  },
];

const deployTarget = {
  tenantId: 'tenant-1',
  workspaceId: 'ws-1',
  actionKind: 'deploy',
  tags: [],
};

describe('evaluatePolicySet (golden path for W022 integration)', () => {
  it('allows a compliant action', () => {
    const outcome = evaluatePolicySet(policies, deployTarget, { inputs: { spend: 10 } }, resolver);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.evaluation.decision.decision).toBe('allow');
    expect(outcome.evaluation.evaluations).toHaveLength(2);
    expect(outcome.evaluation.resolution.applicable.map((p) => p.policyId)).toEqual([
      'tenant-spend-policy',
      'workspace-preferences',
    ]);
  });

  it('allows with penalties when only soft constraints are violated', () => {
    const outcome = evaluatePolicySet(policies, deployTarget, { inputs: { spend: 50 } }, resolver);
    expect(outcome).toMatchObject({
      ok: true,
      evaluation: { decision: { decision: 'allow-with-penalties', totalPenalty: 4 } },
    });
  });

  it('blocks when a bound hard constraint is violated', () => {
    const outcome = evaluatePolicySet(policies, deployTarget, { inputs: { spend: 150 } }, resolver);
    expect(outcome).toMatchObject({
      ok: true,
      evaluation: {
        decision: {
          decision: 'block',
          blocking: [{ constraintId: 'hard-budget', constraintClass: 'hard' }],
        },
      },
    });
  });

  it('ignores policies out of scope for the target', () => {
    const otherTarget = { tenantId: 'tenant-2', actionKind: 'deploy' };
    const outcome = evaluatePolicySet(policies, otherTarget, { inputs: { spend: 999 } }, resolver);
    expect(outcome).toMatchObject({
      ok: true,
      evaluation: { decision: { decision: 'not-applicable' } },
    });
  });

  it('blocks (fail-closed) on unresolved constraint bindings', () => {
    const outcome = evaluatePolicySet(policies, deployTarget, { inputs: { spend: 1 } }, () => undefined);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.evaluation.decision.decision).toBe('block');
    expect(outcome.evaluation.decision.reasons).toEqual(
      expect.arrayContaining([
        'unresolved-constraint:hard-budget',
        'unresolved-constraint:prefer-cheap',
      ]),
    );
    expect(outcome.evaluation.evaluations.every((entry) => entry.resolved === false)).toBe(true);
  });

  it('contains throwing resolvers as non-resolution (never propagates)', () => {
    const outcome = evaluatePolicySet(policies, deployTarget, { inputs: { spend: 1 } }, () => {
      throw new Error('boom');
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.evaluation.decision.decision).toBe('block');
  });

  it('propagates invalid context as blocking evaluations (fail-closed)', () => {
    const outcome = evaluatePolicySet(policies, deployTarget, { inputs: { nope: 1 } }, resolver);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.evaluation.decision.decision).toBe('block');
    expect(outcome.evaluation.decision.reasons).toEqual([
      'evaluation-rejected:invalid-context',
      'evaluation-rejected:invalid-context',
    ]);
  });

  it('propagates typed issues for invalid policy documents', () => {
    const outcome = evaluatePolicySet(
      [{ ...policies[0], precedence: { tier: 'void', rank: 0 } }],
      deployTarget,
      { inputs: { spend: 1 } },
      resolver,
    );
    expect(outcome.ok).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => evaluatePolicySet(null, deployTarget, {}, resolver)).not.toThrow();
    expect(() => evaluatePolicySet(policies, null, null, resolver)).not.toThrow();
    expect(() => evaluatePolicySet(policies, deployTarget, {}, null as never)).not.toThrow();
  });
});

describe('policy contract sync', () => {
  it('policy types equal the contracts/constraints/v1 declarations', () => {
    expect(Object.entries(contractSyncChecks).every(([, ok]) => ok === true)).toBe(true);
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const SCHEMAS_DIR = path.resolve(here, '../../../contracts/constraints/v1/schemas');

  function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = sortKeysDeep(record[key]);
      }
      return sorted;
    }
    return value;
  }

  const expected = `${JSON.stringify(sortKeysDeep(z.toJSONSchema(policyDocumentSchema as never)), null, 2)}\n`;

  if (process.env.ECL_UPDATE_SCHEMAS === '1') {
    it('regenerates policy.json', () => {
      writeFileSync(path.join(SCHEMAS_DIR, 'policy.json'), expected, 'utf8');
      expect(true).toBe(true);
    });
  } else {
    it('policy.json is in sync (run ECL_UPDATE_SCHEMAS=1 to refresh)', () => {
      const committed = readFileSync(path.join(SCHEMAS_DIR, 'policy.json'), 'utf8');
      expect(committed).toBe(expected);
    });
  }
});
