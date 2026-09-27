/**
 * The Scenario DSL (typed, zod): declarative, content-addressed scenario
 * definitions — the generalization of the W031 reference-slice pattern.
 *
 * A scenario declares:
 *   - ACTORS (principals and tenants, W009 grammar);
 *   - FIXTURES (named, deterministic JSON payloads — solutions, programs,
 *     observations, packs, acquisition chains...; the DRIVER interprets
 *     them against the real kernels);
 *   - a SEQUENCE of typed STEPS: each step is either a CALL (a kernel
 *     operation, dispatched through the driver, with a routing class and
 *     a declared expectation) or an ASSERT (an invariant-library check
 *     over the accumulated execution prefix);
 *   - an IDENTITY MAP (canonical ids that must be preserved across
 *     declared projection surfaces);
 *   - the EXPECTED INVARIANTS (scenario-level checks from the invariant
 *     library).
 *
 * Scenarios are content-addressed records: `scenarioDigest` is the SHA-256
 * of the canonical JSON serialization, and the serialization round-trips
 * (`serializeScenario` / `deserializeScenario` verify it).
 */
import { z } from 'zod';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';

/** Versions this engine's records carry. */
export const SCENARIO_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Actors.
// --------------------------------------------------------------------------------

/** One declared actor of a scenario (a tenant or a principal of a tenant). */
export const ScenarioActorSchema = z
  .object({
    actorId: z.string().min(1),
    kind: z.enum(['tenant', 'principal']),
    tenantId: TenantIdSchema,
    role: z.string().min(1).optional(),
  })
  .strict();
export type ScenarioActor = z.infer<typeof ScenarioActorSchema>;

// --------------------------------------------------------------------------------
// Fixtures.
// --------------------------------------------------------------------------------

/**
 * One deterministic fixture: a named JSON payload of an open `kind`
 * vocabulary (e.g. 'solution-version', 'program-of-work', 'observation',
 * 'pack-profile'...). Fixtures are DATA; the driver builds real kernel
 * records from them through the kernels' own admission paths.
 */
export const ScenarioFixtureSchema = z
  .object({
    fixtureId: z.string().min(1),
    kind: z.string().min(1),
    label: z.string().min(1).optional(),
    content: z.custom<JsonValue>((value) => isJsonValue(value), {
      message: 'fixture content must be a JSON value',
    }),
  })
  .strict();
export type ScenarioFixture = z.infer<typeof ScenarioFixtureSchema>;

// --------------------------------------------------------------------------------
// Steps.
// --------------------------------------------------------------------------------

/**
 * The routing class of a call step — what boundary the call crosses:
 *
 * - 'public-api'           — the normal kernel admission path;
 * - 'cross-tenant-attempt' — a foreign-tenant actor attempts a home-tenant
 *                            boundary (must be DENIED, R12);
 * - 'direct-write-attempt' — an attempt to write kernel state outside the
 *                            admission path (must be REJECTED — authority
 *                            routing);
 * - 'adapter-seam'         — an external-provider boundary exercised
 *                            through a real adapter's fixture-driven
 *                            reference behavior.
 */
export const StepRouteSchema = z.enum([
  'public-api',
  'cross-tenant-attempt',
  'direct-write-attempt',
  'adapter-seam',
]);
export type StepRoute = z.infer<typeof StepRouteSchema>;

/** The declared expectation for a call step's outcome. */
export const StepExpectationSchema = z.enum(['ok', 'denied', 'authority-rejected', 'rejected']);
export type StepExpectation = z.infer<typeof StepExpectationSchema>;

/** A CALL step: one kernel operation dispatched through the driver. */
export const CallStepSchema = z
  .object({
    stepId: z.string().min(1),
    kind: z.literal('call'),
    driverOp: z.string().min(1),
    label: z.string().min(1).optional(),
    actorId: z.string().min(1),
    route: StepRouteSchema,
    input: z.custom<JsonValue>((value) => isJsonValue(value), {
      message: 'step input must be a JSON value',
    }),
    expect: StepExpectationSchema.default('ok'),
    expectedErrorCode: z.string().min(1).optional(),
  })
  .strict();
export type CallStep = z.infer<typeof CallStepSchema>;

/**
 * An ASSERT step: an invariant-library check evaluated over the execution
 * prefix accumulated so far (the scenario's inline checkpoint form).
 */
export const AssertStepSchema = z
  .object({
    stepId: z.string().min(1),
    kind: z.literal('assert'),
    invariant: z.string().min(1),
    label: z.string().min(1).optional(),
    argument: z.custom<JsonValue>((value) => isJsonValue(value), {
      message: 'assert argument must be a JSON value',
    }),
    expect: z.literal('satisfied').default('satisfied'),
  })
  .strict();
export type AssertStep = z.infer<typeof AssertStepSchema>;

/** One step of a scenario's sequence (discriminated on `kind`). */
export const ScenarioStepSchema = z.discriminatedUnion('kind', [CallStepSchema, AssertStepSchema]);
export type ScenarioStep = z.infer<typeof ScenarioStepSchema>;

// --------------------------------------------------------------------------------
// Identity map + expected invariants.
// --------------------------------------------------------------------------------

/**
 * One identity-preservation binding: `canonicalId` must be reported (by
 * the driver, from the REAL kernel records) on EVERY declared surface.
 */
export const IdentityBindingSchema = z
  .object({
    canonicalId: z.string().min(1),
    surfaces: z.array(z.string().min(1)).min(2),
    note: z.string().min(1).optional(),
  })
  .strict();
export type IdentityBinding = z.infer<typeof IdentityBindingSchema>;

/** One scenario-level invariant expectation. */
export const InvariantExpectationSchema = z
  .object({
    invariant: z.string().min(1),
    argument: z.custom<JsonValue>((value) => isJsonValue(value), {
      message: 'invariant argument must be a JSON value',
    }).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();
export type InvariantExpectation = z.infer<typeof InvariantExpectationSchema>;

// --------------------------------------------------------------------------------
// The scenario record.
// --------------------------------------------------------------------------------

/** The complete, typed, declarative scenario definition. */
export const ScenarioDefinitionSchema = z
  .object({
    schemaVersion: z.literal(SCENARIO_RECORD_VERSION),
    scenarioId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    tenantId: TenantIdSchema,
    actors: z.array(ScenarioActorSchema).min(1),
    fixtures: z.array(ScenarioFixtureSchema),
    steps: z.array(ScenarioStepSchema).min(1),
    identityMap: z.array(IdentityBindingSchema).default([]),
    invariants: z.array(InvariantExpectationSchema).min(1),
  })
  .strict();
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

/** A typed scenario parse failure (issues are values, never exceptions). */
export interface ScenarioParseError {
  readonly code: 'scenario-parse-failed';
  readonly message: string;
  readonly issues: readonly { readonly path: string; readonly message: string }[];
}

/** Total parse: unknown input -> typed scenario or a typed parse failure. */
export function parseScenario(input: unknown):
  | { ok: true; value: ScenarioDefinition }
  | { ok: false; error: ScenarioParseError } {
  const parsed = ScenarioDefinitionSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    error: {
      code: 'scenario-parse-failed',
      message: 'the scenario definition does not conform to the Scenario DSL',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
        message: issue.message,
      })),
    },
  };
}

// --------------------------------------------------------------------------------
// Content addressing: digest-stable serialization + round-trip.
// --------------------------------------------------------------------------------

/**
 * The digest-stable content projection of a scenario: the exact record the
 * digest is taken over (already-parsed, canonical-serializable JSON).
 */
export function scenarioContent(scenario: ScenarioDefinition): JsonValue {
  return ScenarioDefinitionSchema.parse(scenario) as unknown as JsonValue;
}

/** The canonical SHA-256 content digest of a scenario (content addressing). */
export function scenarioDigest(scenario: ScenarioDefinition): string {
  return canonicalDigest(scenarioContent(scenario));
}

/** Canonical JSON serialization (byte-identical for equal scenarios). */
export function serializeScenario(scenario: ScenarioDefinition): string {
  return canonicalJsonStringify(scenarioContent(scenario));
}

export interface DeserializedScenario {
  readonly scenario: ScenarioDefinition;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/**
 * Deserialize + digest-verify a serialized scenario (the round-trip gate:
 * the parsed record's recomputed digest must equal the claimed digest).
 */
export function deserializeScenario(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedScenario }
  | { ok: false; error: ScenarioParseError | { code: 'scenario-digest-mismatch'; message: string } } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: { code: 'scenario-parse-failed', message: `invalid scenario JSON: ${(err as Error).message}`, issues: [] },
    };
  }
  const parsed = parseScenario(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const recomputed = scenarioDigest(parsed.value);
  return {
    ok: true,
    value: { scenario: parsed.value, claimedDigest, digestVerifies: recomputed === claimedDigest },
  };
}

// --------------------------------------------------------------------------------
// Internals.
// --------------------------------------------------------------------------------

/** Runtime JSON-value type guard (fixture/step payloads). */
function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return typeof value !== 'number' || Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }
  if (typeof value === 'object') {
    return Object.values(value).every((entry) => isJsonValue(entry));
  }
  return false;
}
