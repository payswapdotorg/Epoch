/**
 * @epoch/adapter-github — the deterministic NEUTRAL projection: hosted
 * software-workspace snapshots -> W002-convention observation records.
 *
 * This module TRANSLATES the provider layer's parsed snapshots into the
 * neutral record vocabulary (architecture lock rule 13: provider
 * behavior is adapterized; the provider's names never cross this
 * boundary — the neutrality blocklist test pins it).
 *
 * Determinism (pinned by test/determinism.test.ts): the projection is a
 * PURE function of (tenant, snapshot, observedAt) — content-derived
 * record ids, provider row order never leaks (records sort by recordId),
 * and identical inputs project byte-identically (identical digests).
 */
import {
  canonicalDigest,
  type JsonValue,
  type Sha256Hex,
  type Timestamp,
} from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import { neutralWorkItemCategory, type ProviderSnapshot } from './provider/payload';
import type {
  WorkspaceObservationRecord,
  WorkspaceProjection,
  WorkspaceSourceRef,
  WorkspaceStatement,
} from './types';
import type { GithubAdapterResult } from './errors';
import { GITHUB_ADAPTER_RECORD_VERSION } from './version';

/** The neutral workspace identity derived from a snapshot (`sw:<slug>`). */
export function workspaceIdOf(snapshot: ProviderSnapshot): string {
  return `sw:${snapshot.repository.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`;
}

/** The provider snapshot's content digest (canonical JSON, content-addressed). */
export function snapshotDigestOf(snapshot: ProviderSnapshot): Sha256Hex {
  return canonicalDigest(snapshot as unknown as JsonValue);
}

/** The actor every projected observation carries: THIS adapter, as an external provider. */
function projectionActor(): WorkspaceObservationRecord['provenance']['actor'] {
  return {
    id: 'adapter:software-workspace-source',
    role: 'external-provider',
    displayName: 'Hosted software-workspace source adapter (reference)',
  };
}

/** The evidence every projected observation carries: the exact snapshot revision (W006 conventions). */
function snapshotEvidence(digest: Sha256Hex, workspaceId: string): WorkspaceObservationRecord['provenance']['evidence'] {
  return [
    {
      id: `snapshot:${digest}`,
      kind: 'external',
      digest,
      locator: `workspace:${workspaceId}`,
      description: 'The exact content-addressed provider snapshot the observation was projected from.',
    },
  ];
}

/** Deterministic record identity: content-derived from (tenant, workspace, statement). */
function recordIdOf(tenantId: TenantId, workspaceId: string, statement: WorkspaceStatement): string {
  const scope: JsonValue = { tenantId, workspaceId, statement: statement as unknown as JsonValue };
  return `obs-${canonicalDigest(scope).slice(0, 16)}`;
}

/** Content digest of an observation record (all fields except the digest itself). */
function observationDigest(record: Omit<WorkspaceObservationRecord, 'contentDigest'>): Sha256Hex {
  return canonicalDigest(record as unknown as JsonValue);
}


/** Neutral entity ids (opaque; provider hashes ride as DATA, never as shape). */
function workspaceEntityId(workspaceId: string): string {
  return `entity:${workspaceId}`;
}
function revisionEntityId(workspaceId: string, providerRevisionId: string): string {
  return `entity:${workspaceId}-rev-${providerRevisionId.slice(0, 12)}`;
}
function workItemEntityId(workspaceId: string, neutralCategory: 'task' | 'change-review', number: number): string {
  return `entity:${workspaceId}-item-${neutralCategory === 'task' ? 'task' : 'review'}-${number}`;
}

/** Input of {@link projectSnapshot} (the projection is total and pure). */
export interface ProjectionInput {
  readonly tenantId: TenantId;
  readonly snapshot: ProviderSnapshot;
  readonly observedAt: Timestamp;
}

/**
 * Project a parsed provider snapshot into the neutral observation
 * records (the W002-convention shapes): one workspace entity epoch, one
 * revision entity per revision (+ parent/containment relations), one
 * work-item entity per item (+ reference relations). Records sort by
 * content-derived recordId; the projection digest covers source + scope
 * + every record.
 */
export function projectSnapshot(input: ProjectionInput): WorkspaceProjection {
  const workspaceId = workspaceIdOf(input.snapshot);
  const digest = snapshotDigestOf(input.snapshot);
  const statements: WorkspaceStatement[] = [];

  // The workspace entity epoch.
  statements.push({
    kind: 'entity',
    entityId: workspaceEntityId(workspaceId),
    entityType: 'software:workspace',
    properties: {
      displayName: input.snapshot.repository.name,
      defaultLineageName: input.snapshot.repository.defaultBranch,
    },
  });

  // One revision entity per revision + containment + parent relations.
  const revisionIds = new Set(input.snapshot.revisions.map((revision) => revision.sha));
  for (const revision of input.snapshot.revisions) {
    statements.push({
      kind: 'entity',
      entityId: revisionEntityId(workspaceId, revision.sha),
      entityType: 'software:revision',
      properties: {
        changeSummary: revision.message,
        author: revision.authorName,
        authoredAt: revision.authoredAt,
        contentNodeCount: revision.tree.length,
      },
    });
    statements.push({
      kind: 'relation',
      relationType: 'software:contains-revision',
      source: workspaceEntityId(workspaceId),
      target: revisionEntityId(workspaceId, revision.sha),
    });
    for (const parent of revision.parents) {
      if (revisionIds.has(parent)) {
        statements.push({
          kind: 'relation',
          relationType: 'software:parent-revision',
          source: revisionEntityId(workspaceId, revision.sha),
          target: revisionEntityId(workspaceId, parent),
        });
      }
    }
  }

  // One work-item entity per item + reference relations to head revisions.
  for (const item of input.snapshot.workItems) {
    statements.push({
      kind: 'entity',
      entityId: workItemEntityId(workspaceId, neutralWorkItemCategory(item.kind), item.number),
      entityType: 'software:work-item',
      properties: {
        title: item.title,
        state: item.state,
        itemCategory: neutralWorkItemCategory(item.kind),
        providerItemNumber: item.number,
      },
    });
    if (item.headSha !== undefined && revisionIds.has(item.headSha)) {
      statements.push({
        kind: 'relation',
        relationType: 'software:references-revision',
        source: workItemEntityId(workspaceId, neutralWorkItemCategory(item.kind), item.number),
        target: revisionEntityId(workspaceId, item.headSha),
      });
    }
  }

  const records: WorkspaceObservationRecord[] = statements.map((statement) => {
    const recordId = recordIdOf(input.tenantId, workspaceId, statement);
    const content: Omit<WorkspaceObservationRecord, 'contentDigest'> = {
      schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
      tenantId: input.tenantId,
      workspaceId,
      recordId,
      statement,
      provenance: {
        actor: projectionActor(),
        method: 'workspace-snapshot-projection',
        evidence: snapshotEvidence(digest, workspaceId),
      },
      confidence: {
        distribution: { kind: 'point', value: 1 },
        method: 'imported',
        rationale: 'Direct observation of the exact content-addressed provider snapshot.',
      },
      validity: { from: input.observedAt },
      observedAt: input.observedAt,
    };
    return { ...content, contentDigest: observationDigest(content) };
  });
  records.sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0));

  const source: WorkspaceSourceRef = {
    artifactId: workspaceId,
    revision: `content-${digest.slice(0, 12)}`,
    digest,
  };
  const content: Omit<WorkspaceProjection, 'projectionDigest'> = {
    schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    workspaceId,
    source,
    observedAt: input.observedAt,
    records,
  };
  return { ...content, projectionDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Re-verify a projection's digests (tamper detection; total). */
export function verifyProjection(projection: WorkspaceProjection): GithubAdapterResult<true> {
  for (const record of projection.records) {
    const { contentDigest, ...content } = record;
    const recomputed = canonicalDigest(content as unknown as JsonValue);
    if (recomputed !== contentDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `observation record "${record.recordId}" digest does not match its content (tampered record)`,
          expected: recomputed,
          encountered: contentDigest,
        },
      };
    }
  }
  const { projectionDigest, ...content } = projection;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== projectionDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'projection digest does not match its content (tampered projection)',
        expected: recomputed,
        encountered: projectionDigest,
      },
    };
  }
  return { ok: true, value: true };
}
