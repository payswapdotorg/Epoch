/**
 * @epoch/adapter-fmi — the PROVIDER seam (the co-simulation standard's
 * vocabulary allowed HERE and ONLY here).
 *
 * These schemas parse the fixture payloads that stand in for
 * co-simulation participant model descriptions (the W020/W022 reference
 * precedent: no live runtimes, no network; fixtures carry the standard's
 * shapes). Everything the standard names — the standard identity, the
 * model-description field names, the capability flags — stays inside
 * this directory and is TRANSLATED by the neutral layer into typed
 * participants, ports, and steps. The neutrality blocklist test
 * (test/neutrality.test.ts) enforces that no standard token escapes the
 * provider layer into the neutral seam modules.
 *
 * Strict objects throughout: unknown fields in provider payloads are
 * rejected with typed issues (`unknown-provider-payload`), never
 * silently ignored.
 */
import { z } from 'zod';

/** The provider fixture envelope version (exactly one pinned form). */
export const PROVIDER_DESCRIPTOR_VERSION = 1 as const;

/** The co-simulation standard identity carried by fixtures (provider data). */
export const PROVIDER_STANDARD_NAME = 'fmi' as const;

/** The supported standard versions (the fixture form). */
export const PROVIDER_STANDARD_VERSIONS = ['2.0', '3.0'] as const;

/** The model-name grammar (the standard's own grammar). */
const PROVIDER_MODEL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;

/** The model identity grammar (a globally unique id, hex). */
const PROVIDER_GUID_PATTERN = /^[0-9a-f]{32}$/;

/** The standard's variable-name grammar. */
const PROVIDER_VARIABLE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

/** The standard's causality classes (the fixture form). */
export const PROVIDER_CAUSALITIES = ['input', 'output', 'parameter'] as const;

/** One variable of the model description, in the standard's shape. */
export const ProviderVariableSchema = z
  .strictObject({
    name: z.string().regex(PROVIDER_VARIABLE_PATTERN),
    causality: z.enum(PROVIDER_CAUSALITIES),
    unit: z.string().min(1).max(64).optional(),
    start: z.number().finite(),
  })
  .readonly();

export type ProviderVariable = z.infer<typeof ProviderVariableSchema>;

/**
 * One participant-model descriptor: the typed stand-in for a
 * co-simulation model description. The model identity is unique; the
 * variables declare the participant's ports (inputs, outputs,
 * parameters with start values).
 */
export const ProviderParticipantSchema = z
  .strictObject({
    schemaVersion: z.literal(PROVIDER_DESCRIPTOR_VERSION),
    standard: z.literal(PROVIDER_STANDARD_NAME),
    standardVersion: z.enum(PROVIDER_STANDARD_VERSIONS),
    modelName: z.string().regex(PROVIDER_MODEL_NAME_PATTERN),
    modelIdentity: z.string().regex(PROVIDER_GUID_PATTERN),
    variables: z.array(ProviderVariableSchema).min(2).max(128),
  })
  .readonly()
  .superRefine((participant, ctx) => {
    const names = new Set(participant.variables.map((variable) => variable.name));
    if (names.size !== participant.variables.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'variable names must be unique within a model description',
        path: ['variables'],
      });
    }
    const hasOutput = participant.variables.some((variable) => variable.causality === 'output');
    if (!hasOutput) {
      ctx.addIssue({
        code: 'custom',
        message: 'a model description must declare at least one output variable',
        path: ['variables'],
      });
    }
    const hasInput = participant.variables.some((variable) => variable.causality === 'input');
    if (!hasInput) {
      ctx.addIssue({
        code: 'custom',
        message: 'a model description must declare at least one input variable',
        path: ['variables'],
      });
    }
  });

export type ProviderParticipant = z.infer<typeof ProviderParticipantSchema>;

/** Total parse outcome of the provider seam (typed; never throws). */
export type ProviderParticipantParse =
  | { readonly success: true; readonly data: ProviderParticipant }
  | { readonly success: false; readonly error: z.ZodError };

/**
 * The neutral participant identity derived from a provider model
 * description (`participant:<slug>` — the model's identity rides as
 * data; the standard's grammar is translated at the provider seam).
 */
export function neutralParticipantIdOf(participant: ProviderParticipant): string {
  return `participant:${participant.modelName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
}

/**
 * The provider's own causality classes, mapped to neutral port
 * directions HERE (the standard's vocabulary is translated at the
 * provider seam; the neutral layer never spells the causality field).
 */
export function neutralDirectionOf(variable: ProviderVariable): 'input' | 'output' | 'parameter' {
  return variable.causality;
}

/**
 * Total parse of a provider payload (the provider seam's ONLY entrance
 * for untrusted bytes). Unknown shapes, unknown fields, and envelope
 * skew are typed issues — the caller surfaces them as
 * `unknown-provider-payload` (never a partial silent load).
 */
export function parseProviderParticipant(input: unknown): ProviderParticipantParse {
  return ProviderParticipantSchema.safeParse(input);
}
