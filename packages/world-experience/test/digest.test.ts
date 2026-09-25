// Digest discipline: content-addressed scene identity, digest round-trips,
// tamper rejection, and the scene -> graph -> envelope digest chain.
import { describe, expect, it } from 'vitest';
import {
  canonicalDigest,
  canonicalJsonStringify,
  sha256Hex,
  type JsonValue,
} from '@epoch/agent-protocol';
import {
  computeWorldSceneDigest,
  sealWorldScene,
  serializeWorldScene,
  verifyWorldSceneDigest,
} from '../src/serialize';
import { admitSealedWorldScene } from '../src/parse';
import { createWorldScene, emptyWorldSceneStore, focusSceneEntity } from '../src/scene';
import { compilationDigestChain, compileWorldScene } from '../src/compile';
import { desktopDevice, expectFailure, referenceOntology, sceneContent } from './fixtures';

describe('digest discipline', () => {
  it('the scene digest is the SHA-256 of the canonical content JSON (round-trip)', () => {
    const content = sceneContent();
    const { digest: _omit, ...contentWithoutDigest } = content as unknown as {
      digest?: string;
    } & Record<string, JsonValue>;
    void _omit;
    const expected = canonicalDigest(contentWithoutDigest as JsonValue);
    expect(computeWorldSceneDigest(content)).toBe(expected);
  });

  it('seal -> verify round-trips the scene content', () => {
    const sealed = sealWorldScene(sceneContent());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const verified = verifyWorldSceneDigest(sealed.value);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value).toEqual(
      (() => {
        const { digest: _d, ...rest } = sealed.value;
        void _d;
        return rest;
      })(),
    );
    const admitted = admitSealedWorldScene(sealed.value);
    expect(admitted.ok).toBe(true);
  });

  it('serialization is canonical (sorted keys, no whitespace round-trips)', () => {
    const sealed = sealWorldScene(sceneContent());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const once = serializeWorldScene(sealed.value);
    const twice = serializeWorldScene(JSON.parse(once) as typeof sealed.value);
    expect(once).toBe(twice);
  });

  it('tampering with the sealed content is rejected (digest-mismatch)', () => {
    const sealed = sealWorldScene(sceneContent());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const tampered = { ...sealed.value, name: 'Tampered name' };
    const failure = expectFailure(verifyWorldSceneDigest(tampered), 'digest-mismatch');
    expect(failure.expected).not.toBe(failure.encountered);
    expectFailure(admitSealedWorldScene(tampered), 'digest-mismatch');
  });

  it('every scene revision re-seals with a fresh digest (mutating transitions)', () => {
    const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const focused = focusSceneEntity(created.value.state, 'wsc-tower-a-site', 'wall-south-2');
    expect(focused.ok).toBe(true);
    if (!focused.ok) return;
    expect(focused.value.scene.digest).not.toBe(created.value.scene.digest);
    // And each revision verifies.
    expect(verifyWorldSceneDigest(focused.value.scene).ok).toBe(true);
  });

  it('the compilation digest chain: scene digest -> graph digests -> mount envelopes', () => {
    const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const compiled = compileWorldScene(created.value.scene, {
      ontology: referenceOntology(),
      device: desktopDevice(),
      invocation: { invocationId: 'w016-digest-chain', rendererSessionId: 'rs-world-alpha', atMs: 0 },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const chain = compilationDigestChain(compiled.value);
    expect(chain.sceneDigest).toBe(created.value.scene.digest);
    expect(chain.graphDigests).toHaveLength(compiled.value.graphs.length);
    for (const graph of compiled.value.graphs) {
      // Each graph digest is the canonical digest of the graph content.
      const { digest: _d, ...content } = graph;
      void _d;
      expect(graph.digest).toBe(canonicalDigest(content as JsonValue));
    }
    // Each mount envelope claims exactly its graph digest.
    for (let i = 0; i < compiled.value.graphs.length; i += 1) {
      expect(compiled.value.mountEnvelopes[i]?.graphDigest).toBe(chain.graphDigests[i]);
    }
  });

  it('the digest machinery is the shared canonical implementation (agent-protocol reuse)', () => {
    // The house SHA-256 implementation cross-checked against NIST vectors
    // in @epoch/agent-protocol; here we pin the reuse by identity of
    // output over a canonical payload.
    expect(sha256Hex(canonicalJsonStringify('epoch' as JsonValue))).toBe(
      canonicalDigest('epoch' as JsonValue),
    );
    // NIST vector: SHA-256 of the empty string.
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
