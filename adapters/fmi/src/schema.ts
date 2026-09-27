/**
 * @epoch/adapter-fmi — runtime zod validators for the published
 * contract types (the NEUTRAL seam; the co-simulation standard's
 * vocabulary is absent by construction — pinned by
 * test/neutrality.test.ts).
 *
 * Strict objects throughout: unknown fields are rejected, so
 * standard-specific semantics cannot enter the neutral records through
 * any door.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { FMI_ADAPTER_RECORD_VERSION } from './version';
import { PORT_DIRECTIONS, STEP_DISPOSITIONS } from './version';

const recordVersion = z.literal(FMI_ADAPTER_RECORD_VERSION);
const digest = z.string().regex(/^[0-9a-f]{64}$/, 'lowercase hex SHA-256 (64 characters)');

/** Neutral participant identity: `participant:` + slug. */
export const ParticipantIdSchema = z
  .string()
  .regex(/^participant:[a-z0-9][a-z0-9-]{0,63}$/, "participant ids are 'participant:' + slug (standard-neutral)");

/** Port name (the neutral grammar). */
const PortName = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);

/** Numeric port values record. */
const PortValues = z.record(PortName, z.number().finite());

export const ParticipantPortSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    name: PortName,
    direction: z.enum(PORT_DIRECTIONS),
    valueKind: z.literal('number'),
    unit: z.string().min(1).max(64).optional(),
    startValue: z.number().finite(),
    contentDigest: digest,
  })
  .readonly();

export const TypedParticipantSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    participantId: ParticipantIdSchema,
    displayName: z.string().min(1).max(200),
    modelIdentity: z.string().min(1).max(128),
    ports: z.array(ParticipantPortSchema).min(2).readonly(),
    descriptorDigest: digest,
    contentDigest: digest,
  })
  .readonly()
  .superRefine((participant, ctx) => {
    const names = participant.ports.map((port) => port.name);
    const sorted = [...names].sort();
    if (names.some((name, index) => name !== sorted[index])) {
      ctx.addIssue({ code: 'custom', message: 'ports must be sorted by name ascending', path: ['ports'] });
    }
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', message: 'port names must be unique within a participant', path: ['ports'] });
    }
    if (!participant.ports.some((port) => port.direction === 'output')) {
      ctx.addIssue({ code: 'custom', message: 'a participant must declare at least one output port', path: ['ports'] });
    }
    if (!participant.ports.some((port) => port.direction === 'input')) {
      ctx.addIssue({ code: 'custom', message: 'a participant must declare at least one input port', path: ['ports'] });
    }
  });

export const ParticipantStateSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    participantId: ParticipantIdSchema,
    values: PortValues.readonly(),
    stateDigest: digest,
  })
  .readonly();

export const StepExchangeSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    participantId: ParticipantIdSchema,
    stepNumber: z.number().int().nonnegative().max(1_000_000_000),
    inputs: PortValues.readonly(),
    outputs: PortValues.readonly(),
    parameters: PortValues.readonly(),
    state: ParticipantStateSchema,
    disposition: z.enum(STEP_DISPOSITIONS),
    steppedAt: TimestampSchema,
    stepDigest: digest,
  })
  .readonly()
  .superRefine((step, ctx) => {
    const outputs = Object.keys(step.outputs);
    if (outputs.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'a step exchange must carry at least one output', path: ['outputs'] });
    }
    for (const output of outputs) {
      if (step.state.values[output] !== step.outputs[output]) {
        ctx.addIssue({
          code: 'custom',
          message: 'each output value must equal the post-step state value of its port',
          path: ['outputs'],
        });
        break;
      }
    }
  });

/** The neutral step input (the W007 simulation envelope's inputs — parameter-name keys are lowercase kebab). */
export const StepInputSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    participant: ParticipantIdSchema,
    /** The step number to execute (default: the participant's next step). */
    step: z.number().int().nonnegative().max(1_000_000_000).optional(),
    /** The input-port values for the step. */
    values: PortValues,
  })
  .readonly();
