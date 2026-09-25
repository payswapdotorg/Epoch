/**
 * The renderer-runtime schema surface registry: every data type published
 * at the `contracts/renderers` boundary, paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/renderers/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/renderers/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/renderers/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';
import {
  ControlIntentSchema,
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  ExperienceGraphKindSchema,
  ExperienceIssueSchema,
  ExperienceProtocolErrorSchema,
  InteractionModalitySchema,
  OpaqueScopeIdSchema,
  PoseTrackingKindSchema,
  Sha256HexSchema,
  TenantScopeSchema,
} from '@epoch/experience-protocol';
import {
  RendererBindingStateSchema,
  RendererErrorCodeSchema,
  RendererInvocationKindSchema,
  RendererProtocolVersionSchema,
  RendererReceiptKindSchema,
} from './version';
import {
  DeviceSessionIdSchema,
  InvocationIdSchema,
  RendererIdSchema,
  RendererSessionIdSchema,
  VirtualTimeMsSchema,
} from './primitives';
import {
  RendererBudgetsSchema,
  RendererDescriptorSchema,
  RendererOutputCapabilitiesSchema,
} from './descriptor';
import { DeviceSessionSnapshotSchema } from './snapshot';
import { EffectiveLimitsSchema } from './binding';
import { InvocationEnvelopeSchema } from './invocation';
import { RendererReceiptContentSchema, RendererReceiptSchema } from './receipt';
import { RendererIssueSchema, RendererRuntimeErrorSchema } from './errors';
import {
  RendererBindingContentSchema,
  RendererBindingSchema,
} from './binding';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/**
 * The complete, ordered data-type surface of renderer-runtime v1 (sorted
 * by type name ascending — the manifest inventory order).
 */
export const RENDERER_RUNTIME_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ControlIntent', schema: ControlIntentSchema },
  { type: 'DeviceClass', schema: DeviceClassSchema },
  { type: 'DeviceDescriptor', schema: DeviceDescriptorSchema },
  { type: 'DeviceDisplayCapabilities', schema: DeviceDisplayCapabilitiesSchema },
  { type: 'DeviceSessionId', schema: DeviceSessionIdSchema },
  { type: 'DeviceSessionSnapshot', schema: DeviceSessionSnapshotSchema },
  { type: 'DeviceSpatialCapabilities', schema: DeviceSpatialCapabilitiesSchema },
  { type: 'EffectiveLimits', schema: EffectiveLimitsSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'ExperienceGraphKind', schema: ExperienceGraphKindSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011) —
  // carried verbatim as the typed cause of wrapped graph-admission failures.
  { type: 'ExperienceIssue', schema: ExperienceIssueSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011) —
  // carried verbatim as the typed cause of wrapped graph-admission failures.
  { type: 'ExperienceProtocolError', schema: ExperienceProtocolErrorSchema },
  { type: 'InteractionModality', schema: InteractionModalitySchema },
  // Mirrored shared primitive (canonical home: contracts/agent, W003) —
  // redeclared self-contained in contracts/renderers/index.d.ts, exactly
  // as contracts/experience mirrors JsonValue.
  { type: 'InvocationEnvelope', schema: InvocationEnvelopeSchema },
  { type: 'InvocationId', schema: InvocationIdSchema },
  { type: 'JsonValue', schema: JsonValueSchema },
  { type: 'OpaqueScopeId', schema: OpaqueScopeIdSchema },
  { type: 'PoseTrackingKind', schema: PoseTrackingKindSchema },
  { type: 'RendererBinding', schema: RendererBindingSchema },
  { type: 'RendererBindingContent', schema: RendererBindingContentSchema },
  { type: 'RendererBindingState', schema: RendererBindingStateSchema },
  { type: 'RendererBudgets', schema: RendererBudgetsSchema },
  { type: 'RendererDescriptor', schema: RendererDescriptorSchema },
  { type: 'RendererErrorCode', schema: RendererErrorCodeSchema },
  { type: 'RendererId', schema: RendererIdSchema },
  { type: 'RendererInvocationKind', schema: RendererInvocationKindSchema },
  { type: 'RendererIssue', schema: RendererIssueSchema },
  { type: 'RendererOutputCapabilities', schema: RendererOutputCapabilitiesSchema },
  { type: 'RendererProtocolVersion', schema: RendererProtocolVersionSchema },
  { type: 'RendererReceipt', schema: RendererReceiptSchema },
  { type: 'RendererReceiptContent', schema: RendererReceiptContentSchema },
  { type: 'RendererReceiptKind', schema: RendererReceiptKindSchema },
  { type: 'RendererRuntimeError', schema: RendererRuntimeErrorSchema },
  { type: 'RendererSessionId', schema: RendererSessionIdSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'TenantScope', schema: TenantScopeSchema },
  { type: 'VirtualTimeMs', schema: VirtualTimeMsSchema },
];
