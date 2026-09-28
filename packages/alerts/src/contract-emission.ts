/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderAlertsContractFiles()` renders the IN-PACKAGE full surface
 * under `packages/alerts/schemas` (the W006/W007/W009/W023/W036/W038
 * in-package convention). The PUBLIC core-record projection under
 * `contracts/supervision` is composed with the supervision-kernel core
 * records by the supervision-runtime service (the only W043 component
 * depending on both kernels).
 *
 * The rendered artifacts are COMMITTED and drift-pinned byte-for-byte
 * by test/contract-drift.test.ts. To regenerate:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/alerts test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { ALERTS_SCHEMA_SURFACE } from './surface';
import { ALERTS_CONTRACT_VERSION, ALERTS_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const ALERTS_CONTRACT_DIR = 'packages/alerts/schemas';

/** Render the complete `packages/alerts/schemas` artifact set. */
export function renderAlertsContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of ALERTS_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/alerts',
    contractVersion: ALERTS_CONTRACT_VERSION,
    recordVersion: ALERTS_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Alerts contract surface (W043, in-package full surface): severity + escalation policy as sealed versioned data (finding class token + status -> severity -> escalation path), alert records as append-only revision chains with idempotent deduplication, escalation outcomes bound to verifiable W003 gateway decisions, and typed notifications over the closed neutral channel vocabulary. JSON Schema projection under schemas/; runtime validators in @epoch/alerts.',
    dataTypes: ALERTS_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, chain checks, digest verification) are enforced by the runtime validators in @epoch/alerts and are not represented in the JSON Schema files',
    emittedBy:
      'renderAlertsContractFiles() in @epoch/alerts (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:alerts:${typeToKebabCase(typeName)}:${ALERTS_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `AlertRecordContent` -> `alert-record-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
