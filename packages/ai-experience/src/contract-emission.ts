/**
 * Deterministic emission of the published contract artifacts under
 * `packages/ai-experience/schemas/` (same policy as
 * @epoch/capability-registry, @epoch/event-log, @epoch/collaboration and
 * @epoch/replay). The emission is pure: two renders are byte-identical.
 * Regenerate after an intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/ai-experience test contract-drift
 *
 * Note: schemas that embed foreign vocabularies (agent-protocol
 * MessageId/Timestamp/JsonValue, event-log EventStreamId/EventSequence,
 * experience-protocol ProjectedReference) project those as shared `$defs`
 * entries keyed by their upstream meta ids — the vocabulary reuse is
 * visible in the emitted JSON Schema.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { AI_EXPERIENCE_SCHEMA_SURFACE } from './surface';
import { AI_EXPERIENCE_CONTRACT_VERSION, AI_EXPERIENCE_RECORD_VERSION } from './version';

/** Repository path of the AI-experience contract directory (inside the package). */
export const AI_EXPERIENCE_CONTRACT_DIR = 'packages/ai-experience/schemas';

/** Render the complete `packages/ai-experience/schemas` artifact set. */
export function renderAiExperienceContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of AI_EXPERIENCE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/ai-experience',
    contractVersion: AI_EXPERIENCE_CONTRACT_VERSION,
    recordVersion: AI_EXPERIENCE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral AI-experience contract surface (W015): tenant-scoped collaboration-session descriptors with human/agent role grants, agent presence/focus states, the typed interaction-intent vocabulary (Universal-interaction subsets), takeover/release transitions with provenance, Engineering Moment records (content-addressed), collaboration event adapters over the W010 event shapes, and deterministic projection folds. Semantics as typed data over the event-sourced substrate — never a second authority. JSON Schema projection under schemas/; runtime validators in @epoch/ai-experience.',
    dataTypes: AI_EXPERIENCE_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (role/snapshot/evidence ordering and uniqueness, agent/human kind consistency, single-controller, presence member consistency) are enforced by the runtime validators in @epoch/ai-experience and are not represented in the JSON Schema files',
    emittedBy:
      'renderAiExperienceContractFiles() in @epoch/ai-experience (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:ai-experience:${typeToKebabCase(typeName)}:${AI_EXPERIENCE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `AiSessionDescriptor` -> `ai-session-descriptor`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
