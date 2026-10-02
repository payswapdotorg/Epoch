/**
 * The GLB container battery (W060): every documented malformed shape is a
 * typed `glb-invalid` refusal, and the parser is memory-safe by
 * construction (bounds checked before any slice). The canonical fixture
 * GLB round-trips exactly.
 */
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../src/glb';
import { buildGlb, canonicalGlbBytes, canonicalGltfJson, trianglePositionBytes } from './helpers';

/** The typed failure code of a refusal (undefined on success). */
function errorCodeOf(
  result: { ok: true; value: unknown } | { ok: false; error: { code: string } },
): string | undefined {
  return result.ok ? undefined : result.error.code;
}

const bytesOf = (values: readonly number[]) => new Uint8Array(values);

describe('parseGlb (valid containers)', () => {
  it('parses the canonical fixture GLB (JSON + BIN, both padded)', () => {
    const parsed = parseGlb(canonicalGlbBytes());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const document = JSON.parse(new TextDecoder().decode(parsed.value.jsonBytes));
    expect(document.asset.version).toBe('2.0');
    expect(parsed.value.binBytes).not.toBeNull();
    expect(parsed.value.binBytes!.length).toBe(36);
    expect(parsed.value.chunks.length).toBe(2);
    expect(parsed.value.chunks[0]!.chunkType).toBe(0x4e4f534a);
    expect(parsed.value.chunks[1]!.chunkType).toBe(0x004e4942);
  });

  it('parses a JSON-only GLB (no BIN chunk)', () => {
    const parsed = parseGlb(buildGlb(canonicalGltfJson(), null));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.binBytes).toBeNull();
    expect(parsed.value.chunks.length).toBe(1);
  });

  it('ignores forward-compatible extra chunks after BIN', () => {
    const base = buildGlb(canonicalGltfJson(), trianglePositionBytes());
    // Append one more (spec-allowed, unknown-type) chunk of 4 data bytes.
    const appended = new Uint8Array(base.length + 8 + 4);
    appended.set(base);
    const view = new DataView(appended.buffer);
    view.setUint32(8, appended.length, true); // refresh the declared total length
    const at = base.length;
    view.setUint32(at, 4, true);
    view.setUint32(at + 4, 0x58585858, true); // 'XXXX' — an unknown chunk type
    const parsed = parseGlb(appended);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.chunks.length).toBe(3);
  });
});

describe('parseGlb (typed refusals)', () => {
  it('refuses truncated headers and short inputs', () => {
    expect(parseGlb(new Uint8Array(0)).ok).toBe(false);
    const short = parseGlb(bytesOf([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00]));
    expect(short.ok).toBe(false);
  });

  it('refuses a wrong magic', () => {
    const bad = canonicalGlbBytes();
    bad[0] = 0x78; // corrupt 'g'
    const parsed = parseGlb(bad);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe('glb-invalid');
    expect(parsed.error.message).toContain('magic');
  });

  it('refuses container version != 2', () => {
    const bad = canonicalGlbBytes();
    const view = new DataView(bad.buffer);
    view.setUint32(4, 1, true);
    const parsed = parseGlb(bad);
    expect(errorCodeOf(parsed)).toBe('glb-invalid');
  });

  it('refuses a declared length that disagrees with the actual bytes', () => {
    const bad = canonicalGlbBytes();
    const view = new DataView(bad.buffer);
    view.setUint32(8, bad.length + 4, true);
    expect(parseGlb(bad).ok).toBe(false);
  });

  it('refuses truncated chunk headers and zero-length chunks', () => {
    const base = canonicalGlbBytes();
    // A container whose last 4 bytes are cut: the final chunk header is
    // truncated or the declared data overruns.
    const truncated = base.subarray(0, base.length - 5);
    const parsed = parseGlb(new Uint8Array(truncated));
    expect(errorCodeOf(parsed)).toBe('glb-invalid');

    const zero = canonicalGlbBytes();
    const view = new DataView(zero.buffer);
    view.setUint32(12, 0, true); // zero-length JSON chunk
    const zeroParsed = parseGlb(zero);
    expect(errorCodeOf(zeroParsed)).toBe('glb-invalid');
  });

  it('refuses a first chunk that is not JSON and a BIN chunk that is not second', () => {
    const jsonFirstSwapped = buildGlb(canonicalGltfJson(), trianglePositionBytes());
    const view = new DataView(jsonFirstSwapped.buffer);
    // Swap the chunk types: BIN first, JSON second.
    view.setUint32(16, 0x004e4942, true);
    const chunk2TypeAt = 12 + 8 + (view.getUint32(12, true));
    view.setUint32(chunk2TypeAt + 4, 0x4e4f534a, true);
    const parsed = parseGlb(jsonFirstSwapped);
    expect(errorCodeOf(parsed)).toBe('glb-invalid');
    expect(parsed.ok ? '' : parsed.error.message).toContain('JSON');
  });

  it('refuses chunk padding that overruns the container', () => {
    const base = buildGlb(canonicalGltfJson(), trianglePositionBytes());
    // Declare the JSON chunk 2 bytes LONGER than its data + padding allows,
    // overrunning the container.
    const view = new DataView(base.buffer);
    view.setUint32(12, view.getUint32(12, true) + 2, true);
    const parsed = parseGlb(base);
    expect(errorCodeOf(parsed)).toBe('glb-invalid');
  });
});
