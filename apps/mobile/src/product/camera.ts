/**
 * @epoch/mobile — the field camera seam (W049).
 *
 * W049 Tech Lead pin 4: "camera/evidence capture produces content-addressed
 * evidence records through the object-storage seam (digest computed before
 * upload; the record references the digest, not a local path)."
 *
 * This module is the SEAM, not the platform binding (the platform module
 * binding lives in the adapter layer — native/platform-bindings.ts; the
 * provider vocabulary stays there, never in this typed surface):
 *
 *  - `FieldCameraPort.capturePhoto` returns raw bytes + neutral capture
 *    metadata (NO vendor fields — the W018 neutrality discipline: the
 *    descriptor vocabulary stays the neutral W011/device-capture set).
 *  - `MemoryCameraPort` is the deterministic implementation the tests, the
 *    journey simulations and the device fallback use: caller-supplied bytes
 *    and instants (zero wall-clock, zero randomness).
 *
 * The digest-addressing itself lives in evidence-capture.ts: the bytes this
 * port returns are hashed (sha256) BEFORE any upload, the upload goes
 * through the gateway's evidence.intake (the object-storage seam), the
 * authority RECOMPUTES the digest server-side, and every record/link the
 * field product keeps references the DIGEST — never a local path, never the
 * bytes.
 */

/** Neutral capture metadata (no vendor vocabulary, no local paths). */
export interface FieldPhotoCapture {
  /** The raw captured bytes (the digest input; never persisted by the host). */
  readonly bytes: Uint8Array;
  /** Neutral capture kind for the evidence pipeline. */
  readonly kind: 'photo';
  /** Caller-supplied capture instant (zero wall-clock). */
  readonly capturedAt: string;
  /** The capturing principal (provenance). */
  readonly capturedBy: string;
  /** Pixel width/height when known (neutral descriptor, optional). */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  /** Optional note carried on the evidence reference (never the payload). */
  readonly note?: string | undefined;
}

/** Options of one photo capture. */
export interface CapturePhotoOptions {
  /** Caller-supplied capture instant (zero wall-clock). */
  readonly capturedAt: string;
  /** The capturing principal. */
  readonly capturedBy: string;
  /** Optional note. */
  readonly note?: string | undefined;
}

/** The field camera seam. */
export interface FieldCameraPort {
  /** Capture one photo (bytes + provenance; the camera NEVER digests). */
  capturePhoto(options: CapturePhotoOptions): Promise<FieldPhotoCapture>;
}

/** Decode base64 to bytes (the platform adapter hands base64 photo data). */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const size = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4);
    if (chunk.length < 2) break;
    let word = 0;
    for (let c = 0; c < chunk.length; c += 1) {
      const char = chunk[c]!;
      const code =
        char >= 'A' && char <= 'Z'
          ? char.charCodeAt(0) - 65
          : char >= 'a' && char <= 'z'
            ? char.charCodeAt(0) - 97 + 26
            : char >= '0' && char <= '9'
              ? char.charCodeAt(0) - 48 + 52
              : char === '+'
                ? 62
                : 63;
      word |= code << (18 - c * 6);
    }
    const pad = 4 - chunk.length;
    for (let b = 0; b < 3 - pad; b += 1) {
      if (offset < size) {
        bytes[offset] = (word >>> (16 - b * 8)) & 0xff;
        offset += 1;
      }
    }
  }
  return bytes;
}

/**
 * The deterministic in-memory camera (tests, journey simulations, device
 * fallback): the caller supplies the exact bytes — the digest pipeline stays
 * fully deterministic. A scripted sequence replays bytes in order; the last
 * frame repeats when the sequence is exhausted (never randomness).
 */
export class MemoryCameraPort implements FieldCameraPort {
  private readonly frames: readonly Uint8Array[];
  private cursor = 0;

  constructor(frames: readonly Uint8Array[]) {
    this.frames = frames.map((frame) => new Uint8Array(frame));
  }

  async capturePhoto(options: CapturePhotoOptions): Promise<FieldPhotoCapture> {
    const bytes = this.frames[this.cursor] ?? this.frames[this.frames.length - 1];
    this.cursor = Math.min(this.cursor + 1, Math.max(this.frames.length - 1, 0));
    if (bytes === undefined) {
      throw new TypeError('MemoryCameraPort requires at least one scripted frame');
    }
    return {
      bytes: new Uint8Array(bytes),
      kind: 'photo',
      capturedAt: options.capturedAt,
      capturedBy: options.capturedBy,
      ...(options.note !== undefined ? { note: options.note } : {}),
    };
  }
}
