// Negative tests: every broken-binding class the negotiation must reject —
// unregistered capabilities, category/id conflicts, retirement, and
// version-range violations.
import { describe, expect, it } from 'vitest';
import type { AdapterSdkError, AdapterSdkResult } from '../src/index';
import { negotiateBestBinding, negotiateBinding } from '../src/index';
import { capability, descriptor, typedDescriptor } from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: AdapterSdkResult<T>): AdapterSdkError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('binding to an unregistered capability (negative)', () => {
  it('negotiateBestBinding rejects when no provided record has the served id', () => {
    const error = failureOf(
      negotiateBestBinding(typedDescriptor(), [
        capability({ manifest: { capabilityId: 'other.capability', category: 'simulation', version: '1.0.0' } }),
      ]),
    );
    expect(error.code).toBe('unknown-capability');
  });

  it('negotiateBestBinding rejects an empty capability set', () => {
    const error = failureOf(negotiateBestBinding(typedDescriptor(), []));
    expect(error.code).toBe('unknown-capability');
  });
});

describe('binding conflicts (negative)', () => {
  it('rejects a capability-id mismatch with expected/encountered detail', () => {
    const error = failureOf(
      negotiateBinding(
        typedDescriptor(),
        capability({ manifest: { capabilityId: 'engineering.other-analysis', category: 'simulation', version: '1.2.3' } }),
      ),
    );
    expect(error.code).toBe('binding-conflict');
    if (error.code !== 'binding-conflict') return;
    expect(error.expected).toBe('engineering.stress-analysis');
    expect(error.encountered).toBe('engineering.other-analysis');
  });

  it('rejects a category mismatch (adapter category vs capability category)', () => {
    const error = failureOf(
      negotiateBinding(
        typedDescriptor(),
        capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'evaluator', version: '1.2.3' } }),
      ),
    );
    expect(error.code).toBe('binding-conflict');
    if (error.code !== 'binding-conflict') return;
    expect(error.expected).toBe('simulation');
    expect(error.encountered).toBe('evaluator');
  });

  it('negotiateBestBinding rejects when no id-matching record is in the adapter category', () => {
    const error = failureOf(
      negotiateBestBinding(typedDescriptor(), [
        capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'evaluator', version: '1.2.3' } }),
      ]),
    );
    expect(error.code).toBe('binding-conflict');
  });
});

describe('binding to a retired capability (negative — lifecycle boundary)', () => {
  it('negotiateBinding rejects a retired capability', () => {
    const error = failureOf(
      negotiateBinding(typedDescriptor(), capability({ lifecycle: 'retired' })),
    );
    expect(error.code).toBe('lifecycle-conflict');
    if (error.code !== 'lifecycle-conflict') return;
    expect(error.from).toBe('retired');
  });

  it('negotiateBestBinding rejects when every id-matching record is retired', () => {
    const error = failureOf(
      negotiateBestBinding(typedDescriptor(), [capability({ lifecycle: 'retired' })]),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });
});

describe('version-range violations (negative)', () => {
  it('negotiateBinding rejects a version outside the declared range', () => {
    const error = failureOf(
      negotiateBinding(
        typedDescriptor(),
        capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '2.0.0' } }),
      ),
    );
    expect(error.code).toBe('version-unsatisfied');
    if (error.code !== 'version-unsatisfied') return;
    expect(error.constraint).toEqual({ kind: 'caret', version: '1.0.0' });
    expect(error.availableVersions).toEqual(['2.0.0']);
  });

  it('negotiateBestBinding rejects when no provided version satisfies the range', () => {
    const error = failureOf(
      negotiateBestBinding(typedDescriptor(), [
        capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '2.0.0' } }),
        capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '2.1.0' } }),
      ]),
    );
    expect(error.code).toBe('version-unsatisfied');
    if (error.code !== 'version-unsatisfied') return;
    expect(error.availableVersions).toEqual(['2.0.0', '2.1.0']);
  });

  it('negotiation validates the descriptor defensively (typed validation issues)', () => {
    const bogus = descriptor({ category: 'not-a-category' }) as never;
    for (const result of [negotiateBinding(bogus, capability()), negotiateBestBinding(bogus, [capability()])]) {
      const error = failureOf(result);
      expect(error.code).toBe('validation');
      if (error.code !== 'validation') return;
      expect(error.issues.some((issue) => issue.path === 'category')).toBe(true);
    }
  });
});
