// Negative compile battery: typed rejections at every boundary — version
// skew (envelope and device), malformed descriptors (including vendor
// fields on strict objects), envelope digest tampering, cross-tenant
// compile requests, unknown references (admission passthrough), kernel
// authority violations (admission passthrough), vendor-field authority
// violations (compiler blocklist), device budget exceedance, mesh
// accountability, cyclic narrative chains, and over-anchored labels.
// None of these paths may throw: every failure is a typed CompilerError.
import { describe, expect, it } from 'vitest';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import {
  MAX_PLAN_ANCHORS_PER_OP,
  compileExperienceGraph,
  isVendorKey,
} from '../src/index';
import {
  budgetedHeadsetDevice,
  desktopDevice,
  expectFailure,
  graphContent,
  sealedGraph,
  TENANT_A,
} from './fixtures';

/** Structural view of a mutable envelope copy used by the mutation tests. */
interface MutableEnvelope {
  nodes: Array<{
    id: string;
    kind: string;
    ref?: unknown;
    descriptor: Record<string, unknown>;
    attributes?: Record<string, unknown>;
  }>;
  edges: Array<{
    kind: string;
    from: string;
    to: string;
    attributes?: Record<string, unknown>;
  }>;
  protocolVersion?: string;
  [key: string]: unknown;
}

function resealed(mutate: (content: MutableEnvelope) => void): unknown {
  const content = JSON.parse(JSON.stringify(graphContent('2d'))) as MutableEnvelope;
  mutate(content);
  const sealed = sealExperienceGraph(content);
  if (!sealed.ok) {
    // Some mutations intentionally break the envelope schema; in that case
    // hand the raw (unsealed) mutation to the compiler directly.
    return content;
  }
  return sealed.value;
}

describe('compile (negative) — version-unsupported', () => {
  it('rejects an envelope with a foreign protocolVersion before schema validation', () => {
    const envelope = JSON.parse(JSON.stringify(sealedGraph('2d')));
    envelope.protocolVersion = '2.0.0';
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'version-unsupported',
    );
    expect(failure.expected).toBe('1.0.0');
    expect(failure.encountered).toBe('2.0.0');
  });

  it('rejects a target device with a foreign descriptorVersion before schema validation', () => {
    const device = { ...desktopDevice(), descriptorVersion: 2 };
    const failure = expectFailure(
      compileExperienceGraph({ envelope: sealedGraph('2d'), device }),
      'version-unsupported',
    );
    expect(failure.expected).toBe('1');
    expect(failure.encountered).toBe('2');
  });
});

describe('compile (negative) — malformed-descriptor', () => {
  it('rejects a non-object envelope root', () => {
    const failure = expectFailure(
      compileExperienceGraph({ envelope: 'nope', device: desktopDevice() }),
      'malformed-descriptor',
    );
    expect(failure.issues[0]?.path).toBe('$');
  });

  it('rejects a structurally invalid target device with precise paths', () => {
    const failure = expectFailure(
      compileExperienceGraph({
        envelope: sealedGraph('2d'),
        device: { ...desktopDevice(), display: { stereoscopic: 'yes' } },
      }),
      'malformed-descriptor',
    );
    expect(failure.issues.some((issue) => issue.path.includes('display'))).toBe(true);
  });

  it('rejects an unsorted device interaction modality set (deterministic set semantics)', () => {
    const failure = expectFailure(
      compileExperienceGraph({
        envelope: sealedGraph('2d'),
        device: { ...desktopDevice(), interaction: ['pointer', 'keyboard'] },
      }),
      'malformed-descriptor',
    );
    expect(failure.issues.some((issue) => issue.message.includes('sorted'))).toBe(true);
  });

  it('rejects a cyclic narrative follows chain with a precise path', () => {
    const content = JSON.parse(JSON.stringify(graphContent('narrative'))) as MutableEnvelope;
    // beat-1 -> beat-2 -> beat-3 becomes a cycle: beat-3 -> beat-1.
    content.edges = [
      { kind: 'follows', from: 'xn-beat-1', to: 'xn-beat-2' },
      { kind: 'follows', from: 'xn-beat-2', to: 'xn-beat-3' },
      { kind: 'follows', from: 'xn-beat-3', to: 'xn-beat-1' },
    ];
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const failure = expectFailure(
      compileExperienceGraph({ envelope: sealed.value, device: desktopDevice() }),
      'malformed-descriptor',
    );
    expect(failure.issues[0]?.path).toBe('edges');
    expect(failure.message).toContain('cyclic');
  });

  it('rejects an over-anchored label (bound, never truncated)', () => {
    const content = JSON.parse(JSON.stringify(graphContent('2d'))) as MutableEnvelope;
    content.nodes.push({
      id: 'xn-label-2',
      kind: 'label',
      descriptor: { text: 'Over-anchored' },
    });
    for (let i = 0; i <= MAX_PLAN_ANCHORS_PER_OP; i += 1) {
      const targetId = `xn-shape-2-${i}`;
      content.nodes.push({
        id: targetId,
        kind: 'shape-2d',
        descriptor: { geometry: { form: 'circle', cx: i, cy: 0, r: 1 } },
      });
      content.edges.push({ kind: 'anchors', from: 'xn-label-2', to: targetId });
    }
    content.nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
    content.edges.sort((a, b) =>
      a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0,
    );
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const failure = expectFailure(
      compileExperienceGraph({ envelope: sealed.value, device: desktopDevice() }),
      'malformed-descriptor',
    );
    expect(failure.message).toContain('over-anchored');
  });
});

describe('compile (negative) — digest-mismatch (envelope tamper detection)', () => {
  it('rejects a tampered envelope whose claimed digest does not match its content', () => {
    const envelope = JSON.parse(JSON.stringify(sealedGraph('2d')));
    // Tamper AFTER sealing: swap the label text without recomputing the digest.
    envelope.nodes[0].descriptor.text = 'Tampered text';
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'digest-mismatch',
    );
    expect(failure.path).toEqual(['digest']);
    expect(failure.encountered).toBe(sealedGraph('2d').digest);
  });
});

describe('compile (negative) — cross-tenant-denied', () => {
  it('rejects a compile request for a foreign tenant (R12)', () => {
    const failure = expectFailure(
      compileExperienceGraph({
        envelope: sealedGraph('2d'),
        device: desktopDevice(),
        expectedTenantId: 'tenant-beta',
      }),
      'cross-tenant-denied',
    );
    expect(failure.expectedTenantId).toBe('tenant-beta');
    expect(failure.encounteredTenantId).toBe(TENANT_A);
    expect(failure.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('rejects an envelope carrying a cross-tenant node reference (admission passthrough)', () => {
    const envelope = resealed((content) => {
      content.nodes[0].ref = {
        kind: 'world-entity',
        tenantId: 'tenant-gamma',
        entityId: 'building-7',
        contentDigest: 'a'.repeat(64),
      };
    });
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'cross-tenant-denied',
    );
    expect(failure.encounteredTenantId).toBe('tenant-gamma');
  });
});

describe('compile (negative) — unknown-reference (admission passthrough)', () => {
  it('rejects an edge to a node that does not exist', () => {
    const envelope = resealed((content) => {
      (content.edges as Array<{ kind: string; from: string; to: string }>)[0].to =
        'xn-does-not-exist';
    });
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'unknown-reference',
    );
    expect(failure.reference).toBe('experience-node:xn-does-not-exist');
  });
});

describe('compile (negative) — authority-violation', () => {
  it('rejects kernel-reserved presentation attributes (W011 admission, origin kernel-reserved)', () => {
    const envelope = resealed((content) => {
      content.nodes[0].attributes = { confidence: 0.9 };
    });
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'authority-violation',
    );
    expect(failure.violations).toEqual([
      { path: 'nodes.0.attributes.confidence', key: 'confidence', origin: 'kernel-reserved' },
    ]);
  });

  it('rejects vendor/engine fields in presentation attributes (compiler blocklist, first-class)', () => {
    const envelope = resealed((content) => {
      content.nodes[0].attributes = { 'unity:prefab': 'guid-123', 'threejs-material': { roughness: 0.5 } };
    });
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'authority-violation',
    );
    expect(failure.violations.map((v) => v.key).sort()).toEqual([
      'threejs-material',
      'unity:prefab',
    ]);
    for (const violation of failure.violations) {
      expect(violation.origin).toBe('vendor-blocklist');
    }
  });

  it('rejects vendor fields nested inside attribute values, with precise paths', () => {
    const envelope = resealed((content) => {
      content.nodes[0].attributes = { finish: { 'webgpu-pipeline': 'opaque' } };
    });
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'authority-violation',
    );
    expect(failure.violations).toEqual([
      { path: 'nodes.0.attributes.finish.webgpu-pipeline', key: 'webgpu-pipeline', origin: 'vendor-blocklist' },
    ]);
  });

  it('rejects vendor fields on edge attributes too', () => {
    const envelope = resealed((content) => {
      (content.edges as Array<{ kind: string; from: string; to: string; attributes?: unknown }>)[0].attributes = { 'gpt-prompt': 'summarize' };
    });
    const failure = expectFailure(
      compileExperienceGraph({ envelope, device: desktopDevice() }),
      'authority-violation',
    );
    expect(failure.violations[0]?.origin).toBe('vendor-blocklist');
  });

  it('segment-matches vendor tokens (camelCase, separators, prefixed keys) and passes neutral keys', () => {
    expect(isVendorKey('unity:prefab')).toBe('unity');
    expect(isVendorKey('threejs-material')).toBe('threejs');
    expect(isVendorKey('WebGPULayout')).toBe('webgpu');
    expect(isVendorKey('babylon.scene')).toBe('babylon');
    expect(isVendorKey('my-gpt-hint')).toBe('gpt');
    expect(isVendorKey('ThreeJsRoughness')).toBe('threejs');
    // Neutral presentation vocabulary passes (common English words do not
    // hit: segment matching, not substring matching).
    expect(isVendorKey('display-hint')).toBeNull();
    expect(isVendorKey('slot-index')).toBeNull();
    expect(isVendorKey('roughness')).toBeNull();
    expect(isVendorKey('metallic-finish')).toBeNull();
    expect(isVendorKey('tooltip')).toBeNull();
    expect(isVendorKey('three-d-view')).toBeNull();
    expect(isVendorKey('reaction-count')).toBeNull();
  });
});

describe('compile (negative) — device-budget-exceeded', () => {
  it('rejects content whose estimated triangles exceed the target budget', () => {
    // The 3d fixture estimates 12 triangles (box); declare a budget of 10.
    const device = {
      ...desktopDevice(),
      spatial: { poseTracking: 'none' as const, worldAnchored: false, maxTriangles: 10 },
    };
    const failure = expectFailure(
      compileExperienceGraph({ envelope: sealedGraph('3d'), device }),
      'device-budget-exceeded',
    );
    expect(failure.limit).toBe('maxTriangles');
    expect(failure.expected).toBe(10);
    expect(failure.encountered).toBe(12);
  });

  it('rejects content whose mesh-asset bytes exceed the target memory budget', () => {
    // The 3d fixture carries one 4096-byte mesh; declare a budget of 2048.
    const device = {
      ...desktopDevice(),
      spatial: { poseTracking: 'none' as const, worldAnchored: false, maxTextureBytes: 2048 },
    };
    const failure = expectFailure(
      compileExperienceGraph({ envelope: sealedGraph('3d'), device }),
      'device-budget-exceeded',
    );
    expect(failure.limit).toBe('maxTextureBytes');
    expect(failure.expected).toBe(2048);
    expect(failure.encountered).toBe(4096);
  });

  it('rejects an unaccountable mesh under a declared memory budget (accountability, never silent pass)', () => {
    // Remove the mesh byteSize on the 3d fixture while declaring a budget.
    const content = JSON.parse(JSON.stringify(graphContent('3d'))) as MutableEnvelope;
    const mesh = content.nodes.find((node) => node.kind === 'spatial-3d');
    if (mesh === undefined) throw new Error('fixture mesh node');
    mesh.descriptor.mesh = { assetDigest: 'b'.repeat(64) };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const failure = expectFailure(
      compileExperienceGraph({ envelope: sealed.value, device: budgetedHeadsetDevice() }),
      'malformed-descriptor',
    );
    expect(failure.issues[0]?.path).toContain('byteSize');
  });

  it('admits the same content on devices that declare no such budgets (budgets are data)', () => {
    const compiled = compileExperienceGraph({
      envelope: sealedGraph('3d'),
      device: desktopDevice(),
    });
    expect(compiled.ok).toBe(true);
  });
});

describe('compile (negative) — never throws', () => {
  it('handles absurd inputs totally (typed errors, no exceptions)', () => {
    for (const envelope of [null, undefined, 42, [], 'graph', {}, { protocolVersion: 1 }]) {
      const result = compileExperienceGraph({ envelope, device: desktopDevice() });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(typeof result.error.code).toBe('string');
      }
    }
    for (const device of [null, 42, 'device', {}, { descriptorVersion: 'one' }]) {
      const result = compileExperienceGraph({ envelope: sealedGraph('2d'), device });
      expect(result.ok).toBe(false);
    }
  });
});
