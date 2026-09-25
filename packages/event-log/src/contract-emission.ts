/**
 * Deterministic emission of the published contract artifacts under
 * `packages/event-log/schemas/` (same policy as
 * @epoch/capability-registry, @epoch/tenancy and @epoch/identity). The
 * emission is pure: two renders are byte-identical. Regenerate after an
 * intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/event-log test contract-drift
 *
 * Note: schemas that embed foreign kernel vocabularies (world-model
 * EntityId, action-protocol ProposalReference/ActionTypeReference,
 * agent-protocol Timestamp/JsonValue) project those as shared `$defs`
 * entries keyed by their upstream meta ids — the vocabulary reuse is
 * visible in the emitted JSON Schema (the W011 experience-protocol
 * emission precedent).
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EVENT_LOG_SCHEMA_SURFACE } from './surface';
import { EVENT_LOG_CONTRACT_VERSION, EVENT_LOG_RECORD_VERSION } from './version';

/** Repository path of the event-log contract directory (inside the package). */
export const EVENT_LOG_CONTRACT_DIR = 'packages/event-log/schemas';

/** Render the complete `packages/event-log/schemas` artifact set. */
export function renderEventLogContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EVENT_LOG_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/event-log',
    contractVersion: EVENT_LOG_CONTRACT_VERSION,
    recordVersion: EVENT_LOG_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Event Log contract surface (W010): the authoritative append-only change history as totally-ordered per-stream typed events with actor/tenant scoping, causal references, payload discriminators and content digests. JSON Schema projection under schemas/; runtime validators in @epoch/event-log.',
    dataTypes: EVENT_LOG_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (intra-stream causal parents, kernel payload contracts for reserved namespaces, snapshot ordering/projection consistency) are enforced by the runtime validators in @epoch/event-log and are not represented in the JSON Schema files',
    emittedBy:
      'renderEventLogContractFiles() in @epoch/event-log (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:event-log:${typeToKebabCase(typeName)}:${EVENT_LOG_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `EventRecord` -> `event-record`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
