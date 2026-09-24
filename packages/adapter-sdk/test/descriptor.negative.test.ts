// Negative tests: every broken-descriptor class the SDK must reject —
// vendor/provider field smuggling (strict objects), malformed ids and
// versions, floating ranges, precise paths, and version skew.
import { describe, expect, it } from 'vitest';
import type { AdapterSdkError, AdapterSdkResult } from '../src/index';
import { parseAdapterDescriptor } from '../src/index';
import { descriptor } from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: AdapterSdkResult<T>): AdapterSdkError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

function validationIssues(error: AdapterSdkError): readonly { path: string; message: string }[] {
  expect(error.code).toBe('validation');
  if (error.code !== 'validation') throw new Error('expected a validation error');
  return error.issues;
}

describe('vendor/provider field smuggling (negative — neutrality boundary)', () => {
  it('rejects an unknown top-level provider field', () => {
    const issues = validationIssues(
      failureOf(parseAdapterDescriptor(descriptor({ provider: 'acme-cloud' }))),
    );
    expect(issues.some((issue) => issue.message.toLowerCase().includes('provider'))).toBe(true);
  });

  it('rejects vendor fields inside the binding', () => {
    const result = parseAdapterDescriptor(
      descriptor({
        binding: {
          capabilityId: 'engineering.stress-analysis',
          versionRange: { kind: 'caret', version: '1.0.0' },
          apiKey: 'sk-123',
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an apiUrl on the descriptor', () => {
    expect(parseAdapterDescriptor(descriptor({ apiUrl: 'https://vendor.example' })).ok).toBe(false);
  });
});

describe('malformed descriptor fields (negative)', () => {
  it.each([
    'stress-solver', // no adapter: prefix
    'adapter:', // empty slug
    'adapter:Stress', // uppercase
    'adapter:stress_solver', // underscore
    'x-adaptor:stress', // wrong prefix
  ])('rejects malformed adapterId %s', (adapterId) => {
    const issues = validationIssues(failureOf(parseAdapterDescriptor(descriptor({ adapterId }))));
    expect(issues.some((issue) => issue.path === 'adapterId'), adapterId).toBe(true);
  });

  it.each(['1.2', 'v1.0.0', '1.0.0-beta', '*'])(
    'rejects malformed version-range anchor %s',
    (version) => {
      const result = parseAdapterDescriptor(
        descriptor({ binding: { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'caret', version } } }),
      );
      expect(result.ok, version).toBe(false);
    },
  );

  it('rejects a floating (wildcard) range kind', () => {
    const result = parseAdapterDescriptor(
      descriptor({ binding: { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'any' } } }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a non-qualified capability id in the binding', () => {
    const issues = validationIssues(
      failureOf(
        parseAdapterDescriptor(
          descriptor({ binding: { capabilityId: 'stress-analysis', versionRange: { kind: 'caret', version: '1.0.0' } } }),
        ),
      ),
    );
    expect(issues.some((issue) => issue.path === 'binding.capabilityId')).toBe(true);
  });

  it('rejects version discriminator skew with a path at schemaVersion', () => {
    const issues = validationIssues(failureOf(parseAdapterDescriptor(descriptor({ schemaVersion: 2 }))));
    expect(issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
  });

  it('rejects a category outside the Capability Fabric list', () => {
    const issues = validationIssues(failureOf(parseAdapterDescriptor(descriptor({ category: 'orchestration' }))));
    expect(issues.some((issue) => issue.path === 'category')).toBe(true);
  });

  it('reports the exact dotted path of a nested violation', () => {
    const issues = validationIssues(
      failureOf(
        parseAdapterDescriptor(
          descriptor({ binding: { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'nope', version: '1.0.0' } } }),
        ),
      ),
    );
    expect(issues.some((issue) => issue.path.startsWith('binding.versionRange'))).toBe(true);
  });
});
