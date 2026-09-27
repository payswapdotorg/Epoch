/**
 * @epoch/adapter-fmi — the typed participant model: provider descriptors
 * -> typed participants, and the deterministic step semantics.
 *
 * The TRANSLATION maps the provider layer's parsed model descriptions
 * into neutral typed participants (ports sorted by name; content
 * addressed). The reference STEP SEMANTICS are generic over any port
 * set and fully deterministic (zero randomness, zero wall-clock):
 *
 * - the participant state is one value per output port (initialized
 *   from each output port's declared start value);
 * - the parameters are fixed at the declared start values (the step
 *   carries them for reproducibility);
 * - drive D = the sum of the step's input values (over the declared
 *   input ports, sorted by name);
 * - decay C = 1 / (1 + the sum of |parameter values|) — a stable
 *   contraction in (0, 1];
 * - every output port's next value is C * state[p] + D, and the state
 *   advances to exactly those values (pinned by the step schema).
 *
 * Identical (participant, step number, inputs, prior state) always
 * produce identical outputs, identical state digests, and identical
 * step digests (pinned by the determinism tests).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex, type Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { ProviderParticipant, ProviderVariable } from './provider/payload';
import { neutralDirectionOf, neutralParticipantIdOf, parseProviderParticipant } from './provider/payload';
import type { ParticipantPort, ParticipantState, StepExchange, TypedParticipant } from './types';
import { FMI_ADAPTER_RECORD_VERSION } from './version';
import type { FmiAdapterResult } from './errors';

/** The provider descriptor's content digest (canonical JSON, content-addressed). */
export function descriptorDigestOf(participant: ProviderParticipant): Sha256Hex {
  return canonicalDigest(participant as unknown as JsonValue);
}

/** The neutral port name derived from a provider variable name (underscore-normalized). */
function portNameOf(providerVariableName: string): string {
  return providerVariableName.toLowerCase().replace(/_/g, '-');
}

/** Translate one provider variable into a typed port. */
function portOf(variable: ProviderVariable): ParticipantPort {
  const content = {
    schemaVersion: FMI_ADAPTER_RECORD_VERSION,
    name: portNameOf(variable.name),
    direction: neutralDirectionOf(variable),
    valueKind: 'number' as const,
    ...(variable.unit !== undefined ? { unit: variable.unit } : {}),
    startValue: variable.start,
  };
  return { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Input of {@link projectParticipant} (the projection is total and pure). */
export interface ProjectionInput {
  readonly tenantId: TenantId;
  readonly payload: unknown;
  /** Optional caller-claimed digest of the descriptor payload (tamper detection). */
  readonly claimedDigest?: Sha256Hex | undefined;
}

/**
 * Project a provider model descriptor into a typed simulation
 * participant (deterministic, content-addressed; ports sorted by name).
 * Malformed descriptors are the typed `unknown-provider-payload` (never
 * a partial load); a claimed digest that does not match the content is
 * the typed `digest-mismatch`.
 */
export function projectParticipant(input: ProjectionInput): FmiAdapterResult<TypedParticipant> {
  const parsed = parseProviderParticipant(input.payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'unknown-provider-payload',
        message: 'the payload is not a recognized participant-model descriptor',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const descriptorDigest = descriptorDigestOf(parsed.data);
  if (input.claimedDigest !== undefined && input.claimedDigest !== descriptorDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the claimed descriptor digest does not match its content (tampered or mismatched payload)',
        expected: descriptorDigest,
        encountered: input.claimedDigest,
      },
    };
  }
  const participantId = neutralParticipantIdOf(parsed.data);
  const ports = parsed.data.variables.map(portOf).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const content = {
    schemaVersion: FMI_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    participantId,
    displayName: `${parsed.data.modelName} (typed participant)`,
    modelIdentity: parsed.data.modelIdentity,
    ports,
    descriptorDigest,
  };
  return { ok: true, value: { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) } };
}

/** The ports of one direction (sorted by name). */
export function portsOfDirection(participant: TypedParticipant, direction: 'input' | 'output' | 'parameter'): readonly ParticipantPort[] {
  return participant.ports.filter((port) => port.direction === direction);
}

/** The initial state of a participant (one value per output port). */
export function initialStateOf(participant: TypedParticipant): ParticipantState {
  const values: Record<string, number> = {};
  for (const port of portsOfDirection(participant, 'output')) {
    values[port.name] = port.startValue;
  }
  const content = {
    schemaVersion: FMI_ADAPTER_RECORD_VERSION,
    participantId: participant.participantId,
    values,
  };
  return { ...content, stateDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** The fixed parameters of a participant (one value per parameter port). */
export function parametersOf(participant: TypedParticipant): Readonly<Record<string, number>> {
  const parameters: Record<string, number> = {};
  for (const port of portsOfDirection(participant, 'parameter')) {
    parameters[port.name] = port.startValue;
  }
  return parameters;
}

/** Input of {@link portConformanceGate} (the pre-step conformance check). */
export interface PortConformanceInput {
  readonly participant: TypedParticipant;
  readonly values: Readonly<Record<string, unknown>>;
  readonly direction: 'input';
}

/**
 * The port-conformance gate: step inputs must carry exactly the declared
 * input ports (every required input present, numeric, finite); unknown
 * keys are rejected. Violations are the typed
 * `port-conformance-rejected` with precise paths — never a partial step.
 */
export function portConformanceGate(input: PortConformanceInput): FmiAdapterResult<Readonly<Record<string, number>>> {
  const issues: { path: string; message: string }[] = [];
  const declared = portsOfDirection(input.participant, input.direction);
  for (const port of declared) {
    const value = input.values[port.name];
    if (value === undefined) {
      issues.push({ path: `$.values.${port.name}`, message: 'the declared input port value is missing' });
    } else if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ path: `$.values.${port.name}`, message: 'the port value must be a finite number' });
    }
  }
  const declaredNames = new Set(declared.map((port) => port.name));
  for (const key of Object.keys(input.values)) {
    if (!declaredNames.has(key)) {
      issues.push({ path: `$.values.${key}`, message: 'the value names no declared input port' });
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: 'port-conformance-rejected',
        message: 'the step inputs do not conform to the participant declared ports',
        issues,
      },
    };
  }
  const result: Record<string, number> = {};
  for (const port of declared) {
    result[port.name] = input.values[port.name] as number;
  }
  return { ok: true, value: result };
}

/**
 * Compute ONE deterministic step (pure): the drive from the inputs, the
 * decay from the parameters, and every output port's next value. The
 * returned step exchange is content-addressed and carries the
 * post-step state.
 */
export function computeStep(input: {
  readonly tenantId: TenantId;
  readonly participant: TypedParticipant;
  readonly stepNumber: number;
  readonly inputs: Readonly<Record<string, number>>;
  readonly priorState: ParticipantState;
  readonly steppedAt: Timestamp;
  readonly disposition?: 'stepped' | 'duplicate';
}): StepExchange {
  const parameters = parametersOf(input.participant);
  const inputPorts = portsOfDirection(input.participant, 'input');
  const outputPorts = portsOfDirection(input.participant, 'output');

  const stepInputs: Readonly<Record<string, number>> = input.inputs;
  let drive = 0;
  for (const port of inputPorts) {
    drive += stepInputs[port.name] ?? 0;
  }
  let parameterMagnitude = 0;
  for (const port of portsOfDirection(input.participant, 'parameter')) {
    parameterMagnitude += Math.abs(parameters[port.name] ?? 0);
  }
  const decay = 1 / (1 + parameterMagnitude);

  const nextValues: Record<string, number> = {};
  for (const port of outputPorts) {
    nextValues[port.name] = decay * (input.priorState.values[port.name] ?? 0) + drive;
  }
  const stateContent = {
    schemaVersion: FMI_ADAPTER_RECORD_VERSION,
    participantId: input.participant.participantId,
    values: nextValues,
  };
  const state: ParticipantState = {
    ...stateContent,
    stateDigest: canonicalDigest(stateContent as unknown as JsonValue),
  };
  const content = {
    schemaVersion: FMI_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    participantId: input.participant.participantId,
    stepNumber: input.stepNumber,
    inputs: input.inputs,
    outputs: nextValues,
    parameters,
    state,
    disposition: input.disposition ?? 'stepped',
    steppedAt: input.steppedAt,
  };
  return { ...content, stepDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Re-verify a step exchange's digests (tamper detection; total). */
export function verifyStep(step: StepExchange): boolean {
  const { stepDigest, ...content } = step;
  return canonicalDigest(content as unknown as JsonValue) === stepDigest;
}

/** Re-verify a participant's digest (tamper detection; total). */
export function verifyParticipant(participant: TypedParticipant): boolean {
  const { contentDigest, ...content } = participant;
  return canonicalDigest(content as unknown as JsonValue) === contentDigest;
}
