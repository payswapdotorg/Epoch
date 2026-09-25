/**
 * @epoch/ai-experience — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the W007/W009/W010 in-package
 * convention): a serialized AI-collaboration record (session descriptor,
 * journal event, intent envelope, Engineering Moment, or projection
 * snapshot) is admitted only when its `schemaVersion` equals
 * {@link AI_EXPERIENCE_RECORD_VERSION} exactly; skew surfaces as a typed
 * `version-unsupported` error before any other schema diagnostic.
 * {@link AI_EXPERIENCE_CONTRACT_VERSION} versions the published contract
 * surface (`schemas/` + the typed index export).
 *
 * Authority model (architecture lock rules 8/16 + the W015 pin):
 * this package owns the AI-COLLABORATION SEMANTICS as typed data over the
 * event-sourced W010 substrate — it is never a second authority, never
 * event storage, never a real-time transport, and never an authorization
 * decision maker (approval/execution still flow through the Action
 * Gateway; world semantics stay with the World Model).
 *
 * Provider neutrality (architecture lock rule 13): every identifier is an
 * opaque, kind-prefixed slug in an upstream grammar (agent-protocol,
 * event-log, experience-protocol at runtime; tenancy/collaboration/replay
 * mirrored and parity-pinned via devDependencies — never runtime deps);
 * no field encodes a model provider, vendor SDK, transport, or engine.
 * Open JSON payloads (annotation data, filter criteria) are scanned
 * against the vendor and executable field blocklists below.
 */

/** Version of the published AI-experience contract surface (schemas/ + types). */
export const AI_EXPERIENCE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized AI-collaboration record. */
export const AI_EXPERIENCE_RECORD_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Opaque identity grammars.
// ---------------------------------------------------------------------------

/**
 * Tenant scope of an AI-collaboration record: `tenant:<slug>` — an OPAQUE
 * tenant id in the exact grammar of @epoch/tenancy (W009), mirrored from
 * @epoch/collaboration (W010) and parity-pinned by devDependency tests
 * (never a runtime dependency — same discipline as W010's tenancy mirror).
 */
export const AI_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Participant principal id: `principal:<slug>` — an OPAQUE principal id in
 * the exact grammar of @epoch/identity (W009), mirrored from
 * @epoch/collaboration (W010) and parity-pinned by devDependency tests.
 */
export const AI_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Collaboration session id: `session:<slug>` — the exact @epoch/collaboration
 * (W010) grammar, mirrored and parity-pinned by devDependency tests.
 */
export const AI_SESSION_ID_PATTERN = /^session:[a-z0-9][a-z0-9-]{0,62}$/;

/** Registered agent identity (W003 grammar, runtime reuse — not a mirror). */
export const AI_AGENT_ID_PATTERN = /^agent:[a-z0-9][a-z0-9-]{0,62}$/;

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** `workspace:<slug>` — the W009 tenancy grammar, mirrored. */
export const AI_WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;

/** `project:<slug>` — the W009 tenancy grammar, mirrored. */
export const AI_PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;

// ---------------------------------------------------------------------------
// Presence (the W010 collaboration vocabulary, mirrored + parity-pinned).
// ---------------------------------------------------------------------------

/**
 * Presence states of a collaboration participant — the exact W010
 * @epoch/collaboration vocabulary (`joining`, `present`, `idle`, and the
 * membership-only terminal `left`), mirrored and parity-pinned by
 * devDependency tests.
 */
export const AGENT_PRESENCE_STATES = ['joining', 'present', 'idle', 'left'] as const;

/** One presence state (W010 vocabulary, mirrored). */
export type AgentPresenceState = (typeof AGENT_PRESENCE_STATES)[number];

/**
 * Legal presence transitions — the W010 collaboration transition table,
 * mirrored. `left` is terminal for PRESENCE events; the `left -> joining`
 * rejoin fact is set only by a membership (re)join, so the projection fold
 * admits it as the membership-sourced rejoin (documented deviation from
 * the pure presence table, matching W010's rejoin-via-new-join semantics).
 */
export const AGENT_PRESENCE_TRANSITIONS: Readonly<
  Record<AgentPresenceState, readonly AgentPresenceState[]>
> = {
  joining: ['present', 'left'],
  present: ['present', 'idle', 'left'],
  idle: ['idle', 'present', 'left'],
  left: ['joining'],
};

/** Session lifecycle states (W010 vocabulary, mirrored). */
export const AI_SESSION_STATES = ['open', 'closed'] as const;

/** One session lifecycle state (W010 vocabulary, mirrored). */
export type AiSessionState = (typeof AI_SESSION_STATES)[number];

// ---------------------------------------------------------------------------
// Focus targets (the W010 collaboration subject grammar, mirrored).
// ---------------------------------------------------------------------------

/** The kinds of focus targets (W010 collaboration subject kinds, mirrored). */
export const FOCUS_TARGET_KINDS = ['world-entity', 'action-proposal'] as const;

/** One focus-target kind (W010 vocabulary, mirrored). */
export type FocusTargetKind = (typeof FOCUS_TARGET_KINDS)[number];

/**
 * The exact-revision action-proposal reference of an `action-proposal`
 * focus target — the @epoch/action-protocol (W003) `ProposalReference`
 * shape, mirrored and parity-pinned through @epoch/collaboration's
 * `CollaborationSubject` (devDependency; the member grammars —
 * agent-protocol `MessageId` and the 64-hex digest — are runtime reuses).
 */
export const ACTION_PROPOSAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// ---------------------------------------------------------------------------
// The interaction-intent vocabulary (typed subsets of the Universal
// interactions — spec/experience-architecture.md, binding).
// ---------------------------------------------------------------------------

/**
 * The closed interaction-intent vocabulary: sixteen typed subsets of the
 * Universal interactions (annotate, approve, branch, compare, execute,
 * filter, follow-agent, inspect, pause, query, replay, reject,
 * release-control, resume, select, take-control). Each kind is a versioned
 * discriminated union member of `InteractionIntent` (src/schema.ts); the
 * vocabulary itself is versioned by the contract version. Agents emit
 * these TYPED intents — never arbitrary executable UI code (the Dynamic
 * UI law; violations are typed `executable-ui-rejected` rejections).
 */
export const INTERACTION_INTENT_KINDS = [
  'annotate',
  'approve',
  'branch',
  'compare',
  'execute',
  'filter',
  'follow-agent',
  'inspect',
  'pause',
  'query',
  'reject',
  'release-control',
  'replay',
  'resume',
  'select',
  'take-control',
] as const;

/** One interaction-intent kind (closed vocabulary, sorted). */
export type InteractionIntentKind = (typeof INTERACTION_INTENT_KINDS)[number];

/** The per-member intent payload version (each union member is versioned). */
export const INTENT_PAYLOAD_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Control authority + denial (takeover/release provenance vocabulary).
// ---------------------------------------------------------------------------

/**
 * The kinds of authority a takeover may claim (humans and agents are
 * PEERS; every takeover carries explicit provenance — WHO, WHEN, ON WHAT
 * AUTHORITY):
 * - `session-owner` — the principal that opened the session;
 * - `role-grant` — the actor's role descriptor grants control;
 * - `explicit-handover` — the current controller hands control over.
 */
export const CONTROL_AUTHORITY_KINDS = ['session-owner', 'role-grant', 'explicit-handover'] as const;

/** One control-authority kind. */
export type ControlAuthorityKind = (typeof CONTROL_AUTHORITY_KINDS)[number];

/** The typed reasons a control transition is denied. */
export const CONTROL_DENIAL_REASONS = [
  'actor-lacks-control-authority',
  'actor-not-controller',
  'claimed-authority-invalid',
] as const;

/** One control-denial reason. */
export type ControlDenialReason = (typeof CONTROL_DENIAL_REASONS)[number];

// ---------------------------------------------------------------------------
// The AI-collaboration event vocabulary (over the W010 event shapes).
// ---------------------------------------------------------------------------

/**
 * The closed vocabulary of typed AI-collaboration events — the SEMANTICS
 * of collaboration (presence, focus, takeover/release with provenance,
 * emitted intents, captured Engineering Moments, the terminal close) as
 * typed records over the W010 event shapes (session-journal envelopes in
 * the exact @epoch/collaboration `CollaborationEvent` grammar; event-log
 * records in the `ai` payload namespace). Coordination semantics ONLY —
 * no world-model mutation vocabulary, no authorization vocabulary.
 */
export const AI_COLLABORATION_EVENT_KINDS = [
  'control.denied',
  'control.released',
  'control.taken',
  'focus.changed',
  'focus.released',
  'intent.emitted',
  'moment.captured',
  'presence.changed',
  'session.closed',
] as const;

/** One AI-collaboration event kind. */
export type AiCollaborationEventKind = (typeof AI_COLLABORATION_EVENT_KINDS)[number];

/**
 * The open event-log payload namespace this package owns: `ai:*`
 * discriminators. `world` and `action` are reserved by @epoch/event-log's
 * kernel payload contracts; every other namespace is open, so AI-
 * collaboration facts travel as `ai:<kind>` extension payloads with the
 * typed event as the payload data.
 */
export const AI_EVENT_NAMESPACE = 'ai' as const;

/** The kinds of a W010 `CollaborationEvent` the adapter maps (mirrored vocabulary). */
export const COLLABORATION_ADAPTER_KINDS = [
  'participant.joined',
  'participant.left',
  'participant.presence',
  'subject.focused',
  'subject.released',
  'coordination.note',
  'session.closed',
] as const;

/** One W010 collaboration event kind (mirrored for the adapter input). */
export type MirroredCollaborationEventKind = (typeof COLLABORATION_ADAPTER_KINDS)[number];

// ---------------------------------------------------------------------------
// Participant kinds (W011 vocabulary; peers are the agent/human subset).
// ---------------------------------------------------------------------------

/** The participant kinds admitted as collaboration PEERS (W011 vocabulary subset). */
export const PEER_PARTICIPANT_KINDS = ['agent', 'human'] as const;

/** One peer participant kind (W011 `ParticipantKind` subset: agents and humans). */
export type PeerParticipantKind = (typeof PEER_PARTICIPANT_KINDS)[number];

/** The full W011 participant-kind vocabulary (runtime reuse; presence seats may name system participants). */
export const PARTICIPANT_KINDS = ['agent', 'human', 'system'] as const;

/** One W011 participant kind (agent, human, or system). */
export type AnyParticipantKind = (typeof PARTICIPANT_KINDS)[number];

// ---------------------------------------------------------------------------
// Bounded sizes (DoS discipline).
// ---------------------------------------------------------------------------

/** Upper bound on declared session roles (the opener plus peers). */
export const MAX_SESSION_ROLES = 64;
/** Upper bound on granted intent kinds per role (≤ the closed vocabulary). */
export const MAX_ROLE_INTENTS = INTERACTION_INTENT_KINDS.length;
/** Upper bound on world-snapshot references in an Engineering Moment. */
export const MAX_MOMENT_REFERENCES = 64;
/** Upper bound on evidence references in an Engineering Moment. */
export const MAX_MOMENT_EVIDENCE = 64;
/** Upper bound on moment participant states per participant kind. */
export const MAX_MOMENT_PARTICIPANTS = 64;
/** Upper bound on annotation/filter open-data keys. */
export const MAX_OPEN_DATA_KEYS = 64;
/** Upper bound on annotation notes and query texts (characters). */
export const MAX_TEXT_LENGTH = 2000;
/** Upper bound on moment labels and display names (characters). */
export const MAX_NAME_LENGTH = 128;
/** Upper bound on opaque scenario references (characters). */
export const MAX_SCENARIO_REF_LENGTH = 256;
/** Upper bound on branch labels (characters). */
export const MAX_BRANCH_LABEL_LENGTH = 128;

// ---------------------------------------------------------------------------
// Neutrality blocklists (lock rule 13 + the Dynamic UI law).
// ---------------------------------------------------------------------------

/**
 * Vendor/provider field names REJECTED anywhere in open JSON payloads of
 * AI-collaboration records (keys are structural: a key named `provider`,
 * `model`, `apiKey`, or a model-vendor brand IS provider semantics —
 * forbidden in kernel-adjacent types by lock rule 13). Strict objects
 * already reject unknown fields; these scans cover OPEN payload records
 * (annotation data, filter criteria) where keys are caller-chosen.
 */
export const VENDOR_FIELD_BLOCKLIST: readonly string[] = [
  'accessToken',
  'access_token',
  'anthropic',
  'apiKey',
  'api_key',
  'aws',
  'azure',
  'azureOpenai',
  'azure_openai',
  'bedrock',
  'claude',
  'copilot',
  'credentials',
  'endpoint',
  'gemini',
  'gpt',
  'grok',
  'huggingface',
  'llama',
  'midjourney',
  'mistral',
  'model',
  'modelId',
  'modelName',
  'openai',
  'password',
  'provider',
  'secret',
  'secretKey',
  'secret_key',
  'serverUrl',
  'token',
  'vendor',
  'vertex',
];

/**
 * Executable-UI field names REJECTED anywhere in open JSON payloads (the
 * Dynamic UI law: "Agents emit typed Experience Intents, never arbitrary
 * executable UI code"). Any key in this list — or any string VALUE that
 * starts with an executable marker — is a typed
 * `executable-ui-rejected` error.
 */
export const EXECUTABLE_FIELD_BLOCKLIST: readonly string[] = [
  'bash',
  'binary',
  'code',
  'command',
  'eval',
  'exec',
  'executable',
  'expression',
  'function',
  'html',
  'iframe',
  'import',
  'javascript',
  'js',
  'jsx',
  'module',
  'require',
  'script',
  'scripts',
  'shell',
  'srcdoc',
  'tsx',
  'wasm',
];

/** Suspicious executable string-value prefixes (checked case-insensitively). */
export const EXECUTABLE_VALUE_PREFIXES: readonly string[] = [
  '<script',
  'javascript:',
  'eval(',
  'function(',
  '(function',
];

// ---------------------------------------------------------------------------
// The typed error taxonomy (W015 Tech Lead pin).
// ---------------------------------------------------------------------------

/**
 * The typed AI-experience error taxonomy. Every entry point is total —
 * errors are values, never exceptions:
 * - `version-unsupported` — schemaVersion skew (expected/encountered);
 * - `validation` — malformed records (per-kind member consistency, illegal
 *   presence transitions, duplicate journal sequences);
 * - `digest-mismatch` — claimed digest ≠ recomputed canonical SHA-256;
 * - `unknown-session-reference` — operating on a session that is not the
 *   one being projected/admitted (or does not exist in the supplied set);
 * - `cross-tenant-denied` — tenant scope violation (R12);
 * - `takeover-denied` — an unauthorized takeover or release (typed
 *   rejection whose provenance is recorded in a `control.denied` event);
 * - `invalid-intent` — a malformed or unknown interaction intent;
 * - `executable-ui-rejected` — executable UI code smuggled into an intent
 *   payload (the Dynamic UI law);
 * - `vendor-fields-rejected` — provider/vendor fields in open payload
 *   data (lock rule 13);
 * - `unknown-evidence-reference` — a dangling evidence reference in an
 *   Engineering Moment;
 * - `replay-position-invalid` — a timeline/replay position outside the
 *   known stream bounds.
 */
export const AI_EXPERIENCE_ERROR_CODES = [
  'version-unsupported',
  'validation',
  'digest-mismatch',
  'unknown-session-reference',
  'cross-tenant-denied',
  'takeover-denied',
  'invalid-intent',
  'executable-ui-rejected',
  'vendor-fields-rejected',
  'unknown-evidence-reference',
  'replay-position-invalid',
] as const;

/** One typed error code. */
export type AiExperienceErrorCode = (typeof AI_EXPERIENCE_ERROR_CODES)[number];
