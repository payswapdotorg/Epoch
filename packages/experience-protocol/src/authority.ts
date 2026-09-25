/**
 * The authority boundary of the Experience layer (architecture lock
 * rules 8/16 — "Experience is a projection, never a second source of
 * truth"; "One responsibility has one authority").
 *
 * Nodes and edges carry one OPEN presentation-attribute record. That is
 * the only place kernel semantics could be smuggled into a structurally
 * valid document: a presenter could inline world state (a full entity
 * object, an assertion, a property bag) or restate kernel-owned fields
 * (confidence, provenance, validity, temporal stamps) instead of
 * referencing kernel objects opaquely.
 *
 * The admission pipeline scans presentation-attribute records for the
 * kernel-reserved keys below and REJECTS the document with a typed
 * `authority-violation` error naming every violating path. Strict object
 * schemas handle the other embedding vector (unknown fields on nodes,
 * edges, and descriptors are rejected as `malformed-descriptor` before
 * this scan ever runs).
 */
import type { ExperienceNode, ExperienceEdge } from './graph';
import type { ExperienceProtocolError } from './errors';

/**
 * Kernel-reserved presentation-attribute keys. The list is the union of:
 * - the world-model materialized-view fields (W002): entity/relation/event
 *   field names and their collection plurals;
 * - the assertion vocabulary: properties, provenance, confidence,
 *   validity, source/target/subject;
 * - protocol discriminators: schema, version, sequence;
 * - explicit authority claims: authority, worldState, semanticState, …
 *
 * Presentation code has the entire rest of the string namespace; these
 * keys belong to the kernel and may not be shadowed or restated here.
 */
export const KERNEL_RESERVED_ATTRIBUTE_KEYS = [
  'assertion',
  'assertionId',
  'assertions',
  'authority',
  'authoritative',
  'confidence',
  'createdAt',
  'entities',
  'entity',
  'entityTypes',
  'events',
  'event',
  'externalMappings',
  'properties',
  'provenance',
  'relations',
  'relation',
  'relationTypes',
  'schema',
  'semanticAuthority',
  'semanticState',
  'semanticTruth',
  'sequence',
  'source',
  'subject',
  'target',
  'updatedAt',
  'validity',
  'version',
  'world',
  'worldModel',
  'worldState',
] as const;

/** One kernel-reserved key. */
export type KernelReservedAttributeKey = (typeof KERNEL_RESERVED_ATTRIBUTE_KEYS)[number];

const RESERVED_SET: ReadonlySet<string> = new Set(KERNEL_RESERVED_ATTRIBUTE_KEYS);

/** One authority violation: dotted path plus the reserved key found there. */
export interface AuthorityViolation {
  readonly path: string;
  readonly key: string;
}

/**
 * Scan a graph's presentation-attribute records for kernel-reserved keys.
 * Pure and total: returns every violation (node and edge attributes are
 * both presentation records and both subject to the scan).
 */
export function scanAuthorityViolations(graph: {
  nodes: readonly ExperienceNode[];
  edges: readonly ExperienceEdge[];
}): AuthorityViolation[] {
  const violations: AuthorityViolation[] = [];
  graph.nodes.forEach((node, nodeIndex) => {
    if (node.attributes === undefined) return;
    for (const key of Object.keys(node.attributes)) {
      if (RESERVED_SET.has(key)) {
        violations.push({ path: `nodes.${nodeIndex}.attributes.${key}`, key });
      }
    }
  });
  graph.edges.forEach((edge, edgeIndex) => {
    if (edge.attributes === undefined) return;
    for (const key of Object.keys(edge.attributes)) {
      if (RESERVED_SET.has(key)) {
        violations.push({ path: `edges.${edgeIndex}.attributes.${key}`, key });
      }
    }
  });
  return violations;
}

/**
 * Build the typed `authority-violation` error for a scanned graph. The
 * caller guarantees `violations` is non-empty (the scan only runs on
 * structurally valid documents; empty scans admit).
 */
export function authorityViolationError(
  violations: readonly AuthorityViolation[],
): Extract<ExperienceProtocolError, { readonly code: 'authority-violation' }> {
  return {
    code: 'authority-violation',
    message:
      `experience document attempts to embed or redefine kernel semantics in presentation attributes ` +
      `(${violations.length} violation${violations.length === 1 ? '' : 's'}): kernel state must be referenced opaquely via projected references, never inlined (architecture lock rule 8)`,
    violations: violations.map((v) => ({ path: v.path, key: v.key })),
  };
}
