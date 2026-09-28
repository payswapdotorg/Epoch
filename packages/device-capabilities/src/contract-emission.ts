/**
 * Deterministic emission of the published contract artifacts under
 * `packages/device-capabilities/schemas/` (the W007/W009/W015/W016
 * in-package convention — the shared contracts/ tree is NOT in this Work
 * Order's owned surfaces).
 *
 * `renderDeviceCapabilitiesContractFiles()` is a pure function: it
 * renders the JSON Schema projection (zod 4 `z.toJSONSchema`, draft
 * 2020-12) of every surface entry plus the manifest (with SHA-256
 * digests of every emitted file) into an ordered map of relative path ->
 * exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares
 * byte-for-byte, so committed artifacts can never drift from the
 * implementation schemas. To regenerate after an intentional schema
 * change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/device-capabilities test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * set ordering, derivation consistency) are enforced by the runtime
 * validators and are not represented in the schema files. The manifest
 * records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { DEVICE_CAPABILITIES_SCHEMA_SURFACE } from './surface';
import {
  DEVICE_CAPABILITIES_CONTRACT_VERSION,
  DEVICE_CAPABILITIES_DOCUMENT_KINDS,
  DEVICE_CAPABILITIES_PROTOCOL_VERSION,
} from './version';

/** Repository path of the device-capabilities contract directory (inside the package). */
export const DEVICE_CAPABILITIES_CONTRACT_DIR = 'packages/device-capabilities/schemas';

/** Render the complete `packages/device-capabilities/schemas` artifact set. */
export function renderDeviceCapabilitiesContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of DEVICE_CAPABILITIES_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/device-capabilities',
    contractVersion: DEVICE_CAPABILITIES_CONTRACT_VERSION,
    protocolVersion: DEVICE_CAPABILITIES_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral device-capabilities contract (W019, device-side adaptation): canonical device-class profiles filling the W011 device slot, deterministic sealed capability assessments (adaptation tier + derivation trace), and presentation fit/gap analysis. JSON Schema projection under schemas/; runtime validators in @epoch/device-capabilities.',
    dataTypes: DEVICE_CAPABILITIES_SCHEMA_SURFACE.map((entry) => entry.type),
    documentKinds: [...DEVICE_CAPABILITIES_DOCUMENT_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical set ordering, derivation consistency) are enforced by the runtime validators in @epoch/device-capabilities and are not represented in the JSON Schema files',
    emittedBy:
      'renderDeviceCapabilitiesContractFiles() in @epoch/device-capabilities (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:device-capabilities:${typeToKebabCase(typeName)}:${DEVICE_CAPABILITIES_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `DeviceClassProfile` -> `device-class-profile`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
