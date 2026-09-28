// Contract surface sanity: the published schema surface is ordered,
// complete (every surface entry renders), and free of duplicate type
// names; the closed vocabularies are sorted and duplicate-free.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PROGRESSIVE_SCENE_SCHEMA_SURFACE,
  PROGRESSIVE_SCENE_DOCUMENT_KINDS,
  PROGRESSIVE_SCENE_ERROR_CODES,
  REDUCTION_STAGE_KINDS,
} from '../src/index';

describe('the published schema surface', () => {
  it('is sorted by type name (deterministic emission order)', () => {
    const names = PROGRESSIVE_SCENE_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(names).toEqual([...names].sort());
  });

  it('carries no duplicate type names', () => {
    const names = PROGRESSIVE_SCENE_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry schema is a live zod schema (JSON-Schema renderable)', () => {
    for (const entry of PROGRESSIVE_SCENE_SCHEMA_SURFACE) {
      expect(() => z.toJSONSchema(entry.schema, { target: 'draft-2020-12' })).not.toThrow();
    }
  });

  it('the closed vocabularies are sorted and duplicate-free', () => {
    for (const vocabulary of [
      PROGRESSIVE_SCENE_DOCUMENT_KINDS,
      PROGRESSIVE_SCENE_ERROR_CODES,
      REDUCTION_STAGE_KINDS,
    ]) {
      expect([...vocabulary]).toEqual([...vocabulary].sort());
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('the document kinds cover the two published record families', () => {
    expect(PROGRESSIVE_SCENE_DOCUMENT_KINDS).toContain('progressive-scene.ladder');
    expect(PROGRESSIVE_SCENE_DOCUMENT_KINDS).toContain('progressive-scene.fit');
  });

  it('the error taxonomy includes the pinned W019 codes', () => {
    expect(PROGRESSIVE_SCENE_ERROR_CODES).toContain('cross-tenant-denied');
    expect(PROGRESSIVE_SCENE_ERROR_CODES).toContain('unfittable-scene');
    expect(PROGRESSIVE_SCENE_ERROR_CODES).toContain('digest-mismatch');
    expect(PROGRESSIVE_SCENE_ERROR_CODES).toContain('malformed-record');
  });
});
