/**
 * @epoch/adapter-sdk — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators; the W00x-parity tests
 * pin the structural compatibility of the per-category payloads with the
 * frozen W003/W005/W006 contract shapes (devDependencies, type-level +
 * runtime — NO runtime coupling).
 *
 * Neutrality (architecture lock rule 13): the SDK ships ZERO concrete
 * adapters — any vendor/provider/model/API surface is a property of
 * concrete adapters (W029's reference set and later marketplace
 * adapters), never of these contracts. Identifiers are opaque; strict
 * objects reject unknown (vendor) fields.
 *
 * MIRRORED SHAPES: the simulation/evaluator/action/verification payload
 * types that meet the frozen W003/W005/W006 contracts are declared with
 * EXACTLY their mutability (no `readonly` on the mirrored pieces) so the
 * strictest type-equality parity holds; the surrounding envelopes and
 * SDK-owned types are `readonly` per house style.
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { CAPABILITY_FABRIC_CATEGORIES } from '@epoch/agent-protocol';
import type { ActionFailureCode } from './version';
import type { VersionConstraint } from './semver';

/**
 * A Capability Fabric adapter category — the agent-protocol vocabulary
 * (one source of truth, imported; no drift possible).
 */
export type CapabilityCategory = (typeof CAPABILITY_FABRIC_CATEGORIES)[number];

/**
 * Capability lifecycle states, mirroring @epoch/capability-registry
 * (pinned member-for-member by the registry parity test in test/):
 * `registered`, `deprecated` (advisory), `retired` (terminal — no new
 * bindings).
 */
export type CapabilityLifecycleState = 'registered' | 'deprecated' | 'retired';

/** Registered adapter identifier: `adapter:` + lowercase kebab slug. */
export type AdapterId = string;

/** The version range an adapter declares it serves (exact or caret). */
export type CapabilityVersionRange = VersionConstraint;

/**
 * The capability binding: which capability (opaque, stable id) at which
 * version range this adapter serves. R18 discipline: never a floating
 * reference — the concrete version is negotiated at bind time.
 */
export interface CapabilityBinding {
  readonly capabilityId: string;
  readonly versionRange: CapabilityVersionRange;
}

/**
 * The adapter descriptor: the typed, content-addressed document every
 * concrete adapter ships. Declares the adapter's identity, its category
 * (which per-category contract it implements), and the capability
 * binding it serves. Serialized deterministically (canonical JSON; see
 * `computeAdapterDescriptorDigest`).
 */
export interface AdapterDescriptor {
  readonly schemaVersion: 1;
  readonly adapterId: AdapterId;
  readonly category: CapabilityCategory;
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly binding: CapabilityBinding;
}

/**
 * The minimal STRUCTURAL view of a capability-registry record the SDK
 * binds against. `@epoch/capability-registry`'s `CapabilityRecord` is
 * assignable to this interface (pinned by the registry parity test) —
 * the SDK consumes registry records structurally, with NO runtime
 * dependency on the registry package.
 */
export interface BindableCapability {
  readonly manifest: {
    readonly capabilityId: string;
    readonly category: CapabilityCategory;
    readonly version: string;
  };
  readonly lifecycle: CapabilityLifecycleState;
  readonly manifestDigest: Sha256Hex;
}

/**
 * The negotiated binding pin: the exact revision an invocation is bound
 * to — capability id + version + manifest digest, adapter id + descriptor
 * digest. Both sides of the binding are content-addressed, so every
 * adapter invocation is attributable to the precise contract revisions it
 * ran against.
 */
export interface BindingPin {
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly manifestDigest: Sha256Hex;
  readonly adapterId: AdapterId;
  readonly adapterDescriptorDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// Per-category request/response payload types.
// ---------------------------------------------------------------------------

/**
 * Neutral payload for categories whose protocol contracts are not yet
 * frozen (source, semantic, reconstruction, visualization): a
 * named-parameter record — the same input shape the frozen W005
 * protocols use. Future contract versions specialize these without
 * touching the binding/negotiation machinery.
 */
export interface NeutralRequestPayload {
  inputs: Record<string, JsonValue>;
}

/** Neutral response payload: a named output record. */
export interface NeutralResponsePayload {
  outputs: Record<string, JsonValue>;
}

/**
 * Simulation request payload — MIRRORS W005
 * `SimulationInvocationRequest` where they meet: the named inputs record,
 * the optional seed, and the optional notes have exactly the W005 shapes
 * (parity-pinned). The protocol message envelope (messageId, timestamps,
 * simulator reference) belongs to the simulation protocol; the SDK
 * envelope carries the negotiated binding pin instead.
 */
export interface SimulationRequestPayload {
  inputs: Record<string, JsonValue>;
  seed?: number | undefined;
  notes?: string | undefined;
}

/**
 * Simulation response payload — MIRRORS W005 `SimulationOutcome` exactly
 * (parity-pinned): `completed` with at least one named output, or
 * `failed` with a machine-readable failure code and a required reason.
 */
export type SimulationResponsePayload =
  | {
      status: 'completed';
      outputs: Record<string, JsonValue>;
    }
  | {
      status: 'failed';
      failure: {
        code: SimulationFailureCode;
        message: string;
      };
    };

/** Neutral simulation failure codes — the W005 `SimulationFailureCode` set. */
export type SimulationFailureCode =
  | 'input-out-of-domain'
  | 'numerical-divergence'
  | 'resource-limit-exceeded'
  | 'internal-error';

/**
 * Evaluator request payload — MIRRORS W005 `EvaluationRequest` where they
 * meet: the judged subject (kind, opaque id, canonical digest) and the
 * named criteria record have exactly the W005 shapes (parity-pinned).
 */
export interface EvaluatorRequestPayload {
  subject: {
    kind: 'simulation-result' | 'world-outcome';
    subjectId: string;
    subjectDigest: string;
  };
  criteria: Record<string, JsonValue>;
}

/**
 * Evaluator response payload — MIRRORS W005 `EvaluationVerdict` where
 * they meet: the structured verdict (pass-fail or scored on a declared
 * scale) and the machine-referenceable justification list have exactly
 * the W005 shapes (parity-pinned). Judgment without justification is
 * inexpressible.
 */
export interface EvaluatorResponsePayload {
  verdict:
    | {
        verdictForm: 'pass-fail';
        outcome: 'pass' | 'fail';
      }
    | {
        verdictForm: 'scored';
        score: number;
        scale: {
          minimum: number;
          maximum: number;
        };
      };
  justification: JustificationReference[];
}

/** One verdict justification entry — the W005 `JustificationReference` shape. */
export interface JustificationReference {
  kind: 'criterion' | 'subject-output' | 'subject-failure' | 'assumption' | 'method';
  reference: string;
  statement: string;
}

/**
 * Action request payload — MIRRORS W003 where they meet: the action
 * target (kind + opaque ref, the `ActionTarget` shape) and the named
 * parameters record have exactly the action-protocol shapes
 * (parity-pinned). The adapter EXECUTES an already-authorized
 * intervention against the target; proposals and authorization decisions
 * belong to the action protocol and the Action Gateway (lock rule 3).
 */
export interface ActionRequestPayload {
  target: {
    kind: 'world-entity' | 'world-relation' | 'world-assertion' | 'external-resource';
    ref: string;
  };
  parameters: Record<string, JsonValue>;
}

/**
 * Action response payload (W007 vocabulary): the neutral execution
 * outcome — `executed`, or `failed` with a machine-readable failure code
 * and a required reason.
 */
export type ActionResponsePayload =
  | {
      status: 'executed';
    }
  | {
      status: 'failed';
      failure: {
        code: ActionFailureCode;
        message: string;
      };
    };

/**
 * Verification request payload — MIRRORS W006 where they meet: the
 * method/claim/stage reference carries the W006 `VerificationStage`
 * vocabulary (verification vs validation — distinct, never fused, lock
 * rule 7 corollary) and the run inputs are a named record.
 */
export interface VerificationRequestPayload {
  method: {
    methodId: string;
    claimId: string;
    stage: 'verification' | 'validation';
  };
  inputs: Record<string, JsonValue>;
}

/**
 * Verification response payload — MIRRORS W006 where they meet: the run
 * status vocabulary (`RunStatus`) and the content-addressed produced
 * evidence digests (`readonly Sha256Hex[]`, the W006 `Run` shape).
 */
export interface VerificationResponsePayload {
  runStatus: 'completed' | 'failed' | 'aborted';
  producedEvidence: readonly Sha256Hex[];
}

/** Request payload per category. */
export interface AdapterRequestPayloads {
  readonly source: NeutralRequestPayload;
  readonly semantic: NeutralRequestPayload;
  readonly reconstruction: NeutralRequestPayload;
  readonly visualization: NeutralRequestPayload;
  readonly simulation: SimulationRequestPayload;
  readonly evaluator: EvaluatorRequestPayload;
  readonly action: ActionRequestPayload;
  readonly verification: VerificationRequestPayload;
}

/** Response payload per category. */
export interface AdapterResponsePayloads {
  readonly source: NeutralResponsePayload;
  readonly semantic: NeutralResponsePayload;
  readonly reconstruction: NeutralResponsePayload;
  readonly visualization: NeutralResponsePayload;
  readonly simulation: SimulationResponsePayload;
  readonly evaluator: EvaluatorResponsePayload;
  readonly action: ActionResponsePayload;
  readonly verification: VerificationResponsePayload;
}

// ---------------------------------------------------------------------------
// Invocation envelopes and the adapter interface.
// ---------------------------------------------------------------------------

/** A typed adapter invocation request, discriminated by category. */
export interface AdapterRequestEnvelope<C extends CapabilityCategory = CapabilityCategory> {
  readonly schemaVersion: 1;
  readonly category: C;
  readonly binding: BindingPin;
  readonly payload: AdapterRequestPayloads[C];
}

/** A typed adapter response, discriminated by category. */
export interface AdapterResponseEnvelope<C extends CapabilityCategory = CapabilityCategory> {
  readonly schemaVersion: 1;
  readonly category: C;
  readonly binding: BindingPin;
  readonly payload: AdapterResponsePayloads[C];
}

/** The full request-envelope union (all eight categories). */
export type AdapterRequest = {
  [C in CapabilityCategory]: AdapterRequestEnvelope<C>;
}[CapabilityCategory];

/** The full response-envelope union (all eight categories). */
export type AdapterResponse = {
  [C in CapabilityCategory]: AdapterResponseEnvelope<C>;
}[CapabilityCategory];

/**
 * The per-category adapter contract every concrete adapter implements.
 * The SDK ships ZERO implementations — concrete adapters (W029's
 * Git/IFC/MCP/FMI reference set and future marketplace adapters) own all
 * provider-specific behavior behind this neutral interface.
 */
export interface CapabilityAdapter<C extends CapabilityCategory = CapabilityCategory> {
  /** The adapter's typed, content-addressed descriptor. */
  readonly descriptor: AdapterDescriptor;
  /** Execute one invocation bound to a negotiated capability revision. */
  invoke(request: AdapterRequestEnvelope<C>): Promise<AdapterResponseEnvelope<C>>;
}

/** Per-category adapter contract aliases. */
export type SourceAdapter = CapabilityAdapter<'source'>;
export type SemanticAdapter = CapabilityAdapter<'semantic'>;
export type ReconstructionAdapter = CapabilityAdapter<'reconstruction'>;
export type VisualizationAdapter = CapabilityAdapter<'visualization'>;
export type SimulationAdapter = CapabilityAdapter<'simulation'>;
export type EvaluatorAdapter = CapabilityAdapter<'evaluator'>;
export type ActionAdapter = CapabilityAdapter<'action'>;
export type VerificationAdapter = CapabilityAdapter<'verification'>;

// ---------------------------------------------------------------------------
// Error taxonomy (typed, categorized, precise paths — the W006 style).
// ---------------------------------------------------------------------------

/** Issue codes reported by the SDK's total entry points. */
export type AdapterSdkErrorCode =
  | 'validation'
  | 'unknown-capability'
  | 'version-unsatisfied'
  | 'lifecycle-conflict'
  | 'binding-conflict';

/** One flattened validation issue (dotted path + message). */
export interface AdapterSdkIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed adapter-sdk error taxonomy. Errors are values, not exceptions. */
export type AdapterSdkError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly AdapterSdkIssue[];
    }
  | {
      readonly code: 'unknown-capability';
      readonly message: string;
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'version-unsatisfied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly constraint: VersionConstraint;
      readonly availableVersions: readonly string[];
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly from: CapabilityLifecycleState;
      readonly to: CapabilityLifecycleState;
    }
  | {
      readonly code: 'binding-conflict';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected?: string | undefined;
      readonly encountered?: string | undefined;
    };

/** Result of an SDK operation: a value or a typed error. */
export type AdapterSdkResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AdapterSdkError };
