/**
 * Deterministic emission of the published contract artifacts under
 * `packages/renderer-adapters/schemas/` (the W007/W009/W015/W016
 * in-package convention — the shared contracts/ tree is NOT in this Work
 * Order's owned surfaces).
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares
 * byte-for-byte, so committed artifacts can never drift from the
 * implementation schemas. To regenerate after an intentional schema
 * change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/renderer-adapters test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (trace
 * consistency, canonical step order) are enforced by the runtime
 * validators and are not represented in the schema files. The manifest
 * records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { RENDERER_ADAPTERS_SCHEMA_SURFACE } from './surface';
import {
  RENDERER_ADAPTERS_CONTRACT_VERSION,
  RENDERER_ADAPTERS_DOCUMENT_KINDS,
  RENDERER_ADAPTERS_PROTOCOL_VERSION,
} from './version';

/** Repository path of the renderer-adapters contract directory (inside the package). */
export const RENDERER_ADAPTERS_CONTRACT_DIR = 'packages/renderer-adapters/schemas';

/** Render the complete `packages/renderer-adapters/schemas` artifact set. */
export function renderRendererAdaptersContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of RENDERER_ADAPTERS_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/renderer-adapters',
    contractVersion: RENDERER_ADAPTERS_CONTRACT_VERSION,
    protocolVersion: RENDERER_ADAPTERS_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral renderer-adapters contract (W019, renderer-side adaptation): the neutral technique vocabulary and catalog, deterministic adapter selections over W013 bindings and W019 assessments (full decision traces), mount plans projected onto W013 mount-graph envelopes, and the append-only adaptation-event vocabulary over the mirrored W010 shapes (renderer-adapter:* namespace). JSON Schema projection under schemas/; runtime validators in @epoch/renderer-adapters.',
    dataTypes: RENDERER_ADAPTERS_SCHEMA_SURFACE.map((entry) => entry.type),
    documentKinds: [...RENDERER_ADAPTERS_DOCUMENT_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements (trace consistency, canonical step order, digest chaining) are enforced by the runtime validators in @epoch/renderer-adapters and are not represented in the JSON Schema files',
    emittedBy:
      'renderRendererAdaptersContractFiles() in @epoch/renderer-adapters (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:renderer-adapters:${typeToKebabCase(typeName)}:${RENDERER_ADAPTERS_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `RendererAdapterSelection` -> `renderer-adapter-selection`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
