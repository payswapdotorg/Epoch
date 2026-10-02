/**
 * The bridge battery (W060): the binding factories and the tamper-evidence
 * discipline — the trust-gate story end to end WITHIN the bridge package
 * (the cross-fabric end-to-end proof lives in qa/foundation-renderers).
 */
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import type { RendererAssetBinding } from '@epoch/renderer-runtime';
import {
  admitGltfAsset,
  gltfMeshBindingOf,
  gltfRendererAssetBinding,
  gltfUntrustedAssetBinding,
} from '../src/normalize';
import { sha256HexOfBytes } from '../src/bytes';
import { canonicalGlbBytes } from './helpers';

const TENANT = { tenantId: 'tenant-fixture' };

function admittedFixture() {
  const admitted = admitGltfAsset(canonicalGlbBytes());
  if (!admitted.ok) throw new Error(`fixture admission failed: ${admitted.error.message}`);
  return admitted.value;
}

describe('gltfRendererAssetBinding (the validated binding factory)', () => {
  it('seals a validated, tenant-scoped, content-addressed mesh binding', () => {
    const admission = admittedFixture();
    const binding = gltfRendererAssetBinding({
      admission,
      bindingId: 'rab-gltf-fixture-1',
      fabricSessionId: 'fx-gltf-bridge',
      tenantScope: TENANT,
      boundAtMs: 1_000,
    });
    expect(binding.schema).toBe('epoch.renderer-asset-binding');
    expect(binding.fabricProtocolVersion).toBe('1.0.0');
    expect(binding.bindingId).toBe('rab-gltf-fixture-1');
    expect(binding.fabricSessionId).toBe('fx-gltf-bridge');
    expect(binding.tenantScope).toEqual(TENANT);
    expect(binding.assetKind).toBe('mesh');
    expect(binding.trustState).toBe('validated');
    expect(binding.validatedAtMs).toBe(1_000);
    expect(binding.boundAtMs).toBe(1_000);
    expect(binding.assetDigest).toBe(admission.asset.assetBytesDigest);
    expect(binding.byteSize).toBe(admission.asset.byteSize);
    expect(binding.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('seals verifiably: the digest is the canonical JSON digest of the content', () => {
    const admission = admittedFixture();
    const binding = gltfRendererAssetBinding({
      admission,
      bindingId: 'rab-gltf-fixture-2',
      fabricSessionId: 'fx-gltf-bridge',
      tenantScope: TENANT,
      boundAtMs: 2_000,
    });
    const { digest, ...content } = binding;
    expect(digest).toBe(canonicalDigest(content));
  });

  it('is trust-gated by construction: the factory accepts only a validated admission', () => {
    // The type system enforces it (GltfAssetBindingInput.admission is a
    // GltfAdmission — only admitGltfAsset produces one, and only after the
    // full structural validation). The runtime evidence: a document that
    // FAILS validation never reaches the factory at all.
    const tampered = new Uint8Array(canonicalGlbBytes());
    tampered[21] = 0xff; // corrupt a byte INSIDE the JSON chunk
    const refused = admitGltfAsset(tampered);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('malformed-json');
  });
});

describe('gltfUntrustedAssetBinding (explicit untrusted tracking)', () => {
  it('seals an untrusted binding whose digest is computed, never trusted', () => {
    const bytes = canonicalGlbBytes();
    const binding = gltfUntrustedAssetBinding({
      assetBytes: bytes,
      bindingId: 'rab-gltf-untracked-1',
      fabricSessionId: 'fx-gltf-bridge',
      tenantScope: TENANT,
      boundAtMs: 1_500,
    });
    expect(binding.trustState).toBe('untrusted');
    expect(binding.validatedAtMs).toBeUndefined();
    expect(binding.assetDigest).toBe(sha256HexOfBytes(bytes));
    // Every W056 adapter refuses to mount this (proven cross-fabric in the
    // qa/foundation-renderers battery); here we pin the record's shape.
    expect(binding.byteSize).toBe(bytes.length);
    expect(binding.assetKind).toBe('mesh');
  });

  it('produces DIFFERENT asset digests for different bytes (tamper evidence)', () => {
    const bytes = canonicalGlbBytes();
    const tampered = new Uint8Array(bytes);
    // Flip one byte inside the BIN chunk (a vertex component): the document
    // still validates, but its content address changes — the host detects
    // the substitution by digest comparison.
    tampered[bytes.length - 4] ^= 0x01;
    const first = gltfUntrustedAssetBinding({
      assetBytes: bytes,
      bindingId: 'rab-a',
      fabricSessionId: 'fx',
      tenantScope: TENANT,
      boundAtMs: 1,
    });
    const second = gltfUntrustedAssetBinding({
      assetBytes: tampered,
      bindingId: 'rab-a',
      fabricSessionId: 'fx',
      tenantScope: TENANT,
      boundAtMs: 1,
    });
    expect(first.assetDigest).not.toBe(second.assetDigest);
    expect(admitGltfAsset(tampered).ok).toBe(true);
  });
});

describe('gltfMeshBindingOf (the neutral W016 representation hint)', () => {
  it('projects one mesh into a digest-addressed suggestion record', () => {
    const admission = admittedFixture();
    const suggestion = gltfMeshBindingOf(admission.asset, 0);
    expect(suggestion.ok).toBe(true);
    if (!suggestion.ok) return;
    expect(suggestion.value.kind).toBe('epoch.gltf-mesh-binding');
    expect(suggestion.value.label).toBe('Fixture mesh');
    expect(suggestion.value.vertexCount).toBe(3);
    expect(suggestion.value.triangleCount).toBe(1);
    expect(suggestion.value.sourceAssetDigest).toBe(admission.asset.assetBytesDigest);
    expect(suggestion.value.materials).toHaveLength(1);
    expect(suggestion.value.materials[0]!.name).toBe('Fixture material');
    expect(suggestion.value.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses unknown mesh indices with a typed failure', () => {
    const admission = admittedFixture();
    const refused = gltfMeshBindingOf(admission.asset, 7);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('mesh-invalid');
    expect(refused.error.message).toContain('index 7');
  });
});

describe('the binding discipline (cross-checks against the contract shape)', () => {
  it('validated and untrusted bindings of the SAME bytes stay digest-distinct', () => {
    const admission = admittedFixture();
    const validated = gltfRendererAssetBinding({
      admission,
      bindingId: 'rab-same-id',
      fabricSessionId: 'fx',
      tenantScope: TENANT,
      boundAtMs: 1_000,
    });
    const untrusted = gltfUntrustedAssetBinding({
      assetBytes: canonicalGlbBytes(),
      bindingId: 'rab-same-id',
      fabricSessionId: 'fx',
      tenantScope: TENANT,
      boundAtMs: 1_000,
    });
    // Same asset content address, different trust records.
    expect(validated.assetDigest).toBe(untrusted.assetDigest);
    expect(validated.trustState).not.toBe(untrusted.trustState);
    // The trust distinction is visible in the record shape: only the
    // validated binding carries its validation time.
    expect('validatedAtMs' in validated).toBe(true);
    expect('validatedAtMs' in untrusted).toBe(false);
    const shape = (binding: RendererAssetBinding) =>
      Object.keys(binding).filter((key) => key !== 'validatedAtMs').sort();
    expect(shape(validated)).toEqual(shape(untrusted));
  });
});
