// Determinism + replay evidence (acceptance: identical inputs -> identical digests).
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  GithubAdapterHost,
  buildChangeProposal,
  parseProviderSnapshot,
  projectSnapshot,
  referenceSnapshot,
  snapshotDigestOf,
} from '../src/index';
import { TENANT_A, T0, T1, adapterSetup, pinFor, registryWithAdapter } from './helpers';

describe('determinism', () => {
  it('the same snapshot content always produces the same snapshot digest (any parse)', () => {
    const first = parseProviderSnapshot(referenceSnapshot());
    const second = parseProviderSnapshot(referenceSnapshot());
    if (!first.success || !second.success) throw new Error('fixture parse failed');
    expect(snapshotDigestOf(first.data)).toBe(snapshotDigestOf(second.data));
  });

  it('the same (tenant, snapshot, instant) projects to byte-identical projections', () => {
    const first = parseProviderSnapshot(referenceSnapshot());
    const second = parseProviderSnapshot(referenceSnapshot());
    if (!first.success || !second.success) throw new Error('fixture parse failed');
    const a = projectSnapshot({ tenantId: TENANT_A, snapshot: first.data, observedAt: T0 });
    const b = projectSnapshot({ tenantId: TENANT_A, snapshot: second.data, observedAt: T0 });
    expect(a.projectionDigest).toBe(b.projectionDigest);
    expect(a.records.map((record) => record.contentDigest)).toEqual(
      b.records.map((record) => record.contentDigest),
    );
    expect(a.records.map((record) => record.recordId)).toEqual(b.records.map((record) => record.recordId));
  });

  it('provider row order never leaks into record order (records always sort by recordId)', () => {
    const parsed = parseProviderSnapshot(referenceSnapshot());
    if (!parsed.success) throw new Error('fixture parse failed');
    const reordered = {
      ...parsed.data,
      revisions: [...parsed.data.revisions].reverse(),
      workItems: [...parsed.data.workItems].reverse(),
    };
    const a = projectSnapshot({ tenantId: TENANT_A, snapshot: parsed.data, observedAt: T0 });
    const b = projectSnapshot({ tenantId: TENANT_A, snapshot: reordered, observedAt: T0 });
    // The source digests differ (array order is content), but the projected
    // record set is identical and identically ORDERED (sorted by recordId).
    expect(a.records.map((record) => record.statement)).toEqual(
      b.records.map((record) => record.statement),
    );
    const ids = a.records.map((record) => record.recordId);
    expect([...ids].sort()).toEqual(ids);
  });

  it('different instants change the projection (digests are content-sensitive)', () => {
    const parsed = parseProviderSnapshot(referenceSnapshot());
    if (!parsed.success) throw new Error('fixture parse failed');
    const a = projectSnapshot({ tenantId: TENANT_A, snapshot: parsed.data, observedAt: T0 });
    const b = projectSnapshot({ tenantId: TENANT_A, snapshot: parsed.data, observedAt: T1 });
    expect(a.projectionDigest).not.toBe(b.projectionDigest);
  });

  it('identical proposal inputs derive byte-identical proposals (content-derived ids)', () => {
    const base = {
      tenantId: TENANT_A,
      workspaceId: 'sw:epoch-reference-app',
      changeKind: 'revision' as const,
      actionId: 'action:fixture-change',
      summary: 'stabilize replay digests',
      proposedAt: T1,
    };
    const first = buildChangeProposal(base);
    const second = buildChangeProposal(base);
    expect(first.planDigest).toBe(second.planDigest);
    expect(first.proposalRef.canonicalDigest).toBe(second.proposalRef.canonicalDigest);
    expect(first.proposal.proposalId).toBe(second.proposal.proposalId);
  });

  it('different summaries derive different proposals', () => {
    const base = {
      tenantId: TENANT_A,
      workspaceId: 'sw:epoch-reference-app',
      changeKind: 'revision' as const,
      actionId: 'action:fixture-change',
      proposedAt: T1,
    };
    const first = buildChangeProposal({ ...base, summary: 'first change' });
    const second = buildChangeProposal({ ...base, summary: 'second change' });
    expect(first.planDigest).not.toBe(second.planDigest);
  });

  it('the W007 source envelope is deterministic across independent invocations', async () => {
    const setupA = adapterSetup();
    const setupB = adapterSetup();
    for (const setup of [setupA, setupB]) {
      const ingested = setup.host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
      if (!ingested.ok) throw new Error(ingested.error.message);
    }
    const registry = registryWithAdapter();
    const pinA = pinFor(setupA.source, registry);
    const pinB = pinFor(setupB.source, registry);
    const request = {
      schemaVersion: 1 as const,
      category: 'source' as const,
      binding: pinA,
      payload: { inputs: { tenant: TENANT_A, workspace: 'sw:epoch-reference-app' } },
    };
    const a = await setupA.source.invoke({ ...request, binding: pinA });
    const b = await setupB.source.invoke({ ...request, binding: pinB });
    expect(a.payload.outputs['projection-digest']).toBe(b.payload.outputs['projection-digest']);
  });

  it('replayed ingestion never mutates sealed state (snapshot equality)', () => {
    const host = new GithubAdapterHost();
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const before = host.listIngestions(TENANT_A);
    if (!before.ok) throw new Error(before.error.message);
    const digestBefore = canonicalDigest([...before.value] as unknown as import('@epoch/agent-protocol').JsonValue);
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T1 });
    const after = host.listIngestions(TENANT_A);
    if (!after.ok) throw new Error(after.error.message);
    // The duplicate carries only the disposition marker; the sealed record is unchanged.
    const normalized = after.value.map((r) => ({ ...r, disposition: 'ingested' }));
    expect(canonicalDigest([...normalized] as unknown as import('@epoch/agent-protocol').JsonValue)).toBe(
      digestBefore,
    );
  });
});
