/**
 * Provenance and evidence — who stated what, how, and on what support.
 *
 * Every assertion in the world model carries provenance; writes without an
 * attributed actor are structurally impossible (the write input schemas
 * require provenance). Evidence references are addressable by opaque id —
 * the world model stores the reference, never the evidence bytes.
 */
import type { AssertionId } from './primitives';

/** The kind of actor behind a statement or event. */
export type ActorRole =
  | 'human'
  | 'agent'
  | 'system'
  | 'external-provider'
  | 'sensor'
  | 'importer';

/**
 * A reference to an actor. `id` is opaque and provider-neutral — it may be
 * a person id, an agent registration id, or an external system handle; the
 * world model never interprets it. Actor entities may additionally exist in
 * the graph (e.g. `core:actor` entities) and correlate via this id.
 */
export interface ActorRef {
  readonly id: string;
  readonly role: ActorRole;
  readonly displayName?: string | undefined;
}

/** The kind of thing an evidence reference points at. */
export type EvidenceKind =
  | 'document'
  | 'measurement'
  | 'observation'
  | 'computation'
  | 'assertion'
  | 'external'
  | 'other';

/**
 * An addressable evidence reference. `id` is opaque; `digest` (when known)
 * is a lowercase hex content digest; `locator` is an opaque
 * provider-neutral pointer (path, URL, page, query). Evidence is referenced,
 * never embedded.
 */
export interface EvidenceRef {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly digest?: string | undefined;
  readonly locator?: string | undefined;
  readonly description?: string | undefined;
}

/**
 * Full provenance for an assertion: the actor, the method used, supporting
 * evidence references, and derivation links to prior assertions.
 */
export interface Provenance {
  readonly actor: ActorRef;
  readonly method: string;
  readonly evidence: readonly EvidenceRef[];
  /** Assertion ids this assertion was derived from. */
  readonly derivedFrom?: readonly AssertionId[] | undefined;
  /** Channel/tool that recorded the statement (opaque descriptor). */
  readonly recordedVia?: string | undefined;
}
