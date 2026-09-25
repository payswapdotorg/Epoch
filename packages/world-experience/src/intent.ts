/**
 * The world-subset interaction-intent vocabulary (R27/R30 — binding):
 * typed, versioned, discriminated unions covering the universal
 * interactions whose home is the interactive world view: select, inspect,
 * measure, move, rotate, zoom, isolate, hide, show, compare, annotate,
 * simulate, change, connect, disconnect, filter, query, branch, replay,
 * pause, resume, follow-agent.
 *
 * The action/collaboration interactions (approve, reject, execute,
 * take-control, release-control) belong to the action and collaboration
 * surfaces and are deliberately absent from this subset.
 *
 * Dynamic UI law (binding): intents are TYPED DATA, never arbitrary
 * executable UI code. Admission enforces this with a dedicated
 * `executable-ui-rejected` gate that runs BEFORE schema validation, so an
 * intent smuggling script/code/bytecode content is distinguishable from a
 * generically malformed intent (the negative-class evidence the Dynamic
 * UI law requires).
 *
 * Every intent bridges to a W011 ControlIntent (qualified id +
 * semver core — shape-identical to the action-protocol
 * ActionTypeReference) via {@link controlIntentOf}, so compiling a world
 * intent into a W013 submit-intent envelope needs no translation layer.
 */
import { z } from 'zod';
import { AgentIdSchema, JsonValueSchema, type AgentId, type JsonValue } from '@epoch/agent-protocol';
import {
  QuaternionSchema,
  Sha256HexSchema,
  Vec3Schema,
  type ControlIntent,
  type Quaternion,
  type Vec3,
} from '@epoch/experience-protocol';
import {
  MAX_FILTER_ENTITY_IDS,
  WORLD_INTENT_SCHEMA_NAME,
  WORLD_INTENT_TYPE_NAMESPACE,
  WORLD_INTENT_TYPE_VERSION,
  WORLD_INTENT_VERSION,
  WorldInteractionKindSchema,
  type WorldInteractionKind,
} from './version';
import {
  WorldEntityIdSchema,
  WorldInvocationIdSchema,
  OpaqueScopeIdSchema,
  WorldVirtualTimeMsSchema,
  type WorldEntityId,
  type WorldInvocationId,
  type OpaqueScopeId,
} from './primitives';
import {
  executableUiRejectedError,
  invalidIntentError,
  versionUnsupportedError,
} from './issues';
import type { WorldExperienceResult } from './errors';

// ---------------------------------------------------------------------------
// The intent union (discriminated on `kind`; versioned by intentVersion).
// ---------------------------------------------------------------------------

/** Sorted, duplicate-free entity-id set (deterministic set semantics). */
const EntityIdSet = z
  .array(WorldEntityIdSchema)
  .min(1)
  .max(MAX_FILTER_ENTITY_IDS)
  .refine(
    (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
    'entity id sets must be sorted ascending and duplicate-free (deterministic set semantics)',
  );

const SelectIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('select'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
  })
  .meta({ id: 'SelectIntent', title: 'SelectIntent' });

const InspectIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('inspect'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
  })
  .meta({ id: 'InspectIntent', title: 'InspectIntent' });

const MeasureIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('measure'),
    intentId: WorldInvocationIdSchema,
    fromEntityId: WorldEntityIdSchema,
    toEntityId: WorldEntityIdSchema,
  })
  .meta({ id: 'MeasureIntent', title: 'MeasureIntent' });

const MoveIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('move'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
    delta: Vec3Schema,
  })
  .meta({ id: 'MoveIntent', title: 'MoveIntent' });

const RotateIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('rotate'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
    delta: QuaternionSchema,
  })
  .meta({ id: 'RotateIntent', title: 'RotateIntent' });

const ZoomIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('zoom'),
    intentId: WorldInvocationIdSchema,
    factor: z.number().finite().positive(),
  })
  .meta({ id: 'ZoomIntent', title: 'ZoomIntent' });

const IsolateIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('isolate'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
  })
  .meta({ id: 'IsolateIntent', title: 'IsolateIntent' });

const HideIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('hide'),
    intentId: WorldInvocationIdSchema,
    entityIds: EntityIdSet,
  })
  .meta({ id: 'HideIntent', title: 'HideIntent' });

const ShowIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('show'),
    intentId: WorldInvocationIdSchema,
    entityIds: EntityIdSet,
  })
  .meta({ id: 'ShowIntent', title: 'ShowIntent' });

const CompareIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('compare'),
    intentId: WorldInvocationIdSchema,
    leftEntityId: WorldEntityIdSchema,
    rightEntityId: WorldEntityIdSchema,
  })
  .meta({ id: 'CompareIntent', title: 'CompareIntent' });

const AnnotateIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('annotate'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
    text: z.string().min(1).max(2048),
    evidenceDigests: z
      .array(Sha256HexSchema)
      .max(32)
      .refine(
        (digests) => digests.every((d, i) => i === 0 || d > digests[i - 1]),
        'evidence digests must be sorted ascending and duplicate-free (deterministic set semantics)',
      )
      .optional(),
  })
  .meta({ id: 'AnnotateIntent', title: 'AnnotateIntent' });

const SimulateIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('simulate'),
    intentId: WorldInvocationIdSchema,
    scenarioRef: OpaqueScopeIdSchema,
  })
  .meta({ id: 'SimulateIntent', title: 'SimulateIntent' });

const ChangeIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('change'),
    intentId: WorldInvocationIdSchema,
    entityId: WorldEntityIdSchema,
    propertyPath: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/),
    value: JsonValueSchema,
  })
  .meta({ id: 'ChangeIntent', title: 'ChangeIntent' });

const ConnectIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('connect'),
    intentId: WorldInvocationIdSchema,
    fromEntityId: WorldEntityIdSchema,
    toEntityId: WorldEntityIdSchema,
  })
  .meta({ id: 'ConnectIntent', title: 'ConnectIntent' });

const DisconnectIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('disconnect'),
    intentId: WorldInvocationIdSchema,
    fromEntityId: WorldEntityIdSchema,
    toEntityId: WorldEntityIdSchema,
  })
  .meta({ id: 'DisconnectIntent', title: 'DisconnectIntent' });

const FilterIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('filter'),
    intentId: WorldInvocationIdSchema,
    includeEntityIds: EntityIdSet,
  })
  .meta({ id: 'FilterIntent', title: 'FilterIntent' });

const QueryIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('query'),
    intentId: WorldInvocationIdSchema,
    text: z.string().min(1).max(1024),
  })
  .meta({ id: 'QueryIntent', title: 'QueryIntent' });

const BranchIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('branch'),
    intentId: WorldInvocationIdSchema,
    atMs: WorldVirtualTimeMsSchema,
  })
  .meta({ id: 'BranchIntent', title: 'BranchIntent' });

const ReplayIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('replay'),
    intentId: WorldInvocationIdSchema,
    fromMs: WorldVirtualTimeMsSchema,
  })
  .meta({ id: 'ReplayIntent', title: 'ReplayIntent' });

const PauseIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('pause'),
    intentId: WorldInvocationIdSchema,
  })
  .meta({ id: 'PauseIntent', title: 'PauseIntent' });

const ResumeIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('resume'),
    intentId: WorldInvocationIdSchema,
  })
  .meta({ id: 'ResumeIntent', title: 'ResumeIntent' });

const FollowAgentIntentSchema = z
  .strictObject({
    schema: z.literal(WORLD_INTENT_SCHEMA_NAME),
    intentVersion: z.literal(WORLD_INTENT_VERSION),
    kind: z.literal('follow-agent'),
    intentId: WorldInvocationIdSchema,
    agentId: AgentIdSchema,
  })
  .meta({ id: 'FollowAgentIntent', title: 'FollowAgentIntent' });

/** The world interaction-intent union (discriminated on `kind`). */
export const WorldInteractionIntentSchema = z
  .discriminatedUnion('kind', [
    SelectIntentSchema,
    InspectIntentSchema,
    MeasureIntentSchema,
    MoveIntentSchema,
    RotateIntentSchema,
    ZoomIntentSchema,
    IsolateIntentSchema,
    HideIntentSchema,
    ShowIntentSchema,
    CompareIntentSchema,
    AnnotateIntentSchema,
    SimulateIntentSchema,
    ChangeIntentSchema,
    ConnectIntentSchema,
    DisconnectIntentSchema,
    FilterIntentSchema,
    QueryIntentSchema,
    BranchIntentSchema,
    ReplayIntentSchema,
    PauseIntentSchema,
    ResumeIntentSchema,
    FollowAgentIntentSchema,
  ])
  .meta({
    id: 'WorldInteractionIntent',
    title: 'WorldInteractionIntent',
    description:
      'One world-subset interaction intent: typed, versioned data (never executable UI code) covering select/inspect/measure/move/rotate/zoom/isolate/hide/show/compare/annotate/simulate/change/connect/disconnect/filter/query/branch/replay/pause/resume/follow-agent.',
  });

/** One world interaction intent. */
export type WorldInteractionIntent = z.infer<typeof WorldInteractionIntentSchema>;

// ---------------------------------------------------------------------------
// The Dynamic UI law: executable-content scan (key-based, recursive).
// ---------------------------------------------------------------------------

/**
 * Key segments that denote EXECUTABLE UI content. Any intent payload key
 * (at any depth) whose hyphen/dot/underscore-separated tokens contain one
 * of these segments is rejected with the dedicated `executable-ui-rejected`
 * error — the Dynamic UI law keeps agent-emitted intents typed data only.
 */
export const EXECUTABLE_UI_KEY_SEGMENTS = [
  'bytecode',
  'code',
  'eval',
  'executable',
  'expression',
  'function',
  'html',
  'javascript',
  'js',
  'lambda',
  'module',
  'script',
  'wasm',
] as const;

/** One executable-content violation found by the scan. */
export interface ExecutableUiViolation {
  readonly path: readonly (string | number)[];
  readonly offendingKey: string;
}

function keyOffends(key: string): boolean {
  const tokens = key.toLowerCase().split(/[-_.]/);
  return tokens.some((token) =>
    (EXECUTABLE_UI_KEY_SEGMENTS as readonly string[]).includes(token),
  );
}

function scanValue(
  value: unknown,
  path: readonly (string | number)[],
  violations: ExecutableUiViolation[],
  depth: number,
): void {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      scanValue(value[i], [...path, i], violations, depth + 1);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keyOffends(key)) {
      violations.push({ path: [...path, key], offendingKey: key });
    }
    scanValue(child, [...path, key], violations, depth + 1);
  }
}

/**
 * Scan a raw intent payload for executable UI content (recursive,
 * key-based — the W012 vendor-field-scan discipline applied to the Dynamic
 * UI law). Returns every violation in deterministic discovery order.
 */
export function scanExecutableUiViolations(input: unknown): readonly ExecutableUiViolation[] {
  const violations: ExecutableUiViolation[] = [];
  scanValue(input, [], violations, 0);
  return violations;
}

// ---------------------------------------------------------------------------
// Total admission.
// ---------------------------------------------------------------------------

/**
 * The total admission surface for serialized world interaction intents.
 * Never throws. Admission precedence (fixed, so consumers branch
 * deterministically):
 *
 * 1. root shape — a non-object root is an `invalid-intent`;
 * 2. version gate — an `intentVersion` that differs from
 *    {@link WORLD_INTENT_VERSION} fails fast with `version-unsupported`;
 * 3. executable-UI gate — the Dynamic UI law: any payload key denoting
 *    executable content (script/code/bytecode/...) is rejected with
 *    `executable-ui-rejected` (checked BEFORE schema validation so the
 *    violation is distinguishable from generic malformation);
 * 4. schema gate — the strict discriminated union; failures surface as
 *    `invalid-intent` with precise dotted paths (strict objects also
 *    reject unknown/vendor fields here).
 */
export function admitWorldIntent(input: unknown): WorldExperienceResult<WorldInteractionIntent> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: invalidIntentError([{ path: '$', message: 'expected a JSON object at the intent root' }]) };
  }
  const encountered = (input as Record<string, unknown>).intentVersion;
  if (
    typeof encountered === 'number' ||
    typeof encountered === 'string'
  ) {
    const encounteredNumber = typeof encountered === 'number' ? encountered : Number(encountered);
    if (encounteredNumber !== WORLD_INTENT_VERSION) {
      return {
        ok: false,
        error: versionUnsupportedError(String(WORLD_INTENT_VERSION), String(encountered)),
      };
    }
  }
  const violations = scanExecutableUiViolations(input);
  if (violations.length > 0) {
    const first = violations[0];
    return {
      ok: false,
      error: executableUiRejectedError(first.offendingKey, first.path),
    };
  }
  const parsed = WorldInteractionIntentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: invalidIntentError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

// ---------------------------------------------------------------------------
// The ControlIntent bridge (R30).
// ---------------------------------------------------------------------------

/**
 * The typed ControlIntent one world interaction maps to (qualified id in
 * the `epoch.world.interaction` namespace plus semver core —
 * shape-identical to the action-protocol ActionTypeReference, so the
 * future control-to-proposal wiring through the Action Gateway needs no
 * translation layer).
 */
export function controlIntentOf(intent: WorldInteractionIntent): ControlIntent {
  return {
    id: `${WORLD_INTENT_TYPE_NAMESPACE}.${intent.kind}`,
    version: WORLD_INTENT_TYPE_VERSION,
  };
}

/** The qualified ControlIntent id of one interaction kind. */
export function controlIntentIdOf(kind: WorldInteractionKind): string {
  return `${WORLD_INTENT_TYPE_NAMESPACE}.${kind}`;
}

/** Validate a bare interaction kind string against the closed vocabulary. */
export function isWorldInteractionKind(value: unknown): value is WorldInteractionKind {
  return WorldInteractionKindSchema.safeParse(value).success;
}

/** Exported for the schema surface registry / consumers (type-level only). */
export type IntentJsonValue = JsonValue;
export type IntentVec3 = Vec3;
export type IntentQuaternion = Quaternion;
export type IntentEntityId = WorldEntityId;
export type IntentAgentId = AgentId;
export type IntentScopeId = OpaqueScopeId;
export type IntentId = WorldInvocationId;
