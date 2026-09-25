/**
 * Deterministic emission of the published contract artifacts under
 * `packages/agent-orchestration/schemas/` (same policy as
 * @epoch/capability-registry, @epoch/tenancy and @epoch/event-log). The
 * emission is pure: two renders are byte-identical. Regenerate after an
 * intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/agent-orchestration test contract-drift
 *
 * Note: schemas that embed foreign kernel vocabularies (agent-protocol
 * AgentId/Timestamp, action-protocol ProposalReference, capability-registry
 * CapabilityId/SemverCore/CapabilityCategory) project those as shared
 * `$defs` entries keyed by their upstream meta ids — the vocabulary reuse
 * is visible in the emitted JSON Schema (the W011 experience-protocol
 * emission precedent).
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { AGENT_ORCHESTRATION_SCHEMA_SURFACE } from './surface';
import {
  AGENT_ORCHESTRATION_CONTRACT_VERSION,
  ORCHESTRATION_RECORD_VERSION,
} from './version';

/** Repository path of the agent-orchestration contract directory (inside the package). */
export const AGENT_ORCHESTRATION_CONTRACT_DIR = 'packages/agent-orchestration/schemas';

/** Render the complete `packages/agent-orchestration/schemas` artifact set. */
export function renderAgentOrchestrationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of AGENT_ORCHESTRATION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/agent-orchestration',
    contractVersion: AGENT_ORCHESTRATION_CONTRACT_VERSION,
    recordVersion: ORCHESTRATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Agent Orchestration contract surface (W020): tenant-scoped plans with steps as typed action-proposal references, capability-scoped agent bindings, deterministic content-addressed plan compilation, retry policies as typed data, idempotency keys, sessions and proposal handoffs. JSON Schema projection under schemas/; runtime validators in @epoch/agent-orchestration.',
    dataTypes: AGENT_ORCHESTRATION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (unique capability pins within an agent descriptor, compiled stepCount consistency) and semantic admission gates (topological ordering, proposal-set resolution, registry binding) are enforced by the runtime validators in @epoch/agent-orchestration and are not represented in the JSON Schema files',
    emittedBy:
      'renderAgentOrchestrationContractFiles() in @epoch/agent-orchestration (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:agent-orchestration:${typeToKebabCase(typeName)}:${AGENT_ORCHESTRATION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `CompiledPlanStep` -> `compiled-plan-step`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
