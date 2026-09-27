// Negative evidence (acceptance: typed rejections for every failure class).
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@epoch/agent-protocol';
import {
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  GithubActionAdapter,
  GithubAdapterHost,
  parseProviderSnapshot,
  projectSnapshot,
  verifyProjection,
  incompleteSnapshot,
  malformedSnapshot,
  referenceSnapshot,
  type ActionAuthorityPort,
  type ActionAuthoritySubmission,
  type ActionAuthorityExecutionRequest,
} from '../src/index';
import { TENANT_A, TENANT_B, adapterSetup, allowingContext, pinFor, registryWithAdapter, T0, T1, PRINCIPAL } from './helpers';

/** A provider payload with two head revisions (no unique head). */
function multiHeadSnapshot(): unknown {
  const revision = (seed: string, message: string) => ({
    sha: sha256Hex(`fixture:multi-head:${seed}`).slice(0, 40),
    message,
    authorName: 'fixture-author',
    authoredAt: T0,
    parents: [],
    tree: [],
  });
  return {
    schemaVersion: 1,
    service: 'github',
    repository: { name: 'two-heads', defaultBranch: 'main' },
    revisions: [revision('first', 'first head'), revision('second', 'second head')],
    workItems: [],
  };
}

describe('negative: tenant isolation (R12)', () => {
  it('ingestion naming another tenant is the typed tenant-isolation-rejected', () => {
    const host = new GithubAdapterHost({ expectedTenantId: TENANT_A });
    const result = host.ingestSnapshot({ tenantId: TENANT_B, payload: referenceSnapshot(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
    expect(result.error.expectedTenantId).toBe(TENANT_A);
    expect(result.error.encounteredTenantId).toBe(TENANT_B);
  });

  it('a cross-tenant projection through the W007 envelope is the typed tenant-isolation-rejected', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const result = source.invokeTotal({
      schemaVersion: 1,
      category: 'source',
      binding: pin,
      payload: { inputs: { tenant: TENANT_B, workspace: 'sw:epoch-reference-app' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('tenant-isolation-rejected');
  });
});

describe('negative: unknown provider payloads', () => {
  it('a malformed envelope is the typed unknown-provider-payload (never a partial load)', () => {
    const host = new GithubAdapterHost();
    const result = host.ingestSnapshot({ tenantId: TENANT_A, payload: malformedSnapshot(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('an empty revision list fails provider admission (unknown-provider-payload)', () => {
    const host = new GithubAdapterHost();
    const result = host.ingestSnapshot({ tenantId: TENANT_A, payload: incompleteSnapshot(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
  });
});

describe('negative: ingestion admission', () => {
  it('a snapshot with no unique head revision is the typed ingestion-rejected with a reason', () => {
    const host = new GithubAdapterHost();
    const result = host.ingestSnapshot({ tenantId: TENANT_A, payload: multiHeadSnapshot(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'ingestion-rejected') throw new Error('unexpected outcome');
    expect(result.error.reason).toBe('no-unique-head-revision');
  });
});

describe('negative: tamper detection', () => {
  it('a claimed digest that does not match the content is the typed digest-mismatch', () => {
    const host = new GithubAdapterHost();
    const result = host.ingestSnapshot({
      tenantId: TENANT_A,
      payload: referenceSnapshot(),
      claimedDigest: '0'.repeat(64),
      ingestedAt: T0,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'digest-mismatch') throw new Error('unexpected outcome');
    expect(result.error.encountered).toBe('0'.repeat(64));
  });
});

describe('negative: gateway bypass', () => {
  const bypassPort: ActionAuthorityPort = {
    submitAction(request: ActionAuthoritySubmission) {
      void request;
      throw new Error('the authority must never be called in the bypass test');
    },
    executeAction(request: ActionAuthorityExecutionRequest) {
      void request;
      throw new Error('the authority must never be called in the bypass test');
    },
  };

  it('an execute-direct request is the typed gateway-bypass-rejected (the authority is never called)', () => {
    const { host } = adapterSetup();
    const action = new GithubActionAdapter({ host, authority: bypassPort, expectedTenantId: TENANT_A });
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const registry = registryWithAdapter();
    const pin = pinFor(action, registry);
    const result = action.invokeTotal({
      schemaVersion: 1,
      category: 'action',
      binding: pin,
      payload: {
        target: { kind: 'external-resource', ref: 'sw:epoch-reference-app' },
        parameters: {
          tenant: TENANT_A,
          workspace: 'sw:epoch-reference-app',
          'change-kind': 'revision',
          summary: 'direct push attempt',
          mode: 'execute-direct',
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T1,
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'gateway-bypass-rejected') throw new Error('unexpected outcome');
    expect(result.error.attemptedMode).toBe('execute-direct');
  });
});

describe('negative: binding conflicts', () => {
  it('an envelope bound to another adapter revision is the typed binding-conflict', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const result = source.invokeTotal({
      schemaVersion: 1,
      category: 'source',
      binding: { ...pin, adapterDescriptorDigest: ACTION_ADAPTER_DESCRIPTOR_DIGEST },
      payload: { inputs: { tenant: TENANT_A, workspace: 'sw:epoch-reference-app' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });

  it('an envelope targeting the wrong category is the typed binding-conflict', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const result = source.invokeTotal({
      schemaVersion: 1,
      category: 'semantic' as 'source',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, workspace: 'sw:epoch-reference-app' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });
});

describe('negative: envelope validation', () => {
  it('malformed neutral inputs are the typed validation error with precise paths', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const result = source.invokeTotal({
      schemaVersion: 1,
      category: 'source',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, workspace: 'not-a-workspace-id' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
  });

  it('a missing sealed snapshot is the typed validation error (no silent empty projection)', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const result = source.invokeTotal({
      schemaVersion: 1,
      category: 'source',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, workspace: 'sw:never-ingested' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
    expect(result.error.issues[0]?.path).toBe('$.workspace');
  });

  it('a tampered projection is detected by digest verification', () => {
    const { host } = adapterSetup();
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const snapshotParse = parseProviderSnapshot(referenceSnapshot());
    if (!snapshotParse.success) throw new Error('fixture parse failed');
    const projection = projectSnapshot({ tenantId: TENANT_A, snapshot: snapshotParse.data, observedAt: T0 });
    const tampered = {
      ...projection,
      records: projection.records.map((record, index) =>
        index === 0 ? { ...record, statement: { ...record.statement, entityId: 'entity:tampered' } } : record,
      ),
    };
    const verification = verifyProjection(tampered);
    expect(verification.ok).toBe(false);
    if (verification.ok || verification.error.code !== 'digest-mismatch') throw new Error('unexpected outcome');
  });

  it('the ingestion record of a different tenant is unreachable through tenant-scoped reads', () => {
    const hostA = new GithubAdapterHost({ expectedTenantId: TENANT_A });
    hostA.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const cross = hostA.sealedSnapshot(TENANT_B, 'sw:epoch-reference-app');
    expect(cross.ok).toBe(false);
    if (cross.ok || cross.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });
});
