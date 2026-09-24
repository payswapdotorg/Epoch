/**
 * The extension-runtime schema surface registry: every data type
 * published at the `@epoch/extension-runtime` ownership boundary
 * (runtime-OWNED machinery documents; the manifest mirror is internal
 * validation machinery parity-pinned against @epoch/extension-sdk and
 * is deliberately NOT re-emitted — the SDK owns that emission).
 */
import type { ZodType } from 'zod';
import {
  AdmittedExtensionRecordSchema,
  GrantDescriptionSchema,
  HostExecutionFailureCodeSchema,
  HostInvocationEnvelopeSchema,
  HostInvocationOutcomeSchema,
  InvocationAuditRecordSchema,
  ResolvedCapabilityBindingSchema,
  SandboxSurfaceDescriptionSchema,
  SandboxSurfaceDescriptionVersionSchema,
  InvocationEnvelopeVersionSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the extension-runtime contract v1. */
export const EXTENSION_RUNTIME_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AdmittedExtensionRecord', schema: AdmittedExtensionRecordSchema },
  { type: 'GrantDescription', schema: GrantDescriptionSchema },
  { type: 'HostExecutionFailureCode', schema: HostExecutionFailureCodeSchema },
  { type: 'HostInvocationEnvelope', schema: HostInvocationEnvelopeSchema },
  { type: 'HostInvocationOutcome', schema: HostInvocationOutcomeSchema },
  { type: 'InvocationAuditRecord', schema: InvocationAuditRecordSchema },
  { type: 'InvocationEnvelopeVersion', schema: InvocationEnvelopeVersionSchema },
  { type: 'ResolvedCapabilityBinding', schema: ResolvedCapabilityBindingSchema },
  { type: 'SandboxSurfaceDescription', schema: SandboxSurfaceDescriptionSchema },
  { type: 'SandboxSurfaceDescriptionVersion', schema: SandboxSurfaceDescriptionVersionSchema },
];
