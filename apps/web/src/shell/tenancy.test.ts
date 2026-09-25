// W014 shell tenant context: validation, scope helpers, and the typed
// cross-tenant rejection (named negative).
import { describe, expect, it } from 'vitest';
import {
  assertSameTenantScope,
  isTenantVisible,
  scopeOf,
  switchTenantContext,
  tenantScopeKey,
  validateTenantContext,
} from './tenancy';
import type { ShellError, ShellIssue } from './errors';
import { SHELL_RECORD_VERSION } from './version';

/** Narrow a shell error to its validation issues (fails the test otherwise). */
function validationIssuesOf(error: ShellError): readonly ShellIssue[] {
  expect(error.code).toBe('validation');
  if (error.code !== 'validation') {
    throw new Error(`expected a validation error, got '${error.code}'`);
  }
  return error.issues;
}

const context = {
  schemaVersion: SHELL_RECORD_VERSION,
  tenantId: 'tenant:acme',
  workspaceId: 'workspace:acme-eng',
  projectId: 'project:bridge',
  displayName: 'Acme',
};

describe('shell tenant context', () => {
  it('validates a well-formed tenant context (positive)', () => {
    const result = validateTenantContext(context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tenantId).toBe('tenant:acme');
      expect(result.value.workspaceId).toBe('workspace:acme-eng');
      expect(result.value.projectId).toBe('project:bridge');
    }
  });

  it('accepts a tenant context narrowed to tenant only', () => {
    const result = validateTenantContext({
      schemaVersion: SHELL_RECORD_VERSION,
      tenantId: 'tenant:acme',
      displayName: 'Acme',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects malformed tenant contexts with typed validation errors (named negative)', () => {
    const cases: readonly unknown[] = [
      'tenant:acme', // not an object
      null,
      { schemaVersion: 2, tenantId: 'tenant:acme', displayName: 'X' }, // version skew
      { schemaVersion: 1, tenantId: 'Tenant:ACME', displayName: 'X' }, // bad id casing
      { schemaVersion: 1, tenantId: 'acme', displayName: 'X' }, // missing kind prefix
      { schemaVersion: 1, tenantId: 'tenant:acme', displayName: '  ' }, // blank display name
      {
        schemaVersion: 1,
        tenantId: 'tenant:acme',
        workspaceId: 'eng',
        displayName: 'X',
      }, // malformed workspace id
    ];
    for (const input of cases) {
      const result = validateTenantContext(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
        expect(validationIssuesOf(result.error).length).toBeGreaterThan(0);
      }
    }
  });

  it('rejects a cross-tenant context switch with a typed error (named negative: cross-tenant)', () => {
    const next = {
      schemaVersion: SHELL_RECORD_VERSION,
      tenantId: 'tenant:globex',
      displayName: 'Globex',
    };
    const result = switchTenantContext(context, next);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The typed rejection names both sides of the boundary (R12).
      expect(result.error.code).toBe('cross-tenant-denied');
      if (result.error.code === 'cross-tenant-denied') {
        expect(result.error.tenantOfContext).toBe('tenant:acme');
        expect(result.error.tenantOfSubject).toBe('tenant:globex');
      }
    }
  });

  it('allows same-tenant re-narrowing (workspace moves inside one tenant)', () => {
    const next = {
      schemaVersion: SHELL_RECORD_VERSION,
      tenantId: 'tenant:acme',
      workspaceId: 'workspace:acme-ops',
      displayName: 'Acme Ops',
    };
    const result = switchTenantContext(context, next);
    expect(result.ok).toBe(true);
  });

  it('fail-closes a tenant switch without an established context (typed error)', () => {
    const result = switchTenantContext(null, context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('missing-tenant-context');
    }
  });

  it('assertSameTenantScope: only the tenant boundary is a violation', () => {
    expect(assertSameTenantScope(scopeOf(context), { tenantId: 'tenant:acme' }).ok).toBe(true);
    // Workspace/project narrowing differences are NOT tenant violations.
    expect(
      assertSameTenantScope(scopeOf(context), { tenantId: 'tenant:acme', workspaceId: 'workspace:other' })
        .ok,
    ).toBe(true);
    const denied = assertSameTenantScope(scopeOf(context), { tenantId: 'tenant:globex' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('cross-tenant-denied');
    }
  });

  it('isTenantVisible: tenant-generic subjects are visible everywhere; scoped only inside', () => {
    const scope = scopeOf(context);
    expect(isTenantVisible(scope, {})).toBe(true);
    expect(isTenantVisible(scope, { tenantId: 'tenant:acme' })).toBe(true);
    expect(isTenantVisible(scope, { tenantId: 'tenant:globex' })).toBe(false);
  });

  it('tenantScopeKey is a deterministic ordering key', () => {
    expect(tenantScopeKey({ tenantId: 'tenant:a' })).toBe('tenant:a\u0000\u0000');
    expect(tenantScopeKey({ tenantId: 'tenant:a', workspaceId: 'workspace:b' })).toBe(
      'tenant:a\u0000workspace:b\u0000',
    );
  });
});
