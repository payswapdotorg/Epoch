/**
 * @epoch/desktop — contract versions and closed vocabularies (W017).
 *
 * The desktop client is the typed reference implementation of the desktop
 * host shell (architecture.md "Clients" — binding: the web experience is
 * canonical; the native desktop/mobile shells share its semantic
 * contracts, and desktop may expose optional foundation-backed authoring
 * surfaces whose native timelines/documents/projects remain projections
 * and working artifacts).
 *
 * Versioning policy (v1, the kernel discipline): a serialized desktop
 * document is admitted only when its `protocolVersion` equals
 * {@link DESKTOP_PROTOCOL_VERSION} exactly (or its `schemaVersion` equals
 * {@link DESKTOP_RECORD_VERSION} for internal records); skew surfaces as a
 * typed `version-unsupported` admission error, checked before any schema
 * validation.
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, SURFACE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or native-toolkit name. The concrete native wrapper that
 * will embed this contract is referenced only as "the native wrapper"
 * (the architecture-level client-family designation in spec/architecture.md
 * is the one locked seam where the wrapper's product name appears).
 *
 * Mirrored vocabularies (the W014 app pattern): the principal vocabulary is
 * self-contained here and drift-pinned by parity tests against the
 * devDependency references — @epoch/identity (principal kinds/id pattern)
 * and @epoch/authorization (denial codes). Tenancy vocabulary is consumed
 * DIRECTLY from @epoch/tenancy (a pinned runtime dependency — genuine
 * runtime composition per the W017 dependency freeze).
 */
import { z } from 'zod';

/** Version of the desktop client contract surface (this package). */
export const DESKTOP_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized desktop document. */
export const DESKTOP_PROTOCOL_VERSION = '1.0.0' as const;

/** Version discriminator carried by every internal desktop record. */
export const DESKTOP_RECORD_VERSION = 1 as const;

/** The protocol version literal type. */
export type DesktopProtocolVersion = typeof DESKTOP_PROTOCOL_VERSION;

export const DesktopProtocolVersionSchema = z
  .literal(DESKTOP_PROTOCOL_VERSION)
  .meta({
    id: 'DesktopProtocolVersion',
    title: 'DesktopProtocolVersion',
    description: 'Exact desktop-shell protocol version admitted by this release ("1.0.0").',
  });

/** Record-version literal schema (internal records). */
export const DesktopRecordVersionSchema = z.literal(DESKTOP_RECORD_VERSION).meta({
  id: 'DesktopRecordVersion',
  title: 'DesktopRecordVersion',
  description: 'Record-version discriminator of internal desktop-shell records (1).',
});

// ---------------------------------------------------------------------------
// Document kinds (manifest inventory).
// ---------------------------------------------------------------------------

/**
 * The document kinds of desktop-shell protocol v1 (each kind is a distinct
 * serialized document with its own schema discriminator).
 */
export const DESKTOP_DOCUMENT_KINDS = [
  'desktop.host-shell-envelope',
  'desktop.window-record',
  'desktop.session-snapshot',
  'desktop.authoring-proposal',
  'desktop.cache-entry',
] as const;

/** One desktop document kind. */
export type DesktopDocumentKind = (typeof DESKTOP_DOCUMENT_KINDS)[number];

// ---------------------------------------------------------------------------
// Window lifecycle vocabulary (shell-owned).
// ---------------------------------------------------------------------------

/**
 * The typed window lifecycle states. A desktop window is a shell surface:
 * `opening` (created, not yet presented) -> `open` -> `focused`/`blurred`
 * (focus is a sub-state of openness) -> `closing` -> `closed` (terminal).
 */
export const WINDOW_STATES = ['opening', 'open', 'focused', 'blurred', 'closing', 'closed'] as const;

/** One window lifecycle state. */
export type WindowState = (typeof WINDOW_STATES)[number];

export const WindowStateSchema = z.enum(WINDOW_STATES).meta({
  id: 'WindowState',
  title: 'WindowState',
  description: 'Typed lifecycle state of a desktop shell window.',
});

/** The typed window lifecycle events (state-transition triggers). */
export const WINDOW_EVENTS = ['opened', 'focused', 'blurred', 'close-requested', 'closed'] as const;

/** One window lifecycle event. */
export type WindowEvent = (typeof WINDOW_EVENTS)[number];

export const WindowEventSchema = z.enum(WINDOW_EVENTS).meta({
  id: 'WindowEvent',
  title: 'WindowEvent',
  description: 'Typed lifecycle event of a desktop shell window.',
});

/**
 * The legal window transitions (the closed lifecycle table). `closed` is
 * terminal; every non-terminal state may request a close; focus toggles
 * only between `focused` and `blurred` (an `open` window focuses, a
 * blurred window re-focuses).
 */
export const WINDOW_TRANSITIONS: Readonly<Record<WindowState, readonly WindowEvent[]>> = {
  opening: ['opened', 'close-requested'],
  open: ['focused', 'close-requested'],
  focused: ['blurred', 'close-requested'],
  blurred: ['focused', 'close-requested'],
  closing: ['closed'],
  closed: [],
};

/** The terminal window states. */
export const TERMINAL_WINDOW_STATES: readonly WindowState[] = ['closed'];

// ---------------------------------------------------------------------------
// Session lifecycle vocabulary (shell-owned).
// ---------------------------------------------------------------------------

/**
 * The typed shell-session lifecycle states. A session is tenant-scoped
 * (resolved against @epoch/tenancy at open) and hosts windows, renderer
 * bindings, and the offline caches.
 */
export const SESSION_STATES = ['opening', 'active', 'suspended', 'closing', 'closed'] as const;

/** One session lifecycle state. */
export type SessionState = (typeof SESSION_STATES)[number];

export const SessionStateSchema = z.enum(SESSION_STATES).meta({
  id: 'SessionState',
  title: 'SessionState',
  description: 'Typed lifecycle state of a desktop shell session.',
});

/** The typed session lifecycle events. */
export const SESSION_EVENTS = ['opened', 'suspended', 'resumed', 'close-requested', 'closed'] as const;

/** One session lifecycle event. */
export type SessionEvent = (typeof SESSION_EVENTS)[number];

export const SessionEventSchema = z.enum(SESSION_EVENTS).meta({
  id: 'SessionEvent',
  title: 'SessionEvent',
  description: 'Typed lifecycle event of a desktop shell session.',
});

/**
 * The legal session transitions (the closed lifecycle table). `closed` is
 * terminal; a suspended session resumes before closing.
 */
export const SESSION_TRANSITIONS: Readonly<Record<SessionState, readonly SessionEvent[]>> = {
  opening: ['opened', 'close-requested'],
  active: ['suspended', 'close-requested'],
  suspended: ['resumed', 'close-requested'],
  closing: ['closed'],
  closed: [],
};

// ---------------------------------------------------------------------------
// Host↔shell envelope vocabulary (the IPC seam).
// ---------------------------------------------------------------------------

/** Schema-name discriminator carried by every host↔shell envelope. */
export const HOST_SHELL_ENVELOPE_SCHEMA_NAME = 'epoch.desktop.host-shell-envelope' as const;

/** The direction of one envelope on the seam. */
export const ENVELOPE_DIRECTIONS = ['host-to-shell', 'shell-to-host'] as const;

/** One envelope direction. */
export type EnvelopeDirection = (typeof ENVELOPE_DIRECTIONS)[number];

export const EnvelopeDirectionSchema = z.enum(ENVELOPE_DIRECTIONS).meta({
  id: 'EnvelopeDirection',
  title: 'EnvelopeDirection',
  description: 'Direction of one host↔shell envelope on the desktop IPC seam.',
});

/**
 * The host→shell envelope kinds: native-side lifecycle commands, input-
 * driven requests (the native input loop is host territory), and
 * experience data offers. The host COMMANDS lifecycle, RELAYS user
 * gestures, and OFFERS content-addressed projections; it never reaches
 * into shell state directly.
 */
export const HOST_TO_SHELL_KINDS = [
  'session-open',
  'session-close',
  'window-open',
  'window-close',
  'window-focus',
  'window-blur',
  'experience-offer',
  'cache-invalidation',
  'mount-request',
  'frame-request',
  'intent-request',
  'authoring-request',
  'snapshot-request',
] as const;

/** One host→shell envelope kind. */
export type HostToShellKind = (typeof HOST_TO_SHELL_KINDS)[number];

export const HostToShellKindSchema = z.enum(HOST_TO_SHELL_KINDS).meta({
  id: 'HostToShellKind',
  title: 'HostToShellKind',
  description: 'Kind of one host→shell envelope (lifecycle command or content-addressed experience offer).',
});

/**
 * The shell→host envelope kinds: shell-side lifecycle acknowledgements,
 * admitted-invocation reports (mount/frame/intent evidence), typed
 * authoring proposals (toward the kernel seams), and session-snapshot
 * reports. The shell REPORTS; it never commands the host.
 */
export const SHELL_TO_HOST_KINDS = [
  'session-opened',
  'session-closed',
  'window-opened',
  'window-focused',
  'window-blurred',
  'window-closed',
  'mount-graph',
  'invocation-receipt',
  'authoring-proposal',
  'session-snapshot',
] as const;

/** One shell→host envelope kind. */
export type ShellToHostKind = (typeof SHELL_TO_HOST_KINDS)[number];

export const ShellToHostKindSchema = z.enum(SHELL_TO_HOST_KINDS).meta({
  id: 'ShellToHostKind',
  title: 'ShellToHostKind',
  description: 'Kind of one shell→host envelope (acknowledgement, invocation evidence, typed proposal, or snapshot report).',
});

/** One envelope kind (either direction). */
export type EnvelopeKind = HostToShellKind | ShellToHostKind;

/**
 * The map of legal kinds per direction (the closed dispatch table): an
 * envelope whose kind is foreign to its direction is a malformed record.
 */
export const DIRECTION_KINDS: Readonly<Record<EnvelopeDirection, readonly EnvelopeKind[]>> = {
  'host-to-shell': HOST_TO_SHELL_KINDS,
  'shell-to-host': SHELL_TO_HOST_KINDS,
};

/** The cache-invalidation reasons (freshness vocabulary). */
export const CACHE_INVALIDATION_REASONS = ['host-invalidated', 'superseded', 'tenant-rotation'] as const;

/** One cache-invalidation reason. */
export type CacheInvalidationReason = (typeof CACHE_INVALIDATION_REASONS)[number];

export const CacheInvalidationReasonSchema = z.enum(CACHE_INVALIDATION_REASONS).meta({
  id: 'CacheInvalidationReason',
  title: 'CacheInvalidationReason',
  description: 'Typed reason an offline-cache entry was invalidated.',
});

/** The offline-cache entry kinds (content-addressed projections only). */
export const CACHE_ENTRY_KINDS = ['experience-graph', 'plan-artifact'] as const;

/** One cache entry kind. */
export type CacheEntryKind = (typeof CACHE_ENTRY_KINDS)[number];

export const CacheEntryKindSchema = z.enum(CACHE_ENTRY_KINDS).meta({
  id: 'CacheEntryKind',
  title: 'CacheEntryKind',
  description: 'Kind of one offline-cache entry: a sealed W011 graph or a compiled W012 plan artifact.',
});

// ---------------------------------------------------------------------------
// Authoring vocabulary (projection surface; zero shell authority).
// ---------------------------------------------------------------------------

/** Schema-name discriminator carried by every authoring proposal. */
export const AUTHORING_PROPOSAL_SCHEMA_NAME = 'epoch.desktop.authoring-proposal' as const;

/**
 * The authoring-proposal status. There is exactly ONE status: `proposed`.
 * The desktop shell PROPOSES through the kernel seams; approval and
 * execution are Action-Gateway/kernel territory (architecture lock rule 3)
 * — a record that claims any other status is an authority violation.
 */
export const AUTHORING_PROPOSAL_STATUSES = ['proposed'] as const;

/** One authoring-proposal status (always `proposed`). */
export type AuthoringProposalStatus = (typeof AUTHORING_PROPOSAL_STATUSES)[number];

export const AuthoringProposalStatusSchema = z.literal('proposed').meta({
  id: 'AuthoringProposalStatus',
  title: 'AuthoringProposalStatus',
  description: 'The only authoring-proposal status: proposed (approval/execution are kernel-side, never shell-side).',
});

/**
 * The typed authoring authority-bypass attempts — the surface a naive
 * integrator might reach for. Every attempt is rejected with a typed
 * `authority-violation` (the shell holds NO authority of its own).
 */
export const AUTHORING_AUTHORITY_ATTEMPTS = [
  'self-approve',
  'self-execute',
  'claim-authority',
  'embed-kernel-state',
] as const;

/** One authoring authority-bypass attempt kind. */
export type AuthoringAuthorityAttempt = (typeof AUTHORING_AUTHORITY_ATTEMPTS)[number];

export const AuthoringAuthorityAttemptSchema = z.enum(AUTHORING_AUTHORITY_ATTEMPTS).meta({
  id: 'AuthoringAuthorityAttempt',
  title: 'AuthoringAuthorityAttempt',
  description: 'Kind of authoring authority-bypass attempt (always rejected with a typed authority-violation).',
});

/**
 * The typed admission-bypass attempts on the experience-mounting surface —
 * the seams a naive integrator might try to skip W013 admission through.
 * Every attempt is rejected with a typed `authority-violation`.
 */
export const ADMISSION_BYPASS_ATTEMPTS = [
  'direct-binding-write',
  'unadmitted-mount',
  'receipt-forgery',
] as const;

/** One admission-bypass attempt kind. */
export type AdmissionBypassAttempt = (typeof ADMISSION_BYPASS_ATTEMPTS)[number];

export const AdmissionBypassAttemptSchema = z.enum(ADMISSION_BYPASS_ATTEMPTS).meta({
  id: 'AdmissionBypassAttempt',
  title: 'AdmissionBypassAttempt',
  description: 'Kind of renderer-admission bypass attempt (always rejected with a typed authority-violation).',
});

// ---------------------------------------------------------------------------
// Provenance vocabulary (every projected artifact carries it).
// ---------------------------------------------------------------------------

/** The typed origins of desktop-shell artifacts (provenance vocabulary). */
export const ARTIFACT_ORIGINS = [
  'host-envelope',
  'shell-surface',
  'desktop-authoring-surface',
  'desktop-shell',
  'reference-host',
] as const;

/** One artifact origin. */
export type ArtifactOrigin = (typeof ARTIFACT_ORIGINS)[number];

export const ArtifactOriginSchema = z.enum(ARTIFACT_ORIGINS).meta({
  id: 'ArtifactOrigin',
  title: 'ArtifactOrigin',
  description: 'Typed provenance origin of a desktop-shell artifact.',
});

// ---------------------------------------------------------------------------
// Mirrored principal vocabulary (parity-pinned to @epoch/identity).
// ---------------------------------------------------------------------------

/** Opaque principal identity `principal:<slug>` (mirrors @epoch/identity). */
export const PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** The principal kinds (mirrors @epoch/identity). */
export const PRINCIPAL_KINDS = ['human', 'agent', 'service'] as const;

/** One principal kind (mirror). */
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/**
 * The typed denial codes an authoring proposal may be denied with
 * (mirrors @epoch/authorization; recorded by the kernel-side seams — the
 * shell itself never decides, it records the kernel's typed answer).
 */
export const AUTHORING_DENIAL_CODES = [
  'unknown-principal',
  'unknown-tenant',
  'cross-tenant-denied',
  'cross-workspace-denied',
  'cross-project-denied',
  'inactive-principal',
  'unauthenticated-principal',
] as const;

/** One authoring denial code (mirror of the authorization vocabulary). */
export type AuthoringDenialCode = (typeof AUTHORING_DENIAL_CODES)[number];

// ---------------------------------------------------------------------------
// The typed desktop-shell error taxonomy.
// ---------------------------------------------------------------------------

/**
 * The typed admission/error codes of the desktop shell. Every failure is a
 * discriminated value (never a bare throw), so consumers branch
 * deterministically on `code`:
 * - `version-unsupported` — protocolVersion/schemaVersion skew (first gate);
 * - `malformed-record` — schema violations with flattened issues (strict
 *   objects reject unknown — vendor/native-toolkit — fields here);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed one (tamper detection);
 * - `cross-tenant-denied` — an envelope, document, or cache entry outside
 *   the session's tenant scope (R12);
 * - `authority-violation` — an admission bypass, an authoring authority
 *   claim, or kernel semantic vocabulary smuggled where projections belong
 *   (lock rules 3/8);
 * - `unknown-window` / `unknown-session` — dangling shell-side references;
 * - `invalid-transition` — lifecycle table violations;
 * - `replay-violation` — an envelope-chain gap, fork, or out-of-order
 *   delivery (replay safety);
 * - `device-mismatch` — an experience artifact compiled for a non-desktop
 *   target device;
 * - `cache-violation` — offline-cache contract violations (unknown
 *   addresses, stale reads presented as fresh);
 * - `invocation-rejected` — the W013 renderer runtime denied an invocation;
 *   the verbatim typed `cause` (RendererRuntimeError) stays attached.
 */
export const DESKTOP_ERROR_CODES = [
  'version-unsupported',
  'malformed-record',
  'digest-mismatch',
  'cross-tenant-denied',
  'authority-violation',
  'unknown-window',
  'unknown-session',
  'invalid-transition',
  'replay-violation',
  'device-mismatch',
  'cache-violation',
  'invocation-rejected',
] as const;

/** One typed desktop-shell error code. */
export type DesktopErrorCode = (typeof DESKTOP_ERROR_CODES)[number];

export const DesktopErrorCodeSchema = z.enum(DESKTOP_ERROR_CODES).meta({
  id: 'DesktopErrorCode',
  title: 'DesktopErrorCode',
  description: 'Typed error code of the desktop shell.',
});

// ---------------------------------------------------------------------------
// Neutrality allowlist documentation (locked seam note).
// ---------------------------------------------------------------------------

/**
 * The one locked seam where the native-wrapper vendor designation may
 * appear: the architecture-level client-family contract
 * (spec/architecture.md "Clients") and this package's README, which quotes
 * it. Source identifiers, types, and values in src/ and test/ carry zero
 * vendor vocabulary — the reference host is engine-free and
 * toolkit-free by construction (test/neutrality.test.ts pins this).
 */
export const NEUTRALITY_LOCKED_SEAMS: readonly string[] = [
  'spec/architecture.md (client family designation)',
  'apps/desktop/README.md (reservation/scope documentation)',
];
