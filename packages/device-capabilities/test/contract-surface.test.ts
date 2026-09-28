// Contract surface sanity: the published schema surface is ordered,
// complete (every surface entry renders), and free of duplicate type
// names; the closed vocabularies are sorted and duplicate-free.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DEVICE_CAPABILITIES_SCHEMA_SURFACE,
  DEVICE_CAPABILITIES_DOCUMENT_KINDS,
  DEVICE_CAPABILITIES_ERROR_CODES,
  DEVICE_ADAPTATION_TIERS,
  CAPABILITY_GAP_KINDS,
  GUIDED_FIDELITY_LEVELS,
} from '../src/index';

describe('the published schema surface', () => {
  it('is sorted by type name (deterministic emission order)', () => {
    const names = DEVICE_CAPABILITIES_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(names).toEqual([...names].sort());
  });

  it('carries no duplicate type names', () => {
    const names = DEVICE_CAPABILITIES_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry schema is a live zod schema (JSON-Schema renderable)', () => {
    for (const entry of DEVICE_CAPABILITIES_SCHEMA_SURFACE) {
      expect(() => z.toJSONSchema(entry.schema, { target: 'draft-2020-12' })).not.toThrow();
    }
  });

  it('the closed vocabularies are sorted and duplicate-free', () => {
    for (const vocabulary of [
      DEVICE_CAPABILITIES_DOCUMENT_KINDS,
      DEVICE_CAPABILITIES_ERROR_CODES,
      DEVICE_ADAPTATION_TIERS,
      CAPABILITY_GAP_KINDS,
      GUIDED_FIDELITY_LEVELS,
    ]) {
      expect([...vocabulary]).toEqual([...vocabulary].sort());
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('the document kinds cover the two published record families', () => {
    expect(DEVICE_CAPABILITIES_DOCUMENT_KINDS).toContain('device-capabilities.assessment');
    expect(DEVICE_CAPABILITIES_DOCUMENT_KINDS).toContain('device-capabilities.presentation-fit');
  });
});
