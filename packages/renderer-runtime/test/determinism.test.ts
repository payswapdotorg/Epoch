// Deterministic serialization: identical invocation sequences produce
// byte-identical bindings and receipts (content-addressed execution
// evidence), key-order permutations produce identical digests, and the
// emission of the published contract artifacts is deterministic.
import { describe, expect, it } from 'vitest';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  admitInvocation,
  renderRendererContractFiles,
  serializeRendererBinding,
  serializeRendererReceipt,
  type RendererBinding,
  type RendererReceipt,
} from '../src/index';
import { FULL_RENDERER, boundSession, desktopSnapshot, sealedGraph } from './fixtures';

/** Recursively shuffles object key order (deterministic permutation). */
function permuteKeys(value: JsonValue, flip: boolean): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => permuteKeys(item, !flip));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k, permuteKeys(v, !flip)] as const);
    const ordered = flip ? [...entries].reverse() : entries;
    return Object.fromEntries(ordered);
  }
  return value;
}

/** Run an identical invocation script against a fresh binding. */
function runScript(): { binding: RendererBinding; receipts: RendererReceipt[] } {
  const graph = sealedGraph('2d');
  let binding = boundSession();
  const receipts: RendererReceipt[] = [];

  const mounted = admitInvocation(
    binding,
    {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'mount-graph',
      invocationId: 'inv-det-mount',
      rendererSessionId: 'rs-alpha-1',
      graphDigest: graph.digest,
      atMs: 10,
    },
    { graph },
  );
  if (!mounted.ok) throw new Error('fixture mount');
  binding = mounted.value.binding;
  receipts.push(mounted.value.receipt);

  const framed = admitInvocation(binding, {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'advance-frame',
    invocationId: 'inv-det-frame',
    rendererSessionId: 'rs-alpha-1',
    frameIndex: 0,
    atMs: 16,
  });
  if (!framed.ok) throw new Error('fixture frame');
  binding = framed.value.binding;
  receipts.push(framed.value.receipt);

  const intented = admitInvocation(binding, {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'submit-intent',
    invocationId: 'inv-det-intent',
    rendererSessionId: 'rs-alpha-1',
    modality: 'pointer',
    intent: { id: 'world.view.refresh', version: '1.0.0' },
  });
  if (!intented.ok) throw new Error('fixture intent');
  binding = intented.value.binding;
  receipts.push(intented.value.receipt);

  return { binding, receipts };
}

describe('deterministic execution evidence (positive)', () => {
  it('identical invocation scripts produce byte-identical bindings and receipts', () => {
    const first = runScript();
    const second = runScript();
    expect(serializeRendererBinding(second.binding)).toBe(serializeRendererBinding(first.binding));
    expect(second.binding.digest).toBe(first.binding.digest);
    expect(
      second.receipts.map((receipt) => serializeRendererReceipt(receipt)),
    ).toEqual(first.receipts.map((receipt) => serializeRendererReceipt(receipt)));
    expect(second.receipts.map((receipt) => receipt.digest)).toEqual(
      first.receipts.map((receipt) => receipt.digest),
    );
  });

  it('key-order permutations of a binding produce identical canonical forms', () => {
    const { binding } = runScript();
    const { digest: _stripped, ...content } = binding;
    void _stripped;
    const permuted = permuteKeys(JSON.parse(JSON.stringify(content)) as JsonValue, true);
    // The canonical serialization of the permuted content equals the
    // canonical serialization of the direct content (key order is
    // immaterial under canonical JSON).
    expect(canonicalJsonStringify(permuted)).toBe(
      canonicalJsonStringify(JSON.parse(JSON.stringify(content)) as JsonValue),
    );
  });

  it('the canonical binding form is sorted-key JSON (spot check)', () => {
    const { binding } = runScript();
    const serialized = serializeRendererBinding(binding);
    // The canonical form starts with the alphabetically-first key.
    expect(serialized.startsWith('{"boundAtMs":')).toBe(true);
    expect(canonicalJsonStringify(JSON.parse(serialized) as JsonValue)).toBe(serialized);
  });

  it('contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderRendererContractFiles()).toEqual(renderRendererContractFiles());
  });

  it('the snapshot projection is stable under key permutation', () => {
    const snapshot = desktopSnapshot();
    const permuted = permuteKeys(JSON.parse(JSON.stringify(snapshot)) as JsonValue, true);
    const first = boundSession();
    const second = boundSession(FULL_RENDERER, {
      snapshot: permuted as unknown as ReturnType<typeof desktopSnapshot>,
    });
    expect(serializeRendererBinding(second)).toBe(serializeRendererBinding(first));
  });
});
