/**
 * The agent-protocol schema surface registry: every data type published at
 * the `contracts/agent` boundary, paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/agent/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/agent/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/agent/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { AgentIdSchema, JsonValueSchema, MessageIdSchema, QualifiedTypeReferenceSchema, TimestampSchema } from './primitives';
import { MessageKindSchema, ProtocolVersionSchema } from './version';
import { AgentRegistrationSchema } from './registration';
import { CapabilityDeclarationSchema, ParameterKindSchema, ParameterSpecSchema } from './capability';
import { ToolDeclarationSchema } from './tool';
import { AuthorityDeclarationSchema } from './authority';
import { EvidenceRequirementsSchema } from './evidence';
import { CostProfileSchema, LatencyProfileSchema } from './profiles';
import { ExecutorKindSchema, ExecutorSchema } from './registration';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of agent protocol v1. */
export const AGENT_PROTOCOL_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AgentId', schema: AgentIdSchema },
  { type: 'AgentRegistration', schema: AgentRegistrationSchema },
  { type: 'AuthorityDeclaration', schema: AuthorityDeclarationSchema },
  { type: 'CapabilityDeclaration', schema: CapabilityDeclarationSchema },
  { type: 'CostProfile', schema: CostProfileSchema },
  { type: 'EvidenceRequirements', schema: EvidenceRequirementsSchema },
  { type: 'Executor', schema: ExecutorSchema },
  { type: 'ExecutorKind', schema: ExecutorKindSchema },
  { type: 'JsonValue', schema: JsonValueSchema },
  { type: 'LatencyProfile', schema: LatencyProfileSchema },
  { type: 'MessageId', schema: MessageIdSchema },
  { type: 'MessageKind', schema: MessageKindSchema },
  { type: 'ParameterKind', schema: ParameterKindSchema },
  { type: 'ParameterSpec', schema: ParameterSpecSchema },
  { type: 'ProtocolVersion', schema: ProtocolVersionSchema },
  { type: 'QualifiedTypeReference', schema: QualifiedTypeReferenceSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'ToolDeclaration', schema: ToolDeclarationSchema },
];
