/**
 * @epoch/adapter-github — the tenant-scoped, idempotent ingestion store.
 *
 * Ingestion is CONTENT-ADDRESSED and SEALED: the snapshot's canonical
 * digest is its identity; the store keys by (tenant, workspace). The
 * admission pipeline (total, never throws):
 *
 * 1. tenant gate — a snapshot naming a different tenant than the pinned
 *    one is the typed `tenant-isolation-rejected` (R12);
 * 2. provider parse — unknown shapes are the typed
 *    `unknown-provider-payload` (never a partial silent load);
 * 3. semantic admission — a snapshot without a unique head revision is
 *    the typed `ingestion-rejected` with a reason;
 * 4. digest verification — a caller-claimed digest that does not match
 *    the content is the typed `digest-mismatch` (tamper detection);
 * 5. idempotency — identical content under the same key returns the
 *    SEALED PRIOR record (`duplicate` disposition, no state change);
 *    DIFFERENT content under the same key is the typed
 *    `replay-conflict`.
 *
 * In-memory reference machinery only: no persistence, no network, no
 * clocks (every instant is caller-supplied).
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { ProviderSnapshot } from './provider/payload';
import { parseProviderSnapshot } from './provider/payload';
import { snapshotDigestOf, workspaceIdOf } from './projection';
import type { SnapshotIngestionRecord } from './types';
import { GITHUB_ADAPTER_RECORD_VERSION } from './version';
import type { GithubAdapterResult } from './errors';

/** Input of {@link GithubAdapterHost.ingestSnapshot}. */
export interface IngestSnapshotInput {
  readonly tenantId: TenantId;
  /** Raw provider payload (the provider seam's untrusted bytes). */
  readonly payload: unknown;
  /** Optional caller-claimed digest (tamper detection when present). */
  readonly claimedDigest?: Sha256Hex | undefined;
  readonly ingestedAt: Timestamp;
}

/** The unique head revision (a revision that is no other's parent). */
function headRevisionOf(snapshot: ProviderSnapshot): ProviderSnapshot['revisions'][number] | undefined {
  const parented = new Set(snapshot.revisions.flatMap((revision) => revision.parents));
  const heads = snapshot.revisions.filter((revision) => !parented.has(revision.sha));
  return heads.length === 1 ? heads[0] : undefined;
}

/** Digest of the ingestion record content (everything except the digest). */
function ingestionDigest(content: Omit<SnapshotIngestionRecord, 'contentDigest'>): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * The reference adapter host: an in-memory, tenant-scoped store of
 * sealed snapshots. Construction pins the tenant (`expectedTenantId`):
 * any operation naming a different tenant is the typed
 * `tenant-isolation-rejected`.
 */
export class GithubAdapterHost {
  private readonly expectedTenantId: TenantId | undefined;
  /** tenant#workspace -> the sealed ingestion record + parsed snapshot. */
  private readonly snapshots = new Map<string, { record: SnapshotIngestionRecord; snapshot: ProviderSnapshot }>();

  constructor(options?: { readonly expectedTenantId?: TenantId | undefined }) {
    this.expectedTenantId = options?.expectedTenantId;
  }

  private tenantGate(tenantId: TenantId): GithubAdapterResult<TenantId> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this adapter host is pinned to tenant "${this.expectedTenantId}" — the operation named tenant "${tenantId}"`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
        },
      };
    }
    return { ok: true, value: tenantId };
  }

  /** Ingest one provider snapshot (idempotent; see module docs for the pipeline). */
  ingestSnapshot(input: IngestSnapshotInput): GithubAdapterResult<SnapshotIngestionRecord> {
    const gate = this.tenantGate(input.tenantId);
    if (!gate.ok) return gate;

    const parsed = parseProviderSnapshot(input.payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'unknown-provider-payload',
          message: 'the payload is not a recognized hosted software-workspace snapshot',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.length === 0 ? '$' : issue.path.join('.'),
            message: issue.message,
          })),
        },
      };
    }
    const snapshot = parsed.data;
    const snapshotDigest = snapshotDigestOf(snapshot);
    if (input.claimedDigest !== undefined && input.claimedDigest !== snapshotDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: 'the claimed snapshot digest does not match its content (tampered or mismatched payload)',
          expected: snapshotDigest,
          encountered: input.claimedDigest,
        },
      };
    }
    if (headRevisionOf(snapshot) === undefined) {
      return {
        ok: false,
        error: {
          code: 'ingestion-rejected',
          message: 'the snapshot has no unique head revision — a projection requires exactly one head',
          reason: 'no-unique-head-revision',
        },
      };
    }

    const workspaceId = workspaceIdOf(snapshot);
    const key = `${input.tenantId}#${workspaceId}`;
    const existing = this.snapshots.get(key);
    if (existing !== undefined) {
      if (existing.record.snapshotDigest !== snapshotDigest) {
        return {
          ok: false,
          error: {
            code: 'replay-conflict',
            message: `workspace "${workspaceId}" already holds snapshot revision ${existing.record.snapshotDigest} — different content under the same key is a replay conflict`,
            key,
            expectedDigest: existing.record.snapshotDigest,
            encounteredDigest: snapshotDigest,
          },
        };
      }
      // Idempotent replay: the sealed prior record, marked duplicate.
      return { ok: true, value: { ...existing.record, disposition: 'duplicate' } };
    }

    const content: Omit<SnapshotIngestionRecord, 'contentDigest'> = {
      schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
      tenantId: input.tenantId,
      workspaceId,
      snapshotDigest,
      revisionCount: snapshot.revisions.length,
      workItemCount: snapshot.workItems.length,
      ingestedAt: input.ingestedAt,
      disposition: 'ingested',
    };
    const record: SnapshotIngestionRecord = { ...content, contentDigest: ingestionDigest(content) };
    this.snapshots.set(key, { record, snapshot });
    return { ok: true, value: record };
  }

  /** Retrieve the sealed snapshot of a workspace (tenant-scoped read). */
  sealedSnapshot(
    tenantId: TenantId,
    workspaceId: string,
  ): GithubAdapterResult<{ readonly record: SnapshotIngestionRecord; readonly snapshot: ProviderSnapshot }> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const entry = this.snapshots.get(`${tenantId}#${workspaceId}`);
    if (entry === undefined) {
      return {
        ok: false,
        error: {
          code: 'ingestion-rejected',
          message: `no sealed snapshot for workspace "${workspaceId}" in the requested scope`,
          reason: 'unknown-workspace',
        },
      };
    }
    return { ok: true, value: entry };
  }

  /** Deterministic snapshot of the whole host (sorted; no insertion-order leaks). */
  listIngestions(tenantId: TenantId): GithubAdapterResult<readonly SnapshotIngestionRecord[]> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const prefix = `${tenantId}#`;
    return {
      ok: true,
      value: [...this.snapshots.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, entry]) => entry.record)
        .sort((a, b) => (a.workspaceId < b.workspaceId ? -1 : a.workspaceId > b.workspaceId ? 1 : 0)),
    };
  }
}
