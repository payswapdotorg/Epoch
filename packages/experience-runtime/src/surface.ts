/**
 * The experience-runtime schema surface registry: every data type
 * published at the in-package contract boundary
 * (`packages/experience-runtime/schemas`), paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has an emitted JSON Schema file listed in
 *   `packages/experience-runtime/schemas/manifest.json` with a matching
 *   digest.
 */
import type { ZodType } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';
import {
  DeviceDescriptorSchema,
  Sha256HexSchema,
  TenantScopeSchema,
} from '@epoch/experience-protocol';
import {
  DeviceSessionStateSchema,
  ExperienceRuntimeErrorCodeSchema,
  ExperienceRuntimeProtocolVersionSchema,
  RuntimeEventKindSchema,
} from './version';
import {
  DeviceSessionIdSchema,
  EventSequenceSchema,
  FrameIndexSchema,
  TickIndexSchema,
  VirtualTimeMsSchema,
} from './primitives';
import { FrameScheduleSchema } from './schedule';
import {
  RuntimeEventSchema,
  RuntimeEventTraceContentSchema,
  RuntimeEventTraceSchema,
} from './events';
import {
  DeviceSessionContentSchema,
  DeviceSessionRecordSchema,
} from './session';
import { ExperienceRuntimeIssueSchema, ExperienceRuntimeErrorSchema } from './errors';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/**
 * The complete, ordered data-type surface of experience-runtime v1 (sorted
 * by type name ascending — the manifest inventory order).
 */
export const EXPERIENCE_RUNTIME_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Mirrored shared primitive (canonical home: contracts/experience, W011)
  // — redeclared self-contained in the emitted JSON Schemas, exactly as
  // contracts/experience mirrors JsonValue (canonical home: contracts/agent).
  { type: 'DeviceDescriptor', schema: DeviceDescriptorSchema },
  { type: 'DeviceSessionContent', schema: DeviceSessionContentSchema },
  { type: 'DeviceSessionId', schema: DeviceSessionIdSchema },
  { type: 'DeviceSessionRecord', schema: DeviceSessionRecordSchema },
  { type: 'DeviceSessionState', schema: DeviceSessionStateSchema },
  { type: 'EventSequence', schema: EventSequenceSchema },
  { type: 'ExperienceRuntimeError', schema: ExperienceRuntimeErrorSchema },
  { type: 'ExperienceRuntimeErrorCode', schema: ExperienceRuntimeErrorCodeSchema },
  { type: 'ExperienceRuntimeIssue', schema: ExperienceRuntimeIssueSchema },
  { type: 'ExperienceRuntimeProtocolVersion', schema: ExperienceRuntimeProtocolVersionSchema },
  { type: 'FrameIndex', schema: FrameIndexSchema },
  { type: 'FrameSchedule', schema: FrameScheduleSchema },
  // Mirrored shared primitive (canonical home: contracts/agent, W003).
  { type: 'JsonValue', schema: JsonValueSchema },
  { type: 'RuntimeEvent', schema: RuntimeEventSchema },
  { type: 'RuntimeEventKind', schema: RuntimeEventKindSchema },
  { type: 'RuntimeEventTrace', schema: RuntimeEventTraceSchema },
  { type: 'RuntimeEventTraceContent', schema: RuntimeEventTraceContentSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'TenantScope', schema: TenantScopeSchema },
  { type: 'TickIndex', schema: TickIndexSchema },
  { type: 'VirtualTimeMs', schema: VirtualTimeMsSchema },
];
