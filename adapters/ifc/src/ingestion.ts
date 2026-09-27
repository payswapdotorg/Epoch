/**
 * @epoch/adapter-ifc — the tenant-scoped, idempotent ingestion store.
 *
 * Ingestion is CONTENT-ADDRESSED and SEALED: the model fixture's
 * canonical digest is its identity; the store keys by (tenant, model).
 * The admission pipeline (total, never throws):
 *
 * 1. tenant gate — a model naming a different tenant than the pinned
 *    one is the typed `tenant-isolation-rejected` (R12);
 * 2. provider parse — unknown shapes are the typed
 *    `unknown-provider-payload` (never a partial silent load);
 * 3. semantic admission — a model without exactly one spatial root, or
 *    a containment relation whose container is not a spatial element,
 *    is the typed `ingestion-rejected` WITH A REASON;
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
import { canonicalDigest, type JsonValue, type Sha256Hex, type Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import { parseProviderModel, admissionProblemOf, type ProviderModel } from './provider/payload';
import { modelDigestOf, modelIdOf } from './projection';
import type { ModelIngestionRecord } from './types';
import { IFC_ADAPTER_RECORD_VERSION } from './version';
import type { IfcAdapterResult } from './errors';

/** Input of {@link IfcAdapterHost.ingestModel}. */
export interface IngestModelInput {
  readonly tenantId: TenantId;
  /** Raw provider payload (the provider seam's untrusted bytes). */
  readonly payload: unknown;
  /** Optional caller-claimed digest (tamper detection when present). */
  readonly claimedDigest?: Sha256Hex | undefined;
  readonly ingestedAt: Timestamp;
}


/** Digest of the ingestion record content (everything except the digest). */
function ingestionDigest(content: Omit<ModelIngestionRecord, 'contentDigest'>): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * The reference adapter host: an in-memory, tenant-scoped store of
 * sealed models. Construction pins the tenant (`expectedTenantId`):
 * any operation naming a different tenant is the typed
 * `tenant-isolation-rejected`.
 */
export class IfcAdapterHost {
  private readonly expectedTenantId: TenantId | undefined;
  /** tenant#modelId -> the sealed ingestion record + parsed model. */
  private readonly models = new Map<string, { record: ModelIngestionRecord; model: ProviderModel }>();

  constructor(options?: { readonly expectedTenantId?: TenantId | undefined }) {
    this.expectedTenantId = options?.expectedTenantId;
  }

  private tenantGate(tenantId: TenantId): IfcAdapterResult<TenantId> {
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

  /** Ingest one provider model (idempotent; see module docs for the pipeline). */
  ingestModel(input: IngestModelInput): IfcAdapterResult<ModelIngestionRecord> {
    const gate = this.tenantGate(input.tenantId);
    if (!gate.ok) return gate;

    const parsed = parseProviderModel(input.payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'unknown-provider-payload',
          message: 'the payload is not a recognized building-model fixture',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.length === 0 ? '$' : issue.path.join('.'),
            message: issue.message,
          })),
        },
      };
    }
    const model = parsed.data;
    const modelDigest = modelDigestOf(model);
    if (input.claimedDigest !== undefined && input.claimedDigest !== modelDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: 'the claimed model digest does not match its content (tampered or mismatched payload)',
          expected: modelDigest,
          encountered: input.claimedDigest,
        },
      };
    }
    const problem = admissionProblemOf(model);
    if (problem !== undefined) {
      return {
        ok: false,
        error: {
          code: 'ingestion-rejected',
          message: `the building model failed semantic admission (${problem})`,
          reason: problem,
        },
      };
    }

    const modelId = modelIdOf(model);
    const key = `${input.tenantId}#${modelId}`;
    const existing = this.models.get(key);
    if (existing !== undefined) {
      if (existing.record.modelDigest !== modelDigest) {
        return {
          ok: false,
          error: {
            code: 'replay-conflict',
            message: `model "${modelId}" already holds revision ${existing.record.modelDigest} — different content under the same key is a replay conflict`,
            key,
            expectedDigest: existing.record.modelDigest,
            encounteredDigest: modelDigest,
          },
        };
      }
      // Idempotent replay: the sealed prior record, marked duplicate.
      return { ok: true, value: { ...existing.record, disposition: 'duplicate' } };
    }

    const content: Omit<ModelIngestionRecord, 'contentDigest'> = {
      schemaVersion: IFC_ADAPTER_RECORD_VERSION,
      tenantId: input.tenantId,
      modelId,
      modelDigest,
      elementCount: model.elements.length,
      relationCount: model.relations.length,
      ingestedAt: input.ingestedAt,
      disposition: 'ingested',
    };
    const record: ModelIngestionRecord = { ...content, contentDigest: ingestionDigest(content) };
    this.models.set(key, { record, model });
    return { ok: true, value: record };
  }

  /** Retrieve the sealed model of a building model (tenant-scoped read). */
  sealedModel(
    tenantId: TenantId,
    modelId: string,
  ): IfcAdapterResult<{ readonly record: ModelIngestionRecord; readonly model: ProviderModel }> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const entry = this.models.get(`${tenantId}#${modelId}`);
    if (entry === undefined) {
      return {
        ok: false,
        error: {
          code: 'ingestion-rejected',
          message: `no sealed model for "${modelId}" in the requested scope`,
          reason: 'unknown-model',
        },
      };
    }
    return { ok: true, value: entry };
  }

  /** Deterministic listing (sorted; no insertion-order leaks). */
  listIngestions(tenantId: TenantId): IfcAdapterResult<readonly ModelIngestionRecord[]> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const prefix = `${tenantId}#`;
    return {
      ok: true,
      value: [...this.models.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, entry]) => entry.record)
        .sort((a, b) => (a.modelId < b.modelId ? -1 : a.modelId > b.modelId ? 1 : 0)),
    };
  }
}
