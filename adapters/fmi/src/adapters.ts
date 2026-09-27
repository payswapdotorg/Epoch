/**
 * @epoch/adapter-fmi — the W007 adapter surface (the reference
 * implementation of the SDK's simulation contract) and the participant
 * host (the tenant-scoped, idempotent step store).
 *
 * `FmiSimulationAdapter` implements `SimulationAdapter` (the neutral
 * simulation envelope -> the computed outputs). The HOST admits typed
 * participants (provider seam -> projection), executes steps
 * idempotently (identical content under the same step key returns the
 * sealed prior step; different content is the typed `replay-conflict`),
 * and drives the participant state.
 *
 * Every invocation is TOTAL (typed errors, never thrown) and runs the
 * same discipline:
 * 1. envelope admission — the SDK's `parseAdapterRequest` (strict
 *    objects reject unknown fields);
 * 2. binding check — the envelope's pin must reference THIS adapter's
 *    descriptor (identity + digest) and category — else the typed
 *    `binding-conflict`;
 * 3. tenant gate — the payload's tenant must match the pinned tenant —
 *    else the typed `tenant-isolation-rejected`;
 * 4. port conformance — the step values must carry exactly the declared
 *    input ports — else the typed `port-conformance-rejected` (mapped
 *    onto the W005 failure vocabulary `input-out-of-domain` in the
 *    envelope response);
 * 5. the deterministic step computation.
 */
import type {
  AdapterRequestEnvelope,
  AdapterResponseEnvelope,
  BindingPin,
  SimulationAdapter,
} from '@epoch/adapter-sdk';
import { parseAdapterRequest } from '@epoch/adapter-sdk';
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import {
  computeStep,
  initialStateOf,
  parametersOf,
  portConformanceGate,
  projectParticipant,
} from './participant';
import type { ParticipantState, StepExchange, TypedParticipant } from './types';
import {
  SIMULATION_ADAPTER_DESCRIPTOR,
  SIMULATION_ADAPTER_DESCRIPTOR_DIGEST,
} from './descriptor';
import { StepInputSchema } from './schema';
import type { FmiAdapterResult } from './errors';

function validationFailure(
  message: string,
  issues: readonly { path: string; message: string }[],
): FmiAdapterResult<never> {
  return { ok: false, error: { code: 'validation', message, issues } };
}

/** Flatten an SDK admission error into the adapter's issue list (typed). */
function sdkIssues(message: string): readonly { path: string; message: string }[] {
  return [{ path: '$', message }];
}

/** Input of {@link FmiAdapterHost.admitParticipant}. */
export interface AdmitParticipantInput {
  readonly tenantId: TenantId;
  readonly payload: unknown;
  readonly claimedDigest?: string | undefined;
}

/** Input of {@link FmiAdapterHost.step}. */
export interface StepInput {
  readonly tenantId: TenantId;
  readonly participantId: string;
  readonly stepNumber?: number | undefined;
  readonly values: Readonly<Record<string, unknown>>;
  /** Caller-supplied instant; when absent, a deterministic instant is derived from the step number. */
  readonly steppedAt?: Timestamp | undefined;
}

/**
 * The reference adapter host: a tenant-scoped, in-memory store of typed
 * participants and sealed steps. Construction pins the tenant
 * (`expectedTenantId`): any operation naming a different tenant is the
 * typed `tenant-isolation-rejected`.
 */
export class FmiAdapterHost {
  private readonly expectedTenantId: TenantId | undefined;
  /** participantId -> the typed participant. */
  private readonly participants = new Map<string, TypedParticipant>();
  /** participantId -> the current state (advanced per step). */
  private readonly states = new Map<string, ParticipantState>();
  /** participantId#stepNumber -> the sealed step + its ORIGINAL prior state digest. */
  private readonly steps = new Map<string, { readonly step: StepExchange; readonly priorStateDigest: Sha256Hex }>();
  /** participantId -> the next step number. */
  private readonly counters = new Map<string, number>();

  constructor(options?: { readonly expectedTenantId?: TenantId | undefined }) {
    this.expectedTenantId = options?.expectedTenantId;
  }

  private tenantGate(tenantId: TenantId): FmiAdapterResult<TenantId> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this adapter host is pinned to tenant "${this.expectedTenantId}" — the operation named tenant "${tenantId}"`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
        },
      };
    }
    return { ok: true, value: tenantId };
  }

  /** Admit one typed participant (idempotent: identical content returns the prior projection). */
  admitParticipant(input: AdmitParticipantInput): FmiAdapterResult<TypedParticipant> {
    const gate = this.tenantGate(input.tenantId);
    if (!gate.ok) return gate;
    const projected = projectParticipant({
      tenantId: input.tenantId,
      payload: input.payload,
      ...(input.claimedDigest !== undefined ? { claimedDigest: input.claimedDigest } : {}),
    });
    if (!projected.ok) return projected;
    const participant = projected.value;
    const existing = this.participants.get(participant.participantId);
    if (existing !== undefined) {
      if (existing.contentDigest !== participant.contentDigest) {
        return {
          ok: false,
          error: {
            code: 'replay-conflict',
            message: `participant "${participant.participantId}" already holds revision ${existing.contentDigest} — different content under the same key is a replay conflict`,
            key: participant.participantId,
            expectedDigest: existing.contentDigest,
            encounteredDigest: participant.contentDigest,
          },
        };
      }
      return { ok: true, value: existing };
    }
    this.participants.set(participant.participantId, participant);
    this.states.set(participant.participantId, initialStateOf(participant));
    this.counters.set(participant.participantId, 0);
    return { ok: true, value: participant };
  }

  /** Retrieve a typed participant (tenant-scoped read). */
  participant(tenantId: TenantId, participantId: string): FmiAdapterResult<TypedParticipant> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const participant = this.participants.get(participantId);
    if (participant === undefined) {
      return validationFailure(`no admitted participant "${participantId}" in the requested scope`, [
        { path: '$.participant', message: `unknown participant "${participantId}"` },
      ]);
    }
    return { ok: true, value: participant };
  }

  /** The current state of a participant (tenant-scoped read). */
  currentState(tenantId: TenantId, participantId: string): FmiAdapterResult<ParticipantState> {
    const participant = this.participant(tenantId, participantId);
    if (!participant.ok) return participant;
    const state = this.states.get(participantId);
    if (state === undefined) {
      return validationFailure(`no state for participant "${participantId}"`, [
        { path: '$.participant', message: 'participant state missing' },
      ]);
    }
    return { ok: true, value: state };
  }

  /**
   * Execute ONE deterministic step (idempotent, content-addressed):
   * port-conformance gate -> step key -> duplicate/conflict admission ->
   * deterministic computation -> seal. A replayed step key with
   * identical content returns the SEALED PRIOR step (marked duplicate,
   * no state advance); different content under the same key is the
   * typed `replay-conflict`.
   */
  step(input: StepInput): FmiAdapterResult<StepExchange> {
    const gate = this.tenantGate(input.tenantId);
    if (!gate.ok) return gate;
    const participant = this.participant(input.tenantId, input.participantId);
    if (!participant.ok) return participant;
    const conformant = portConformanceGate({ participant: participant.value, values: input.values, direction: 'input' });
    if (!conformant.ok) return conformant;

    const stepNumber =
      input.stepNumber !== undefined
        ? input.stepNumber
        : this.counters.get(input.participantId) ?? 0;
    const steppedAt = input.steppedAt ?? steppedAtOf(stepNumber);
    const key = `${input.participantId}#${stepNumber}`;
    const existing = this.steps.get(key);
    const priorStateDigest = this.states.get(input.participantId)!.stateDigest;
    if (existing !== undefined) {
      // The sealed record is the truth: identical inputs under the same key
      // replay the sealed exchange; different inputs are a conflict. The
      // prior-state digest is stored for audit, not re-derived on replay.
      const sameInputs = deepEqualNumbers(existing.step.inputs, conformant.value);
      if (!sameInputs) {
        return {
          ok: false,
          error: {
            code: 'replay-conflict',
            message: `step key "${key}" already holds a different exchange — different content under the same key is a replay conflict`,
            key,
            expectedDigest: existing.step.stepDigest,
            encounteredDigest: 'uncomputed (rejected before execution)',
          },
        };
      }
      // Idempotent replay: the sealed prior step, marked duplicate (no state advance).
      return { ok: true, value: { ...existing.step, disposition: 'duplicate' } };
    }

    const priorState = this.states.get(input.participantId)!;
    const exchange = computeStep({
      tenantId: input.tenantId,
      participant: participant.value,
      stepNumber,
      inputs: conformant.value,
      priorState,
      steppedAt,
    });
    this.steps.set(key, { step: exchange, priorStateDigest });
    this.states.set(input.participantId, exchange.state);
    this.counters.set(input.participantId, stepNumber + 1);
    return { ok: true, value: exchange };
  }

  /** The sealed step at an exact key (tenant-scoped read). */
  sealedStep(tenantId: TenantId, participantId: string, stepNumber: number): FmiAdapterResult<StepExchange> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const entry = this.steps.get(`${participantId}#${stepNumber}`);
    if (entry === undefined) {
      return validationFailure(`no sealed step ${stepNumber} for participant "${participantId}"`, [
        { path: '$.step', message: 'unknown step' },
      ]);
    }
    return { ok: true, value: entry.step };
  }

  /** All sealed steps of a participant (sorted by step number). */
  sealedSteps(tenantId: TenantId, participantId: string): FmiAdapterResult<readonly StepExchange[]> {
    const gate = this.tenantGate(tenantId);
    if (!gate.ok) return gate;
    const prefix = `${participantId}#`;
    return {
      ok: true,
      value: [...this.steps.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, entry]) => entry.step)
        .sort((a, b) => a.stepNumber - b.stepNumber),
    };
  }

  /** The fixed parameters of a participant (convenience read). */
  parametersOf(tenantId: TenantId, participantId: string): FmiAdapterResult<Readonly<Record<string, number>>> {
    const participant = this.participant(tenantId, participantId);
    if (!participant.ok) return participant;
    return { ok: true, value: parametersOf(participant.value) };
  }
}

/**
 * The reference simulation adapter: the participant stepping surface.
 * Every invocation steps the participant's CURRENT state with the
 * envelope's input values; the response maps onto the SDK's neutral
 * simulation payload (completed with outputs, or failed with the W005
 * failure vocabulary).
 */
export class FmiSimulationAdapter implements SimulationAdapter {
  readonly descriptor = SIMULATION_ADAPTER_DESCRIPTOR;
  private readonly host: FmiAdapterHost;
  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: {
    readonly host: FmiAdapterHost;
    readonly expectedTenantId?: TenantId | undefined;
  }) {
    this.host = options.host;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The typed domain operation: step a participant (deterministic steppedAt derived from the step number). */
  step(inputs: {
    readonly tenant: TenantId;
    readonly participant: string;
    readonly values: Readonly<Record<string, unknown>>;
  }): FmiAdapterResult<StepExchange> {
    if (this.expectedTenantId !== undefined && inputs.tenant !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this adapter surface is pinned to tenant "${this.expectedTenantId}" — the invocation named tenant "${inputs.tenant}"`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: inputs.tenant,
        },
      };
    }
    return this.host.step({
      tenantId: inputs.tenant,
      participantId: inputs.participant,
      values: inputs.values,
    });
  }

  async invoke(request: AdapterRequestEnvelope<'simulation'>): Promise<AdapterResponseEnvelope<'simulation'>> {
    const outcome = this.invokeTotal(request);
    if (outcome.ok) return outcome.value;
    throw new Error(`adapter invocation failed (${outcome.error.code}): ${outcome.error.message}`);
  }

  /** Total form of {@link invoke} (typed errors, never thrown). */
  invokeTotal(request: AdapterRequestEnvelope<'simulation'>): FmiAdapterResult<AdapterResponseEnvelope<'simulation'>> {
    const admitted = parseAdapterRequest(request);
    if (!admitted.ok) {
      return validationFailure(admitted.error.message, sdkIssues(admitted.error.message));
    }
    const envelope = admitted.value;
    if (envelope.category !== 'simulation') {
      return {
        ok: false,
        error: {
          code: 'binding-conflict',
          message: `this surface implements the simulation contract; the envelope targets ${envelope.category}`,
          expected: 'simulation',
          encountered: envelope.category,
        },
      };
    }
    const binding: BindingPin = envelope.binding;
    if (
      binding.adapterId !== this.descriptor.adapterId ||
      binding.adapterDescriptorDigest !== SIMULATION_ADAPTER_DESCRIPTOR_DIGEST
    ) {
      return {
        ok: false,
        error: {
          code: 'binding-conflict',
          message: `the invocation envelope is not bound to this adapter surface (simulation "${this.descriptor.adapterId}" at revision ${SIMULATION_ADAPTER_DESCRIPTOR_DIGEST})`,
          expected: `${this.descriptor.adapterId}@${SIMULATION_ADAPTER_DESCRIPTOR_DIGEST}`,
          encountered: `${binding.adapterId}@${binding.adapterDescriptorDigest}`,
        },
      };
    }
    const inputs = StepInputSchema.safeParse(envelope.payload.inputs);
    if (!inputs.success) {
      return validationFailure('the neutral step inputs are malformed', inputs.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$.inputs' : `$.inputs.${issue.path.join('.')}`,
        message: issue.message,
      })));
    }
    const domain = this.step({
      tenant: inputs.data.tenant,
      participant: inputs.data.participant,
      values: inputs.data.values,
    });
    if (!domain.ok) {
      if (domain.error.code === 'port-conformance-rejected') {
        // The W005 failure vocabulary carries the conformance rejection.
        const response: AdapterResponseEnvelope<'simulation'> = {
          schemaVersion: 1,
          category: 'simulation',
          binding: {
            capabilityId: this.descriptor.binding.capabilityId,
            capabilityVersion: envelope.binding.capabilityVersion,
            manifestDigest: envelope.binding.manifestDigest,
            adapterId: this.descriptor.adapterId,
            adapterDescriptorDigest: SIMULATION_ADAPTER_DESCRIPTOR_DIGEST,
          },
          payload: {
            status: 'failed',
            failure: { code: 'input-out-of-domain', message: domain.error.message },
          },
        };
        return { ok: true, value: response };
      }
      return domain;
    }
    const response: AdapterResponseEnvelope<'simulation'> = {
      schemaVersion: 1,
      category: 'simulation',
      binding: {
        capabilityId: this.descriptor.binding.capabilityId,
        capabilityVersion: envelope.binding.capabilityVersion,
        manifestDigest: envelope.binding.manifestDigest,
        adapterId: this.descriptor.adapterId,
        adapterDescriptorDigest: SIMULATION_ADAPTER_DESCRIPTOR_DIGEST,
      },
      payload: {
        status: 'completed',
        outputs: {
          outputs: domain.value.outputs as unknown as Record<string, JsonValue>,
          'step-digest': domain.value.stepDigest,
        },
      },
    };
    return { ok: true, value: response };
  }
}

/** Deterministic step instant: a fixed epoch plus one second per step number (no wall-clock in src). */
function steppedAtOf(stepNumber: number): Timestamp {
  const epochMs = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
  return new Date(epochMs + stepNumber * 1000).toISOString();
}

/** Deep numeric-record equality (deterministic; fixed key iteration). */
function deepEqualNumbers(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
