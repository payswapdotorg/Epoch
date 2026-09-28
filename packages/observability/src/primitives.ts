/**
 * Observability primitives: the package-local id grammars plus the
 * shared mirrored W009/W010 grammars (timestamps, SHA-256 digests,
 * canonical JSON values) re-used by every record model. All
 * identifiers are opaque and kind-prefixed; strict objects reject
 * unknown (vendor) fields (lock rule 13).
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import {
  OBSERVATION_ID_PATTERN,
  OBSERVABILITY_PRINCIPAL_ID_PATTERN,
  OBSERVABILITY_TENANT_ID_PATTERN,
  QUARANTINE_ID_PATTERN,
  SANDBOX_TRUST_CLASS_PATTERN,
  SECURITY_HOST_STREAM_ID_PATTERN,
  SECURITY_POLICY_ID_PATTERN,
  SECURITY_STREAM_ID_PATTERN,
  SUBJECT_ID_PATTERN,
} from './version';

// --------------------------------------------------------------------------------
// Package-local id grammars.
// --------------------------------------------------------------------------------

/** Security-policy id (`security-policy:<slug>`). */
export const SecurityPolicyIdSchema = z.string().regex(SECURITY_POLICY_ID_PATTERN).meta({
  id: 'SecurityPolicyId',
  title: 'SecurityPolicyId',
  description: 'Opaque security-policy identity: "security-policy:<slug>", caller-supplied.',
});

/** One security-policy id. */
export type SecurityPolicyId = z.infer<typeof SecurityPolicyIdSchema>;

/** Observation id (`observation:<slug>`). */
export const ObservationIdSchema = z.string().regex(OBSERVATION_ID_PATTERN).meta({
  id: 'ObservationId',
  title: 'ObservationId',
  description: 'Opaque security-observation identity: "observation:<slug>", caller-supplied.',
});

/** One observation id. */
export type ObservationId = z.infer<typeof ObservationIdSchema>;

/** Quarantine-fact id (`quarantine:<slug>`). */
export const QuarantineIdSchema = z.string().regex(QUARANTINE_ID_PATTERN).meta({
  id: 'QuarantineId',
  title: 'QuarantineId',
  description: 'Opaque quarantine-fact identity: "quarantine:<slug>", caller-supplied.',
});

/** One quarantine-fact id. */
export type QuarantineId = z.infer<typeof QuarantineIdSchema>;

/** Observation-subject id (`<kind>:<slug>`, the open bounded grammar). */
export const SubjectIdSchema = z.string().regex(SUBJECT_ID_PATTERN).meta({
  id: 'SubjectId',
  title: 'SubjectId',
  description:
    'Opaque observation-subject identity: "<kind>:<slug>" (extension, session, simrun, action, principal, tenant, workspace, security-policy families).',
});

/** One observation-subject id. */
export type SubjectId = z.infer<typeof SubjectIdSchema>;

/** Security stream id (`stream:security-<suffix>`). */
export const SecurityStreamIdSchema = z.string().regex(SECURITY_STREAM_ID_PATTERN).meta({
  id: 'SecurityStreamId',
  title: 'SecurityStreamId',
  description: 'Opaque security-stream identity: "stream:security-<suffix>" (one stream per observed subject).',
});

/** One security stream id. */
export type SecurityStreamId = z.infer<typeof SecurityStreamIdSchema>;

/** Security host stream id (`stream:security-host-<suffix>`). */
export const SecurityHostStreamIdSchema = z.string().regex(SECURITY_HOST_STREAM_ID_PATTERN).meta({
  id: 'SecurityHostStreamId',
  title: 'SecurityHostStreamId',
  description: 'Opaque security host-stream identity: "stream:security-host-<suffix>" (tenant-level host steps).',
});

/** One security host stream id. */
export type SecurityHostStreamId = z.infer<typeof SecurityHostStreamIdSchema>;

// --------------------------------------------------------------------------------
// Mirrored W009 grammars (drift-pinned by parity tests — no runtime coupling).
// --------------------------------------------------------------------------------

/** Tenant id (the W009 tenancy grammar, mirrored). */
export const TenantIdSchema = z.string().regex(OBSERVABILITY_TENANT_ID_PATTERN).meta({
  id: 'ObservabilityTenantId',
  title: 'ObservabilityTenantId',
  description: 'Opaque tenant identity of the security domain: "tenant:<slug>" (the W009 grammar).',
});

/** One tenant id. */
export type TenantId = z.infer<typeof TenantIdSchema>;

/** Principal id (the W009 identity grammar, mirrored). */
export const PrincipalIdSchema = z.string().regex(OBSERVABILITY_PRINCIPAL_ID_PATTERN).meta({
  id: 'ObservabilityPrincipalId',
  title: 'ObservabilityPrincipalId',
  description: 'Opaque acting principal of the security domain: "principal:<slug>" (the W009 grammar).',
});

/** One principal id. */
export type PrincipalId = z.infer<typeof PrincipalIdSchema>;

// --------------------------------------------------------------------------------
// Shared W010/W006 grammars (agent-protocol is the runtime authority).
// --------------------------------------------------------------------------------

/** SHA-256 content digest (64 lowercase hex chars). */
export const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/).meta({
  id: 'ObservabilitySha256Hex',
  title: 'ObservabilitySha256Hex',
  description: 'SHA-256 digest over canonical JSON: the exact-revision content address of a security record.',
});

/** The canonical JSON value space (the shared protocol grammar). */
export { JsonValueSchema, TimestampSchema };
export type { JsonValue, Sha256Hex, Timestamp };

/** Non-negative integer (counts, thresholds). */
export const NonNegativeIntegerSchema = z
  .number()
  .int('counts are integers')
  .min(0, 'counts are non-negative')
  .max(Number.MAX_SAFE_INTEGER, 'counts are safe integers')
  .meta({
    id: 'NonNegativeInteger',
    title: 'NonNegativeInteger',
    description: 'A non-negative safe integer (counts, thresholds).',
  });

/** One non-negative integer. */
export type NonNegativeInteger = z.infer<typeof NonNegativeIntegerSchema>;

/** Semver core version string. */
export const SemverCoreSchema = z.string().regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/).meta({
  id: 'ObservabilitySemverCore',
  title: 'ObservabilitySemverCore',
  description: 'Semantic-version core string (MAJOR.MINOR.PATCH).',
});

/** One semver core. */
export type SemverCore = z.infer<typeof SemverCoreSchema>;

/** Sandbox trust-class token (t0..t4, the W008 grammar mirrored). */
export const SandboxTrustClassSchema = z.string().regex(SANDBOX_TRUST_CLASS_PATTERN).meta({
  id: 'SandboxTrustClassToken',
  title: 'SandboxTrustClassToken',
  description: 'Sandbox trust-class token t0..t4 (the W008 grammar, parity-pinned).',
});

/** One sandbox trust-class token. */
export type SandboxTrustClassToken2 = z.infer<typeof SandboxTrustClassSchema>;

/** Host-function token (bounded neutral string; the W008 vocabulary is enforced by the check). */
export const HostFunctionTokenSchema = z.string().min(1).max(64).meta({
  id: 'HostFunctionToken',
  title: 'HostFunctionToken',
  description: 'One host-function token of a sandbox grant (validated against the W008 vocabulary by the isolation check).',
});

/** One host-function token. */
export type HostFunctionToken = z.infer<typeof HostFunctionTokenSchema>;

/** Resource-scope token pair (resource domain + access kind). */
export const ResourceScopeTokenSchema = z
  .strictObject({
    resource: z.string().min(1).max(32),
    access: z.string().min(1).max(32),
  })
  .readonly()
  .meta({
    id: 'ResourceScopeToken',
    title: 'ResourceScopeToken',
    description: 'One (resource, access) scope token of a sandbox grant (validated against the W008 legal table by the isolation check).',
  });

/** One resource-scope token pair. */
export type ResourceScopeToken = z.infer<typeof ResourceScopeTokenSchema>;

/** Capability binding reference (opaque id, min 3 chars). */
export const CapabilityBindingTokenSchema = z.string().min(3).max(128).meta({
  id: 'CapabilityBindingToken',
  title: 'CapabilityBindingToken',
  description: 'One opaque capability-binding reference of a sandbox subject (capability ids resolve in the W007 registry).',
});

/** One capability-binding token. */
export type CapabilityBindingToken = z.infer<typeof CapabilityBindingTokenSchema>;
