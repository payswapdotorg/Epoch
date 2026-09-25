/**
 * Event-log contract versions and closed vocabularies.
 *
 * architecture.md (binding): "The event log is the authoritative change
 * history: append-only, totally-ordered per stream, typed events carrying
 * actor/tenant scoping, causal references, and content digests. Events are
 * FACTS (immutable); corrections are new events, never mutations."
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry / W009
 * tenancy): a serialized event record is admitted only when its
 * `schemaVersion` equals {@link EVENT_LOG_RECORD_VERSION} exactly; skew
 * surfaces as a typed `version-unsupported` error before any other schema
 * diagnostic. {@link EVENT_LOG_CONTRACT_VERSION} versions the published
 * contract surface (`schemas/` + the typed index export).
 *
 * Neutrality (architecture lock rule 13): stream ids, tenant ids, actor
 * ids and payload discriminators are opaque, kind-prefixed or namespaced
 * tokens; NO provider, broker, database or vendor vocabulary appears in
 * this contract. Durable persistence and event distribution (the
 * architecture.md "Persistence" targets) are FUTURE adapter concerns —
 * this package owns the in-memory reference machinery and the typed
 * contract.
 */

/** Version of the published event-log contract surface (schemas/ + types). */
export const EVENT_LOG_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized event-log record. */
export const EVENT_LOG_RECORD_VERSION = 1 as const;

/**
 * Event stream identity: `stream:<slug>`. A stream is the unit of total
 * order — every event in one stream has a strictly contiguous sequence
 * starting at 1. Streams are opaque references; their semantic meaning
 * (a world, a scenario, a delivery, a session journal) is the caller's
 * vocabulary, never this package's.
 */
export const EVENT_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Event payload discriminator: `namespace:name` (e.g. `world:subjects`,
 * `action:lifecycle`). The discriminator selects the payload DATA
 * contract. The `world` and `action` namespaces are RESERVED for the
 * kernel payload contracts published by this package
 * (src/subjects.ts); extension authors register their own namespaces.
 * The shape mirrors the world-model `TypeKey` grammar (namespace:name,
 * lowercase segments) so event kinds and world type keys share one
 * discipline.
 */
export const EVENT_KIND_DISCRIMINATOR_PATTERN =
  /^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,126}$/;

/**
 * Namespaces reserved for the kernel payload contracts (src/subjects.ts):
 * `world` (payloads referencing world entities/relations) and `action`
 * (action-derived lifecycle payloads referencing action proposals).
 * Discriminators in these namespaces MUST carry data admitted by the
 * corresponding kernel payload validator; unknown kinds in a reserved
 * namespace are rejected at admission (a typed `validation` error).
 */
export const RESERVED_EVENT_NAMESPACES = ['world', 'action'] as const;

/** One reserved kernel event namespace. */
export type ReservedEventNamespace = (typeof RESERVED_EVENT_NAMESPACES)[number];

/**
 * Event actor reference: `principal:<slug>` — an OPAQUE principal id in
 * the exact grammar of @epoch/identity (W009). Identity is NOT a runtime
 * dependency: the pattern is mirrored here and pinned member-for-member
 * by devDependency parity tests (test/parity.test.ts,
 * test/kernel-parity.types.ts).
 */
export const EVENT_ACTOR_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Tenant scope of an event: `tenant:<slug>` — an OPAQUE tenant id in the
 * exact grammar of @epoch/tenancy (W009). Tenancy is NOT a runtime
 * dependency: the pattern is mirrored here and pinned member-for-member
 * by devDependency parity tests.
 */
export const EVENT_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Lifecycle phases of an action-derived event (the `action:lifecycle`
 * kernel payload family). The vocabulary mirrors the action protocol's
 * propose -> authorize -> execute flow (architecture.md "Actions":
 * "Agents propose; the Action Gateway authorizes execution"): events
 * record FACTS about that flow; the authorization decision itself is
 * @epoch/authorization's authority, never this package's.
 */
export const ACTION_EVENT_PHASES = [
  'proposed',
  'authorized',
  'rejected',
  'executed',
  'effects-recorded',
  'failed',
] as const;

/** One action-derived event lifecycle phase. */
export type ActionEventPhase = (typeof ACTION_EVENT_PHASES)[number];

/**
 * World-subject reference kinds (the `world:subjects` kernel payload
 * family): an event may reference world ENTITIES (graph nodes) or
 * RELATIONS (graph edges) — the W002 world-model vocabulary
 * (EntityId/RelationId), referenced opaquely, never embedded.
 */
export const EVENT_SUBJECT_KINDS = ['entity', 'relation'] as const;

/** One world-subject reference kind. */
export type EventSubjectKind = (typeof EVENT_SUBJECT_KINDS)[number];

/** The namespace segment of an event-kind discriminator (before `:`). */
export function namespaceOf(discriminator: string): string {
  const separator = discriminator.indexOf(':');
  return separator === -1 ? '' : discriminator.slice(0, separator);
}
