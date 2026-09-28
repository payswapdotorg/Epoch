/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-parity
 * precedent of W013/W015/W016/W036).
 *
 * This file pins structural compatibility between the renderer-adapters
 * shapes and the sibling vocabularies WITHOUT adding runtime dependencies
 * beyond the declared runtime set (@epoch/agent-protocol,
 * @epoch/experience-protocol, @epoch/renderer-runtime,
 * @epoch/device-capabilities, zod):
 *
 * - `AdapterEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (adaptation events are append-only typed events over
 *   the W010 event shapes — the `renderer-adapter:*` payload namespace);
 * - the mirrored stream/actor grammars are TYPE-EQUAL to the W010
 *   grammars (the W009 principal grammar);
 * - the mirrored W013 effective-limits snapshot carried by the selection
 *   is FIELD-COMPATIBLE with the REAL W013 `EffectiveLimits` (the fit
 *   target — never redefined).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit`
 * (tsconfig.json includes src/**) and mirrored by runtime parity tests
 * (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { AdapterEventContent } from './events';
import type { AdapterStreamId, AdapterActor } from './primitives';
import type { RendererAdapterSelection } from './selection';
import type { EventContent, EventStreamId, EventActor } from '@epoch/event-log';
import type { EffectiveLimits } from '@epoch/renderer-runtime';

/** Adaptation events are W010 event shapes, structurally (W010 parity). */
export type AdapterEventParity = Expect<Equals<AdapterEventContent, EventContent>>;

/** The mirrored stream grammar is the W010 stream grammar. */
export type AdapterStreamIdParity = Expect<Equals<AdapterStreamId, EventStreamId>>;

/** The mirrored actor grammar is the W010 actor grammar (the W009 grammar). */
export type AdapterActorParity = Expect<Equals<AdapterActor, EventActor>>;

/** The selection's effective-limits snapshot is field-compatible with W013. */
export type SelectionLimitsParity = Expect<
  Equals<
    Pick<
      RendererAdapterSelection['effectiveLimits'],
      'maxGraphNodes' | 'maxGraphEdges' | 'maxTriangles' | 'maxTextureBytes'
    >,
    Pick<EffectiveLimits, 'maxGraphNodes' | 'maxGraphEdges' | 'maxTriangles' | 'maxTextureBytes'>
  >
>;
