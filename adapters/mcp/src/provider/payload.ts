/**
 * @epoch/adapter-mcp — the PROVIDER seam (the tool protocol's
 * vocabulary allowed HERE and ONLY here).
 *
 * These schemas parse the fixture payloads that stand in for the tool
 * protocol's discovery responses (the W020/W022 reference precedent: no
 * live network calls; fixtures carry the protocol's shapes). Everything
 * the protocol names — the protocol identity, the descriptor field
 * names, the tool-name grammar — stays inside this directory and is
 * TRANSLATED by the neutral layer into typed invocation surfaces. The
 * neutrality blocklist test (test/neutrality.test.ts) enforces that no
 * protocol token escapes the provider layer into the neutral seam
 * modules.
 *
 * Strict objects throughout: unknown fields in provider payloads are
 * rejected with typed issues (`unknown-provider-payload`), never
 * silently ignored.
 */
import { z } from 'zod';

/** The provider fixture envelope version (exactly one pinned form). */
export const PROVIDER_CATALOG_VERSION = 1 as const;

/** The tool-protocol identity carried by fixtures (provider data). */
export const PROVIDER_PROTOCOL_NAME = 'mcp' as const;

/** The tool-name grammar (the protocol's own grammar). */
const PROVIDER_TOOL_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

/** The declared value kinds of a tool argument (the fixture form). */
const PROVIDER_VALUE_KINDS = ['string', 'number', 'boolean'] as const;

/** One declared argument of a tool, in the protocol's shape. */
export const ProviderToolArgumentSchema = z
  .strictObject({
    name: z.string().regex(PROVIDER_TOOL_NAME_PATTERN),
    valueKind: z.enum(PROVIDER_VALUE_KINDS),
    required: z.boolean(),
    description: z.string().min(1).max(2000),
  })
  .readonly();

export type ProviderToolArgument = z.infer<typeof ProviderToolArgumentSchema>;

/** One discovered tool, in the protocol's shape. */
export const ProviderToolSchema = z
  .strictObject({
    name: z.string().regex(PROVIDER_TOOL_NAME_PATTERN),
    description: z.string().min(1).max(2000),
    inputArguments: z.array(ProviderToolArgumentSchema).min(1).max(64),
    outputSummary: z.string().min(1).max(2000),
  })
  .readonly()
  .superRefine((tool, ctx) => {
    const names = new Set(tool.inputArguments.map((argument) => argument.name));
    if (names.size !== tool.inputArguments.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'tool argument names must be unique within a tool',
        path: ['inputArguments'],
      });
    }
  });

export type ProviderTool = z.infer<typeof ProviderToolSchema>;

/**
 * One tool-catalog fixture: the typed stand-in for a discovery
 * response. Tools are unique by name.
 */
export const ProviderToolCatalogSchema = z
  .strictObject({
    schemaVersion: z.literal(PROVIDER_CATALOG_VERSION),
    protocol: z.literal(PROVIDER_PROTOCOL_NAME),
    tools: z.array(ProviderToolSchema).min(1).max(256),
  })
  .readonly()
  .superRefine((catalog, ctx) => {
    const names = new Set(catalog.tools.map((tool) => tool.name));
    if (names.size !== catalog.tools.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'tool names must be unique within a catalog',
        path: ['tools'],
      });
    }
  });

export type ProviderToolCatalog = z.infer<typeof ProviderToolCatalogSchema>;

/** Total parse outcome of the provider seam (typed; never throws). */
export type ProviderCatalogParse =
  | { readonly success: true; readonly data: ProviderToolCatalog }
  | { readonly success: false; readonly error: z.ZodError };

/**
 * The neutral tool reference derived from a provider tool name
 * (`tool:<slug>` — the tool's identity rides as data; the protocol's
 * grammar is translated at the provider seam).
 */
export function neutralToolRefOf(providerToolName: string): string {
  return `tool:${providerToolName.replace(/_/g, '-')}`;
}

/**
 * The neutral W007 capability id derived from a provider tool name
 * (`tool.<sanitized-segments>` — the qualified-name grammar requires a
 * hyphen-free first segment, so the tool slug is normalized here).
 */
export function neutralToolCapabilityIdOf(providerToolName: string): string {
  const slug = providerToolName.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return `tool.${slug || 'unnamed'}`;
}

/**
 * Total parse of a provider payload (the provider seam's ONLY entrance
 * for untrusted bytes). Unknown shapes, unknown fields, and envelope
 * skew are typed issues — the caller surfaces them as
 * `unknown-provider-payload` (never a partial silent load).
 */
export function parseProviderCatalog(input: unknown): ProviderCatalogParse {
  return ProviderToolCatalogSchema.safeParse(input);
}
