// RUNTIME PARITY with the sibling vocabularies (devDependencies only —
// no runtime coupling; the compile-time half lives in
// src/kernel-parity.ts):
//
// - W010 event-log: the mirrored adaptation-event shape is admitted by
//   the REAL W010 seal path and digests identically; the stream/actor
//   grammars are pattern-identical; the record versions are equal;
// - W013 renderer-runtime: selections consume REAL W013 bindings and
//   the technique catalog's kind coverage is checked against the REAL
//   W011 graph-kind vocabulary;
// - W019 device-capabilities: selections consume REAL W019 assessments
//   (the sibling composition edge).
import { describe, expect, it } from 'vitest';
import {
  sealEvent,
  computeEventDigest,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  EVENT_ACTOR_PATTERN,
  EVENT_TENANT_ID_PATTERN,
} from '@epoch/event-log';
import { EXPERIENCE_GRAPH_KINDS } from '@epoch/experience-protocol';
import { bindRendererSession } from '@epoch/renderer-runtime';
import { assessDeviceDescriptor } from '@epoch/device-capabilities';
import {
  ADAPTER_STREAM_ID_PATTERN,
  ADAPTER_ACTOR_PATTERN,
  ADAPTER_TENANT_ID_PATTERN,
  ADAPTER_EVENT_RECORD_VERSION,
  RENDERER_TECHNIQUE_CATALOG,
  selectRendererAdapter,
  buildTechniqueSelectedEvent,
  sealAdapterEvent,
  computeAdapterEventDigest,
} from '../src/index';
import { boundSession, desktopDevice, assess, FULL_RENDERER, TENANT_A } from './fixtures';

const T1 = '2026-09-28T00:00:00.000Z';
const ACTOR = 'principal:host-shell';
const TENANT = 'tenant:tenant-alpha';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored stream pattern is exactly the W010 stream pattern', () => {
    expect(ADAPTER_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(ADAPTER_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(ADAPTER_ACTOR_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(ADAPTER_ACTOR_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the mirrored tenant grammar is exactly the W010 tenant pattern (the W009 grammar)', () => {
    expect(ADAPTER_TENANT_ID_PATTERN.source).toBe(EVENT_TENANT_ID_PATTERN.source);
    expect(ADAPTER_TENANT_ID_PATTERN.flags).toBe(EVENT_TENANT_ID_PATTERN.flags);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(ADAPTER_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('an adaptation event is admitted by the REAL W010 seal path and digests identically', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-parity');
    const selection = selectRendererAdapter({ selectionId: 'ras-parity', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const content = buildTechniqueSelectedEvent(
      {
        selectionId: selection.value.selectionId,
        rendererSessionId: selection.value.rendererSessionId,
        technique: selection.value.technique,
        reason: selection.value.reason,
        bindingDigest: selection.value.bindingDigest,
        assessmentDigest: selection.value.assessmentDigest,
      },
      { streamId: 'stream:renderer-adapter-alpha-1', sequence: 1, causalParent: null },
      { tenantId: TENANT, actor: ACTOR, occurredAt: T1 },
    );
    if (!content.ok) throw new Error(content.error.message);

    // The REAL W010 seal path admits the mirrored content verbatim.
    const real = sealEvent(content.value);
    expect(real.ok, JSON.stringify(real.ok ? null : real.error)).toBe(true);

    // And the digests agree (the mirrored canonicalization is identical).
    const mine = sealAdapterEvent(content.value);
    if (!mine.ok) throw new Error(mine.error.message);
    if (real.ok) {
      expect(mine.value.digest).toBe(real.value.digest);
      expect(computeEventDigest(content.value)).toBe(mine.value.digest);
      expect(computeAdapterEventDigest(content.value).ok).toBe(true);
    }
  });

  it('an adaptation event with a reserved kernel namespace is rejected by the REAL W010 path', () => {
    const reserved = {
      schemaVersion: 1,
      streamId: 'stream:renderer-adapter-alpha-1',
      sequence: 1,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: { discriminator: 'world:subjects', data: {} },
      occurredAt: T1,
    };
    // The REAL W010 seal path rejects reserved namespaces without a
    // kernel payload contract; the mirrored shape rejects them at the
    // grammar level (the mirrored discriminator is namespace-locked).
    const real = sealEvent(reserved);
    expect(real.ok).toBe(false);
    const mine = sealAdapterEvent(reserved);
    expect(mine.ok).toBe(false);
  });
});

describe('W013 renderer-runtime parity (runtime)', () => {
  it('the technique catalog covers only REAL W011 graph kinds', () => {
    for (const technique of Object.keys(RENDERER_TECHNIQUE_CATALOG)) {
      const record =
        RENDERER_TECHNIQUE_CATALOG[technique as keyof typeof RENDERER_TECHNIQUE_CATALOG];
      for (const kind of record.graphKinds) {
        expect(EXPERIENCE_GRAPH_KINDS).toContain(kind);
      }
    }
  });

  it('the retained technique hosts every REAL W011 graph kind', () => {
    for (const kind of EXPERIENCE_GRAPH_KINDS) {
      expect(RENDERER_TECHNIQUE_CATALOG['retained-scene-3d'].graphKinds).toContain(kind);
    }
  });

  it('the flat techniques host exactly the flat W011 graph kinds', () => {
    const flat = RENDERER_TECHNIQUE_CATALOG['immediate-2d'].graphKinds;
    expect(flat).toEqual(['2d', 'controls', 'narrative', 'timeline-replay']);
    for (const kind of flat) {
      expect(EXPERIENCE_GRAPH_KINDS).toContain(kind);
    }
  });

  it('a REAL W013 binding round-trips through selection admission', () => {
    const bound = bindRendererSession({
      rendererSessionId: 'rs-parity-real',
      renderer: FULL_RENDERER,
      device: {
        deviceSessionId: 'ds-parity-real',
        tenantScope: { tenantId: TENANT_A },
        device: desktopDevice(),
      },
      boundAtMs: 0,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) throw new Error('fixture failed');
    const assessment = assessDeviceDescriptor({
      assessmentId: 'dca-parity-real',
      device: bound.value.device.device,
    });
    expect(assessment.ok).toBe(true);
    const selection = selectRendererAdapter({
      selectionId: 'ras-parity-real',
      binding: bound.value,
      assessment: assessment.ok ? assessment.value : undefined,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.bindingDigest).toBe(bound.value.digest);
    }
  });
});
