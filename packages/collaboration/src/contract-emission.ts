/**
 * Deterministic emission of the published contract artifacts under
 * `packages/collaboration/schemas/` (same policy as
 * @epoch/capability-registry, @epoch/event-log and @epoch/replay). The
 * emission is pure: two renders are byte-identical. Regenerate after an
 * intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/collaboration test contract-drift
 *
 * Note: schemas that embed foreign kernel vocabularies (world-model
 * EntityId, action-protocol ProposalReference, agent-protocol
 * Timestamp/JsonValue) project those as shared `$defs` entries keyed by
 * their upstream meta ids — the vocabulary reuse is visible in the
 * emitted JSON Schema.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { COLLABORATION_SCHEMA_SURFACE } from './surface';
import { COLLABORATION_CONTRACT_VERSION, COLLABORATION_RECORD_VERSION } from './version';

/** Repository path of the collaboration contract directory (inside the package). */
export const COLLABORATION_CONTRACT_DIR = 'packages/collaboration/schemas';

/** Render the complete `packages/collaboration/schemas` artifact set. */
export function renderCollaborationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of COLLABORATION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/collaboration',
    contractVersion: COLLABORATION_CONTRACT_VERSION,
    recordVersion: COLLABORATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Collaboration contract surface (W010): session-based presence/coordination over the shared model — tenant-scoped sessions, opaque principal membership, presence events, and session-scoped coordination envelopes. A coordination surface, never a second authority. JSON Schema projection under schemas/; runtime validators in @epoch/collaboration.',
    dataTypes: COLLABORATION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (session scope workspace-with-project, per-kind event member consistency, membership/presence invariants) are enforced by the runtime validators in @epoch/collaboration and are not represented in the JSON Schema files',
    emittedBy:
      'renderCollaborationContractFiles() in @epoch/collaboration (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:collaboration:${typeToKebabCase(typeName)}:${COLLABORATION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `CollaborationSession` -> `collaboration-session`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
