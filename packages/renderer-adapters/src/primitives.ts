/**
 * Neutral primitives — renderer-adapters-owned id grammar plus the reused
 * shared vocabularies (canonical homes: @epoch/agent-protocol,
 * @epoch/experience-protocol, @epoch/renderer-runtime,
 * @epoch/device-capabilities).
 */
import { z } from 'zod';
import { Sha256HexSchema } from '@epoch/experience-protocol';
import { TenantScopeSchema } from '@epoch/experience-protocol';

/** Adapter id grammar (`rad-<slug>`). */
export const ADAPTER_ID_PATTERN = /^rad-[a-z0-9][a-z0-9-]{0,62}$/;

export const AdapterIdSchema = z.string().regex(ADAPTER_ID_PATTERN).meta({
  id: 'AdapterId',
  title: 'AdapterId',
  description: 'Opaque renderer-adapter id (rad-<slug>).',
});

/** One adapter id. */
export type AdapterId = z.infer<typeof AdapterIdSchema>;

/** Selection id grammar (`ras-<slug>`). */
export const SELECTION_ID_PATTERN = /^ras-[a-z0-9][a-z0-9-]{0,62}$/;

export const SelectionIdSchema = z.string().regex(SELECTION_ID_PATTERN).meta({
  id: 'SelectionId',
  title: 'SelectionId',
  description: 'Opaque adapter-selection id (ras-<slug>).',
});

/** One selection id. */
export type SelectionId = z.infer<typeof SelectionIdSchema>;

/** Mount-plan id grammar (`rmp-<slug>`). */
export const MOUNT_PLAN_ID_PATTERN = /^rmp-[a-z0-9][a-z0-9-]{0,62}$/;

export const MountPlanIdSchema = z.string().regex(MOUNT_PLAN_ID_PATTERN).meta({
  id: 'MountPlanId',
  title: 'MountPlanId',
  description: 'Opaque renderer-mount-plan id (rmp-<slug>).',
});

/** One mount-plan id. */
export type MountPlanId = z.infer<typeof MountPlanIdSchema>;

// Mirrored W010 grammars (canonical home: @epoch/event-log; parity-pinned
// via devDependencies — never a runtime edge).
import {
  ADAPTER_STREAM_ID_PATTERN,
  ADAPTER_ACTOR_PATTERN,
  ADAPTER_TENANT_ID_PATTERN,
  ADAPTER_TIMESTAMP_PATTERN,
} from './version';

/** Mirrored W010 stream id (`stream:<slug>`). */
export const AdapterStreamIdSchema = z.string().regex(ADAPTER_STREAM_ID_PATTERN).meta({
  id: 'AdapterStreamId',
  title: 'AdapterStreamId',
  description: 'Mirrored W010 event stream id (stream:<slug>).',
});

/** One mirrored stream id. */
export type AdapterStreamId = z.infer<typeof AdapterStreamIdSchema>;

/** Mirrored W010 actor (`principal:<slug>` — the W009 grammar). */
export const AdapterActorSchema = z.string().regex(ADAPTER_ACTOR_PATTERN).meta({
  id: 'AdapterActor',
  title: 'AdapterActor',
  description: 'Mirrored W010 event actor (principal:<slug> — the W009 identity grammar).',
});

/** One mirrored actor. */
export type AdapterActor = z.infer<typeof AdapterActorSchema>;

/** Mirrored W010 tenant id (`tenant:<slug>` — the W009 grammar). */
export const AdapterTenantIdSchema = z.string().regex(ADAPTER_TENANT_ID_PATTERN).meta({
  id: 'AdapterTenantId',
  title: 'AdapterTenantId',
  description: 'Mirrored W010 event tenant id (tenant:<slug> — the W009 tenancy grammar).',
});

/** One mirrored tenant id. */
export type AdapterTenantId = z.infer<typeof AdapterTenantIdSchema>;

/** Mirrored W010 timestamp (millisecond-precision UTC ISO). */
export const AdapterTimestampSchema = z.string().regex(ADAPTER_TIMESTAMP_PATTERN).meta({
  id: 'AdapterTimestamp',
  title: 'AdapterTimestamp',
  description: 'Mirrored W010 event timestamp (millisecond-precision UTC ISO — producer-supplied).',
});

/** One mirrored timestamp. */
export type AdapterTimestamp = z.infer<typeof AdapterTimestampSchema>;

// Reused shared primitives (re-exported so consumers need one import site).
export { Sha256HexSchema, TenantScopeSchema };
export type { Sha256Hex, TenantScope } from '@epoch/experience-protocol';
