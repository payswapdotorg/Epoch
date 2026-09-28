// Contract surface sanity: the published schema surface is ordered,
// complete (every surface entry renders), and free of duplicate type
// names; the closed vocabularies are sorted and duplicate-free.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  RENDERER_ADAPTERS_SCHEMA_SURFACE,
  RENDERER_ADAPTERS_DOCUMENT_KINDS,
  RENDERER_ADAPTERS_ERROR_CODES,
  RENDERER_TECHNIQUES,
  TECHNIQUE_EXECUTION_CLASSES,
  SELECTION_REASONS,
  ELIGIBILITY_REASONS,
  ADAPTER_EVENT_DISCRIMINATORS,
} from '../src/index';

describe('the published schema surface', () => {
  it('is sorted by type name (deterministic emission order)', () => {
    const names = RENDERER_ADAPTERS_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(names).toEqual([...names].sort());
  });

  it('carries no duplicate type names', () => {
    const names = RENDERER_ADAPTERS_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry schema is a live zod schema (JSON-Schema renderable)', () => {
    for (const entry of RENDERER_ADAPTERS_SCHEMA_SURFACE) {
      expect(() => z.toJSONSchema(entry.schema, { target: 'draft-2020-12' })).not.toThrow();
    }
  });

  it('the closed vocabularies are sorted and duplicate-free', () => {
    for (const vocabulary of [
      RENDERER_ADAPTERS_DOCUMENT_KINDS,
      RENDERER_ADAPTERS_ERROR_CODES,
      RENDERER_TECHNIQUES,
      TECHNIQUE_EXECUTION_CLASSES,
      SELECTION_REASONS,
      ELIGIBILITY_REASONS,
      ADAPTER_EVENT_DISCRIMINATORS,
    ]) {
      expect([...vocabulary]).toEqual([...vocabulary].sort());
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('the document kinds cover the published record families', () => {
    expect(RENDERER_ADAPTERS_DOCUMENT_KINDS).toContain('renderer-adapters.selection');
    expect(RENDERER_ADAPTERS_DOCUMENT_KINDS).toContain('renderer-adapters.mount-plan');
    expect(RENDERER_ADAPTERS_DOCUMENT_KINDS).toContain('renderer-adapters.adapter-descriptor');
  });

  it('the error taxonomy includes the pinned W019 codes', () => {
    expect(RENDERER_ADAPTERS_ERROR_CODES).toContain('cross-tenant-denied');
    expect(RENDERER_ADAPTERS_ERROR_CODES).toContain('assessment-device-mismatch');
    expect(RENDERER_ADAPTERS_ERROR_CODES).toContain('digest-mismatch');
    expect(RENDERER_ADAPTERS_ERROR_CODES).toContain('malformed-record');
    expect(RENDERER_ADAPTERS_ERROR_CODES).toContain('no-eligible-technique');
    expect(RENDERER_ADAPTERS_ERROR_CODES).toContain('version-unsupported');
  });
});
