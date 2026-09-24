// Negative tests: malformed layouts, non-canonical ordering, digest
// tampering, strict-object rejection, and section-content corruption.
import { describe, expect, it } from 'vitest';
import {
  computeLayoutDigest,
  validateComponentLayoutDescriptor,
  verifyLayoutDescriptorDigest,
  verifySectionContent,
  type WasmLayoutResult,
} from '../src/index';
import { descriptor, FIXTURE_SECTION_CONTENT, syntheticBytes } from './helpers';


/** Typed accessor: the validation issues (undefined unless the error is validation). */
function issuesOf<T>(result: WasmLayoutResult<T>): readonly { path: string; message: string }[] | undefined {
  if (result.ok) return undefined;
  return result.error.code === 'validation' ? result.error.issues : undefined;
}

const firstIssueOf = <T,>(result: WasmLayoutResult<T>): { path: string; message: string } | undefined =>
  result.ok ? undefined : (result.error as { issues?: { path: string; message: string }[] }).issues?.[0];

describe('structural validation (negative)', () => {
  it('rejects a wrong schemaVersion discriminator with a precise path', () => {
    const result = validateComponentLayoutDescriptor(descriptor({ schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(firstIssueOf(result)?.path).toBe('schemaVersion');
  });

  it('rejects a malformed component id', () => {
    const result = validateComponentLayoutDescriptor(descriptor({ componentId: 'not-qualified' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(firstIssueOf(result)?.path).toBe('componentId');
  });

  it('rejects a malformed component version ("v1.0")', () => {
    const result = validateComponentLayoutDescriptor(descriptor({ componentVersion: 'v1.0' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(firstIssueOf(result)?.path).toBe('componentVersion');
  });

  it('rejects a malformed world name', () => {
    const result = validateComponentLayoutDescriptor(descriptor({ worldName: 'World Name' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(firstIssueOf(result)?.path).toBe('worldName');
  });

  it('rejects an empty exports list', () => {
    const result = validateComponentLayoutDescriptor(descriptor({ exports: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('exports');
  });

  it('rejects an empty sections list', () => {
    const result = validateComponentLayoutDescriptor(descriptor({ sections: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('sections');
  });

  it('rejects an unknown section kind with the precise path', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        sections: [
          { name: 'blob', kind: 'data-blob', byteSize: 10, contentDigest: 'a'.repeat(64) },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('sections.0.kind');
  });

  it('rejects a negative and a fractional byteSize with precise paths', () => {
    for (const byteSize of [-1, 1.5]) {
      const result = validateComponentLayoutDescriptor(
        descriptor({
          sections: [{ name: 'custom-metadata', kind: 'custom', byteSize, contentDigest: 'a'.repeat(64) }],
        }),
      );
      expect(result.ok, String(byteSize)).toBe(false);
      if (result.ok) return;
      expect(issuesOf(result)![0]!.path).toBe('sections.0.byteSize');
    }
  });

  it('rejects a malformed content digest (not 64 lowercase hex)', () => {
    for (const contentDigest of ['xyz', 'A'.repeat(64), 'a'.repeat(63)]) {
      const result = validateComponentLayoutDescriptor(
        descriptor({
          sections: [{ name: 'custom-metadata', kind: 'custom', byteSize: 96, contentDigest }],
        }),
      );
      expect(result.ok, contentDigest.slice(0, 8)).toBe(false);
      if (result.ok) return;
      expect(issuesOf(result)![0]!.path).toBe('sections.0.contentDigest');
    }
  });

  it('rejects unknown fields (strict layout objects never trust author-side tooling)', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({ toolchain: 'vendor-wasm-pack', engine: 'acme-fem' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = issuesOf(result)!.map((issue) => issue.path).sort();
    expect(paths).toEqual(['engine', 'toolchain']);
    expect(issuesOf(result)![0]!.message).toContain('strict layout objects reject unknown fields');
  });

  it('rejects an interface with an empty function list', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({ imports: [{ interfaceName: 'epoch:world/reader', functions: [] }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('imports.0.functions');
  });

  it('rejects an unknown WIT value type', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        imports: [
          {
            interfaceName: 'epoch:world/reader',
            functions: [{ functionName: 'read-entity', params: [{ name: 'ref', type: 'list' }], result: 'string' }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('imports.0.functions.0.params.0.type');
  });

  it('rejects a non-object descriptor', () => {
    const result = validateComponentLayoutDescriptor('nope');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('');
  });
});

describe('canonical ordering (negative: non-determinism asserted against)', () => {
  it('rejects UNSORTED sections with the offending index and key path', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        sections: [...(descriptor().sections as unknown[])].reverse(),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('sections.'));
    expect(issue).toBeDefined();
    expect(issue!.path).toBe('sections.1.name');
    expect(issue!.message).toContain('sorted ascending');
  });

  it('rejects DUPLICATE section names', () => {
    const sectionsList = descriptor().sections as unknown[];
    const sections = [sectionsList[0]!, { ...(sectionsList[1]! as Record<string, unknown>), name: 'adapter-locale' }];
    const result = validateComponentLayoutDescriptor(descriptor({ sections }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('sections.'));
    expect(issue!.message).toContain('duplicate-free');
  });

  it('rejects UNSORTED imports by interface name', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        imports: [
          {
            interfaceName: 'epoch:world/zzz',
            functions: [{ functionName: 'read', params: [] }],
          },
          {
            interfaceName: 'epoch:world/reader',
            functions: [{ functionName: 'read-entity', params: [{ name: 'ref', type: 'string' }] }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('imports.'));
    expect(issue!.path).toBe('imports.1.interfaceName');
  });

  it('rejects UNSORTED functions within an interface', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        exports: [
          {
            interfaceName: 'epoch:view/renderer',
            functions: [
              { functionName: 'render-frame', params: [], result: 'string' },
              { functionName: 'draw', params: [] },
            ],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('exports.'));
    expect(issue!.path).toBe('exports.0.functions.1.functionName');
  });

  it('rejects UNSORTED params within a function', () => {
    const result = validateComponentLayoutDescriptor(
      descriptor({
        exports: [
          {
            interfaceName: 'epoch:view/renderer',
            functions: [
              {
                functionName: 'render-frame',
                params: [
                  { name: 'zoom', type: 'f32' },
                  { name: 'alpha', type: 'u8' },
                ],
                result: 'string',
              },
            ],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('exports.'));
    expect(issue!.path).toBe('exports.0.functions.0.params.1.name');
  });
});

describe('descriptor digest tampering (negative)', () => {
  it('rejects a claimed digest that does not match the content (tamper detection)', () => {
    const digest = computeLayoutDigest(descriptor());
    expect(digest.ok).toBe(true);
    if (!digest.ok) return;
    const tampered = descriptor({ worldName: 'other-world' });
    const result = verifyLayoutDescriptorDigest({ descriptor: tampered, digest: digest.value });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('digest-mismatch');
    if (result.error.code !== 'digest-mismatch') return;
    expect(result.error.path).toEqual(['digest']);
    expect(result.error.encountered).toBe(digest.value);
    const tamperedDigest = computeLayoutDigest(tampered);
    if (tamperedDigest.ok) {
      expect(result.error.expected).toBe(tamperedDigest.value);
    }
  });

  it('rejects a malformed claimed digest (not 64-hex) as validation', () => {
    const result = verifyLayoutDescriptorDigest({ descriptor: descriptor(), digest: 'deadbeef' });
    expect(result.ok).toBe(false);
  });
});

describe('section content verification (negative)', () => {
  it('rejects TAMPERED section bytes (digest mismatch, precise section path)', () => {
    const tampered: Record<string, Uint8Array> = {
      ...FIXTURE_SECTION_CONTENT,
      'core-module-main': syntheticBytes(999, FIXTURE_SECTION_CONTENT['core-module-main']!.length),
    };
    const result = verifySectionContent(descriptor(), tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('digest-mismatch');
    if (result.error.code !== 'digest-mismatch') return;
    expect(result.error.path).toEqual(['sections', 'core-module-main', 'contentDigest']);
  });

  it('rejects a WRONG byte length (declared byteSize mismatch)', () => {
    const wrongLength: Record<string, Uint8Array> = {
      ...FIXTURE_SECTION_CONTENT,
      'adapter-locale': syntheticBytes(101, 511),
    };
    const result = verifySectionContent(descriptor(), wrongLength);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(issuesOf(result)![0]!.path).toBe('sections.adapter-locale.byteSize');
  });

  it('rejects UNKNOWN sections in the content bundle', () => {
    const extra: Record<string, Uint8Array> = {
      ...FIXTURE_SECTION_CONTENT,
      'extra-blob': new Uint8Array(4),
    };
    const result = verifySectionContent(descriptor(), extra);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(issuesOf(result)![0]!.path).toBe('sections.extra-blob');
  });
});
