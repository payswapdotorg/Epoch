/**
 * @epoch/evidence — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators in
 * `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality: every identifier that crosses a domain boundary (artifact,
 * revision, run, actor, method) is an opaque string owned by its producing
 * domain; no field encodes a vendor, framework, or provider. Provider- or
 * storage-specific meaning lives behind adapters, never in these types
 * (architecture lock rule 13).
 */
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type {
  CONFIDENCE_METHODS,
  EVIDENCE_KINDS,
  INTERVAL_BIASES,
} from './version';

/** Evidence kind — the W002 world-model `EvidenceKind` vocabulary. */
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** How a confidence figure was obtained (W002-aligned). */
export type ConfidenceMethod = (typeof CONFIDENCE_METHODS)[number];

/** Directional bias admitted for interval estimates (W002-aligned). */
export type IntervalBias = (typeof INTERVAL_BIASES)[number];

/**
 * Bounded probability distribution describing uncertainty — structurally
 * identical to the W002 world-model `ConfidenceDistribution`
 * (contracts/world/src/confidence.ts), so confidence travels losslessly
 * between evidence records and world-model assertions where they meet.
 * All numbers are within [0, 1]; interval bounds satisfy lower <= upper;
 * weights (when present) align with values.
 */
export type ConfidenceDistribution =
  | {
      readonly kind: 'point';
      readonly value: number;
    }
  | {
      readonly kind: 'interval';
      readonly lower: number;
      readonly upper: number;
      readonly bias?: IntervalBias | undefined;
    }
  | {
      readonly kind: 'set';
      readonly values: readonly number[];
      readonly weights?: readonly number[] | undefined;
    };

/**
 * The confidence attached to an evidence record (the W002 `Confidence`
 * shape). Always present on evidence records: exact/deterministic evidence
 * states its certainty explicitly (`kind: 'point'`, `value: 1`,
 * `method: 'stated'`) rather than leaving uncertainty implicit — the same
 * policy W002 applies to assertions.
 */
export interface Confidence {
  readonly distribution: ConfidenceDistribution;
  readonly method?: ConfidenceMethod | undefined;
  readonly rationale?: string | undefined;
}

/**
 * Reference to the EXACT artifact revision an evidence record is about.
 *
 * `digest` is the proof-grade SHA-256 of the artifact revision's content in
 * canonical JSON form — the exact-revision discipline of the Epoch
 * verification chain (architecture.md: "Evidence is exact-revision
 * addressable"). SHA-256 is used for content addressing here, NOT the
 * non-cryptographic FNV-1a change detectors the constraint language pinned
 * for compiled-constraint tamper detection: evidence digests are identity,
 * not just change detection.
 */
export interface ExactRevisionRef {
  /** Opaque artifact identity (owned by the producing domain). */
  readonly artifactId: string;
  /** Opaque revision label within the artifact's history (e.g. "r3"). */
  readonly revision: string;
  /** SHA-256 (lowercase hex, 64 chars) of the exact artifact revision content. */
  readonly digest: Sha256Hex;
}

/** Who produced an evidence record, by which run (and optionally method). */
export interface EvidenceProduction {
  /** Opaque id of the run that produced this evidence. */
  readonly runId: string;
  /** Opaque actor identity (agent, person, or system) that executed the run. */
  readonly actorId: string;
  /** Opaque id of the method the run executed, when recorded. */
  readonly methodId?: string | undefined;
}

/** The evidence payload: JSON-representable data plus an optional locator. */
export interface EvidencePayload {
  /** RFC 6838-style media type of `data` (e.g. "application/json"). */
  readonly mediaType: string;
  /** JSON-representable payload captured as evidence. */
  readonly data: JsonValue;
  /**
   * Opaque, provider-neutral out-of-band locator for the full artifact bytes
   * (never interpreted by the kernel; resolvers behind adapters own it).
   */
  readonly locator?: string | undefined;
}

/**
 * A single evidence record: what exact artifact revision it is about, who
 * produced it and when, what it captured, and how certain it is. The record
 * carries the `schemaVersion` discriminator on its serialized form; its
 * identity is the SHA-256 of its canonical JSON serialization (see
 * `computeEvidenceDigest`) — evidence is content-addressed.
 */
export interface EvidenceRecord {
  readonly schemaVersion: 1;
  readonly kind: EvidenceKind;
  readonly subject: ExactRevisionRef;
  readonly producedBy: EvidenceProduction;
  /** When the evidence was observed/produced (canonical UTC instant). */
  readonly observedAt: Timestamp;
  readonly content: EvidencePayload;
  readonly confidence: Confidence;
}

/** Issue codes reported by the evidence parse/admission surface. */
export type EvidenceIssueCode = 'version-mismatch' | 'schema' | 'subject-conflict';

/** One typed, human-readable issue (entry points never throw). */
export interface EvidenceIssue {
  readonly code: EvidenceIssueCode;
  readonly message: string;
  readonly path?: readonly (string | number)[];
}

/** A stored evidence record together with its content-addressed digest. */
export interface EvidenceReceipt {
  readonly digest: Sha256Hex;
  readonly record: EvidenceRecord;
}
