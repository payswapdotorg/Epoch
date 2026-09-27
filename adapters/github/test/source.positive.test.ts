// Positive evidence (acceptance: source-category observation records).
import { describe, expect, it } from 'vitest';
import {
  conflictingSnapshot,
  referenceSnapshot,
  snapshotDigestOf,
  GithubAdapterHost,
  projectSnapshot,
  verifyProjection,
  parseProviderSnapshot,
} from '../src/index';
import { TENANT_A, T0 } from './helpers';

describe('hosted software-workspace source adapter (positive)', () => {
  it('ingests a provider snapshot and returns a sealed, content-addressed ingestion record', () => {
    const host = new GithubAdapterHost();
    const ingested = host.ingestSnapshot({
      tenantId: TENANT_A,
      payload: referenceSnapshot(),
      ingestedAt: T0,
    });
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) throw new Error(ingested.error.message);
    const record = ingested.value;
    expect(record.tenantId).toBe(TENANT_A);
    expect(record.workspaceId).toBe('sw:epoch-reference-app');
    expect(record.disposition).toBe('ingested');
    expect(record.revisionCount).toBe(3);
    expect(record.workItemCount).toBe(2);
    expect(record.snapshotDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(record.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ingest is idempotent: a duplicate ingestion returns the sealed prior record', () => {
    const host = new GithubAdapterHost();
    const first = host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const second = host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: '2026-03-01T10:00:00.000Z' });
    if (!first.ok || !second.ok) throw new Error('ingestion failed');
    expect(second.value.disposition).toBe('duplicate');
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
    expect(second.value.snapshotDigest).toBe(first.value.snapshotDigest);
    const listed = host.listIngestions(TENANT_A);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.length).toBe(1);
  });

  it('projects the snapshot into W002-convention observation records with full provenance', () => {
    const snapshot = parseProviderSnapshot(referenceSnapshot());
    if (!snapshot.success) throw new Error('fixture parse failed');
    const projection = projectSnapshot({
      tenantId: TENANT_A,
      snapshot: snapshot.data,
      observedAt: T0,
    });
    const digest = snapshotDigestOf(snapshot.data);
    // Entities: workspace + 3 revisions + 2 work items; relations: containment + parents + references.
    expect(projection.records.length).toBeGreaterThan(6);
    for (const record of projection.records) {
      expect(record.tenantId).toBe(TENANT_A);
      expect(record.workspaceId).toBe('sw:epoch-reference-app');
      expect(record.recordId).toMatch(/^obs-[0-9a-f]{16}$/);
      expect(record.provenance.actor.id).toBe('adapter:software-workspace-source');
      expect(record.provenance.actor.role).toBe('external-provider');
      expect(record.provenance.method).toBe('workspace-snapshot-projection');
      expect(record.provenance.evidence[0]?.kind).toBe('external');
      expect(record.provenance.evidence[0]?.digest).toBe(digest);
      expect(record.confidence.method).toBe('imported');
      expect(record.confidence.distribution).toEqual({ kind: 'point', value: 1 });
      expect(record.validity?.from).toBe(T0);
      expect(record.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    const types = new Set(
      projection.records
        .filter((record) => record.statement.kind === 'entity')
        .map((record) => (record.statement as { entityType: string }).entityType),
    );
    expect(types).toContain('software:workspace');
    expect(types).toContain('software:revision');
    expect(types).toContain('software:work-item');
    const verification = verifyProjection(projection);
    expect(verification.ok).toBe(true);
  });

  it('the workspace entity carries neutral properties (no provider vocabulary)', () => {
    const snapshot = parseProviderSnapshot(referenceSnapshot());
    if (!snapshot.success) throw new Error('fixture parse failed');
    const projection = projectSnapshot({ tenantId: TENANT_A, snapshot: snapshot.data, observedAt: T0 });
    const workspace = projection.records.find(
      (record) => record.statement.kind === 'entity' && record.statement.entityType === 'software:workspace',
    );
    expect(workspace).toBeDefined();
    if (workspace?.statement.kind !== 'entity') throw new Error('unreachable');
    expect(workspace.statement.properties?.displayName).toBe('epoch-reference-app');
    expect(workspace.statement.properties?.defaultLineageName).toBe('main');
  });

  it('work-item references project onto revision entities through typed relations', () => {
    const snapshot = parseProviderSnapshot(referenceSnapshot());
    if (!snapshot.success) throw new Error('fixture parse failed');
    const projection = projectSnapshot({ tenantId: TENANT_A, snapshot: snapshot.data, observedAt: T0 });
    const references = projection.records.filter(
      (record) => record.statement.kind === 'relation' && record.statement.relationType === 'software:references-revision',
    );
    expect(references.length).toBe(1);
    const parents = projection.records.filter(
      (record) => record.statement.kind === 'relation' && record.statement.relationType === 'software:parent-revision',
    );
    expect(parents.length).toBe(2);
    const containment = projection.records.filter(
      (record) => record.statement.kind === 'relation' && record.statement.relationType === 'software:contains-revision',
    );
    expect(containment.length).toBe(3);
  });

  it('the source reference addresses the exact snapshot revision (W006 conventions)', () => {
    const snapshot = parseProviderSnapshot(referenceSnapshot());
    if (!snapshot.success) throw new Error('fixture parse failed');
    const projection = projectSnapshot({ tenantId: TENANT_A, snapshot: snapshot.data, observedAt: T0 });
    expect(projection.source.artifactId).toBe('sw:epoch-reference-app');
    expect(projection.source.digest).toBe(snapshotDigestOf(snapshot.data));
    expect(projection.source.revision).toMatch(/^content-[0-9a-f]{12}$/);
  });

  it('a conflicting snapshot for the same workspace is a typed replay-conflict (never a silent overwrite)', () => {
    const host = new GithubAdapterHost();
    const first = host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    expect(first.ok).toBe(true);
    const conflict = host.ingestSnapshot({ tenantId: TENANT_A, payload: conflictingSnapshot(), ingestedAt: T0 });
    expect(conflict.ok).toBe(false);
    if (conflict.ok || conflict.error.code !== 'replay-conflict') throw new Error('unexpected outcome');
    expect(conflict.error.expectedDigest).not.toBe(conflict.error.encounteredDigest);
  });
});
