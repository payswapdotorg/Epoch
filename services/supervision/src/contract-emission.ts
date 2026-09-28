/**
 * Deterministic emission of the PUBLIC W043 contract projection under
 * `contracts/supervision` (the W012 convention): the CORE record types
 * of BOTH W043 kernels — @epoch/supervision findings/passes/inputs and
 * @epoch/alerts policies/alerts/outcomes/notifications — composed by
 * this service because it is the only W043 component that depends on
 * both kernels at runtime.
 *
 * Pure functions: each schema file is self-contained with a versioned
 * `$id` `urn:epoch:supervision:<name>:<contractVersion>`, and the
 * manifest carries SHA-256 digests of every emitted file, into an
 * ordered map of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED and drift-pinned byte-for-byte
 * by the service's contract-drift test. To regenerate:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/supervision-runtime test contract-drift
 */
import { z, type ZodType } from 'zod';
import {
  SUPERVISION_CONTRACT_VERSION,
  SUPERVISION_CORE_RECORD_SURFACE,
  sha256Hex,
} from '@epoch/supervision';
import { ALERTS_CORE_RECORD_SURFACE } from '@epoch/alerts';
import { ALERTS_CONTRACT_VERSION } from '@epoch/alerts';

/** Repository path of the public W043 contract directory (W012 convention). */
export const SUPERVISION_PUBLIC_CONTRACT_DIR = 'contracts/supervision';

/** Render the complete `contracts/supervision` artifact set (both kernels' core records). */
export function renderSupervisionPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];
  const dataTypes: string[] = [];

  for (const entry of SUPERVISION_CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile('supervision', entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
    dataTypes.push(entry.type);
  }
  for (const entry of ALERTS_CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile('alerts', entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
    dataTypes.push(entry.type);
  }

  const manifest = {
    contract: 'epoch/supervision',
    contractVersion: SUPERVISION_CONTRACT_VERSION,
    companionContractVersion: ALERTS_CONTRACT_VERSION,
    recordVersion: 1,
    description:
      'Typed, versioned, provider-neutral Delivery Supervision + Alerts public contract surface (W043, W012 convention): the CORE record types a domain pack or downstream consumer binds to — supervision findings (content-addressed, W006-convention provenance), the W038-shaped execution-issue summaries and W037-shaped lead-time risk inputs, the typed anomaly thresholds, the sealed supervision pass, the severity/escalation policy records, the alert revision chains, the gateway-bound escalation outcomes, and the typed notifications — plus the supervision:* events over the W010 shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes,
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/supervision and @epoch/alerts and are not represented in the JSON Schema files',
    emittedBy:
      'renderSupervisionPublicContractFiles() in @epoch/supervision-runtime (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(namespace: 'supervision' | 'alerts', typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:${namespace}:${typeToKebabCase(typeName)}:${SUPERVISION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `SupervisionPassContent` -> `supervision-pass-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
