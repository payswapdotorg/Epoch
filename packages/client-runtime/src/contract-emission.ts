/**
 * Deterministic emission of the published contract artifacts under
 * `contracts/application-gateway/` (the W002-W004/W045 convention).
 *
 * `renderApplicationGatewayContractFiles()` is a pure function: it renders
 * the JSON Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of
 * every surface entry plus the manifest (with SHA-256 digests of every
 * emitted file) into an ordered map of relative path -> exact file
 * content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/client-runtime test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants, id-grammar agreement) are enforced by the runtime
 * validators and are not represented in the schema files. The manifest
 * records this explicitly.
 */
import { z } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { APPLICATION_GATEWAY_SCHEMA_SURFACE } from './surface';
import { APPLICATION_GATEWAY_CONTRACT_VERSION, CLIENT_RUNTIME_RECORD_VERSION } from './version';

/** Repository path of the application-gateway contract directory. */
export const APPLICATION_GATEWAY_CONTRACT_DIR = 'contracts/application-gateway';

/** Render the complete `contracts/application-gateway` artifact set. */
export function renderApplicationGatewayContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of APPLICATION_GATEWAY_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/application-gateway',
    contractVersion: APPLICATION_GATEWAY_CONTRACT_VERSION,
    recordVersion: CLIENT_RUNTIME_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Application Gateway contract surface (W046, ACR-005): the client-facing operation vocabulary + request/response envelopes, the recoverable client error taxonomy, correlation, the typed IdempotentReplay, offline admission (pending projections only, five named negatives), session references and the projection cache — shared by web/desktop/mobile. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: APPLICATION_GATEWAY_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/client-runtime and are not represented in the JSON Schema files',
    emittedBy:
      'renderApplicationGatewayContractFiles() in @epoch/client-runtime (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: z.ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:application-gateway:${typeToKebabCase(typeName)}:${APPLICATION_GATEWAY_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `GatewayOutcome` -> `gateway-outcome`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
