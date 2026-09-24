// Contract surface integrity: the published manifest, the TypeScript
// declarations, and the parity assertions cover exactly the package's
// declared schema surface (plus the documented set of mirrored shared
// primitives) — no missing, no extra, no drift.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EVALUATION_PROTOCOL_SCHEMA_SURFACE } from '../src/surface';
import {
  EVALUATION_CONTRACT_VERSION,
  EVALUATION_PROTOCOL_MESSAGE_KINDS,
  EVALUATION_PROTOCOL_VERSION,
} from '../src/version';
import { renderEvaluationContractFiles } from '../src/contract-emission';
import { sha256Hex } from '@epoch/agent-protocol';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'contracts');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

const surfaceTypes = EVALUATION_PROTOCOL_SCHEMA_SURFACE.map((entry) => entry.type);

/**
 * Shared primitives mirrored from contracts/agent so this contract
 * surface is self-contained (documented in contracts/README.md). They are
 * allowed as extra exports of index.d.ts and as extra parity assertions.
 */
const MIRRORED_PRIMITIVES = [
  'CostProfile',
  'JsonValue',
  'LatencyProfile',
  'MessageId',
  'ParameterKind',
  'ParameterSpec',
  'Timestamp',
];

function readContractFile(rel: string): string {
  return readFileSync(path.join(CONTRACTS_DIR, rel), 'utf8');
}

function exportedTypeNames(source: string): string[] {
  const names = new Set<string>();
  const pattern = /^export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.add(match[1]!);
  }
  return [...names].sort();
}

describe('evaluation contracts surface integrity', () => {
  it.skipIf(UPDATE_MODE)('manifest dataTypes equal the package schema surface', () => {
    const manifest = JSON.parse(readContractFile('manifest.json'));
    expect(manifest.contract).toBe('epoch/evaluation');
    expect(manifest.contractVersion).toBe(EVALUATION_CONTRACT_VERSION);
    expect(manifest.protocolVersion).toBe(EVALUATION_PROTOCOL_VERSION);
    expect(manifest.messageKinds).toEqual([...EVALUATION_PROTOCOL_MESSAGE_KINDS]);
    expect(manifest.dataTypes).toEqual(surfaceTypes);
    expect(manifest.jsonSchemaFidelity).toContain('structural-only');
  });

  it.skipIf(UPDATE_MODE)('index.d.ts exports exactly the surface types plus the mirrored primitives', () => {
    const declared = exportedTypeNames(readContractFile('index.d.ts'));
    expect(declared).toEqual([...surfaceTypes, ...MIRRORED_PRIMITIVES].sort());
  });

  it.skipIf(UPDATE_MODE)('parity.ts asserts every surface type against the implementation', () => {
    const parity = readContractFile('parity.ts');
    const assertions = new Set<string>();
    const pattern = /Equals<contracts\.([A-Za-z0-9_]+),\s*impl\.([A-Za-z0-9_]+)>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(parity)) !== null) {
      expect(match[2]).toBe(match[1]); // contract name must equal impl name
      assertions.add(match[1]!);
    }
    expect([...assertions].sort()).toEqual([...surfaceTypes, ...MIRRORED_PRIMITIVES].sort());
  });

  it.skipIf(UPDATE_MODE)('manifest schema digests match the committed files', () => {
    const manifest = JSON.parse(readContractFile('manifest.json'));
    for (const entry of manifest.schemas as Array<{ type: string; file: string; sha256: string }>) {
      const committed = readContractFile(entry.file);
      expect(entry.sha256, entry.file).toBe(sha256Hex(committed));
    }
    const rendered = renderEvaluationContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      expect(readContractFile(rel)).toBe(content);
    }
  });
});
