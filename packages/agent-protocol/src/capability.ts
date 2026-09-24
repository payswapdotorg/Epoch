/**
 * Capability declarations: the neutral unit with which a registered agent
 * declares what it can do. A capability is a dot-namespaced, versioned,
 * provider-neutral declaration of inputs, outputs, and stated assumptions.
 *
 * A `CapabilityDeclaration` is a standalone protocol document (validatable on
 * its own, addressed by `capabilityId` at its declared `protocolVersion`) and
 * is embedded in every {@link AgentRegistration}.
 */
import { z } from 'zod';
import { QUALIFIED_NAME_PATTERN, SLUG_PATTERN, PARAMETER_NAME_PATTERN } from './primitives';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from './envelope';
import { AGENT_PROTOCOL_VERSION, ProtocolVersionSchema } from './version';

/** Kinds of values a capability parameter can carry. */
export const PARAMETER_KINDS = [
  'integer',
  'number',
  'string',
  'boolean',
  'enum',
  'entity-reference',
  'json',
] as const;

export type ParameterKind = (typeof PARAMETER_KINDS)[number];

export const ParameterKindSchema = z.enum(PARAMETER_KINDS).meta({
  id: 'ParameterKind',
  title: 'ParameterKind',
  description: 'Value kind of a capability parameter.',
});

/**
 * A single named capability parameter. Refinements (enforced by the runtime
 * validator, not representable in the structural JSON Schema projection):
 * `enumValues` must be present if and only if `kind` is `enum`, and `unit`
 * may only be present for the numeric kinds.
 */
export const ParameterSpecSchema = z
  .strictObject({
    name: z.string().regex(PARAMETER_NAME_PATTERN),
    kind: ParameterKindSchema,
    required: z.boolean(),
    description: z.string().min(1).max(2000),
    enumValues: z.array(z.string().min(1).max(200)).min(1).optional(),
    unit: z.string().min(1).max(64).optional(),
  })
  .refine(
    (spec) => (spec.kind === 'enum') === (spec.enumValues !== undefined),
    'enumValues must be present if and only if kind is "enum"',
  )
  .refine(
    (spec) => spec.unit === undefined || spec.kind === 'integer' || spec.kind === 'number',
    'unit may only be present when kind is "integer" or "number"',
  )
  .meta({
    id: 'ParameterSpec',
    title: 'ParameterSpec',
    description: 'Named capability parameter with value kind, optionality, and description.',
  });

export type ParameterSpec = z.infer<typeof ParameterSpecSchema>;

/**
 * A capability declaration document. Domain is a free kebab slug (e.g.
 * `structural`, `software`) — protocol-level vocabulary carries no vendor or
 * framework semantics.
 */
export const CapabilityDeclarationSchema = z
  .strictObject({
    protocolVersion: ProtocolVersionSchema,
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    summary: z.string().min(1).max(500),
    domain: z.string().regex(SLUG_PATTERN),
    inputs: z.array(ParameterSpecSchema),
    outputs: z.array(ParameterSpecSchema),
    assumptions: z.array(z.string().min(1).max(2000)),
  })
  .meta({
    id: 'CapabilityDeclaration',
    title: 'CapabilityDeclaration',
    description:
      'Provider-neutral declaration of a capability: namespaced id, domain, parameter specs, and stated assumptions.',
  });

export type CapabilityDeclaration = z.infer<typeof CapabilityDeclarationSchema>;

/**
 * Admit a standalone capability declaration (version gate + schema
 * validation + canonical evidence form). Capability declarations carry
 * `protocolVersion` but no message envelope, so no kind gate applies.
 */
export function parseCapabilityDeclaration(input: unknown): ParseOutcome<CapabilityDeclaration> {
  return admitMessage({
    input,
    expectedVersion: AGENT_PROTOCOL_VERSION,
    schema: CapabilityDeclarationSchema,
  });
}

/** Throwing variant of {@link parseCapabilityDeclaration}. */
export function validateCapabilityDeclaration(input: unknown): CapabilityDeclaration {
  return unwrapOrThrow(parseCapabilityDeclaration(input));
}
