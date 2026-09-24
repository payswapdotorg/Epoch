// Wasm Component Model descriptor tests (author side): validation,
// canonical ordering, content addressing, and the shared committed
// fixture also validated host-side by runtimes/wasm (defense in depth —
// the two validators are deliberately independent).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computeWasmComponentDescriptorDigest,
  parseWasmComponentDescriptor,
  serializeWasmComponentDescriptor,
  verifyWasmComponentDescriptorDigest,
  type ExtensionSdkResult,
} from '../src/index';
import { componentDescriptor } from './helpers';


/** Typed accessor: the validation issues (undefined unless the error is validation). */
function issuesOf<T>(result: ExtensionSdkResult<T>): readonly { path: string; message: string }[] | undefined {
  if (result.ok) return undefined;
  return result.error.code === 'validation' ? result.error.issues : undefined;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const SHARED_FIXTURE = path.resolve(
  here,
  '../../../runtimes/wasm/test/fixtures/component-descriptor.fixture.json',
);

describe('Wasm component descriptor validation (positive)', () => {
  it('accepts a valid canonical descriptor', () => {
    const result = parseWasmComponentDescriptor(componentDescriptor());
    expect(result.ok).toBe(true);
  });

  it('accepts multiple sections and interfaces in canonical order', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        exports: [
          {
            interfaceName: 'epoch:view/exporter',
            functions: [
              { functionName: 'export-frame', params: [{ name: 'quality', type: 'u8' }], result: 'string' },
              { functionName: 'render-frame', params: [], result: 'string' },
            ],
          },
          {
            interfaceName: 'epoch:view/renderer',
            functions: [{ functionName: 'draw', params: [], result: undefined }],
          },
        ],
        sections: [
          {
            name: 'adapter-locale',
            kind: 'adapter',
            byteSize: 4096,
            contentDigest: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
          },
          {
            name: 'core-module-a',
            kind: 'core-module',
            byteSize: 100,
            contentDigest: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
          },
          {
            name: 'core-module-b',
            kind: 'core-module',
            byteSize: 200,
            contentDigest: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
          },
          {
            name: 'custom-metadata',
            kind: 'custom',
            byteSize: 32,
            contentDigest: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts every WIT primitive value type as a param or result type', () => {
    const types = ['bool', 'char', 'f32', 'f64', 's16', 's32', 's64', 's8', 'string', 'u16', 'u32', 'u64', 'u8'];
    for (const type of types) {
      const result = parseWasmComponentDescriptor(
        componentDescriptor({
          exports: [
            {
              interfaceName: 'epoch:view/renderer',
              functions: [{ functionName: 'render-frame', params: [{ name: 'value', type }], result: type }],
            },
          ],
        }),
      );
      expect(result.ok, type).toBe(true);
    }
  });

  it('seal/verify round-trips the descriptor digest', () => {
    const descriptor = componentDescriptor();
    const digest = computeWasmComponentDescriptorDigest(descriptor as never);
    const verified = verifyWasmComponentDescriptorDigest({ descriptor: descriptor as never, digest });
    expect(verified.ok).toBe(true);
  });

  it('deterministic serialization: key-order permutations produce identical bytes', () => {
    const left = componentDescriptor();
    const right = {
      sections: left.sections,
      exports: left.exports,
      imports: left.imports,
      worldName: left.worldName,
      componentVersion: left.componentVersion,
      componentId: left.componentId,
      schemaVersion: left.schemaVersion,
    };
    expect(serializeWasmComponentDescriptor(left as never)).toBe(
      serializeWasmComponentDescriptor(right as never),
    );
  });
});

describe('Wasm component descriptor validation (negative)', () => {
  it('rejects UNSORTED sections (non-deterministic layout asserted against)', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        sections: [
          {
            name: 'core-module-main',
            kind: 'core-module',
            byteSize: 65536,
            contentDigest: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
          },
          {
            name: 'adapter-locale',
            kind: 'adapter',
            byteSize: 4096,
            contentDigest: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
          },
        ],
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
    const section = {
      name: 'core-module-main',
      kind: 'core-module',
      byteSize: 65536,
      contentDigest: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    };
    const result = parseWasmComponentDescriptor(componentDescriptor({ sections: [section, section] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('sections.'));
    expect(issue!.message).toContain('duplicate-free');
  });

  it('rejects an unknown section kind', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        sections: [
          {
            name: 'blob',
            kind: 'data-blob',
            byteSize: 10,
            contentDigest: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a negative or fractional byteSize', () => {
    for (const byteSize of [-1, 1.5]) {
      const result = parseWasmComponentDescriptor(
        componentDescriptor({
          sections: [
            {
              name: 'core-module-main',
              kind: 'core-module',
              byteSize,
              contentDigest: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
            },
          ],
        }),
      );
      expect(result.ok, String(byteSize)).toBe(false);
      if (result.ok) return;
      expect(issuesOf(result)![0]!.path).toBe('sections.0.byteSize');
    }
  });

  it('rejects a malformed content digest', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        sections: [
          {
            name: 'core-module-main',
            kind: 'core-module',
            byteSize: 10,
            contentDigest: 'xyz',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('sections.0.contentDigest');
  });

  it('rejects a malformed component version', () => {
    const result = parseWasmComponentDescriptor(componentDescriptor({ componentVersion: 'v1.0' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('componentVersion');
  });

  it('rejects an empty exports list (the host must have something to call)', () => {
    const result = parseWasmComponentDescriptor(componentDescriptor({ exports: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty sections list', () => {
    const result = parseWasmComponentDescriptor(componentDescriptor({ sections: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects UNSORTED imports by interface name', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        imports: [
          {
            interfaceName: 'epoch:world/zzz',
            functions: [{ functionName: 'read', params: [], result: 'string' }],
          },
          {
            interfaceName: 'epoch:world/reader',
            functions: [{ functionName: 'read-entity', params: [], result: 'string' }],
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
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        exports: [
          {
            interfaceName: 'epoch:view/renderer',
            functions: [
              { functionName: 'render-frame', params: [], result: 'string' },
              { functionName: 'draw', params: [], result: undefined },
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

  it('rejects an interface with an empty function list', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        imports: [{ interfaceName: 'epoch:world/reader', functions: [] }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown WIT value type', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({
        exports: [
          {
            interfaceName: 'epoch:view/renderer',
            functions: [{ functionName: 'render-frame', params: [{ name: 'v', type: 'list' }], result: 'string' }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('exports.0.functions.0.params.0.type');
  });

  it('rejects vendor fields on the descriptor (strict objects)', () => {
    const result = parseWasmComponentDescriptor(
      componentDescriptor({ toolchain: 'vendor-wasm-pack' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.message).toContain('Unrecognized key');
  });

  it('rejects a tampered descriptor digest (tamper detection)', () => {
    const descriptor = componentDescriptor();
    const digest = computeWasmComponentDescriptorDigest(descriptor as never);
    const tampered = componentDescriptor({ worldName: 'other-world' });
    const result = verifyWasmComponentDescriptorDigest({ descriptor: tampered as never, digest });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('digest-mismatch');
  });
});

describe('shared committed fixture (author/host parity anchor)', () => {
  it('the runtimes/wasm fixture parses with the author-side schema', () => {
    const fixture = JSON.parse(readFileSync(SHARED_FIXTURE, 'utf8')) as unknown;
    const result = parseWasmComponentDescriptor(fixture);
    expect(result.ok).toBe(true);
  });
});
