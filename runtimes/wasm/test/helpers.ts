// Shared fixtures for the runtimes/wasm tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely.
import { sha256BytesHex } from '../src/index';

/** Deterministic pseudo-random byte generator (xorshift32, fixed seed). */
export function syntheticBytes(seed: number, length: number): Uint8Array {
  let state = seed >>> 0 || 0x9e3779b9;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

/**
 * The canonical fixture sections: deterministic synthetic byte content
 * per section name (the SAME content the shared committed fixture's
 * digests address — regeneration script documents the pairing).
 */
export const FIXTURE_SECTION_CONTENT: Readonly<Record<string, Uint8Array>> = {
  'adapter-locale': syntheticBytes(101, 512),
  'core-module-main': syntheticBytes(202, 4096),
  'custom-metadata': syntheticBytes(303, 96),
};

/** A valid canonical descriptor as loose JSON, matching the shared fixture shape. */
export function descriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    componentId: 'engineering.stress-visualizer',
    componentVersion: '1.0.0',
    worldName: 'stress-view',
    imports: [
      {
        interfaceName: 'epoch:world/reader',
        functions: [
          {
            functionName: 'read-entity',
            params: [{ name: 'entity-ref', type: 'string' }],
            result: 'string',
          },
        ],
      },
    ],
    exports: [
      {
        interfaceName: 'epoch:view/renderer',
        functions: [{ functionName: 'render-frame', params: [], result: 'string' }],
      },
    ],
    sections: [
      {
        name: 'adapter-locale',
        kind: 'adapter',
        byteSize: FIXTURE_SECTION_CONTENT['adapter-locale']!.length,
        contentDigest: sha256BytesHex(FIXTURE_SECTION_CONTENT['adapter-locale']!),
      },
      {
        name: 'core-module-main',
        kind: 'core-module',
        byteSize: FIXTURE_SECTION_CONTENT['core-module-main']!.length,
        contentDigest: sha256BytesHex(FIXTURE_SECTION_CONTENT['core-module-main']!),
      },
      {
        name: 'custom-metadata',
        kind: 'custom',
        byteSize: FIXTURE_SECTION_CONTENT['custom-metadata']!.length,
        contentDigest: sha256BytesHex(FIXTURE_SECTION_CONTENT['custom-metadata']!),
      },
    ],
    ...overrides,
  };
}
