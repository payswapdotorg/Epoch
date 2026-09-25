/**
 * Deterministic emission of the published contract artifacts under
 * `packages/world-experience/schemas/` (same policy as @epoch/tenancy —
 * the W007/W009 in-package convention). Regenerate after an intentional
 * schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/world-experience test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, resolvability gates) are enforced by
 * the runtime validators and are not represented in the schema files.
 * The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { WORLD_EXPERIENCE_SCHEMA_SURFACE } from './surface';
import {
  WORLD_EXPERIENCE_CONTRACT_VERSION,
  WORLD_EXPERIENCE_DOCUMENT_KINDS,
  WORLD_EXPERIENCE_PROTOCOL_VERSION,
} from './version';

/** Repository path of the world-experience contract directory (inside the package). */
export const WORLD_EXPERIENCE_CONTRACT_DIR = 'packages/world-experience/schemas';

/** Render the complete `packages/world-experience/schemas` artifact set. */
export function renderWorldExperienceContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of WORLD_EXPERIENCE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/world-experience',
    contractVersion: WORLD_EXPERIENCE_CONTRACT_VERSION,
    protocolVersion: WORLD_EXPERIENCE_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral World Experience contract surface (W016): the interactive-world domain model — world scene/view descriptors (Experience Graph vocabulary), camera/follow semantics, the world-subset interaction-intent vocabulary, the pack-contributable domain visual ontology, typed fidelity projections, and renderer-envelope compilers (W013-shaped mount/advance/submit envelopes). JSON Schema projection under schemas/; runtime validators in @epoch/world-experience.',
    dataTypes: WORLD_EXPERIENCE_SCHEMA_SURFACE.map((entry) => entry.type),
    documentKinds: [...WORLD_EXPERIENCE_DOCUMENT_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical collection ordering, cross-field invariants, reference resolvability, replay bounds, executable-UI gates) are enforced by the runtime validators in @epoch/world-experience and are not represented in the JSON Schema files',
    emittedBy:
      'renderWorldExperienceContractFiles() in @epoch/world-experience (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:world-experience:${typeToKebabCase(typeName)}:${WORLD_EXPERIENCE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `WorldScene` -> `world-scene`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
