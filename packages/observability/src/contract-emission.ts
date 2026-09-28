/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderObservabilityContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/observability/schemas` (the W006/W007/
 * W009/W023/W036/W038/W024 in-package convention — W030 owns no
 * `contracts/` tree).
 *
 * Pure functions: each schema file is self-contained with a versioned
 * `$id` `urn:epoch:observability:<name>:<contractVersion>`, and the
 * manifest carries SHA-256 digests of every emitted file, into
 * ordered maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares
 * byte-for-byte. To regenerate after an intentional schema change,
 * run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/observability test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, ceiling checks) are enforced by
 * the runtime validators and are not represented in the schema
 * files. The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { OBSERVABILITY_SCHEMA_SURFACE } from './surface';
import { OBSERVABILITY_CONTRACT_VERSION, OBSERVABILITY_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const OBSERVABILITY_CONTRACT_DIR = 'packages/observability/schemas';

/** Render the complete `packages/observability/schemas` artifact set. */
export function renderObservabilityContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of OBSERVABILITY_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/observability',
    contractVersion: OBSERVABILITY_CONTRACT_VERSION,
    recordVersion: OBSERVABILITY_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Security/Isolation/Observability contract surface (W030, in-package full surface): sealed security observations (content-addressed, exact-revision provenance), security policies as data (isolation profiles + thresholds), the W008-mirrored sandbox subject + isolation check inputs, quarantine facts, the security:* event vocabulary over the W010 shapes, and the audit-family mirrors (projection summaries + canonical object references). JSON Schema projection under schemas/; runtime validators in @epoch/observability.',
    dataTypes: OBSERVABILITY_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, digest verification, tenant checks, ceiling conformance) are enforced by the runtime validators in @epoch/observability and are not represented in the JSON Schema files',
    emittedBy:
      'renderObservabilityContractFiles() in @epoch/observability (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:observability:${typeToKebabCase(typeName)}:${OBSERVABILITY_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `SandboxSubject` -> `sandbox-subject`. */
export function typeToKebabCase(typeName: string): string {
  return typeName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
