import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { canonicalJson } from '../src/canonical';
import {
  AssertionInputSchema,
  AssertionSchema,
  ConfidenceSchema,
  DecisionScopeSpecSchema,
  EntitySchema,
  EntityTypeDefinitionSchema,
  ExternalMappingSchema,
  ProvenanceSchema,
  RelationSchema,
  RelationTypeDefinitionSchema,
  RetractionInputSchema,
  TaskSufficientWorldSchema,
  ValiditySchema,
  WORLD_CONTRACTS_VERSION,
  WorldEventSchema,
  WorldSnapshotSchema,
  WorldStatisticsSchema,
} from '../src/index';

const CONTRACTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../contracts/world',
);

/**
 * Contract sync — the test-time half of the W002 typed/versioned contract
 * guarantee (the compile-time half is src/schema/type-sync.ts).
 *
 * Proves for every published core type that:
 *  1. the JSON Schema document under contracts/world/schemas/ equals the
 *     z.toJSONSchema() conversion of the runtime zod validator (so the
 *     published wire shape can never drift from runtime validation);
 *  2. the $id is versioned with the current contract version;
 *  3. the document declares draft 2020-12;
 *  4. the manifest version matches the runtime contract version constant.
 */
const PUBLISHED: readonly [string, z.ZodType<unknown>][] = [
  ['entity', EntitySchema],
  ['relation', RelationSchema],
  ['assertion', AssertionSchema],
  ['assertion-input', AssertionInputSchema],
  ['retraction-input', RetractionInputSchema],
  ['provenance', ProvenanceSchema],
  ['confidence', ConfidenceSchema],
  ['validity', ValiditySchema],
  ['world-event', WorldEventSchema],
  ['world-snapshot', WorldSnapshotSchema],
  ['entity-type-definition', EntityTypeDefinitionSchema],
  ['relation-type-definition', RelationTypeDefinitionSchema],
  ['external-mapping', ExternalMappingSchema],
  ['decision-scope-spec', DecisionScopeSpecSchema],
  ['task-sufficient-world', TaskSufficientWorldSchema],
  ['world-statistics', WorldStatisticsSchema],
];

describe('contract sync (contracts/world)', () => {
  it('publishes exactly the expected schema documents', () => {
    const expected = PUBLISHED.map(([name]) => `${name}.schema.json`).sort();
    const files = readdirSync(path.join(CONTRACTS_DIR, 'schemas'))
      .filter((file) => file.endsWith('.schema.json'))
      .sort();
    expect(files).toEqual(expected);
  });

  for (const [name, schema] of PUBLISHED) {
    it(`keeps ${name}.schema.json in sync with the runtime validator`, () => {
      const raw = readFileSync(path.join(CONTRACTS_DIR, 'schemas', `${name}.schema.json`), 'utf8');
      const published = JSON.parse(raw) as Record<string, unknown>;
      expect(published.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(published.$id).toBe(`urn:epoch:contracts:world:${name}:${WORLD_CONTRACTS_VERSION}`);
      const generated = z.toJSONSchema(schema) as Record<string, unknown>;
      const expected = { ...generated, $id: published.$id };
      expect(canonicalJson(published)).toBe(canonicalJson(expected));
    });
  }

  it('pins the manifest version to the runtime contract version', () => {
    const manifest = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, 'package.json'), 'utf8')) as {
      version: string;
      name: string;
    };
    expect(manifest.name).toBe('@epoch/world-contracts');
    expect(manifest.version).toBe(WORLD_CONTRACTS_VERSION);
  });

  it('exposes the contract surface as types-only TypeScript (no runtime exports)', () => {
    const barrel = readFileSync(path.join(CONTRACTS_DIR, 'src', 'index.ts'), 'utf8');
    expect(barrel).toMatch(/export type \* from '\.\/version'/);
    expect(barrel).not.toMatch(/export \* from/);
    expect(barrel).not.toMatch(/export const/);
    expect(barrel).not.toMatch(/export function/);
  });
});
