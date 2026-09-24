// Published-surface integrity: the exported vocabularies are the
// architecture-pinned sets (mirrors of the SDK's, parity-tested), the
// host-execution failure vocabulary is the neutral W007-style set, and
// the runtime surface inventory is complete.
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_INVOCATION_ENVELOPE_VERSION,
  EXTENSION_RUNTIME_CONTRACT_VERSION,
  EXTENSION_RUNTIME_SCHEMA_SURFACE,
  HOST_EXECUTION_FAILURE_CODES,
  HOST_FUNCTION_IDS,
  HOST_LOG_LEVELS,
  PERMISSION_DENIED_REASONS,
  SANDBOX_SURFACE_DESCRIPTION_VERSION,
  SANDBOX_VIOLATION_DETAILS,
  TRUST_CLASS_GRANT_CEILINGS,
} from '../src/index';

describe('extension-runtime published surface', () => {
  it('version constants are pinned', () => {
    expect(EXTENSION_RUNTIME_CONTRACT_VERSION).toBe('1.0.0');
    expect(EXTENSION_INVOCATION_ENVELOPE_VERSION).toBe(1);
    expect(SANDBOX_SURFACE_DESCRIPTION_VERSION).toBe(1);
  });

  it('the permission-denial reasons are the typed allow-list semantics', () => {
    expect([...PERMISSION_DENIED_REASONS]).toEqual([
      'cross-capability-access',
      'undeclared-host-function',
      'undeclared-resource-scope',
    ]);
  });

  it('the sandbox-violation details are the typed boundary-escape semantics', () => {
    expect([...SANDBOX_VIOLATION_DETAILS]).toEqual([
      'session-identity-mismatch',
      'unbound-capability',
    ]);
  });

  it('the host-execution failure vocabulary is neutral and closed', () => {
    expect([...HOST_EXECUTION_FAILURE_CODES]).toEqual(['handler-error', 'handler-unavailable']);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = EXTENSION_RUNTIME_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of EXTENSION_RUNTIME_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });

  it('the ceiling table is monotone and t4 equals the full host surface', () => {
    for (let index = 1; index < TRUST_CLASS_GRANT_CEILINGS.length; index += 1) {
      const lower = TRUST_CLASS_GRANT_CEILINGS[index - 1]!;
      const upper = TRUST_CLASS_GRANT_CEILINGS[index]!;
      for (const fn of lower.hostFunctions) {
        expect(upper.hostFunctions, `${upper.trustClass} must include ${fn}`).toContain(fn);
      }
    }
    expect([...TRUST_CLASS_GRANT_CEILINGS[4]!.hostFunctions].sort()).toEqual([
      ...HOST_FUNCTION_IDS,
    ].sort());
    expect(HOST_LOG_LEVELS).toHaveLength(4);
  });
});
