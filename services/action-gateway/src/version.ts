/**
 * Action-gateway service contract versions and closed vocabularies.
 *
 * The service is the EXECUTION AUTHORITY over the @epoch/action-policy
 * kernel (W022 division of ownership): it owns intake, the authorization
 * gate, the approval flow, execution dispatch through the adapter seam,
 * outcome recording, and the action:* event vocabulary — never new
 * decision/approval contract authorities (those are the kernel's; this
 * service reuses them verbatim).
 *
 * Neutrality (architecture lock rule 13): no field, id, code or vocabulary
 * names a vendor, provider, broker or deployment surface. The execution
 * seam is the `ActionExecutionPort`; concrete external systems (HTTP
 * services, queues, tools) are adapters behind it, never core types.
 */

/** Version of the action-gateway host surface. */
export const ACTION_GATEWAY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by gateway snapshots and outcome records. */
export const GATEWAY_RECORD_VERSION = 1 as const;

/**
 * The lifecycle statuses of one hosted action (the host model over the
 * kernel's decision outcomes and approval-request states):
 *
 * - `awaiting-approval` — a requires-approval decision is in force, quorum
 *   unmet, deadline unpassed;
 * - `authorized` — execution is permitted (an allow decision, or the
 *   approval quorum met) but not yet dispatched;
 * - `denied` — the policy decision denied the action (terminal);
 * - `rejected` — a human rejection vetoed the approval request (terminal);
 * - `approval-expired` — the approval deadline passed with the quorum
 *   unmet (the typed approval-timeout terminal);
 * - `executed` — the dispatch succeeded and the outcome record is sealed
 *   (terminal);
 * - `failed` — the dispatch ran and the effect failed (the typed failure
 *   record is sealed; terminal — retries are NEW proposals).
 */
export const ACTION_STATUSES = [
  'awaiting-approval',
  'authorized',
  'denied',
  'rejected',
  'approval-expired',
  'executed',
  'failed',
] as const;

/** One action lifecycle status. */
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/**
 * The action event vocabulary (W010-shaped): every gateway event is a W010
 * `action:lifecycle` fact — the reserved `action` namespace admits exactly
 * this discriminator through the REAL W010 kernel payload contract
 * (src/events.ts mirrors the shapes; test/events.parity.test.ts pins the
 * seal/digest parity with the real `sealEvent` / `computeEventDigest`).
 */
export const ACTION_LIFECYCLE_EVENT_KIND = 'action:lifecycle' as const;

/** The stream id prefix of the action event vocabulary. */
export const ACTION_STREAM_PREFIX = 'action-' as const;

/**
 * Lifecycle phases of an action-derived event — MIRRORED from W010's
 * `ACTION_EVENT_PHASES` (the reserved `action` namespace payload
 * vocabulary; the runtime parity test pins the mirror member-for-member).
 * The gateway's richer host statuses (awaiting-approval, approval-expired,
 * …) project onto these FACT phases with typed detail payloads.
 */
export const ACTION_EVENT_PHASES = [
  'proposed',
  'authorized',
  'rejected',
  'executed',
  'effects-recorded',
  'failed',
] as const;

/** One action event phase (the W010 vocabulary, mirrored). */
export type ActionEventPhase = (typeof ACTION_EVENT_PHASES)[number];

/**
 * Opaque action identity (`action:<slug>`): one action = one event stream
 * (`stream:action-<slug>`). The suffix bound keeps the derived stream id
 * inside the W010 stream grammar (≤ 63 chars after `stream:`).
 */
export const ACTION_ID_PATTERN = /^action:[a-z0-9][a-z0-9-]{0,55}$/;

/**
 * Health statuses of the gateway host (typed liveness data):
 * `degraded` exactly when at least one hosted action settled `failed`.
 */
export const GATEWAY_HEALTH_STATUSES = ['healthy', 'degraded'] as const;

/** One gateway health status. */
export type GatewayHealthStatus = (typeof GATEWAY_HEALTH_STATUSES)[number];
