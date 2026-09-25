// W014 shell mounting seam: mounting-point registry, feature-descriptor
// contract validation, tenant isolation of features, and the named
// negatives (missing mount, malformed descriptor, cross-tenant feature).
import { describe, expect, it } from 'vitest';
import {
  admitFeature,
  createFeatureSet,
  createMountRegistry,
  featuresAtMount,
  validateFeatureDescriptor,
  validateMountingPoint,
} from './mounting';
import type { ShellError, ShellIssue } from './errors';
import { builtInMounts, REFERENCE_TENANT } from './bootstrap';
import { SHELL_RECORD_VERSION } from './version';

/** Narrow a shell error to its validation issues (fails the test otherwise). */
function validationIssuesOf(error: ShellError): readonly ShellIssue[] {
  expect(error.code).toBe('validation');
  if (error.code !== 'validation') {
    throw new Error(`expected a validation error, got '${error.code}'`);
  }
  return error.issues;
}

const mountsResult = createMountRegistry(builtInMounts());
if (!mountsResult.ok) {
  throw new Error('built-in mount registry must build');
}
const mounts = mountsResult.value;

describe('shell mounting points', () => {
  it('exposes the built-in surface: four frame regions + three Experience slots (positive)', () => {
    const all = mounts.listMounts();
    expect(all.map((m) => m.mountId)).toEqual([
      'mount:content',
      'mount:controls',
      'mount:header',
      'mount:narrative',
      'mount:navigation',
      'mount:scene',
      'mount:status',
    ]);
    const scene = mounts.experienceSlot('scene');
    expect(scene.ok).toBe(true);
    if (scene.ok) {
      expect(scene.value.acceptedGraphKinds).toEqual(['2d', '3d', 'animation', 'timeline-replay', 'presence']);
    }
    const narrative = mounts.experienceSlot('narrative');
    expect(narrative.ok && narrative.value.acceptedGraphKinds).toEqual(['narrative']);
  });

  it('validates well-formed mounting points and rejects malformed ones (negative)', () => {
    expect(validateMountingPoint(builtInMounts()[0]).ok).toBe(true);
    const cases: readonly unknown[] = [
      'mount:header',
      null,
      { ...builtInMounts()[0], mountId: 'header' }, // bad id
      { ...builtInMounts()[0], kind: 'portal' }, // unknown kind
      { ...builtInMounts()[0], region: 'sidebar' }, // unknown region
      // region mount carrying a slot:
      { schemaVersion: 1, mountId: 'mount:x', kind: 'region', region: 'header', slot: 'scene', acceptedGraphKinds: [], description: 'x' },
      // experience mount without a slot:
      { schemaVersion: 1, mountId: 'mount:x', kind: 'experience', acceptedGraphKinds: [], description: 'x' },
    ];
    for (const input of cases) {
      const result = validateMountingPoint(input);
      expect(result.ok, `expected rejection for ${JSON.stringify(input)}`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
      }
    }
  });

  it('rejects an unknown mount id with the typed unknown-mount error (negative)', () => {
    const result = mounts.resolve('mount:sidebar');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-mount');
      if (result.error.code === 'unknown-mount') {
        expect(result.error.mountId).toBe('mount:sidebar');
      }
    }
  });

  it('rejects duplicate mount ids and duplicate slot exposure (negative)', () => {
    const duplicate = createMountRegistry([...builtInMounts(), builtInMounts()[0]]);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe('duplicate-mount');
    }
    const secondScene = createMountRegistry([
      ...builtInMounts(),
      {
        schemaVersion: SHELL_RECORD_VERSION,
        mountId: 'mount:scene-2',
        kind: 'experience',
        slot: 'scene',
        acceptedGraphKinds: ['2d'],
        description: 'duplicate scene slot',
      },
    ]);
    expect(secondScene.ok).toBe(false);
  });
});

describe('shell feature descriptors', () => {
  const validFeature = {
    schemaVersion: SHELL_RECORD_VERSION,
    featureId: 'feature:marketplace',
    displayName: 'Marketplace',
    version: '1.0.0',
    mounts: [
      { mountId: 'mount:content', required: true },
      { mountId: 'mount:scene', required: false, experienceGraphKinds: ['3d'] },
    ],
  };

  it('validates a well-formed feature descriptor against the mount registry (positive)', () => {
    const result = validateFeatureDescriptor(validFeature, mounts);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureId).toBe('feature:marketplace');
      expect(result.value.mounts).toHaveLength(2);
    }
  });

  it('rejects a feature descriptor whose required mount is not provided by the shell (named negative)', () => {
    const missing = {
      ...validFeature,
      mounts: [{ mountId: 'mount:sidebar', required: true }],
    };
    const result = validateFeatureDescriptor(missing, mounts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      expect(validationIssuesOf(result.error).map((issue) => issue.path)).toContain(
        'mounts[0].mountId',
      );
    }
    // A mount that exists nowhere at all (not a mounting point) is the same
    // typed rejection class.
    const nowhere = {
      ...validFeature,
      mounts: [{ mountId: 'mount:does-not-exist', required: true }],
    };
    expect(validateFeatureDescriptor(nowhere, mounts).ok).toBe(false);
  });

  it('rejects malformed feature descriptors with typed validation errors (negative)', () => {
    const cases: readonly unknown[] = [
      'feature:x',
      null,
      { ...validFeature, schemaVersion: 2 }, // version skew
      { ...validFeature, featureId: 'marketplace' }, // bad id
      { ...validFeature, displayName: ' ' }, // blank display name
      { ...validFeature, version: '1.0' }, // not semver core
      { ...validFeature, version: 'latest' }, // not semver core
      { ...validFeature, mounts: [] }, // no mounts at all
      { ...validFeature, mounts: 'mount:content' }, // not an array
      // duplicate mount declaration:
      {
        ...validFeature,
        mounts: [
          { mountId: 'mount:content', required: true },
          { mountId: 'mount:content', required: false },
        ],
      },
      // region mount declaring experience graph kinds:
      {
        ...validFeature,
        mounts: [{ mountId: 'mount:content', required: true, experienceGraphKinds: ['2d'] }],
      },
      // experience mount without graph kinds:
      {
        ...validFeature,
        mounts: [{ mountId: 'mount:scene', required: true }],
      },
      // experience mount with a kind the slot does not accept:
      {
        ...validFeature,
        mounts: [{ mountId: 'mount:narrative', required: true, experienceGraphKinds: ['3d'] }],
      },
      // experience mount with an unknown graph kind:
      {
        ...validFeature,
        mounts: [{ mountId: 'mount:scene', required: true, experienceGraphKinds: ['hologram'] }],
      },
      // malformed tenant binding:
      { ...validFeature, tenantId: 'acme' },
    ];
    for (const input of cases) {
      const result = validateFeatureDescriptor(input, mounts);
      expect(result.ok, `expected rejection for ${JSON.stringify(input)}`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
      }
    }
  });

  it('rejects a cross-tenant feature admission with the typed error (named negative: cross-tenant)', () => {
    const foreignFeature = {
      ...validFeature,
      featureId: 'feature:globex-private',
      tenantId: 'tenant:globex',
    };
    const validated = validateFeatureDescriptor(foreignFeature, mounts);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const admission = admitFeature(validated.value, REFERENCE_TENANT); // tenant:epoch-reference
    expect(admission.ok).toBe(false);
    if (!admission.ok) {
      expect(admission.error.code).toBe('cross-tenant-denied');
      if (admission.error.code === 'cross-tenant-denied') {
        expect(admission.error.tenantOfContext).toBe('tenant:epoch-reference');
        expect(admission.error.tenantOfSubject).toBe('tenant:globex');
      }
    }
  });

  it('feature sets are tenant-isolated and deterministic (positive + isolation)', () => {
    const shared = { ...validFeature, tenantId: undefined };
    const own = { ...validFeature, featureId: 'feature:own', tenantId: 'tenant:epoch-reference' };
    const foreign = { ...validFeature, featureId: 'feature:foreign', tenantId: 'tenant:globex' };
    // Foreign features cannot even enter the reference context's set.
    const rejected = createFeatureSet([foreign], mounts, REFERENCE_TENANT);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('cross-tenant-denied');
    }
    const set = createFeatureSet([own, shared], mounts, REFERENCE_TENANT);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    // Sorted by feature id, regardless of registration order.
    expect(set.value.listFeatureIds()).toEqual(['feature:marketplace', 'feature:own']);
    // featuresAtMount projects occupancy deterministically.
    expect(featuresAtMount(set.value, 'mount:content').map((f) => f.featureId)).toEqual([
      'feature:marketplace',
      'feature:own',
    ]);
    expect(featuresAtMount(set.value, 'mount:header')).toEqual([]);
  });

  it('rejects duplicate feature ids with the typed error (negative)', () => {
    const set = createFeatureSet([validFeature, validFeature], mounts, REFERENCE_TENANT);
    expect(set.ok).toBe(false);
    if (!set.ok) {
      expect(set.error.code).toBe('duplicate-feature');
    }
  });

  it('the empty feature set is valid and empty (the features-absent baseline)', () => {
    const set = createFeatureSet([], mounts, REFERENCE_TENANT);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.value.listFeatureIds()).toEqual([]);
    expect(set.value.listFeatures()).toEqual([]);
    const resolve = set.value.resolve('feature:any');
    expect(resolve.ok).toBe(false);
  });
});
