// Positive tests: canonical layout validation, content addressing,
// section-content verification over synthetic bytes, and the shared
// committed fixture (the author/host parity anchor also validated by
// @epoch/extension-sdk's zod schema).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computeLayoutDigest,
  sealLayoutDescriptor,
  serializeLayoutDescriptor,
  validateComponentLayoutDescriptor,
  validateWasmLayoutType,
  verifyLayoutDescriptorDigest,
  verifySectionContent,
} from '../src/index';
import { descriptor, FIXTURE_SECTION_CONTENT } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHARED_FIXTURE = path.resolve(here, 'fixtures/component-descriptor.fixture.json');

describe('canonical layout validation (positive)', () => {
  it('accepts a valid canonical descriptor', () => {
    const result = validateComponentLayoutDescriptor(descriptor());
    expect(result.ok).toBe(true);
  });

  it('accepts every published type via the rule-table walker', () => {
    expect(validateWasmLayoutType('WasmValueType', 'string').ok).toBe(true);
    expect(validateWasmLayoutType('WasmSectionKind', 'core-module').ok).toBe(true);
    expect(validateWasmLayoutType('LayoutSection', (descriptor().sections as unknown[])[0]).ok).toBe(true);
    expect(validateWasmLayoutType('WasmParamDeclaration', { name: 'v', type: 'u8' }).ok).toBe(true);
  });

  it('accepts interfaces with namespace-qualified names and empty params', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        imports: [
          {
            interfaceName: 'epoch:world/reader',
            functions: [{ functionName: 'ping', params: [] }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('content addressing (positive)', () => {
  it('serialization is canonical (key-order permutations identical)', () => {
    const left = descriptor();
    const right = {
      sections: left.sections,
      exports: left.exports,
      imports: left.imports,
      worldName: left.worldName,
      componentVersion: left.componentVersion,
      componentId: left.componentId,
      schemaVersion: left.schemaVersion,
    };
    const a = serializeLayoutDescriptor(left);
    const b = serializeLayoutDescriptor(right);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value).toBe(b.value);
  });

  it('seal/verify round-trips the descriptor digest', () => {
    const sealed = sealLayoutDescriptor(descriptor());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const verified = verifyLayoutDescriptorDigest(sealed.value);
    expect(verified.ok).toBe(true);
  });

  it('the digest is stable across identical inputs (deterministic content address)', () => {
    const first = computeLayoutDigest(descriptor());
    const second = computeLayoutDigest(JSON.parse(JSON.stringify(descriptor())));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toBe(second.value);
  });
});

describe('section content verification (positive, synthetic bytes)', () => {
  it('verifies the declared sections over their exact byte content', () => {
    const result = verifySectionContent(descriptor(), FIXTURE_SECTION_CONTENT);
    expect(result.ok).toBe(true);
  });

  it('verifies a subset of sections is NOT enough (missing sections are errors)', () => {
    const partial: Record<string, Uint8Array> = {
      'core-module-main': FIXTURE_SECTION_CONTENT['core-module-main']!,
    };
    const result = verifySectionContent(descriptor(), partial);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    if (result.error.code !== 'validation') return;
    expect(result.error.issues.map((issue) => issue.path).sort()).toEqual([
      'sections.adapter-locale',
      'sections.custom-metadata',
    ]);
  });
});

describe('shared committed fixture (author/host parity anchor)', () => {
  it('the fixture validates with the host-side machinery', () => {
    const fixture = JSON.parse(readFileSync(SHARED_FIXTURE, 'utf8')) as unknown;
    const result = validateComponentLayoutDescriptor(fixture);
    expect(result.ok).toBe(true);
  });

  it('the fixture serializes and digests deterministically (stable content address)', () => {
    const fixture = JSON.parse(readFileSync(SHARED_FIXTURE, 'utf8')) as unknown;
    const digest = computeLayoutDigest(fixture);
    expect(digest.ok).toBe(true);
    // The stable digest value is asserted in the drift test manifest; here
    // determinism across reloads is the material property.
    expect(computeLayoutDigest(fixture)).toEqual(digest);
  });

  it('the fixture sections verify against the documented synthetic content', () => {
    const fixture = JSON.parse(readFileSync(SHARED_FIXTURE, 'utf8')) as unknown;
    const result = verifySectionContent(fixture, FIXTURE_SECTION_CONTENT);
    expect(result.ok).toBe(true);
  });
});
