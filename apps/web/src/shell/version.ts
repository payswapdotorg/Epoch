/**
 * @epoch/web shell contract versions and closed vocabularies (W014).
 *
 * The shell is COMPOSITION, not authority (architecture lock rules 8/16):
 * navigation, layout, providers, and route wiring live here; ALL domain and
 * experience semantics arrive through typed contracts owned by upstream
 * packages. This file declares the shell's OWN vocabulary and MIRRORS the
 * upstream vocabularies the shell consumes — the mirrors are self-contained
 * in shell source (zero runtime coupling; the W007 semver-duplication
 * policy) and drift-pinned by compile/runtime parity tests against the
 * devDependency references (`src/shell/parity.test.ts`):
 *
 * - tenancy id patterns      <- @epoch/tenancy (W009)
 * - principal vocabulary     <- @epoch/identity (W009)
 * - denial-code vocabulary   <- @epoch/authorization (W009)
 * - experience graph kinds   <- @epoch/experience-protocol (W011) and the
 *                               compile table of @epoch/experience-compiler
 *                               (W012)
 *
 * Versioning policy (v1, the kernel discipline): every serialized shell
 * record carries `schemaVersion: 1` exactly; skew is a typed `validation`
 * rejection before any other diagnostic.
 */

/** Version of the shell contract surface (this module's public types). */
export const SHELL_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized shell record. */
export const SHELL_RECORD_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Tenant-scope identity (mirrors @epoch/tenancy — parity-pinned).
// ---------------------------------------------------------------------------

/** Opaque tenant identity `tenant:<slug>` (structural mirror of @epoch/tenancy `TenantId`). */
export type TenantId = string;

/** Opaque workspace identity `workspace:<slug>` (mirror of @epoch/tenancy `WorkspaceId`). */
export type WorkspaceId = string;

/** Opaque project identity `project:<slug>` (mirror of @epoch/tenancy `ProjectId`). */
export type ProjectId = string;

/** Opaque tenant identity pattern `tenant:<slug>` (mirrors @epoch/tenancy). */
export const TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque workspace identity `workspace:<slug>` (mirrors @epoch/tenancy). */
export const WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque project identity `project:<slug>` (mirrors @epoch/tenancy). */
export const PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;

// ---------------------------------------------------------------------------
// Principal identity (mirrors @epoch/identity — parity-pinned).
// ---------------------------------------------------------------------------

/** The principal kinds (mirrors @epoch/identity). */
export const PRINCIPAL_KINDS = ['human', 'agent', 'service'] as const;

/** One principal kind. */
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/** The principal lifecycle states (mirror @epoch/identity; @epoch/authorization projects them as statuses). */
export const PRINCIPAL_STATUSES = ['active', 'suspended', 'deactivated'] as const;

/** One principal status (caller-supplied fact; mirrors @epoch/authorization `PrincipalStatus`). */
export type PrincipalStatus = (typeof PRINCIPAL_STATUSES)[number];

/** Opaque principal identity `principal:<slug>` (mirrors @epoch/identity). */
export const PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

// ---------------------------------------------------------------------------
// Session vocabulary (shell-owned).
// ---------------------------------------------------------------------------

/** Opaque reference-session identity `session:<slug>`. */
export const SESSION_ID_PATTERN = /^session:[a-z0-9][a-z0-9-]{0,62}$/;

/** The typed session states of the in-memory reference session. */
export const SESSION_STATES = ['anonymous', 'active', 'suspended', 'expired'] as const;

/** One session state. */
export type SessionState = (typeof SESSION_STATES)[number];

// ---------------------------------------------------------------------------
// Navigation vocabulary (shell-owned + mirrored authorization denials).
// ---------------------------------------------------------------------------

/**
 * The canonical Solution Navigator stages (spec/solution-navigator-
 * architecture.md, binding): the universal lifecycle in canonical order.
 * The shell's built-in route registry declares exactly one route per stage.
 */
export const NAVIGATOR_STAGES = [
  'understand',
  'decide',
  'plan',
  'acquire',
  'realize',
  'observe',
  'verify',
  'forecast',
  'close',
  'learn',
] as const;

/** One Solution Navigator lifecycle stage. */
export type NavigatorStage = (typeof NAVIGATOR_STAGES)[number];

/** Opaque route identity `route:<slug>`. */
export const ROUTE_ID_PATTERN = /^route:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Route paths the shell wires into the App Router in v1: the root path or a
 * single lowercase kebab segment (e.g. `/`, `/understand`). Multi-segment
 * paths are a versioned extension.
 */
export const ROUTE_PATH_PATTERN = /^\/(?:[a-z0-9][a-z0-9-]{0,62})?$/;

/**
 * The shell's closed permission vocabulary for navigation gating. `navigator:
 * read` gates the lifecycle stage routes. The vocabulary grows only through
 * a versioned change to this contract (later waves contribute stages of
 * their own).
 */
export const SHELL_PERMISSIONS = ['navigator:read'] as const;

/** One shell permission. */
export type ShellPermission = (typeof SHELL_PERMISSIONS)[number];

/**
 * The typed navigation-denial taxonomy (fail-closed). The first three codes
 * are SHELL-OWNED (registry/permission concerns); the last three MIRROR
 * @epoch/authorization's `DENIAL_CODES` (parity-pinned subset) so navigation
 * denials speak the platform's authorization vocabulary wherever the
 * semantics coincide. The authorization decision point itself remains
 * @epoch/authorization's authority — the shell's gate is a projection-level
 * reference check over caller-supplied typed facts, not a second decision
 * point.
 */
export const NAVIGATION_DENIAL_CODES = [
  'unknown-route',
  'malformed-route',
  'insufficient-permissions',
  'cross-tenant-denied',
  'unauthenticated-principal',
  'inactive-principal',
] as const;

/** One typed navigation denial code. */
export type NavigationDenialCode = (typeof NAVIGATION_DENIAL_CODES)[number];

/** The denial codes mirrored from @epoch/authorization (parity-pinned). */
export const MIRRORED_AUTHORIZATION_DENIAL_CODES = [
  'cross-tenant-denied',
  'unauthenticated-principal',
  'inactive-principal',
] as const;

// ---------------------------------------------------------------------------
// Frame regions + mounting points (shell-owned).
// ---------------------------------------------------------------------------

/** The frame regions of the app shell layout. */
export const SHELL_REGION_IDS = ['header', 'navigation', 'content', 'status'] as const;

/** One frame region id. */
export type ShellRegionId = (typeof SHELL_REGION_IDS)[number];

/** The kinds of mounting points the shell exposes. */
export const SHELL_MOUNT_KINDS = ['region', 'experience'] as const;

/** One mounting-point kind. */
export type ShellMountKind = (typeof SHELL_MOUNT_KINDS)[number];

/**
 * The Experience mounting slots (spec/experience-architecture.md, binding):
 * the shell exposes typed mount slots for the scene surface, the
 * narrative/status surface, and the candidate/action controls — as
 * placeholders that later waves fill (W013 renderer wiring, W016 interactive
 * UX). The shell never RUNS an experience; it HOSTS the projection surface.
 */
export const EXPERIENCE_SLOT_IDS = ['scene', 'narrative', 'controls'] as const;

/** One Experience mounting slot id. */
export type ExperienceSlotId = (typeof EXPERIENCE_SLOT_IDS)[number];

/**
 * The Experience Graph kinds (mirrors @epoch/experience-protocol —
 * parity-pinned). The shell never interprets graph content; it only routes
 * graphs of a kind to the slot that hosts that kind of projection.
 */
export const EXPERIENCE_GRAPH_KINDS = [
  '2d',
  '3d',
  'animation',
  'narrative',
  'timeline-replay',
  'presence',
  'controls',
] as const;

/** One Experience Graph kind (mirror of @epoch/experience-protocol). */
export type ExperienceGraphKind = (typeof EXPERIENCE_GRAPH_KINDS)[number];

/**
 * Which Experience Graph kinds each slot hosts — a disjoint partition of
 * {@link EXPERIENCE_GRAPH_KINDS}: the scene surface hosts every spatial/
 * visual presentation (2D, 3D, animation, timeline/replay position, and
 * presence overlays); the narrative surface hosts narrative/status blocks;
 * the controls surface hosts candidate/action controls. Pinned as a total
 * partition by parity tests.
 */
export const EXPERIENCE_SLOT_GRAPH_KINDS: Readonly<
  Record<ExperienceSlotId, readonly ExperienceGraphKind[]>
> = {
  scene: ['2d', '3d', 'animation', 'timeline-replay', 'presence'],
  narrative: ['narrative'],
  controls: ['controls'],
};

/** Opaque mounting-point identity `mount:<slug>`. */
export const MOUNT_ID_PATTERN = /^mount:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque feature identity `feature:<slug>` (features are W015/W016/W023 property). */
export const FEATURE_ID_PATTERN = /^feature:[a-z0-9][a-z0-9-]{0,62}$/;

/** Semantic version core `x.y.z` for feature descriptors. */
export const SEMVER_CORE_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;

// ---------------------------------------------------------------------------
// Boundary vocabulary (shell-owned).
// ---------------------------------------------------------------------------

/** The typed shell-boundary states (error/loading boundaries as typed data). */
export const SHELL_BOUNDARY_STATES = ['loading', 'empty', 'failed', 'degraded'] as const;

/** One shell boundary state kind. */
export type ShellBoundaryStateKind = (typeof SHELL_BOUNDARY_STATES)[number];
