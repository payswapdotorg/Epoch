// COMPILE-TIME PARITY with the frozen W003/W005/W006 contract shapes and
// with @epoch/capability-registry (verified by `tsc --noEmit`).
//
// The adapter-sdk payload types that MEET those contracts must be
// IDENTICAL to them under the strictest TypeScript type-equality check.
// If a frozen contract ever evolves incompatibly, THIS file fails
// typecheck and the drift surfaces immediately. Type-only imports: the
// SDK has NO runtime dependency on these packages (devDependencies only,
// the W006 evidence -> W002 world-model precedent).
import type { z } from 'zod';
import type {
  ActionProposal,
  ActionTarget,
} from '@epoch/action-protocol';
import type {
  EvaluationRequest,
  EvaluationSubject,
  EvaluationVerdict,
  VerdictOutcome,
} from '@epoch/evaluation-protocol';
import type {
  SimulationFailureCode,
  SimulationInvocationRequest,
  SimulationOutcome,
} from '@epoch/simulation-protocol';
import type {
  Run,
  RunStatus,
  VerificationStage,
} from '@epoch/verification';
import type {
  CapabilityCategory as RegistryCapabilityCategory,
  CapabilityLifecycleState as RegistryCapabilityLifecycleState,
  CapabilityRecord,
  VersionConstraint as RegistryVersionConstraint,
} from '@epoch/capability-registry';
import type { Equals, Expect } from '../src/type-utils';
import type {
  SimulationRequestPayloadSchema,
  SimulationResponsePayloadSchema,
} from '../src/schema';
import type {
  ActionRequestPayload,
  EvaluatorRequestPayload,
  EvaluatorResponsePayload,
  SimulationRequestPayload,
  SimulationResponsePayload,
  VerificationRequestPayload,
  VerificationResponsePayload,
  BindableCapability,
  CapabilityCategory,
  CapabilityLifecycleState,
} from '../src/index';
import type { VersionConstraint } from '../src/semver';

// --- W005 simulation protocol ----------------------------------------------

export type SimulationInputsParity = Expect<
  Equals<SimulationRequestPayload['inputs'], SimulationInvocationRequest['inputs']>
>;
export type SimulationSeedParity = Expect<
  Equals<SimulationRequestPayload['seed'], SimulationInvocationRequest['seed']>
>;
export type SimulationNotesParity = Expect<
  Equals<SimulationRequestPayload['notes'], SimulationInvocationRequest['notes']>
>;
export type SimulationOutcomeParity = Expect<
  Equals<SimulationResponsePayload, SimulationOutcome>
>;
export type SimulationFailureCodeParity = Expect<
  Equals<
    Extract<SimulationResponsePayload, { status: 'failed' }>['failure']['code'],
    SimulationFailureCode
  >
>;

// --- W005 evaluation protocol -----------------------------------------------

export type EvaluationSubjectParity = Expect<
  Equals<EvaluatorRequestPayload['subject'], EvaluationSubject>
>;
export type EvaluationCriteriaParity = Expect<
  Equals<EvaluatorRequestPayload['criteria'], EvaluationRequest['criteria']>
>;
export type VerdictOutcomeParity = Expect<
  Equals<EvaluatorResponsePayload['verdict'], VerdictOutcome>
>;
export type JustificationParity = Expect<
  Equals<EvaluatorResponsePayload['justification'], EvaluationVerdict['justification']>
>;

// --- W003 action protocol ----------------------------------------------------

export type ActionTargetParity = Expect<
  Equals<ActionRequestPayload['target'], ActionTarget>
>;
export type ActionParametersParity = Expect<
  Equals<ActionRequestPayload['parameters'], ActionProposal['parameters']>
>;

// --- W006 verification -------------------------------------------------------

export type VerificationStageParity = Expect<
  Equals<VerificationRequestPayload['method']['stage'], VerificationStage>
>;
export type RunStatusParity = Expect<
  Equals<VerificationResponsePayload['runStatus'], RunStatus>
>;
export type ProducedEvidenceParity = Expect<
  Equals<VerificationResponsePayload['producedEvidence'], Run['producedEvidence']>
>;

// --- @epoch/capability-registry (structural, NO runtime coupling) ------------

export type RegistryVersionConstraintParity = Expect<
  Equals<VersionConstraint, RegistryVersionConstraint>
>;
export type RegistryLifecycleParity = Expect<
  Equals<CapabilityLifecycleState, RegistryCapabilityLifecycleState>
>;
export type RegistryCategoryParity = Expect<
  Equals<CapabilityCategory, RegistryCapabilityCategory>
>;
/** The registry's published record is assignable to the SDK's binding view. */
export type RegistryRecordIsBindable = Expect<CapabilityRecord extends BindableCapability ? true : false>;
/** The binding view is a projection of the record's manifest (structural consumption). */
export type BindableIsNarrower = Expect<
  Equals<
    Pick<CapabilityRecord['manifest'], 'capabilityId' | 'category' | 'version'>,
    BindableCapability['manifest']
  >
>;

/** Zod-schema inference parity for the mirrored payload pieces. */
export type AdapterSdkW00xSchemaSync = [
  Expect<Equals<z.infer<typeof SimulationResponsePayloadSchema>, SimulationOutcome>>,
  Expect<Equals<z.infer<typeof SimulationRequestPayloadSchema>, SimulationRequestPayload>>,
];
