/**
 * @epoch/mobile — contract versions and closed vocabularies (Work Order
 * W018).
 *
 * The mobile field client owns EXACTLY the field-shell vocabulary (sessions,
 * captures, evidence kinds, review kinds, queue intents). Everything else is
 * consumed from the canonical packages: device-descriptor vocabulary from
 * @epoch/experience-protocol (W011), observation/distinction/uncertainty
 * vocabulary from @epoch/solution-delivery (W036), proposal vocabulary from
 * @epoch/action-protocol (W003), tenant grammar from @epoch/tenancy (W009).
 * Mirrors of devDependency-only vocabularies (the W022 decision outcome
 * grammar) are pinned by test/parity.test.ts, never runtime deps.
 */
import { z } from 'zod';

/** Version of the published mobile field-client contract surface. */
export const MOBILE_FIELD_CLIENT_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized mobile field record. */
export const MOBILE_FIELD_RECORD_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Field session lifecycle (mobile-owned).
// ---------------------------------------------------------------------------

/** The capture-session states (a projection of availability, never a kernel lifecycle). */
export const FIELD_SESSION_STATES = ['active', 'paused', 'closed'] as const;

/** One field session state. */
export type FieldSessionState = (typeof FIELD_SESSION_STATES)[number];

export const FieldSessionStateSchema = z.enum(FIELD_SESSION_STATES);

// ---------------------------------------------------------------------------
// Field evidence kinds (the capture channels a field device offers).
// ---------------------------------------------------------------------------

/**
 * The neutral field-evidence kinds: what a field device can capture. Photo,
 * sensor reading and note references are carried BY DIGEST in the W006
 * convention — never as embedded payloads. These kinds name capture ROLES,
 * never vendors, formats or device products (lock rule 13).
 */
export const FIELD_EVIDENCE_KINDS = ['photo', 'sensor-reading', 'note'] as const;

/** One field evidence kind. */
export type FieldEvidenceKind = (typeof FIELD_EVIDENCE_KINDS)[number];

export const FieldEvidenceKindSchema = z.enum(FIELD_EVIDENCE_KINDS);

// ---------------------------------------------------------------------------
// Field review kinds (the approval surfaces).
// ---------------------------------------------------------------------------

/**
 * What a field review proposal is about. Observation acceptance/rejection
 * review the W036 observation intake; session close review closing the field
 * session's delivery scope. Execution authority stays with the Action
 * Gateway (lock rule 3) — a review kind names intent, never an execution
 * path.
 */
export const FIELD_REVIEW_KINDS = [
  'observation-acceptance',
  'observation-rejection',
  'session-close',
] as const;

/** One field review kind. */
export type FieldReviewKind = (typeof FIELD_REVIEW_KINDS)[number];

export const FieldReviewKindSchema = z.enum(FIELD_REVIEW_KINDS);

// ---------------------------------------------------------------------------
// Offline queue intent kinds.
// ---------------------------------------------------------------------------

/** What a queue record intents: replaying a capture, or an approval proposal. */
export const FIELD_QUEUE_INTENT_KINDS = ['capture-intent', 'approval-intent'] as const;

/** One queue intent kind. */
export type FieldQueueIntentKind = (typeof FIELD_QUEUE_INTENT_KINDS)[number];

export const FieldQueueIntentKindSchema = z.enum(FIELD_QUEUE_INTENT_KINDS);

// ---------------------------------------------------------------------------
// Queue replay states (the reference host's bookkeeping).
// ---------------------------------------------------------------------------

export const FIELD_QUEUE_REPLAY_STATES = ['pending', 'admitted', 'rejected'] as const;

/** One queue replay state. */
export type FieldQueueReplayState = (typeof FIELD_QUEUE_REPLAY_STATES)[number];

export const FieldQueueReplayStateSchema = z.enum(FIELD_QUEUE_REPLAY_STATES);

// ---------------------------------------------------------------------------
// Gateway decision outcomes (MIRROR of the W022 policy-decision grammar).
// ---------------------------------------------------------------------------

/**
 * The gateway decision outcome vocabulary, mirrored from
 * @epoch/action-policy POLICY_DECISION_OUTCOMES (allow/deny/requires-
 * approval) so the mobile client receives gateway decision records in the
 * same grammar without a runtime dependency on the policy kernel (the
 * apps/web shell precedent: mirrors in source, drift-pinned by
 * test/parity.test.ts via devDependencies).
 */
export const GATEWAY_DECISION_OUTCOMES = ['allow', 'deny', 'requires-approval'] as const;

/** One gateway decision outcome. */
export type GatewayDecisionOutcome = (typeof GATEWAY_DECISION_OUTCOMES)[number];

export const GatewayDecisionOutcomeSchema = z.enum(GATEWAY_DECISION_OUTCOMES);

// ---------------------------------------------------------------------------
// Mobile-owned id grammars (kind-prefixed slugs, the W009/W036 convention).
// ---------------------------------------------------------------------------

export const FIELD_SESSION_ID_PATTERN = /^field-session:[a-z0-9][a-z0-9-]{0,62}$/;
export const FIELD_CAPTURE_ID_PATTERN = /^field-capture:[a-z0-9][a-z0-9-]{0,62}$/;
export const FIELD_APPROVAL_ID_PATTERN = /^field-approval:[a-z0-9][a-z0-9-]{0,62}$/;
export const FIELD_QUEUE_ID_PATTERN = /^field-queue:[a-z0-9][a-z0-9-]{0,62}$/;
export const FIELD_DECISION_ID_PATTERN = /^field-decision:[a-z0-9][a-z0-9-]{0,62}$/;

// ---------------------------------------------------------------------------
// Field fidelity (the experience-architecture ladder pin).
// ---------------------------------------------------------------------------

/**
 * The FIELD-fidelity interaction modality set (experience-architecture.md
 * "Device adaptation": mobile = field). Low-friction field capture runs on
 * touch, gesture and voice interaction; keyboard/pointer/gamepad/gaze stay
 * at higher fidelity rungs. Sorted, duplicate-free (the W011 deterministic
 * set semantics).
 */
export const FIELD_FIDELITY_INTERACTION_MODALITIES = ['gesture', 'touch', 'voice'] as const;

/** One field-fidelity interaction modality. */
export type FieldFidelityInteractionModality =
  (typeof FIELD_FIDELITY_INTERACTION_MODALITIES)[number];

// ---------------------------------------------------------------------------
// Typed error codes (values, never thrown).
// ---------------------------------------------------------------------------

/**
 * The typed mobile-field-client error taxonomy. Every admission seam returns
 * these as values; no runtime exception ever escapes this package.
 */
export const MOBILE_FIELD_ERROR_CODES = [
  'validation',
  'vendor-fields-rejected',
  'version-mismatch',
  'cross-tenant-denied',
  'ambiguous-linkage-rejected',
  'uncertainty-missing-rejected',
  'evidence-payload-rejected',
  'digest-mismatch',
  'duplicate-capture',
  'version-conflict',
  'lifecycle-conflict',
  'session-state-conflict',
  'gateway-bypass-rejected',
  'undirected-proposal',
  'gateway-rejected',
] as const;

/** One mobile field-client error code. */
export type MobileFieldErrorCode = (typeof MOBILE_FIELD_ERROR_CODES)[number];
