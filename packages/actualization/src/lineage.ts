/**
 * LINEAGE ACROSS UNIVERSAL LIFECYCLE REALIZATIONS (the W039 pin): typed
 * exact-revision references chaining prediction -> baseline ->
 * commitment -> actual -> forecast for EVERY realization variant.
 *
 * - Every lineage node is an EXACT-REVISION reference into a W036
 *   semantic-distinction record (the W037 commitment-reference
 *   discipline): kind-prefixed record id + content digest, never an
 *   embedded copy — revision-precise and content-addressed.
 * - A lineage EDGE is a sealed, append-only record binding `from` and
 *   `to` nodes of ONE subject under ONE realization variant. Edges flow
 *   FORWARD in the canonical stage order (prediction -> baseline ->
 *   commitment -> actual -> forecast) or stay `forecast -> forecast`
 *   (rolling forecast revision refinement); anything else is a typed
 *   `lineage-order-rejected`. An edge that would close a cycle is a
 *   typed `lineage-cycle-rejected` (the graph stays a DAG).
 * - The lineage store is append-only: exact re-admission is idempotent;
 *   the same edge id with different content is a typed
 *   `version-conflict`; the same (from, to) node pair under a NEW edge id
 *   is a typed `version-conflict` (one edge identity grounds exactly one
 *   node pair — the W037 lineage-pair rule).
 * - TRAVERSABLE IN BOTH DIRECTIONS: {@link traceLineageForward} and
 *   {@link traceLineageBackward} walk the graph deterministically
 *   (sorted, visited-set BFS — input order never leaks).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  DistinctionSubjectSchema,
  REALIZATION_VARIANTS,
  SolutionIdSchema,
  TenantIdSchema,
} from '@epoch/solution-delivery';
import { LineageEdgeIdSchema, PrincipalIdSchema, TimestampSchema } from './primitives';
import {
  ACTUALIZATION_RECORD_VERSION,
  LINEAGE_EDGE_SCHEMA_NAME,
  lineageStageOrdinal,
  type LineageNodeKind,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ActualizationResult } from './errors';

// --------------------------------------------------------------------------------
// Lineage node references (exact-revision, kind-checked).
// --------------------------------------------------------------------------------

/** The per-kind record-id grammar of one lineage node (the W036 distinction id grammar). */
const LINEAGE_NODE_ID_PATTERNS: Readonly<Record<LineageNodeKind, RegExp>> = {
  prediction: /^prediction:[a-z0-9][a-z0-9-]{0,62}$/,
  baseline: /^baseline:[a-z0-9][a-z0-9-]{0,62}$/,
  commitment: /^commitment:[a-z0-9][a-z0-9-]{0,62}$/,
  actual: /^actual:[a-z0-9][a-z0-9-]{0,62}$/,
  forecast: /^forecast:[a-z0-9][a-z0-9-]{0,62}$/,
};

function lineageNodeRefSchema<K extends LineageNodeKind>(kind: K) {
  return z
    .strictObject({
      kind: z.literal(kind),
      recordId: z.string().regex(LINEAGE_NODE_ID_PATTERNS[kind]),
      contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .readonly();
}

const LINEAGE_NODE_REF_OPTIONS = [
  lineageNodeRefSchema('prediction'),
  lineageNodeRefSchema('baseline'),
  lineageNodeRefSchema('commitment'),
  lineageNodeRefSchema('actual'),
  lineageNodeRefSchema('forecast'),
] as const;

/**
 * One lineage node reference: a lifecycle-first distinction kind, its
 * kind-prefixed W036 record id, and the EXACT content digest of that
 * revision (content-addressed, revision-precise).
 */
export const LineageNodeRefSchema = z
  .discriminatedUnion('kind', LINEAGE_NODE_REF_OPTIONS)
  .meta({
    id: 'LineageNodeRef',
    title: 'LineageNodeRef',
    description:
      'One lineage node reference: a lifecycle-first distinction kind (prediction/baseline/commitment/actual/forecast), its kind-prefixed W036 record id, and the exact content digest of that revision.',
  });

/** One lineage node reference. */
export type LineageNodeRef = z.infer<typeof LineageNodeRefSchema>;

/** The opaque node key of one lineage node reference (the traversal key). */
export function lineageNodeKey(ref: LineageNodeRef): string {
  return ref.recordId;
}

// --------------------------------------------------------------------------------
// The lineage-edge record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one lineage edge: one forward (or
 * forecast-refinement) exact-revision link between two lifecycle-first
 * nodes of ONE subject under ONE realization variant.
 */
const lineageEdgeShape = z.strictObject({
  schema: z.literal(LINEAGE_EDGE_SCHEMA_NAME),
  schemaVersion: z.literal(ACTUALIZATION_RECORD_VERSION),
  edgeId: LineageEdgeIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  realizationVariant: z.enum(REALIZATION_VARIANTS),
  subject: DistinctionSubjectSchema,
  from: LineageNodeRefSchema,
  to: LineageNodeRefSchema,
  recordedAt: TimestampSchema,
  recordedBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const LineageEdgeContentSchema = lineageEdgeShape
  .readonly()
  .superRefine((edge, ctx) => {
    const fromOrdinal = lineageStageOrdinal(edge.from.kind);
    const toOrdinal = lineageStageOrdinal(edge.to.kind);
    const forward = toOrdinal > fromOrdinal;
    const forecastRefinement = edge.from.kind === 'forecast' && edge.to.kind === 'forecast';
    if (!forward && !forecastRefinement) {
      ctx.addIssue({
        code: 'custom',
        message:
          `lineage must flow prediction -> baseline -> commitment -> actual -> forecast (forecast -> forecast refinement allowed) — "${edge.from.kind}" -> "${edge.to.kind}" is not a forward link`,
        path: ['to'],
      });
    }
    if (edge.from.recordId === edge.to.recordId) {
      ctx.addIssue({
        code: 'custom',
        message: 'a lineage edge cannot be reflexive',
        path: ['to'],
      });
    }
  })
  .meta({
    id: 'LineageEdgeContent',
    title: 'LineageEdgeContent',
    description:
      'The immutable content of one lineage edge: one forward (or forecast-refinement) exact-revision link between two lifecycle-first nodes of one subject under one realization variant, with provenance and tenant scope.',
  });

/** One lineage-edge content. */
export type LineageEdgeContent = z.infer<typeof LineageEdgeContentSchema>;

/** The SEALED lineage edge: content plus its SHA-256 content digest. */
export const SealedLineageEdgeSchema = z
  .strictObject({
    ...lineageEdgeShape.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedLineageEdge',
    title: 'SealedLineageEdge',
    description:
      'The sealed lineage edge: immutable lineage content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed lineage edge. */
export type SealedLineageEdge = z.infer<typeof SealedLineageEdgeSchema>;

/** Compute the content digest of a lineage-edge content (canonical JSON). */
export function computeLineageEdgeDigest(content: LineageEdgeContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid lineage-edge content into its published record. */
export function sealLineageEdge(content: unknown): ActualizationResult<SealedLineageEdge> {
  const parsed = LineageEdgeContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed lineage edge: schema validation + digest recomputation
 * (tamper detection — `digest-mismatch`).
 */
export function verifySealedLineageEdge(sealed: unknown): ActualizationResult<SealedLineageEdge> {
  const parsed = SealedLineageEdgeSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed lineage edge digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The append-only lineage store (reference in-memory).
// --------------------------------------------------------------------------------

/** The state of one lineage store after admissions. */
export interface LineageStore {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly edges: readonly SealedLineageEdge[];
}

/** An empty lineage store for one (tenant, solution) scope. */
export function openLineageStore(scope: {
  readonly tenantId: string;
  readonly solutionId: string;
}): LineageStore {
  return { tenantId: scope.tenantId, solutionId: scope.solutionId, edges: [] };
}

/**
 * Admit a sealed lineage edge into the store (append-only):
 *
 * - the edge verifies (tamper detection);
 * - tenant/solution scope must match the store (`tenant-isolation-rejected`
 *   / `validation`);
 * - the stage ORDER rule (forward or forecast->forecast refinement);
 * - the edge must not close a CYCLE (`lineage-cycle-rejected` — the
 *   content-addressed lineage graph stays a DAG);
 * - an exact re-admission is idempotent; the same edge id with different
 *   content is a typed `version-conflict`;
 * - the same (from, to) node pair under a NEW edge id is a typed
 *   `version-conflict` — one edge identity grounds exactly one node pair.
 */
export function admitLineageEdge(
  store: LineageStore,
  edge: unknown,
): ActualizationResult<LineageStore> {
  const verified = verifySealedLineageEdge(edge);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `lineage edge "${admitted.edgeId}" belongs to tenant "${admitted.tenantId}" but the lineage store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.edgeId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `lineage edge "${admitted.edgeId}" subjects solution "${admitted.solutionId}" but the lineage store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'lineage/store solution mismatch' }],
      },
    };
  }
  const existingById = store.edges.find((candidate) => candidate.edgeId === admitted.edgeId);
  if (existingById !== undefined) {
    if (existingById.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `lineage edge "${admitted.edgeId}" is already sealed with different content — a sealed lineage edge is immutable; changed content ships as a NEW edge id`,
        subject: 'lineage-edge',
        subjectId: admitted.edgeId,
        publishedDigest: existingById.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const existingPair = store.edges.find(
    (candidate) =>
      candidate.from.recordId === admitted.from.recordId &&
      candidate.to.recordId === admitted.to.recordId,
  );
  if (existingPair !== undefined) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `lineage already links "${admitted.from.recordId}" -> "${admitted.to.recordId}" by edge "${existingPair.edgeId}" — one edge identity grounds exactly one node pair`,
        subject: 'lineage-edge-pair',
        subjectId: `${admitted.from.recordId}->${admitted.to.recordId}`,
        publishedDigest: existingPair.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  // Cycle guard: admitting from -> to closes a cycle when `to` already
  // reaches `from` through the forward graph.
  if (reachableForward(store, admitted.to.recordId, admitted.from.recordId)) {
    return {
      ok: false,
      error: {
        code: 'lineage-cycle-rejected',
        message: `lineage edge "${admitted.edgeId}" (${admitted.from.recordId} -> ${admitted.to.recordId}) would close a cycle in the content-addressed lineage graph — lineage stays a DAG`,
        cycle: [admitted.from.recordId, admitted.to.recordId, admitted.from.recordId],
      },
    };
  }
  return { ok: true, value: { ...store, edges: [...store.edges, admitted] } };
}

/** Whether `target` is reachable from `start` following forward edges (deterministic BFS). */
function reachableForward(store: LineageStore, start: string, target: string): boolean {
  const queue = [start];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const edge of store.edges) {
      if (edge.from.recordId === current) {
        queue.push(edge.to.recordId);
      }
    }
  }
  return false;
}

// --------------------------------------------------------------------------------
// Deterministic bidirectional traversal.
// --------------------------------------------------------------------------------

/** The deterministic result of one lineage trace. */
export interface LineageTrace {
  /** The traversal origin node key. */
  readonly originRecordId: string;
  /** Every reachable node reference, sorted by (stage ordinal, recordId). */
  readonly nodes: readonly LineageNodeRef[];
  /** Every traversed edge, sorted by edgeId. */
  readonly edges: readonly SealedLineageEdge[];
}

/**
 * Trace the lineage graph FORWARD from one node (prediction ->
 * ... -> forecast): every node reachable by following forward edges,
 * deterministically (visited-set BFS over sorted adjacency; input order
 * never leaks).
 */
export function traceLineageForward(store: LineageStore, recordId: string): LineageTrace {
  return traceLineage(store, recordId, 'forward');
}

/**
 * Trace the lineage graph BACKWARD from one node (forecast ->
 * ... -> prediction): every node reachable by following edges in
 * reverse, deterministically.
 */
export function traceLineageBackward(store: LineageStore, recordId: string): LineageTrace {
  return traceLineage(store, recordId, 'backward');
}

function traceLineage(store: LineageStore, recordId: string, direction: 'forward' | 'backward'): LineageTrace {
  const queue = [recordId];
  const visited = new Set<string>([recordId]);
  const traversedEdges = new Map<string, SealedLineageEdge>();
  const nodeRefs = new Map<string, LineageNodeRef>();
  const sortedEdges = [...store.edges].sort((a, b) => (a.edgeId < b.edgeId ? -1 : 1));
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of sortedEdges) {
      const match =
        direction === 'forward' ? edge.from.recordId === current : edge.to.recordId === current;
      if (!match) {
        continue;
      }
      traversedEdges.set(edge.edgeId, edge);
      nodeRefs.set(edge.from.recordId, edge.from);
      nodeRefs.set(edge.to.recordId, edge.to);
      const next = direction === 'forward' ? edge.to.recordId : edge.from.recordId;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  const nodes = [...nodeRefs.values()].sort((a, b) =>
    a.kind === b.kind
      ? a.recordId < b.recordId
        ? -1
        : 1
      : lineageStageOrdinal(a.kind) - lineageStageOrdinal(b.kind),
  );
  return {
    originRecordId: recordId,
    nodes,
    edges: [...traversedEdges.values()].sort((a, b) => (a.edgeId < b.edgeId ? -1 : 1)),
  };
}

/** The lineage-store fold: edges sorted by edgeId (deterministic). */
export function foldLineageEdges(store: LineageStore): readonly SealedLineageEdge[] {
  return [...store.edges].sort((a, b) => (a.edgeId < b.edgeId ? -1 : 1));
}

/**
 * The lineage edges touching one node (both directions), sorted by
 * edgeId — the bidirectional adjacency view.
 */
export function lineageEdgesOf(store: LineageStore, recordId: string): readonly SealedLineageEdge[] {
  return foldLineageEdges(store).filter(
    (edge) => edge.from.recordId === recordId || edge.to.recordId === recordId,
  );
}
