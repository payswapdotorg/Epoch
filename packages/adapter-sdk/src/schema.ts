/**
 * @epoch/adapter-sdk — runtime zod validators for the published contract
 * types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter through the SDK door (same
 * policy as the W002/W006 validators). Every exported schema is part of
 * the published surface emitted under `schemas/`.
 *
 * The simulation/evaluator/action/verification payload validators MIRROR
 * the frozen W003/W005/W006 field schemas (records, refinements, bounds)
 * so runtime parity holds — the per-category fixtures accepted here are
 * the same ones the frozen protocols accept (proven by the parity tests).
 * They are declared here, NOT imported: the SDK has no runtime dependency
 * on those packages (devDependency parity only).
 */
import { z } from 'zod';
import {
  CAPABILITY_FABRIC_CATEGORIES,
  JsonValueSchema,
  PARAMETER_NAME_PATTERN,
} from '@epoch/agent-protocol';
import {
  ACTION_FAILURE_CODES,
  ADAPTER_DESCRIPTOR_VERSION,
  ADAPTER_ENVELOPE_VERSION,
} from './version';

/** The eight Capability Fabric categories, as a literal union. */
type CapabilityCategoryLiteral = (typeof CAPABILITY_FABRIC_CATEGORIES)[number];

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Registered adapter identifier: `adapter:` + lowercase kebab slug. */
export const ADAPTER_ID_PATTERN = /^adapter:[a-z0-9][a-z0-9-]{0,62}$/;

/** Semver core string (the frozen agent-protocol shared pattern). */
export const SemverCoreSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'must be a semver core "major.minor.patch"')
  .meta({
    id: 'SemverCore',
    title: 'SemverCore',
    description: 'Semantic-version core (major.minor.patch, digits only, no prerelease/build suffixes).',
  });

/** Named JSON record: the shared W005 input/criteria/parameters shape. */
const NamedInputs = z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema);

/** Opaque chain identifier (the W006 ChainId bounds). */
const ChainId = z.string().min(1).max(256);

/** A version range (exact pin or caret compatibility). */
export const VersionConstraintSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('exact'), version: SemverCoreSchema }).readonly(),
    z.strictObject({ kind: z.literal('caret'), version: SemverCoreSchema }).readonly(),
  ])
  .meta({
    id: 'VersionConstraint',
    title: 'VersionConstraint',
    description:
      'Version range an adapter declares it serves: an exact pin, or caret major-version compatibility (npm-caret semantics incl. the 0.x carve-outs).',
  });

/** The capability binding: capability id + version range. */
export const CapabilityBindingSchema = z
  .strictObject({
    capabilityId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    versionRange: VersionConstraintSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityBinding',
    title: 'CapabilityBinding',
    description: 'Which capability (opaque, stable id) at which version range an adapter serves.',
  });

/** Capability lifecycle states (mirrors @epoch/capability-registry). */
export const CapabilityLifecycleStateSchema = z
  .enum(['registered', 'deprecated', 'retired'])
  .meta({
    id: 'CapabilityLifecycleState',
    title: 'CapabilityLifecycleState',
    description:
      'Capability lifecycle: registered, deprecated (advisory — still bindable), or retired (terminal — no new bindings).',
  });

/** The Capability Fabric adapter categories (agent-protocol vocabulary). */
export const CapabilityCategorySchema = z.enum(CAPABILITY_FABRIC_CATEGORIES).meta({
  id: 'CapabilityCategory',
  title: 'CapabilityCategory',
  description:
    'Capability Fabric adapter category: source, semantic, reconstruction, visualization, simulation, evaluator, action, or verification.',
});

/** Adapter id. */
export const AdapterIdSchema = z.string().regex(ADAPTER_ID_PATTERN).meta({
  id: 'AdapterId',
  title: 'AdapterId',
  description: 'Registered adapter identifier: "adapter:" followed by a lowercase kebab slug.',
});

/** Version discriminator on serialized adapter descriptors (v1). */
export const AdapterDescriptorVersionSchema = z.literal(ADAPTER_DESCRIPTOR_VERSION).meta({
  id: 'AdapterDescriptorVersion',
  title: 'AdapterDescriptorVersion',
  description: 'Version discriminator carried by every serialized adapter descriptor (currently 1).',
});

/** Version discriminator on serialized invocation envelopes (v1). */
export const AdapterEnvelopeVersionSchema = z.literal(ADAPTER_ENVELOPE_VERSION).meta({
  id: 'AdapterEnvelopeVersion',
  title: 'AdapterEnvelopeVersion',
  description:
    'Version discriminator carried by every serialized adapter request/response envelope (currently 1).',
});

/** The adapter descriptor. */
export const AdapterDescriptorSchema = z
  .strictObject({
    schemaVersion: AdapterDescriptorVersionSchema,
    adapterId: AdapterIdSchema,
    category: CapabilityCategorySchema,
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    binding: CapabilityBindingSchema,
  })
  .readonly()
  .meta({
    id: 'AdapterDescriptor',
    title: 'AdapterDescriptor',
    description:
      'Typed, content-addressed adapter document: identity, category (the per-category contract implemented), and the capability binding served.',
  });

/** The minimal structural view of a registry record the SDK binds against. */
export const BindableCapabilitySchema = z
  .strictObject({
    manifest: z
      .strictObject({
        capabilityId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
        category: CapabilityCategorySchema,
        version: SemverCoreSchema,
      })
      .readonly(),
    lifecycle: CapabilityLifecycleStateSchema,
    manifestDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'BindableCapability',
    title: 'BindableCapability',
    description:
      'Minimal structural view of a capability-registry record the SDK binds against (no runtime dependency on the registry).',
  });

/** The negotiated binding pin (both sides content-addressed). */
export const BindingPinSchema = z
  .strictObject({
    capabilityId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    capabilityVersion: SemverCoreSchema,
    manifestDigest: z.string().regex(SHA256_HEX_PATTERN),
    adapterId: AdapterIdSchema,
    adapterDescriptorDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'BindingPin',
    title: 'BindingPin',
    description:
      'Negotiated binding: capability id + version + manifest digest, adapter id + descriptor digest — both sides content-addressed.',
  });

// ---------------------------------------------------------------------------
// Per-category payload validators (W003/W005/W006 mirrors).
// ---------------------------------------------------------------------------

/** Neutral request payload (categories without frozen contracts yet). */
export const NeutralRequestPayloadSchema = z
  .strictObject({
    inputs: NamedInputs,
  })
  .meta({
    id: 'NeutralRequestPayload',
    title: 'NeutralRequestPayload',
    description: 'Neutral invocation payload: a named JSON input record (parameter-name keys).',
  });

/** Neutral response payload. */
export const NeutralResponsePayloadSchema = z
  .strictObject({
    outputs: NamedInputs,
  })
  .meta({
    id: 'NeutralResponsePayload',
    title: 'NeutralResponsePayload',
    description: 'Neutral response payload: a named JSON output record (parameter-name keys).',
  });

/** Upper bound for seeds: the exact integer range of IEEE-754 doubles (W005). */
const Seed = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** Simulation request payload (mirrors W005 invocation fields). */
export const SimulationRequestPayloadSchema = z
  .strictObject({
    inputs: NamedInputs,
    seed: Seed.optional(),
    notes: z.string().max(4000).optional(),
  })
  .meta({
    id: 'SimulationRequestPayload',
    title: 'SimulationRequestPayload',
    description:
      'Simulation adapter request: named inputs, optional seed, optional notes (W005-aligned shapes).',
  });

/** Simulation failure (the W005 SimulationFailure shape). */
const SimulationFailure = z
  .strictObject({
    code: z
      .enum(['input-out-of-domain', 'numerical-divergence', 'resource-limit-exceeded', 'internal-error'])
      .meta({
        id: 'SimulationFailureCode',
        title: 'SimulationFailureCode',
        description: 'Machine-readable failure code carried by failed simulation outcomes (W005 vocabulary).',
      }),
    message: z.string().min(1).max(4000),
  });

/** Simulation response payload (mirrors the W005 SimulationOutcome union). */
export const SimulationResponsePayloadSchema = z
  .discriminatedUnion('status', [
    z
      .strictObject({
        status: z.literal('completed'),
        outputs: NamedInputs,
      })
      .refine(
        (outcome) => Object.keys(outcome.outputs).length >= 1,
        'a completed simulation outcome must carry at least one named output',
      ),
    z.strictObject({
      status: z.literal('failed'),
      failure: SimulationFailure,
    }),
  ])
  .meta({
    id: 'SimulationResponsePayload',
    title: 'SimulationResponsePayload',
    description:
      'Simulation adapter response: completed (at least one named output) or failed (machine-readable code + reason) — the W005 outcome union.',
  });

/** Evaluation subject (the W005 EvaluationSubject shape). */
const EvaluationSubject = z
  .strictObject({
    kind: z.enum(['simulation-result', 'world-outcome']).meta({
      id: 'EvaluationSubjectKind',
      title: 'EvaluationSubjectKind',
      description: 'What an evaluator judges: a simulation result or a world outcome (W005 vocabulary).',
    }),
    subjectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
    subjectDigest: z.string().regex(SHA256_HEX_PATTERN),
  });

/** Evaluator request payload (mirrors W005 request fields). */
export const EvaluatorRequestPayloadSchema = z
  .strictObject({
    subject: EvaluationSubject,
    criteria: NamedInputs,
  })
  .meta({
    id: 'EvaluatorRequestPayload',
    title: 'EvaluatorRequestPayload',
    description:
      'Evaluator adapter request: the judged subject (kind, id, canonical digest) and named criteria (W005-aligned shapes).',
  });

/** Verdict justification entry (the W005 JustificationReference shape). */
const JustificationReference = z.strictObject({
  kind: z.enum(['criterion', 'subject-output', 'subject-failure', 'assumption', 'method']),
  reference: z.string().min(1).max(256),
  statement: z.string().min(1).max(4000),
});

/** Verdict outcome (the W005 VerdictOutcome union). */
const VerdictOutcome = z
  .discriminatedUnion('verdictForm', [
    z.strictObject({
      verdictForm: z.literal('pass-fail'),
      outcome: z.enum(['pass', 'fail']),
    }),
    z
      .strictObject({
        verdictForm: z.literal('scored'),
        score: z.number(),
        scale: z
          .strictObject({
            minimum: z.number(),
            maximum: z.number(),
          })
          .refine((scale) => scale.minimum < scale.maximum, 'scale minimum must be below maximum')
          .refine(
            (scale) => Number.isFinite(scale.minimum) && Number.isFinite(scale.maximum),
            'scale bounds must be finite',
          ),
      })
      .refine(
        (verdict) =>
          verdict.scale.minimum <= verdict.score && verdict.score <= verdict.scale.maximum,
        'score must lie within the declared scale',
      ),
  ]);

/** Evaluator response payload (mirrors W005 verdict fields). */
export const EvaluatorResponsePayloadSchema = z
  .strictObject({
    verdict: VerdictOutcome,
    justification: z.array(JustificationReference).min(1),
  })
  .meta({
    id: 'EvaluatorResponsePayload',
    title: 'EvaluatorResponsePayload',
    description:
      'Evaluator adapter response: a structured verdict (pass-fail or scored) plus at least one machine-referenceable justification (W005-aligned shapes).',
  });

/** Action target (the W003 ActionTarget shape). */
const ActionTarget = z
  .strictObject({
    kind: z
      .enum(['world-entity', 'world-relation', 'world-assertion', 'external-resource'])
      .meta({
        id: 'ActionTargetKind',
        title: 'ActionTargetKind',
        description: 'What an executed intervention acts upon (W003 vocabulary).',
      }),
    ref: z.string().min(1).max(256),
  });

/** Action request payload (mirrors W003 target/parameters fields). */
export const ActionRequestPayloadSchema = z
  .strictObject({
    target: ActionTarget,
    parameters: NamedInputs,
  })
  .meta({
    id: 'ActionRequestPayload',
    title: 'ActionRequestPayload',
    description:
      'Action adapter request: the target (kind + opaque ref) and named parameters (W003-aligned shapes). Authorization belongs to the Action Gateway, never here.',
  });

/** Action response payload (W007 neutral execution outcome). */
export const ActionResponsePayloadSchema = z
  .discriminatedUnion('status', [
    z.strictObject({ status: z.literal('executed') }),
    z.strictObject({
      status: z.literal('failed'),
      failure: z
        .strictObject({
          code: z.enum(ACTION_FAILURE_CODES),
          message: z.string().min(1).max(4000),
        })
        .meta({
          id: 'ActionFailure',
          title: 'ActionFailure',
          description: 'A failed action execution: machine-readable code plus a human-auditable reason.',
        }),
    }),
  ])
  .meta({
    id: 'ActionResponsePayload',
    title: 'ActionResponsePayload',
    description:
      'Action adapter response: executed, or failed with a machine-readable code and required reason.',
  });

/** Verification request payload (mirrors W006 stage vocabulary). */
export const VerificationRequestPayloadSchema = z
  .strictObject({
    method: z
      .strictObject({
        methodId: ChainId,
        claimId: ChainId,
        stage: z.enum(['verification', 'validation']).meta({
          id: 'VerificationStage',
          title: 'VerificationStage',
          description:
            'The two distinct stages (W006 vocabulary): verification ("was the work done to spec") vs validation ("is the spec right").',
        }),
      })
      .meta({
        id: 'VerificationMethodReference',
        title: 'VerificationMethodReference',
        description: 'Reference to the W006 method being executed: method id, claim id, and stage.',
      }),
    inputs: NamedInputs,
  })
  .meta({
    id: 'VerificationRequestPayload',
    title: 'VerificationRequestPayload',
    description:
      'Verification adapter request: the method/claim/stage reference (W006 vocabulary) and named run inputs.',
  });

/** Verification response payload (mirrors W006 run fields). */
export const VerificationResponsePayloadSchema = z
  .strictObject({
    runStatus: z.enum(['completed', 'failed', 'aborted']).meta({
      id: 'RunStatus',
      title: 'RunStatus',
      description: 'Execution status of a verification run (W006 vocabulary): completed, failed, or aborted.',
    }),
    producedEvidence: z.array(z.string().regex(SHA256_HEX_PATTERN)).readonly(),
  })
  .meta({
    id: 'VerificationResponsePayload',
    title: 'VerificationResponsePayload',
    description:
      'Verification adapter response: the run status (W006 vocabulary) and the content-addressed evidence digests the run produced.',
  });

// ---------------------------------------------------------------------------
// Envelope validators (category-discriminated).
// ---------------------------------------------------------------------------

// Each envelope schema is constructed with a per-call generic so the
// category discriminator stays a singleton literal per branch and the
// payload type flows into the branch (a non-generic parameter would
// widen z.literal to the whole union; a .map over the categories would
// lose per-branch inference entirely).
const requestEnvelopeSchema = <C extends CapabilityCategoryLiteral, P>(
  category: C,
  payload: z.ZodType<P>,
) =>
  z
    .strictObject({
      schemaVersion: AdapterEnvelopeVersionSchema,
      category: z.literal(category),
      binding: BindingPinSchema,
      payload,
    })
    .readonly()
    .meta({
      id: `AdapterRequest-${category}`,
      title: `AdapterRequest (${category})`,
      description: `Invocation envelope for ${category}-category adapters: version discriminator, negotiated binding pin, and the typed ${category} payload.`,
    });

const responseEnvelopeSchema = <C extends CapabilityCategoryLiteral, P>(
  category: C,
  payload: z.ZodType<P>,
) =>
  z
    .strictObject({
      schemaVersion: AdapterEnvelopeVersionSchema,
      category: z.literal(category),
      binding: BindingPinSchema,
      payload,
    })
    .readonly()
    .meta({
      id: `AdapterResponse-${category}`,
      title: `AdapterResponse (${category})`,
      description: `Response envelope for ${category}-category adapters: version discriminator, negotiated binding pin, and the typed ${category} payload.`,
    });

const REQUEST_ENVELOPES = [
  requestEnvelopeSchema('source', NeutralRequestPayloadSchema),
  requestEnvelopeSchema('semantic', NeutralRequestPayloadSchema),
  requestEnvelopeSchema('reconstruction', NeutralRequestPayloadSchema),
  requestEnvelopeSchema('visualization', NeutralRequestPayloadSchema),
  requestEnvelopeSchema('simulation', SimulationRequestPayloadSchema),
  requestEnvelopeSchema('evaluator', EvaluatorRequestPayloadSchema),
  requestEnvelopeSchema('action', ActionRequestPayloadSchema),
  requestEnvelopeSchema('verification', VerificationRequestPayloadSchema),
] as const;

const RESPONSE_ENVELOPES = [
  responseEnvelopeSchema('source', NeutralResponsePayloadSchema),
  responseEnvelopeSchema('semantic', NeutralResponsePayloadSchema),
  responseEnvelopeSchema('reconstruction', NeutralResponsePayloadSchema),
  responseEnvelopeSchema('visualization', NeutralResponsePayloadSchema),
  responseEnvelopeSchema('simulation', SimulationResponsePayloadSchema),
  responseEnvelopeSchema('evaluator', EvaluatorResponsePayloadSchema),
  responseEnvelopeSchema('action', ActionResponsePayloadSchema),
  responseEnvelopeSchema('verification', VerificationResponsePayloadSchema),
] as const;

/** The full request-envelope union validator (all eight categories). */
export const AdapterRequestSchema = z
  .discriminatedUnion('category', REQUEST_ENVELOPES)
  .meta({
    id: 'AdapterRequest',
    title: 'AdapterRequest',
    description:
      'Typed adapter invocation envelope, discriminated by category: version discriminator, negotiated binding pin, and the per-category payload.',
  });

/** The full response-envelope union validator (all eight categories). */
export const AdapterResponseSchema = z
  .discriminatedUnion('category', RESPONSE_ENVELOPES)
  .meta({
    id: 'AdapterResponse',
    title: 'AdapterResponse',
    description:
      'Typed adapter response envelope, discriminated by category: version discriminator, negotiated binding pin, and the per-category payload.',
  });
