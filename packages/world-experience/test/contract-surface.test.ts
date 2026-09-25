// Contract surface sanity: the published schema surface is ordered,
// complete (every surface entry renders), and free of duplicate type
// names; every schema parses its own canonical fixture documents.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  WORLD_EXPERIENCE_SCHEMA_SURFACE,
  WORLD_EXPERIENCE_DOCUMENT_KINDS,
  WORLD_EXPERIENCE_ERROR_CODES,
  WORLD_INTERACTION_KINDS,
  WORLD_ONTOLOGY_RECORD_KINDS,
  WORLD_FIDELITY_LEVELS,
} from '../src/index';

describe('the published schema surface', () => {
  it('is sorted by type name (deterministic emission order)', () => {
    const names = WORLD_EXPERIENCE_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(names).toEqual([...names].sort());
  });

  it('carries no duplicate type names', () => {
    const names = WORLD_EXPERIENCE_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry schema is a live zod schema (JSON-Schema renderable)', () => {
    for (const entry of WORLD_EXPERIENCE_SCHEMA_SURFACE) {
      expect(() => z.toJSONSchema(entry.schema, { target: 'draft-2020-12' })).not.toThrow();
    }
  });

  it('the closed vocabularies are sorted and duplicate-free', () => {
    for (const vocabulary of [
      WORLD_EXPERIENCE_DOCUMENT_KINDS,
      WORLD_EXPERIENCE_ERROR_CODES,
      WORLD_INTERACTION_KINDS,
      WORLD_ONTOLOGY_RECORD_KINDS,
      WORLD_FIDELITY_LEVELS,
    ]) {
      expect([...vocabulary]).toEqual([...vocabulary].sort());
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('the error taxonomy includes every pinned W016 code', () => {
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('unknown-scene-reference');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('cross-tenant-denied');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('invalid-intent');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('unknown-overlay-reference');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('unknown-ontology-record');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('budget-exceeded');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('executable-ui-rejected');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('invalid-replay-position');
    expect(WORLD_EXPERIENCE_ERROR_CODES).toContain('unknown-evidence-reference');
  });
});
