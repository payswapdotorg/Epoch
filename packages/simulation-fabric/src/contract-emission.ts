/**
 * Deterministic emission of the published contract artifacts under
 * `packages/simulation-fabric/schemas/` (same policy as
 * @epoch/capability-registry, @epoch/tenancy, @epoch/event-log,
 * @epoch/agent-orchestration and @epoch/solution-delivery). The emission
 * is pure: two renders are byte-identical. Regenerate after an
 * intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/simulation-fabric test contract-drift
 *
 * Note: schemas that embed foreign kernel vocabularies (simulation-
 * protocol registration/request/result/reference shapes, agent-protocol
 * Timestamp, tenancy TenantId) project those as shared `$defs` entries
 * keyed by their upstream meta ids — the vocabulary reuse is visible in
 * the emitted JSON Schema (the W011/W020 emission precedent).
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { SIMULATION_FABRIC_SCHEMA_SURFACE } from './surface';
import { SIMULATION_FABRIC_CONTRACT_VERSION, SIMULATION_FABRIC_RECORD_VERSION } from './version';

/** Repository path of the simulation-fabric contract directory (inside the package). */
export const SIMULATION_FABRIC_CONTRACT_DIR = 'packages/simulation-fabric/schemas';

/** Render the complete `packages/simulation-fabric/schemas` artifact set. */
export function renderSimulationFabricContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of SIMULATION_FABRIC_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/simulation-fabric',
    contractVersion: SIMULATION_FABRIC_CONTRACT_VERSION,
    recordVersion: SIMULATION_FABRIC_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Simulation Execution Fabric contract surface (W021): content-addressed simulation runs over the W005 simulation protocol, opaque capability binding references, the sealed append-only run state chain (previousRunDigest chaining), the simulation:* event vocabulary over the W010 event shapes, and the execution-port seam. JSON Schema projection under schemas/; runtime validators in @epoch/simulation-fabric.',
    dataTypes: SIMULATION_FABRIC_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (W010 causal-parent ordering on event content) and semantic admission gates (W005 pipeline admission, cross-document conformance, state-chain integrity, idempotency bookkeeping) are enforced by the runtime validators in @epoch/simulation-fabric and are not represented in the JSON Schema files',
    emittedBy:
      'renderSimulationFabricContractFiles() in @epoch/simulation-fabric (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:simulation-fabric:${typeToKebabCase(typeName)}:${SIMULATION_FABRIC_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `CompiledPlanStep` -> `compiled-plan-step`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
