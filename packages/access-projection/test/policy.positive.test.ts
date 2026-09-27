// Projection-policy positive evidence: sealing, versioning, binding
// selection, scope-filter shapes, and the policy-as-data swap.
import { describe, expect, it } from 'vitest';
import {
  admitProjectionPolicy,
  openAccessProjectionStore,
  sealProjectionPolicy,
  selectRoleBinding,
  selectTaskBinding,
  type SealedProjectionPolicy,
} from '../src/index';
import { unwrap } from './helpers';
import {
  ENGINEER_ALLOWLIST,
  ROLE_AGENT,
  ROLE_CLIENT,
  ROLE_ENGINEER,
  ROLE_SERVICE,
  TASK_CLASS,
  TASK_CLASS_ALLOWLIST,
  TENANT,
  binding,
  standardPolicyContent,
} from './fixtures';

function sealPolicy(content: Record<string, unknown>): SealedProjectionPolicy {
  return unwrap(sealProjectionPolicy(content));
}

describe('policy admission (positive)', () => {
  it('seals a multi-role policy with the digest over its canonical JSON', () => {
    const sealed = sealPolicy(standardPolicyContent());
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.policyId).toBe('policy:tower-retrofit-access');
    expect(sealed.bindings).toHaveLength(4);
  });

  it('the store registers revisions append-only and returns duplicates idempotently', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const rev1 = sealPolicy(standardPolicyContent());
    const first = unwrap(admitProjectionPolicy(store, rev1));
    expect(first.outcome.kind).toBe('policy-admitted');
    const again = unwrap(admitProjectionPolicy(first.store, rev1));
    expect(again.outcome.kind).toBe('duplicate-policy-returned');
    expect(again.outcome.policy.contentDigest).toBe(rev1.contentDigest);
    expect(again.store.policies).toHaveLength(1);

    const rev2 = sealPolicy(standardPolicyContent({ revision: 2, title: 'Tower Retrofit access v2' }));
    const second = unwrap(admitProjectionPolicy(again.store, rev2));
    expect(second.outcome.kind).toBe('policy-admitted');
    expect(second.store.policies.map((policy) => policy.revision)).toEqual([1, 2]);
  });

  it('binding selection is pure data lookup (role rows and task rows)', () => {
    const policy = sealPolicy(standardPolicyContent());
    const clientRow = selectRoleBinding(
      policy,
      { principalId: 'principal:x', principalKind: 'human', role: ROLE_CLIENT },
      'program-of-work',
    );
    expect(clientRow?.allowedActions).toEqual(['view']);
    const engineerRow = selectRoleBinding(
      policy,
      { principalId: 'principal:x', principalKind: 'human', role: ROLE_ENGINEER },
      'program-of-work',
    );
    expect(engineerRow?.allowedActions).toEqual(['export', 'share', 'view']);
    expect(engineerRow?.fieldAllowlist).toEqual([...ENGINEER_ALLOWLIST].sort());
    const taskRow = selectTaskBinding(policy, TASK_CLASS, 'program-of-work');
    expect(taskRow?.fieldAllowlist).toEqual([...TASK_CLASS_ALLOWLIST].sort());
    const missing = selectRoleBinding(
      policy,
      { principalId: 'principal:x', principalKind: 'human', role: 'role:nonexistent' },
      'program-of-work',
    );
    expect(missing).toBeNull();
  });

  it('a service role row binds like a human role row (service-to-service path)', () => {
    const policy = sealPolicy(standardPolicyContent());
    const row = selectRoleBinding(
      policy,
      { principalId: 'principal:x', principalKind: 'service', role: ROLE_SERVICE },
      'program-of-work',
    );
    expect(row).not.toBeNull();
    expect(row?.scopeFilters.commercial).toBe('hidden');
  });

  it('an agent role baseline row and its task row coexist', () => {
    const policy = sealPolicy(
      standardPolicyContent({
        bindings: [
          binding({
            selector: { principalKind: 'agent', role: ROLE_AGENT },
            fieldAllowlist: [...TASK_CLASS_ALLOWLIST, 'workPackages[].realizationVariant'].sort(),
          }),
          binding({
            selector: { principalKind: 'agent', agentTaskClass: TASK_CLASS },
            fieldAllowlist: [...TASK_CLASS_ALLOWLIST].sort(),
          }),
        ],
      }),
    );
    expect(selectTaskBinding(policy, TASK_CLASS, 'program-of-work')).not.toBeNull();
  });
});
