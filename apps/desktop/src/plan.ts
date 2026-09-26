/**
 * The compiled-plan artifact projection (W017) — how the desktop shell
 * consumes W012 compiler output WITHOUT a runtime dependency on the
 * compiler.
 *
 * The W012 Render Plan is a large sealed document (stages, constraints,
 * ops). The desktop shell needs only its ADDRESSING, CHAIN, TARGET, and
 * USAGE: which graph revision it compiled from, which tenant it belongs
 * to, which device it targets, and what resources it declared. This
 * module projects a plan document onto that strict structural subset
 * (the `deviceSessionSnapshotOf` precedent: pure structural selection),
 * so the full document stays the single source of truth and the shell
 * never re-implements compiler vocabulary.
 *
 * The projection is pinned member-for-member against the REAL compiler
 * by the devDependency parity test (test/parity.test.ts): a plan compiled
 * with @epoch/experience-compiler projects losslessly, and its digest
 * chain (source envelope digest -> plan digest) survives the projection.
 *
 * Runtime-dependency discipline: this module imports only W011/W013
 * vocabulary (already runtime dependencies); the compiler itself stays a
 * devDependency (the W014 app pattern — mirrored/structural consumption,
 * parity-pinned, never a runtime coupling).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { z } from 'zod';
import {
  DeviceDescriptorSchema,
  ExperienceGraphIdSchema,
  EXPERIENCE_GRAPH_KINDS,
  TenantScopeSchema,
} from '@epoch/experience-protocol';
import { desktopOk, type DesktopResult } from './errors';
import { DESKTOP_PROTOCOL_VERSION } from './version';

/** The W012 plan schema-name discriminator (mirrored literal). */
export const RENDER_PLAN_SCHEMA_NAME = 'epoch.render-plan' as const;

/** The W012 plan protocol version (mirrored literal, parity-pinned). */
export const RENDER_PLAN_PROTOCOL_VERSION = '1.0.0' as const;

/** The mirrored usage record of a compiled plan (structural subset). */
export const PlanUsageSchema = z
  .strictObject({
    nodes: z.number().int().min(1),
    edges: z.number().int().nonnegative(),
    estimatedTriangles: z.number().int().nonnegative(),
    assetBytes: z.number().int().nonnegative(),
  })
  .meta({
    id: 'DesktopPlanUsage',
    title: 'DesktopPlanUsage',
    description: 'The projected resource usage of a compiled plan: node/edge counts, triangle estimate, asset bytes.',
  });

/** One projected plan usage. */
export type PlanUsage = z.infer<typeof PlanUsageSchema>;

/** The projected plan artifact (the shell's strict structural subset of a W012 Render Plan). */
export const PlanArtifactSchema = z
  .strictObject({
    schema: z.literal(RENDER_PLAN_SCHEMA_NAME),
    protocolVersion: z.literal(RENDER_PLAN_PROTOCOL_VERSION),
    sourceGraphId: ExperienceGraphIdSchema,
    sourceGraphKind: z.enum(EXPERIENCE_GRAPH_KINDS),
    /** The exact-revision digest of the sealed W011 graph this plan compiled from. */
    sourceEnvelopeDigest: z.string().regex(/^[0-9a-f]{64}$/),
    tenantScope: TenantScopeSchema,
    /** The device the plan was compiled FOR (W011 vocabulary). */
    target: DeviceDescriptorSchema,
    usage: PlanUsageSchema,
    /** The content digest of the FULL plan document (its exact-revision address). */
    digest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .meta({
    id: 'DesktopPlanArtifact',
    title: 'DesktopPlanArtifact',
    description:
      'The projected compiled-plan artifact: addressing, digest chain, tenant scope, target device, and usage (structural subset of a W012 Render Plan).',
  });

/** One projected plan artifact. */
export type PlanArtifact = z.infer<typeof PlanArtifactSchema>;

/** Structural selection of the projection fields from an arbitrary record. */
function selectPlanArtifact(value: Record<string, unknown>): Record<string, unknown> {
  return {
    schema: value.schema,
    protocolVersion: value.protocolVersion,
    sourceGraphId: value.sourceGraphId,
    sourceGraphKind: value.sourceGraphKind,
    sourceEnvelopeDigest: value.sourceEnvelopeDigest,
    tenantScope: value.tenantScope,
    target: value.target,
    usage: value.usage,
    digest: value.digest,
  };
}

/**
 * Project a compiled-plan document onto the shell's strict artifact
 * subset (total, typed; pure structural selection + validation).
 */
export function projectPlanArtifact(input: unknown): DesktopResult<PlanArtifact> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'a compiled-plan artifact must be a JSON object',
        issues: [{ path: '$', message: 'expected a JSON object at the plan root' }],
      },
    };
  }
  const record = input as Record<string, unknown>;
  if (record.schema !== undefined && record.schema !== RENDER_PLAN_SCHEMA_NAME) {
    return {
      ok: false,
      error: {
        code: 'version-unsupported',
        message: `plan schema discriminator mismatch: expected ${RENDER_PLAN_SCHEMA_NAME}, encountered ${String(record.schema)}`,
        expected: RENDER_PLAN_SCHEMA_NAME,
        encountered: String(record.schema),
      },
    };
  }
  if (record.protocolVersion !== undefined && record.protocolVersion !== RENDER_PLAN_PROTOCOL_VERSION) {
    return {
      ok: false,
      error: {
        code: 'version-unsupported',
        message: `plan protocol version mismatch: expected ${RENDER_PLAN_PROTOCOL_VERSION}, encountered ${String(record.protocolVersion)}`,
        expected: RENDER_PLAN_PROTOCOL_VERSION,
        encountered: String(record.protocolVersion),
      },
    };
  }
  const projected = PlanArtifactSchema.safeParse(selectPlanArtifact(record));
  if (!projected.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'compiled-plan artifact failed projection validation',
        issues: projected.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return desktopOk(projected.data);
}

/**
 * Verify a full compiled-plan document's own digest (tamper detection):
 * the claimed `digest` must equal the canonical SHA-256 of the document
 * content (digest field excluded). Returns the verified digest.
 */
export function verifyPlanDocument(input: unknown): DesktopResult<Sha256Hex> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'a compiled-plan document must be a JSON object',
        issues: [{ path: '$', message: 'expected a JSON object at the plan root' }],
      },
    };
  }
  const record = input as Record<string, unknown>;
  const claimed = record.digest;
  if (typeof claimed !== 'string' || !/^[0-9a-f]{64}$/.test(claimed)) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the compiled-plan document carries no well-formed digest',
        issues: [{ path: 'digest', message: 'expected a lowercase 64-char hex digest' }],
      },
    };
  }
  const { digest: _claimed, ...content } = record;
  void _claimed;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== claimed) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'compiled-plan digest does not match its content — the artifact is rejected (tamper detection)',
        path: 'digest',
        expected: recomputed,
        encountered: claimed,
      },
    };
  }
  return desktopOk(claimed as Sha256Hex);
}

/** The digest-chain record of one plan artifact (envelope -> plan). */
export function planDigestChain(plan: PlanArtifact): {
  readonly sourceEnvelopeDigest: Sha256Hex;
  readonly planDigest: Sha256Hex;
} {
  return { sourceEnvelopeDigest: plan.sourceEnvelopeDigest, planDigest: plan.digest };
}

/** The desktop protocol version re-export (parity documentation). */
export { DESKTOP_PROTOCOL_VERSION };
