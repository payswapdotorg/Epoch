/**
 * @epoch/simulation-fabric — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics (vendor names, grid/cloud endpoints,
 * engine hints) AND structural copies of foreign records (W007 capability
 * descriptors embedded instead of referenced) cannot enter kernel types
 * through the fabric door (same policy as the W002-W020 validators).
 * Every exported schema is part of the published surface emitted under
 * `schemas/`.
 *
 * Runtime vocabulary composition (the W021 dependency policy):
 * - invocation/simulator references, failures, requests and registrations
 *   use @epoch/simulation-protocol's validators directly (W005 grammar —
 *   genuine runtime composition; the ONLY upstream simulation authority);
 * - timestamps use @epoch/agent-protocol's `TimestampSchema`;
 * - tenant ids use @epoch/tenancy's `TenantIdSchema` (W009 grammar);
 * - the W010 event, W007 capability, W006 evidence/verification and
 *   authorization vocabularies are MIRRORED structurally and pinned by
 *   devDependency parity (src/kernel-parity.ts + the parity tests) —
 *   never runtime deps.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  InvocationReferenceSchema,
  SimulationFailureSchema,
  SimulationInvocationRequestSchema,
  SimulationResultSchema,
  SimulatorReferenceSchema,
  SimulatorRegistrationSchema,
} from '@epoch/simulation-protocol';
import {
  CAPABILITY_BINDING_ID_PATTERN,
  SEMVER_CORE_PATTERN,
  SIMULATION_EVENT_DISCRIMINATORS,
  SIMULATION_FABRIC_RECORD_VERSION,
  SIMULATION_IDEMPOTENCY_KEY_PATTERN,
  SIMULATION_JOB_ID_PATTERN,
  SIMULATION_PRINCIPAL_ID_PATTERN,
  SIMULATION_RUN_ID_PATTERN,
  SIMULATION_RUN_STATUSES,
  RUN_TRANSITION_CAUSES,
} from './version';
import { SHA256_HEX_PATTERN, SealedSimulationEventSchema } from './events';

/** Version discriminator on serialized fabric records (v1). */
export const SimulationFabricRecordVersionSchema = z
  .literal(SIMULATION_FABRIC_RECORD_VERSION)
  .meta({
    id: 'SimulationFabricRecordVersion',
    title: 'SimulationFabricRecordVersion',
    description:
      'Version discriminator carried by every serialized simulation-fabric record and snapshot (currently 1).',
  });

/** One run lifecycle status (the closed W021 vocabulary). */
export const SimulationRunStatusSchema = z.enum(SIMULATION_RUN_STATUSES).meta({
  id: 'SimulationRunStatus',
  title: 'SimulationRunStatus',
  description:
    'One run lifecycle status: submitted, scheduled, running, or the terminal completed / failed / cancelled.',
});

/** One run-transition cause (the closed vocabulary). */
export const RunTransitionCauseSchema = z.enum(RUN_TRANSITION_CAUSES).meta({
  id: 'RunTransitionCause',
  title: 'RunTransitionCause',
  description:
    'The typed cause of a run-state transition: submission, planning, dispatch, result-ingested, execution-failed, result-rejected, or cancellation.',
});

/** One simulation event discriminator (the simulation:* vocabulary). */
export const SimulationEventDiscriminatorSchema = z
  .enum(SIMULATION_EVENT_DISCRIMINATORS)
  .meta({
    id: 'SimulationEventDiscriminator',
    title: 'SimulationEventDiscriminator',
    description:
      'One simulation lifecycle event discriminator (the open-namespace simulation:* family over the W010 event shapes).',
  });

/** Simulation run identity (`simrun:<slug>`, derived content-addressed). */
export const SimulationRunIdSchema = z
  .string()
  .regex(SIMULATION_RUN_ID_PATTERN, 'must be a run id of the form "simrun:<slug>"')
  .meta({
    id: 'SimulationRunId',
    title: 'SimulationRunId',
    description:
      'Simulation run identity: "simrun:" followed by a lowercase slug (derived deterministically from the run identity digest).',
  });

/** Simulation job identity (`simjob:<slug>`, a caller-supplied opaque handle). */
export const SimulationJobIdSchema = z
  .string()
  .regex(SIMULATION_JOB_ID_PATTERN, 'must be a job id of the form "simjob:<slug>"')
  .meta({
    id: 'SimulationJobId',
    title: 'SimulationJobId',
    description:
      'Simulation job identity: "simjob:" followed by a lowercase slug (a caller-supplied opaque handle, never the run identity).',
  });

/** Acting principal (`principal:<slug>`, the W009/W010 actor grammar mirrored). */
export const FabricPrincipalIdSchema = z
  .string()
  .regex(SIMULATION_PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'FabricPrincipalId',
    title: 'FabricPrincipalId',
    description:
      'Acting principal of a fabric operation: "principal:" followed by a lowercase slug (the W009/W010 actor grammar, mirrored).',
  });

/** A submission idempotency key (caller-supplied or content-derived). */
export const FabricIdempotencyKeySchema = z
  .string()
  .regex(
    SIMULATION_IDEMPOTENCY_KEY_PATTERN,
    'must be an idempotency key: an opaque token of 1..128 characters from [A-Za-z0-9._-]',
  )
  .meta({
    id: 'FabricIdempotencyKey',
    title: 'FabricIdempotencyKey',
    description:
      'A submission idempotency key: caller-supplied opaque token, or the derived content key (lowercase hex SHA-256).',
  });

/**
 * An opaque typed reference to a W007 capability registration. STRICT:
 * only the three reference fields exist — structural copies of registry
 * records (descriptors, display names, trust surfaces) are rejected as
 * unknown fields (`vendor-fields-rejected`).
 */
export const CapabilityBindingRefSchema = z
  .strictObject({
    capabilityId: z.string().regex(CAPABILITY_BINDING_ID_PATTERN),
    version: z.string().regex(SEMVER_CORE_PATTERN),
    registrationDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'CapabilityBindingRef',
    title: 'CapabilityBindingRef',
    description:
      'Opaque typed reference to a W007 capability registration: capability id, semver version, and the registration manifest digest (the exact-revision pin). Never a structural copy of the registry record.',
  });

/** One typed run-state transition (provenance + timestamp). */
export const RunTransitionSchema = z
  .strictObject({
    from: SimulationRunStatusSchema.nullable(),
    to: SimulationRunStatusSchema,
    cause: RunTransitionCauseSchema,
    actor: FabricPrincipalIdSchema,
    at: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'RunTransition',
    title: 'RunTransition',
    description:
      'One typed run-state transition: cause, acting principal (provenance), and the caller-supplied instant; the genesis record carries from: null.',
  });

/**
 * One sealed, content-addressed run-state record (the W023 version-chain
 * convention). `stateDigest` is verified against the recomputed canonical
 * SHA-256 at admission (tamper detection).
 */
export const SimulationRunStateSchema = z
  .strictObject({
    schema: z.literal('epoch.simulation-fabric.run-state'),
    schemaVersion: SimulationFabricRecordVersionSchema,
    runId: SimulationRunIdSchema,
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    status: SimulationRunStatusSchema,
    transition: RunTransitionSchema,
    previousRunDigest: z.string().regex(SHA256_HEX_PATTERN).nullable(),
    stateDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'SimulationRunState',
    title: 'SimulationRunState',
    description:
      'One sealed, content-addressed run-state record: status, the typed transition that produced it, the previousRunDigest chain link, and its own SHA-256 content address (append-only; W023 version-chain style).',
  });

/** A sealed simulation result: the admitted W005 result plus its canonical digest. */
export const SealedSimulationResultSchema = z
  .strictObject({
    result: SimulationResultSchema,
    resultDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'SealedSimulationResult',
    title: 'SealedSimulationResult',
    description:
      'A sealed simulation result: the admitted W005 SimulationResult document plus its canonical SHA-256 digest (the exact-revision address of the prediction artifact).',
  });

/**
 * A simulation run: the tenant-scoped, append-only execution of one W005
 * invocation. Runtime refinements beyond the schema (chain integrity,
 * digest agreement, result/failure presence discipline) are enforced by
 * the admission machinery (src/state.ts).
 */
export const SimulationRunSchema = z
  .strictObject({
    schemaVersion: SimulationFabricRecordVersionSchema,
    runId: SimulationRunIdSchema,
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    tenantId: TenantIdSchema,
    status: SimulationRunStatusSchema,
    invocation: InvocationReferenceSchema,
    simulator: SimulatorReferenceSchema,
    capabilityBindings: z.array(CapabilityBindingRefSchema).readonly(),
    idempotencyKey: FabricIdempotencyKeySchema,
    states: z.array(SimulationRunStateSchema).min(1).readonly(),
    stateDigest: z.string().regex(SHA256_HEX_PATTERN),
    result: SealedSimulationResultSchema.optional(),
    failure: SimulationFailureSchema.optional(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'SimulationRun',
    title: 'SimulationRun',
    description:
      'A simulation run: tenant-scoped, content-addressed identity (digest over the canonical invocation payload), exact-revision invocation and simulator references, opaque capability bindings, the append-only sealed state chain, and (on completion) the sealed result.',
  });

/** One consumed idempotency-key record. */
export const IdempotencyRecordSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    idempotencyKey: FabricIdempotencyKeySchema,
    runId: SimulationRunIdSchema,
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'IdempotencyRecord',
    title: 'IdempotencyRecord',
    description:
      'One consumed submission idempotency key: the tenant-scoped key bound to the run identity it admitted.',
  });

/** One hosted run's bookkeeping (the snapshot entry). */
export const FabricRunEntrySchema = z
  .strictObject({
    run: SimulationRunSchema,
    request: SimulationInvocationRequestSchema,
    registration: SimulatorRegistrationSchema,
    events: z.array(SealedSimulationEventSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'FabricRunEntry',
    title: 'FabricRunEntry',
    description:
      'One hosted run entry: the run document, its admitted W005 invocation request and simulator registration (the executed chain), and its sealed simulation event stream.',
  });

/** The deterministic whole-fabric snapshot projection. */
export const SimulationFabricSnapshotSchema = z
  .strictObject({
    schemaVersion: SimulationFabricRecordVersionSchema,
    entries: z.array(FabricRunEntrySchema).readonly(),
    idempotency: z.array(IdempotencyRecordSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'SimulationFabricSnapshot',
    title: 'SimulationFabricSnapshot',
    description:
      'Deterministic, serialization-friendly whole-fabric projection: run entries sorted by (tenantId, runId) and idempotency records sorted by (tenantId, idempotencyKey).',
  });
