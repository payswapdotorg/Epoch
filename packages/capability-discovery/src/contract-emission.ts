/**
 * Deterministic emission of the published contract artifacts under
 * `contracts/capability-discovery/` (the W002-W004 convention).
 *
 * `renderCapabilityDiscoveryContractFiles()` is a pure function: it
 * renders the JSON Schema projection (zod 4 `z.toJSONSchema`,
 * draft 2020-12) of every surface entry plus the manifest (with SHA-256
 * digests of every emitted file) into an ordered map of relative path ->
 * exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/capability-discovery test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants) are enforced by the runtime validators and are not
 * represented in the schema files. The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CAPABILITY_DISCOVERY_SCHEMA_SURFACE } from './surface';
import { CAPABILITY_DISCOVERY_CONTRACT_VERSION, CAPABILITY_DISCOVERY_RECORD_VERSION } from './version';

/** Repository path of the capability-discovery contract directory. */
export const CAPABILITY_DISCOVERY_CONTRACT_DIR = 'contracts/capability-discovery';

/** Render the complete `contracts/capability-discovery` artifact set. */
export function renderCapabilityDiscoveryContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CAPABILITY_DISCOVERY_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/capability-discovery',
    contractVersion: CAPABILITY_DISCOVERY_CONTRACT_VERSION,
    recordVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Capability Discovery contract surface (W045, ACR-004): capability demands, role proposals, candidate profiles, capability gaps, organization proposals + evaluation, content-addressed discovery runs, source-adapter artifacts, promotion records, ecosystem proposals, schedules. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CAPABILITY_DISCOVERY_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/capability-discovery and are not represented in the JSON Schema files',
    emittedBy:
      'renderCapabilityDiscoveryContractFiles() in @epoch/capability-discovery (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:capability-discovery:${typeToKebabCase(typeName)}:${CAPABILITY_DISCOVERY_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `CapabilityDemand` -> `capability-demand`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
