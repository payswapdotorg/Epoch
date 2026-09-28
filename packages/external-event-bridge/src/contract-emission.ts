/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderExternalEventBridgeContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/external-event-bridge/schemas` (the
 * W006/W007/W009/W023/W036/W041 in-package convention);
 * `renderExternalEventBridgePublicContractFiles()` renders the CORE
 * record projection under `contracts/external-event-bridge/` (the W012
 * public-contract convention: schemas/ + manifest). Both are pure
 * functions: each schema file is self-contained with a versioned `$id`
 * `urn:epoch:external-event-bridge:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered
 * maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/external-event-bridge test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, digest verification, tenant checks, scope chains) are
 * enforced by the runtime validators and are not represented in the
 * schema files. The manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CORE_RECORD_SURFACE, EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE } from './surface';
import { EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION, EXTERNAL_EVENT_BRIDGE_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const EXTERNAL_EVENT_BRIDGE_CONTRACT_DIR = 'packages/external-event-bridge/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const EXTERNAL_EVENT_BRIDGE_PUBLIC_CONTRACT_DIR = 'contracts/external-event-bridge';

/** Render the complete `packages/external-event-bridge/schemas` artifact set. */
export function renderExternalEventBridgeContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/external-event-bridge',
    contractVersion: EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION,
    recordVersion: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral External Event Bridge contract surface (W042, in-package full surface): normalized inbound external events with W006-shaped provenance and the W036-shaped observation intake proposals (the authority path), the four-class outbound requests with least-privilege filtered payloads and the W041 projection-policy reference, typed retry policies and content-addressed per-attempt receipts, provider registrations with class-based resolution, the provider-unavailability records with fallback/manual-queue/alternative-provider semantics, and the bridge:* event vocabulary over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/external-event-bridge.',
    dataTypes: EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, digest verification, tenant checks, scope chains) are enforced by the runtime validators in @epoch/external-event-bridge and are not represented in the JSON Schema files',
    emittedBy:
      'renderExternalEventBridgeContractFiles() in @epoch/external-event-bridge (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the public `contracts/external-event-bridge` artifact set (the core records). */
export function renderExternalEventBridgePublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/external-event-bridge',
    contractVersion: EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION,
    recordVersion: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral External Event Bridge public contract surface (W042, W012 convention): the CORE record types a provider adapter or downstream consumer binds to — the sealed external event, the W036-shaped observation intake proposal, the four-class outbound request with its least-privilege filtered payload and projection reference, the typed retry policy and per-attempt delivery receipts, the sealed provider registration, the provider-unavailability record with fallback semantics, the manual-queue work item, and the W010-shaped bridge event record. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, digest verification, tenant checks, scope chains) are enforced by the runtime validators in @epoch/external-event-bridge and are not represented in the JSON Schema files',
    emittedBy:
      'renderExternalEventBridgePublicContractFiles() in @epoch/external-event-bridge (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:external-event-bridge:${typeToKebabCase(typeName)}:${EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `SealedExternalEvent` -> `sealed-external-event`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
