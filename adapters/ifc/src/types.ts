/**
 * @epoch/adapter-ifc — published contract types (v1), the NEUTRAL seam
 * (architecture lock rule 13).
 *
 * The record surfaces below are the standard-AGNOSTIC shapes everything
 * outside `src/provider/` speaks: W006-convention exact-revision source
 * references, W002 REAL assertion inputs (the world-model's own types —
 * a runtime dependency of this adapter: semantic projections map INTO
 * the world-model graph, never the reverse), and the content-addressed
 * projection/ingestion records. No exchange-standard vocabulary appears
 * in any shape, key, or enum (pinned by test/neutrality.test.ts).
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { AssertionInput } from '@epoch/world-model';
import type { IFC_ADAPTER_RECORD_VERSION } from './version';
import type { IngestionDisposition } from './version';

/**
 * The exact-revision source reference — the W006 `ExactRevisionRef`
 * convention: the observed building-model fixture, addressed by content
 * digest (pinned by compile-time parity in src/parity.ts).
 */
export interface BuildingModelSourceRef {
  readonly artifactId: string;
  readonly revision: string;
  readonly digest: Sha256Hex;
}

/**
 * The outcome of a model ingestion (idempotent, content-addressed):
 * the sealed prior record returns as `duplicate` on identical content;
 * different content under the same key is the typed `replay-conflict`.
 */
export interface ModelIngestionRecord {
  readonly schemaVersion: typeof IFC_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  /** Neutral building-model identity (`bim:<slug>`), derived from the fixture. */
  readonly modelId: string;
  readonly modelDigest: Sha256Hex;
  readonly elementCount: number;
  readonly relationCount: number;
  readonly ingestedAt: Timestamp;
  readonly disposition: IngestionDisposition;
  readonly contentDigest: Sha256Hex;
}

/**
 * The source-category observation record: the typed observation of the
 * external building-model artifact (exact-revision source reference +
 * element/relation counts + provenance + confidence), content-addressed.
 */
export interface BuildingModelObservation {
  readonly schemaVersion: typeof IFC_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly modelId: string;
  readonly source: BuildingModelSourceRef;
  readonly elementCount: number;
  readonly relationCount: number;
  readonly observedAt: Timestamp;
  readonly provenance: {
    readonly actor: { readonly id: string; readonly role: 'external-provider'; readonly displayName?: string };
    readonly method: string;
    readonly evidence: readonly {
      readonly id: string;
      readonly kind: 'document' | 'measurement' | 'observation' | 'computation' | 'assertion' | 'external' | 'other';
      readonly digest?: string;
      readonly locator?: string;
      readonly description?: string;
    }[];
  };
  readonly confidence: {
    readonly distribution: { readonly kind: 'point'; readonly value: number };
    readonly method: 'imported';
    readonly rationale: string;
  };
  readonly contentDigest: Sha256Hex;
}

/**
 * The semantic-category projection: the building model mapped INTO the
 * world-model graph as REAL W002 `AssertionInput` records (entities,
 * properties, relationships — external-standard semantics ADAPTED,
 * never authoritative). Deterministic: identical (tenant, model,
 * observedAt) project byte-identically (identical digests).
 */
export interface BuildingModelProjection {
  readonly schemaVersion: typeof IFC_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly modelId: string;
  readonly source: BuildingModelSourceRef;
  readonly observedAt: Timestamp;
  /** REAL W002 assertion inputs; entities first (sorted), then relations (sorted). */
  readonly assertionInputs: readonly AssertionInput[];
  /** SHA-256 of the projection content (scope + source + every assertion input). */
  readonly projectionDigest: Sha256Hex;
}
