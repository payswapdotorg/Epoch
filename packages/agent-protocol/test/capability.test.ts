// Capability declarations — positive and negative validation evidence:
// malformed capability declarations (the shape agents register their
// competences with) must be rejected with typed errors.
import { describe, expect, it } from 'vitest';
import {
  parseCapabilityDeclaration,
  validateCapabilityDeclaration,
} from '../src/capability';
import { VALID_CAPABILITY } from './fixtures';

describe('parseCapabilityDeclaration (positive)', () => {
  it('admits a standalone capability declaration with canonical evidence form', () => {
    const outcome = parseCapabilityDeclaration(VALID_CAPABILITY);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.capabilityId).toBe('engineering.stress-analysis');
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('admits every parameter kind in its valid form', () => {
    const declaration = {
      ...VALID_CAPABILITY,
      inputs: [
        { name: 'a-int', kind: 'integer', required: true, description: 'd', unit: 'm' },
        { name: 'a-num', kind: 'number', required: true, description: 'd' },
        { name: 'a-str', kind: 'string', required: false, description: 'd' },
        { name: 'a-bool', kind: 'boolean', required: false, description: 'd' },
        {
          name: 'a-enum',
          kind: 'enum',
          required: true,
          description: 'd',
          enumValues: ['x', 'y'],
        },
        { name: 'a-ref', kind: 'entity-reference', required: true, description: 'd' },
        { name: 'a-json', kind: 'json', required: false, description: 'd' },
      ],
    };
    const outcome = parseCapabilityDeclaration(declaration);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.inputs).toHaveLength(7);
  });

  it('validateCapabilityDeclaration returns the parsed value', () => {
    const value = validateCapabilityDeclaration(VALID_CAPABILITY);
    expect(value.domain).toBe('structural');
    expect(value.assumptions).toHaveLength(2);
  });
});

describe('parseCapabilityDeclaration (negative: malformed declarations)', () => {
  it('rejects enum parameters without enumValues', () => {
    const declaration = {
      ...VALID_CAPABILITY,
      inputs: [
        { name: 'load-case', kind: 'enum', required: true, description: 'Load case.' },
      ],
    };
    const outcome = parseCapabilityDeclaration(declaration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.error.kind === 'schema-violation') {
      expect(
        outcome.error.issues.some((issue) => /enumValues/.test(issue.message)),
      ).toBe(true);
    }
  });

  it('rejects enum parameters with an empty enumValues array', () => {
    const declaration = {
      ...VALID_CAPABILITY,
      inputs: [
        {
          name: 'load-case',
          kind: 'enum',
          required: true,
          description: 'Load case.',
          enumValues: [],
        },
      ],
    };
    expect(parseCapabilityDeclaration(declaration).ok).toBe(false);
  });

  it('rejects non-enum parameters that carry enumValues', () => {
    const declaration = {
      ...VALID_CAPABILITY,
      inputs: [
        {
          name: 'count',
          kind: 'integer',
          required: true,
          description: 'Count.',
          enumValues: ['1', '2'],
        },
      ],
    };
    const outcome = parseCapabilityDeclaration(declaration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.error.kind === 'schema-violation') {
      expect(outcome.error.issues.some((issue) => /enumValues/.test(issue.message))).toBe(
        true,
      );
    }
  });

  it('rejects units on non-numeric parameters', () => {
    const declaration = {
      ...VALID_CAPABILITY,
      inputs: [
        { name: 'label', kind: 'string', required: true, description: 'Label.', unit: 'm' },
      ],
    };
    const outcome = parseCapabilityDeclaration(declaration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.error.kind === 'schema-violation') {
      expect(outcome.error.issues.some((issue) => /unit/.test(issue.message))).toBe(true);
    }
  });

  it('rejects single-segment capability ids', () => {
    for (const capabilityId of ['stress', 'Engineering.Stress', '']) {
      const outcome = parseCapabilityDeclaration({ ...VALID_CAPABILITY, capabilityId });
      expect(outcome.ok, `capabilityId=${capabilityId}`).toBe(false);
    }
  });

  it('rejects a missing protocolVersion as schema-violation', () => {
    const { protocolVersion, ...rest } = VALID_CAPABILITY;
    void protocolVersion;
    const outcome = parseCapabilityDeclaration(rest);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('reports version-mismatch distinctly', () => {
    const outcome = parseCapabilityDeclaration({
      ...VALID_CAPABILITY,
      protocolVersion: '2.0.0',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.encountered).toBe('2.0.0');
      }
    }
  });

  it('rejects unknown fields (strict object discipline)', () => {
    const outcome = parseCapabilityDeclaration({
      ...VALID_CAPABILITY,
      provider: 'acme-solver',
      framework: 'langgraph',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('rejects parameter names with invalid charset', () => {
    const declaration = {
      ...VALID_CAPABILITY,
      inputs: [{ name: 'Bad_Name', kind: 'string', required: true, description: 'd' }],
    };
    expect(parseCapabilityDeclaration(declaration).ok).toBe(false);
  });

  it('rejects empty summaries and invalid domains', () => {
    expect(parseCapabilityDeclaration({ ...VALID_CAPABILITY, summary: '' }).ok).toBe(false);
    expect(parseCapabilityDeclaration({ ...VALID_CAPABILITY, domain: 'Structural' }).ok).toBe(
      false,
    );
  });
});
