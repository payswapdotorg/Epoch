/**
 * Collaboration contract versions and closed vocabularies.
 *
 * architecture.md (binding): "Collaboration is session-based
 * presence/coordination over the shared model: typed collaboration
 * sessions (participants as opaque principal ids from W009 identity),
 * membership, and session-scoped coordination events. It is NOT a second
 * authority: collaboration does not mutate the world model; it
 * coordinates actors whose actions still flow through the action
 * gateway."
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry / W009
 * tenancy): a serialized collaboration record (session, coordination
 * event, or snapshot) is admitted only when its `schemaVersion` equals
 * {@link COLLABORATION_RECORD_VERSION} exactly; skew surfaces as a typed
 * `version-unsupported` error before any other schema diagnostic.
 * {@link COLLABORATION_CONTRACT_VERSION} versions the published contract
 * surface (`schemas/` + the typed index export).
 *
 * Neutrality (architecture lock rule 13): session ids, tenant ids,
 * principal ids and coordination kinds are opaque, kind-prefixed or
 * namespaced tokens; NO provider, collaboration-vendor, transport or
 * protocol product appears in this contract. Real-time transports
 * (WebSocket services, presence brokers) are FUTURE adapters — this
 * package owns the typed session/coordination machinery.
 */

/** Version of the published collaboration contract surface (schemas/ + types). */
export const COLLABORATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized collaboration record. */
export const COLLABORATION_RECORD_VERSION = 1 as const;

/**
 * Collaboration session identity: `session:<slug>`. Sessions are opaque
 * coordination scopes; their meaning (a design review, an inspection
 * shift, an approval huddle) is the caller's vocabulary.
 */
export const COLLABORATION_SESSION_ID_PATTERN =
  /^session:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Tenant scope of a session: `tenant:<slug>` — an OPAQUE tenant id in
 * the exact grammar of @epoch/tenancy (W009). Mirrored and pinned by
 * devDependency parity tests (never a runtime dependency).
 */
export const COLLABORATION_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Participant principal id: `principal:<slug>` — an OPAQUE principal id
 * in the exact grammar of @epoch/identity (W009). Mirrored and pinned by
 * devDependency parity tests (never a runtime dependency).
 */
export const COLLABORATION_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Optional session scope narrowing: workspace and project ids in the
 * exact W009 tenancy grammars (`workspace:<slug>`, `project:<slug>`).
 * Mirrored and pinned by parity tests.
 */
export const COLLABORATION_WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;
export const COLLABORATION_PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Session lifecycle states: a session opens `open` and closes `closed`
 * (the terminal event `session.closed` is immutable history — sessions
 * are never deleted, only closed).
 */
export const SESSION_STATES = ['open', 'closed'] as const;

/** One session lifecycle state. */
export type SessionState = (typeof SESSION_STATES)[number];

/**
 * Presence states of a session participant. `left` is terminal and is
 * set ONLY by the `participant.left` membership event; rejoining is a
 * new `participant.joined` event. Presence heartbeats may re-assert the
 * current state (`joining -> joining` and `idle -> idle` are legal).
 */
export const PRESENCE_STATES = ['joining', 'present', 'idle', 'left'] as const;

/** One presence state. */
export type PresenceState = (typeof PRESENCE_STATES)[number];

/**
 * Legal presence transitions (the W007 lifecycle-transition discipline):
 * `joining` advances to `present`; `present` and `idle` interchange and
 * re-assert themselves (heartbeats); `left` is terminal and is reachable
 * only through the `participant.left` membership event — a presence
 * event can never set it. `joining` cannot jump straight to `idle`
 * (a participant must be present before idling): the typed
 * `invalid-presence-transition` error.
 */
export const PRESENCE_TRANSITIONS: Readonly<
  Record<PresenceState, readonly PresenceState[]>
> = {
  joining: ['present', 'left'],
  present: ['present', 'idle', 'left'],
  idle: ['idle', 'present', 'left'],
  left: [],
};

/**
 * The closed vocabulary of session-scoped COORDINATION event kinds.
 * Coordination semantics ONLY — no world-model mutation vocabulary, no
 * authorization vocabulary (lock rules 1/3/12):
 *
 * - `participant.joined` / `participant.left` — membership facts;
 * - `participant.presence` — presence state changes (heartbeats);
 * - `subject.focused` / `subject.released` — shared-model subject focus
 *   (what the session is looking AT — an opaque reference, never a
 *   write);
 * - `coordination.note` — a generic session-scoped coordination envelope
 *   (typed data, open semantics);
 * - `session.closed` — the terminal lifecycle fact.
 */
export const COLLABORATION_EVENT_KINDS = [
  'participant.joined',
  'participant.left',
  'participant.presence',
  'subject.focused',
  'subject.released',
  'coordination.note',
  'session.closed',
] as const;

/** One session-scoped coordination event kind. */
export type CollaborationEventKind = (typeof COLLABORATION_EVENT_KINDS)[number];

/**
 * The kinds of subjects a coordination envelope may carry (the shared
 * model being coordinated OVER): a world-graph entity (W002 vocabulary)
 * or an action proposal at an exact revision (W003 vocabulary).
 * References only — coordination never mutates them.
 */
export const COLLABORATION_SUBJECT_KINDS = ['world-entity', 'action-proposal'] as const;

/** One coordination subject kind. */
export type CollaborationSubjectKind = (typeof COLLABORATION_SUBJECT_KINDS)[number];
