/**
 * Observability contract versions and the closed vocabularies (W030 —
 * Security/Isolation/Observability).
 *
 * architecture.md (binding): "Public extensions are sandboxed and
 * capability-scoped." (lock rule 10: "Public arbitrary code is
 * sandboxed."), "Identity != tenancy != authorization != policy"
 * (lock rule 12), "Provider-specific behavior is adapterized" (lock
 * rule 13), and tenancy is a security boundary (R12 tenant isolation).
 *
 * THE AUTHORITY SPLIT (lock rule 16 — one responsibility, one
 * authority):
 * - The sandbox HOST machinery (admission, permission enforcement,
 *   invocation envelopes) is @epoch/extension-runtime's authority
 *   (W008). This package MIRRORS its closed vocabularies (trust
 *   classes, flavors, grant ceilings, data-handling classifications)
 *   for its ISOLATION CHECK — pinned member-for-member by devDep
 *   parity tests, never a runtime edge.
 * - Authorization DECISIONS are @epoch/authorization's (W009). This
 *   package OBSERVES sealed decisions by digest reference; it never
 *   re-evaluates a decision.
 * - Tenancy containment is @epoch/tenancy's (W009); identity is
 *   @epoch/identity's (W009). Their id grammars are MIRRORED here
 *   (the W007 semver-duplication policy: self-contained in src,
 *   drift-pinned by parity tests — no runtime coupling).
 * - The CHANGE HISTORY is @epoch/event-log's (W010). The
 *   `security:*` payload namespace rides the W010 event SHAPES via a
 *   structural mirror (the W023/W036/W038/W043 kernel convention),
 *   pinned compile-time by src/kernel-parity.ts and runtime by
 *   test/parity.test.ts (identical digests through the REAL sealEvent).
 * - Access projections (authorization + redaction) are
 *   @epoch/access-projection's (W041). The audit family verifies
 *   their published INVARIANTS (identity preservation, redaction
 *   completeness, decision/policy linkage) over MIRRORED summaries.
 * - Marketplace listings/trust metadata are @epoch/marketplace's
 *   (W023). The isolation profile may REQUIRE a listing reference;
 *   listing verification itself is the service's composition (the
 *   kernel checks presence, never marketplace semantics).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open
 * string) and provider-neutral: no entry names a vendor, cloud,
 * SIEM, broker, or monitoring product. External security monitoring
 * systems are future adapters behind the capability fabric.
 *
 * Versioning policy (mirrors @epoch/entitlements): a serialized
 * observability record is admitted only when its `schemaVersion`
 * equals {@link OBSERVABILITY_RECORD_VERSION} exactly; skew surfaces
 * as a `validation` issue at path ["schemaVersion"] before other
 * schema diagnostics. {@link OBSERVABILITY_CONTRACT_VERSION} versions
 * the published contract surface (schemas/ + the typed index export).
 */

/** Version of the published observability contract surface (schemas/ + types). */
export const OBSERVABILITY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized observability record. */
export const OBSERVABILITY_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized `security:*`
 * event — MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION
 * (security events are append-only typed events over the W010 event
 * shapes, the open `security:` payload namespace). The runtime parity
 * test asserts the constants are equal; a future W010 bump
 * intentionally breaks that parity and surfaces here as a review
 * gate.
 */
export const OBSERVABILITY_EVENT_RECORD_VERSION = 1 as const;

/** Schema discriminator of the sealed security-policy envelope. */
export const SECURITY_POLICY_SCHEMA_NAME = 'epoch.observability.security-policy' as const;

/** Schema discriminator of the sealed observation envelope. */
export const OBSERVATION_SCHEMA_NAME = 'epoch.observability.observation' as const;

/** Schema discriminator of the sealed quarantine-fact envelope. */
export const QUARANTINE_SCHEMA_NAME = 'epoch.observability.quarantine' as const;

// --------------------------------------------------------------------------------
// Id grammars (kind-prefixed, opaque, provider-neutral — the house pattern).
// --------------------------------------------------------------------------------

/** Security-policy identity: `security-policy:<slug>`. */
export const SECURITY_POLICY_ID_PATTERN = /^security-policy:[a-z0-9][a-z0-9-]{0,49}$/;

/** Observation identity: `observation:<slug>`. */
export const OBSERVATION_ID_PATTERN = /^observation:[a-z0-9][a-z0-9-]{0,62}$/;

/** Quarantine-fact identity: `quarantine:<slug>`. */
export const QUARANTINE_ID_PATTERN = /^quarantine:[a-z0-9][a-z0-9-]{0,56}$/;

/**
 * Observation-subject identity: `<kind>:<slug>` — the OPEN bounded
 * grammar every subject id satisfies (extension:…, session:…,
 * simrun:…, action:…, principal:…, tenant:…, workspace:…,
 * security-policy:…). The CLOSED subject-kind vocabulary below names
 * the families this kernel understands; the suffix grammar is
 * permissive enough for every sibling surface's kind-prefixed ids
 * (pinned by the service parity tests over the REAL W020/W021/W022
 * ids).
 */
export const SUBJECT_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}:[a-z0-9][a-z0-9._-]{0,95}$/;

/**
 * Security stream identity: `stream:security-<suffix>` — one stream
 * per observed subject (the W010 stream grammar).
 */
export const SECURITY_STREAM_ID_PATTERN = /^stream:security-[a-z0-9][a-z0-9._-]{0,52}$/;

/** Security host stream identity: `stream:security-host-<suffix>` (tenant-level host steps). */
export const SECURITY_HOST_STREAM_ID_PATTERN = /^stream:security-host-[a-z0-9][a-z0-9._-]{0,47}$/;

/**
 * Tenant identity of the security domain. MIRRORED from
 * @epoch/tenancy's TENANT_ID_PATTERN (the W009 grammar) — pinned by
 * the runtime parity test; never a runtime dependency.
 */
export const OBSERVABILITY_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Principal identity of the actor named on observability records.
 * MIRRORED from @epoch/identity's PRINCIPAL_ID_PATTERN (the W009
 * grammar) — pinned by the runtime parity test; never a runtime
 * dependency.
 */
export const OBSERVABILITY_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

// --------------------------------------------------------------------------------
// The observation subject kinds (the closed family vocabulary).
// --------------------------------------------------------------------------------

/**
 * The closed subject-kind vocabulary: WHAT a security observation
 * can be about. The kinds name the sibling SURFACES opaquely (never
 * providers): `extension` (a W008-hosted extension), `agent-session`
 * (a W020 orchestration session), `simulation-run` (a W021 fabric
 * run), `action` (a W022 gateway action), `principal`/`workspace`/
 * `tenant` (W009 identity/tenancy subjects), `security-policy` (an
 * observability policy itself).
 */
export const OBSERVATION_SUBJECT_KINDS = [
  'extension',
  'agent-session',
  'simulation-run',
  'action',
  'principal',
  'workspace',
  'tenant',
  'security-policy',
] as const;

/** One observation subject kind. */
export type ObservationSubjectKind = (typeof OBSERVATION_SUBJECT_KINDS)[number];

// --------------------------------------------------------------------------------
// The observation classes (what happened).
// --------------------------------------------------------------------------------

/**
 * The closed observation-class vocabulary — the security-relevant
 * FACT families the execution surfaces report:
 *
 * - `sandbox-admission` — an extension surface was checked against
 *   an isolation profile (the admission decision);
 * - `sandbox-invocation` — an extension invoked through the sandbox
 *   boundary (permitted or denied);
 * - `sandbox-violation` — a sandbox constraint was violated (the
 *   W008 violation-detail codes ride as neutral strings);
 * - `authorization-decision` — a W009 decision point outcome
 *   observed by digest reference;
 * - `tenant-boundary-check` — a tenant-isolation check (R12)
 *   outcome, carrying both the subject and actor tenants;
 * - `agent-session` — a W020 agent-session lifecycle fact;
 * - `simulation-run` — a W021 simulation-run lifecycle fact;
 * - `action-dispatch` — a W022 action-gateway dispatch fact;
 * - `security-audit` — a finding produced by one of this kernel's
 *   audit families (tenant boundary / access projection).
 */
export const OBSERVATION_CLASSES = [
  'sandbox-admission',
  'sandbox-invocation',
  'sandbox-violation',
  'authorization-decision',
  'tenant-boundary-check',
  'agent-session',
  'simulation-run',
  'action-dispatch',
  'security-audit',
] as const;

/** One observation class. */
export type ObservationClass = (typeof OBSERVATION_CLASSES)[number];

/**
 * The closed observation-outcome vocabulary. `observed` is a neutral
 * fact (no allow/deny semantics — lifecycle observations use this);
 * `allowed`/`denied` are enforcement outcomes; `violated` is a
 * security-relevant violation of an invariant (sandbox violation,
 * cross-tenant breach, projection invariant failure).
 */
export const OBSERVATION_OUTCOMES = ['observed', 'allowed', 'denied', 'violated'] as const;

/** One observation outcome. */
export type ObservationOutcome = (typeof OBSERVATION_OUTCOMES)[number];

/**
 * The closed observation-severity vocabulary. Lifecycle facts
 * (`observed` outcome) carry `info`; enforcement successes carry
 * `notice`; enforcement denials carry `warning`; violations carry
 * `critical` (the health projection counts critical violations).
 */
export const OBSERVATION_SEVERITIES = ['info', 'notice', 'warning', 'critical'] as const;

/** One observation severity. */
export type ObservationSeverity = (typeof OBSERVATION_SEVERITIES)[number];

// --------------------------------------------------------------------------------
// The sandbox isolation vocabulary (W008-mirrored + kernel-owned).
// --------------------------------------------------------------------------------

/**
 * The extension trust-class grammar — MIRRORED from W008's
 * EXTENSION_TRUST_CLASSES (t0..t4; parity-pinned member-for-member).
 * The isolation profile names a MAXIMUM admitted trust class; a
 * subject whose trust class EXCEEDS it is a typed violation.
 */
export const SANDBOX_TRUST_CLASS_PATTERN = /^t[0-4]$/;

/** One sandbox trust class token (t0..t4, the W008 grammar mirrored). */
export type SandboxTrustClassToken = string;

/**
 * The extension FLAVOR vocabulary — MIRRORED from W008's
 * EXTENSION_FLAVORS (declarative / ui / wasm / remote;
 * parity-pinned member-for-member). The isolation profile admits a
 * subset; a subject of a non-admitted flavor is a typed violation.
 */
export const SANDBOX_FLAVORS = ['declarative', 'ui', 'wasm', 'remote'] as const;

/** One sandbox flavor (the W008 grammar mirrored). */
export type SandboxFlavor = (typeof SANDBOX_FLAVORS)[number];

/**
 * The data-handling classification vocabulary — MIRRORED from W008's
 * DATA_HANDLING_CLASSIFICATIONS (sandbox-only / tenant-scoped /
 * external-transfer; parity-pinned member-for-member). The isolation
 * profile admits a subset (e.g. a tenant may forbid
 * external-transfer); a subject declaring a non-admitted
 * classification is a typed violation.
 */
export const SANDBOX_DATA_HANDLING = ['sandbox-only', 'tenant-scoped', 'external-transfer'] as const;

/** One sandbox data-handling classification (the W008 grammar mirrored). */
export type SandboxDataHandling = (typeof SANDBOX_DATA_HANDLING)[number];

/**
 * The sandbox resource-domain vocabulary — MIRRORED from W008's
 * RESOURCE_DOMAINS (world / evidence / storage / capability;
 * parity-pinned member-for-member).
 */
export const SANDBOX_RESOURCE_DOMAINS = ['world', 'evidence', 'storage', 'capability'] as const;

/** One sandbox resource domain (the W008 grammar mirrored). */
export type SandboxResourceDomain = (typeof SANDBOX_RESOURCE_DOMAINS)[number];

/**
 * The sandbox resource-access vocabulary — MIRRORED from W008's
 * RESOURCE_ACCESSES (read / append / write / invoke; parity-pinned
 * member-for-member).
 */
export const SANDBOX_RESOURCE_ACCESSES = ['read', 'append', 'write', 'invoke'] as const;

/** One sandbox resource access (the W008 grammar mirrored). */
export type SandboxResourceAccess = (typeof SANDBOX_RESOURCE_ACCESSES)[number];

/** One (resource, access) scope of a sandbox grant (the W008 shape mirrored). */
export interface SandboxResourceScope {
  readonly resource: SandboxResourceDomain;
  readonly access: SandboxResourceAccess;
}

/**
 * The CLOSED isolation-violation code vocabulary (every typed
 * rejection the isolation check can report):
 *
 * - `trust-class-exceeds-ceiling` — the subject's trust class is
 *   above the profile's maximum;
 * - `flavor-not-admitted` — the subject's flavor is outside the
 *   profile's admitted flavor set;
 * - `data-handling-not-admitted` — the subject declares a
 *   data-handling classification outside the admitted set;
 * - `grant-exceeds-trust-ceiling` — a grant exceeds the W008
 *   trust-class ceiling table (the mirrored W008 authority);
 * - `host-function-not-legal` — a grant names a host function
 *   outside the W008 host-function vocabulary;
 * - `resource-scope-not-legal` — a grant names a (resource, access)
 *   pair outside the W008 legal-scope table;
 * - `capability-binding-missing` — the subject has grants but no
 *   capability bindings to ground them;
 * - `listing-required` — the profile requires a marketplace listing
 *   reference and the subject carries none.
 */
export const ISOLATION_VIOLATION_CODES = [
  'trust-class-exceeds-ceiling',
  'flavor-not-admitted',
  'data-handling-not-admitted',
  'grant-exceeds-trust-ceiling',
  'host-function-not-legal',
  'resource-scope-not-legal',
  'capability-binding-missing',
  'listing-required',
] as const;

/** One isolation violation code. */
export type IsolationViolationCode = (typeof ISOLATION_VIOLATION_CODES)[number];

/**
 * The MIRRORED W008 host-function vocabulary (the closed v1 set) —
 * a grant naming anything else is the typed
 * `host-function-not-legal` violation.
 */
export const SANDBOX_HOST_FUNCTIONS = [
  'capability.invoke',
  'clock.read',
  'evidence.append',
  'log.write',
  'storage.read',
  'storage.write',
  'world.read',
] as const;

/**
 * The MIRRORED W008 trust-class grant-ceiling table: for every trust
 * class, the host functions and (resource, access) scopes a grant of
 * that class may lawfully carry. MIRRORED from
 * @epoch/extension-runtime's TRUST_CLASS_GRANT_CEILINGS (the SDK
 * authority W008 mirrors; this kernel mirrors W008) and pinned
 * member-for-member by the runtime parity test — never a runtime
 * dependency. The isolation check enforces it; the parity test also
 * proves verdict AGREEMENT with the REAL W008 grantExceedsCeiling.
 */
export interface SandboxGrantCeiling {
  readonly trustClass: string;
  readonly hostFunctions: readonly (typeof SANDBOX_HOST_FUNCTIONS)[number][];
  readonly resourceScopes: readonly SandboxResourceScope[];
}

/** The mirrored trust-class ceiling table (W008 parity-pinned). */
export const SANDBOX_GRANT_CEILINGS: readonly SandboxGrantCeiling[] = [
  {
    trustClass: 't0',
    hostFunctions: ['clock.read', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't1',
    hostFunctions: ['clock.read', 'evidence.append', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't2',
    hostFunctions: [
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'world.read',
    ],
    resourceScopes: [
      { resource: 'capability', access: 'invoke' },
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't3',
    hostFunctions: [
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
    ],
    resourceScopes: [
      { resource: 'capability', access: 'invoke' },
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
      { resource: 'storage', access: 'write' },
    ],
  },
  {
    trustClass: 't4',
    hostFunctions: [
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
    ],
    resourceScopes: [
      { resource: 'capability', access: 'invoke' },
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
      { resource: 'storage', access: 'write' },
    ],
  },
];

/**
 * The MIRRORED W008 legal (resource, access) scope table — a grant
 * naming an illegal pair is the typed `resource-scope-not-legal`
 * violation.
 */
export const SANDBOX_LEGAL_RESOURCE_SCOPES: readonly SandboxResourceScope[] = [
  { resource: 'world', access: 'read' },
  { resource: 'evidence', access: 'append' },
  { resource: 'storage', access: 'read' },
  { resource: 'storage', access: 'write' },
  { resource: 'capability', access: 'invoke' },
];

// --------------------------------------------------------------------------------
// The security-health vocabulary.
// --------------------------------------------------------------------------------

/**
 * The closed security-health status vocabulary (the derived
 * projection over the metrics fold): `healthy` — no critical
 * violations; `degraded` — critical violations reached the policy's
 * degraded threshold; `critical` — critical violations reached the
 * policy's critical threshold OR any subject is quarantined
 * (deny-by-default trips the highest state).
 */
export const SECURITY_HEALTH_STATUSES = ['healthy', 'degraded', 'critical'] as const;

/** One security-health status. */
export type SecurityHealthStatus = (typeof SECURITY_HEALTH_STATUSES)[number];

// --------------------------------------------------------------------------------
// The audit-finding vocabulary (the audit families' typed findings).
// --------------------------------------------------------------------------------

/**
 * The closed audit-finding code vocabulary:
 *
 * - `cross-tenant-breach` — a tenant-boundary observation whose
 *   subject and actor tenants DISAGREE and whose outcome is not
 *   `denied` (the R12 invariant failed — this is the audit the
 *   tenant-isolation boundary claims to enforce);
 * - `projection-identity-fork` — a W041 access projection whose
 *   record id or content digest does not match its canonical record
 *   (projections never mint identities);
 * - `projection-path-overlap` — a path both released AND redacted
 *   (every field is exactly one of the two);
 * - `projection-decision-missing` — a released projection with no
 *   authorization-decision digest reference;
 * - `projection-policy-missing` — a projection with no policy
 *   revision reference.
 */
export const AUDIT_FINDING_CODES = [
  'cross-tenant-breach',
  'projection-identity-fork',
  'projection-path-overlap',
  'projection-decision-missing',
  'projection-policy-missing',
] as const;

/** One audit-finding code. */
export type AuditFindingCode = (typeof AUDIT_FINDING_CODES)[number];

// --------------------------------------------------------------------------------
// The quarantine vocabulary.
// --------------------------------------------------------------------------------

/**
 * The closed quarantine vocabulary: a quarantine fact is imposed
 * (deny-by-default from that instant on) and released (explicit,
 * authorization-gated; never silent). There is no third state and no
 * mutation: corrections are new facts.
 */
export const QUARANTINE_FACT_KINDS = ['quarantine-imposed', 'quarantine-released'] as const;

/** One quarantine fact kind. */
export type QuarantineFactKind = (typeof QUARANTINE_FACT_KINDS)[number];

// --------------------------------------------------------------------------------
// Event discriminators (the W010 open-namespace payload families).
// --------------------------------------------------------------------------------

/** The complete closed discriminator vocabulary of the security events. */
export const SECURITY_EVENT_DISCRIMINATORS = [
  'security:policy-registered',
  'security:observation-recorded',
  'security:violation-detected',
  'security:quarantine-imposed',
  'security:quarantine-released',
  'security:health-projected',
  'security:audit-recorded',
] as const;

/** One security event discriminator. */
export type SecurityEventDiscriminator = (typeof SECURITY_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Deterministic stream-id derivation.
// --------------------------------------------------------------------------------

/** The slug suffix of a kind-prefixed id (the segment after `:`; empty if absent). */
function idSuffixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(separator + 1);
}

/** Normalize a subject/tenant suffix into a stream-safe slug (deterministic, bounded). */
function streamSlugOf(id: string): string {
  return idSuffixOf(id)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Derive the security stream id of one observed subject (deterministic). */
export function securityStreamIdOf(subjectId: string): string {
  return `stream:security-${streamSlugOf(subjectId)}`;
}

/** Derive the tenant-level host stream id (deterministic). */
export function securityHostStreamIdOf(tenantId: string): string {
  return `stream:security-host-${streamSlugOf(tenantId)}`;
}

/** The kind prefix of an observability opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}
