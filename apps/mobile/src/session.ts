/**
 * @epoch/mobile — the typed capture-session model (Work Order W018).
 *
 * Field sessions are TENANT-SCOPED via @epoch/tenancy (the W009 grammar) and
 * carry the FIELD-fidelity device descriptor (src/device.ts). A session is
 * an immutable, content-addressed record: every lifecycle transition
 * (open → pause → resume → close) returns a NEW sealed session, the W036
 * DeliveryRecord discipline applied to the field shell. The session is a
 * CAPTURE context, never a semantic store (lock rules 8/16): it references
 * the work context (solution + delivery) by opaque id and holds no
 * delivery-domain semantics.
 *
 * Cross-tenant admissions are typed `cross-tenant-denied` rejections (R12).
 * State-machine violations are typed `session-state-conflict` (pausing a
 * closed session, closing a paused session without resuming, etc.).
 * Tampering is typed `digest-mismatch`.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  DeliveryIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
} from '@epoch/solution-delivery';
import { DeviceDescriptorSchema } from '@epoch/experience-protocol';
import {
  crossTenantDeniedError,
  digestMismatchError,
  fieldError,
  fieldOk,
  fieldValidationError,
  hasUnrecognizedKeys,
  vendorFieldsError,
  type MobileFieldResult,
} from './errors';
import { FieldSessionIdSchema } from './primitives';
import {
  FieldSessionStateSchema,
  FIELD_SESSION_STATES,
  MOBILE_FIELD_RECORD_VERSION,
  type FieldSessionState,
} from './version';
import { validateFieldDeviceDescriptor } from './device';

/** The serialized schema name of a field session record. */
export const FIELD_SESSION_SCHEMA_NAME = 'field.session' as const;

/** The lifecycle refinement (close/pause provenance matches the state). */
function refineSessionLifecycle(
  content: {
    state: FieldSessionState;
    pausedAt?: string | undefined;
    resumedAt?: string | undefined;
    closedAt?: string | undefined;
    closedBy?: string | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (content.state === 'closed') {
    if (content.closedAt === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a closed field session must carry closedAt', path: ['closedAt'] });
    }
    if (content.closedBy === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a closed field session must carry closedBy', path: ['closedBy'] });
    }
  } else if (content.closedAt !== undefined || content.closedBy !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'only a closed field session carries close provenance',
      path: ['closedAt'],
    });
  }
  if (content.state === 'paused' && content.pausedAt === undefined) {
    ctx.addIssue({ code: 'custom', message: 'a paused field session must carry pausedAt', path: ['pausedAt'] });
  }
  if (content.state !== 'active' && content.resumedAt !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'only an active session carries resume history (resumedAt)',
      path: ['resumedAt'],
    });
  }
  if (content.resumedAt !== undefined && content.pausedAt === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'resumedAt requires a prior pausedAt',
      path: ['resumedAt'],
    });
  }
}

/** The immutable content of one field session (everything except the digest). */
const fieldSessionShape = z.strictObject({
  schema: z.literal(FIELD_SESSION_SCHEMA_NAME),
  schemaVersion: z.literal(MOBILE_FIELD_RECORD_VERSION),
  sessionId: FieldSessionIdSchema,
  tenantId: TenantIdSchema,
  device: DeviceDescriptorSchema,
  state: FieldSessionStateSchema,
  scope: z
    .strictObject({
      solutionId: SolutionIdSchema,
      deliveryId: DeliveryIdSchema,
    })
    .readonly(),
  openedAt: TimestampSchema,
  openedBy: PrincipalIdSchema,
  pausedAt: TimestampSchema.optional(),
  resumedAt: TimestampSchema.optional(),
  closedAt: TimestampSchema.optional(),
  closedBy: PrincipalIdSchema.optional(),
});

export const FieldSessionContentSchema = fieldSessionShape
  .superRefine(refineSessionLifecycle)
  .readonly()
  .meta({
    id: 'FieldSessionContent',
    title: 'FieldSessionContent',
    description:
      'The immutable content of one field capture session: tenant scope, FIELD-fidelity device descriptor, work context (solution + delivery by opaque id), lifecycle state and provenance.',
  });

/** One field session content. */
export type FieldSessionContent = z.infer<typeof FieldSessionContentSchema>;

/** The sealed field session: content plus its SHA-256 content digest. */
export const SealedFieldSessionSchema = z
  .strictObject({
    ...fieldSessionShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .superRefine(refineSessionLifecycle)
  .readonly()
  .meta({
    id: 'SealedFieldSession',
    title: 'SealedFieldSession',
    description:
      'The sealed field session: immutable lifecycle content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed field session. */
export type SealedFieldSession = z.infer<typeof SealedFieldSessionSchema>;

/** Strip the content digest (the pure content). */
function contentOf(sealed: SealedFieldSession): FieldSessionContent {
  const content: Record<string, unknown> = { ...sealed };
  delete content['contentDigest'];
  return content as unknown as FieldSessionContent;
}

/** Options to open a field session. */
export interface OpenFieldSessionOptions {
  readonly sessionId: string;
  readonly tenantId: string;
  /** The field device descriptor (validated at FIELD fidelity through W011 admission). */
  readonly device: unknown;
  readonly solutionId: string;
  readonly deliveryId: string;
  readonly openedBy: string;
  readonly openedAt: string;
}

/**
 * Open a field capture session. The device descriptor must be a valid
 * FIELD-fidelity descriptor (validated through the W011 admission
 * machinery + the field capability set). Deterministic: identical inputs
 * produce identical digests.
 */
export function openFieldSession(
  options: OpenFieldSessionOptions,
): MobileFieldResult<SealedFieldSession> {
  const device = validateFieldDeviceDescriptor(options.device);
  if (!device.ok) {
    return device;
  }
  const content = {
    schema: FIELD_SESSION_SCHEMA_NAME,
    schemaVersion: MOBILE_FIELD_RECORD_VERSION,
    sessionId: options.sessionId,
    tenantId: options.tenantId,
    device: device.value,
    state: 'active' as const,
    scope: { solutionId: options.solutionId, deliveryId: options.deliveryId },
    openedAt: options.openedAt,
    openedBy: options.openedBy,
  };
  const parsed = FieldSessionContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  return fieldOk({
    ...parsed.data,
    contentDigest: canonicalDigest(parsed.data as unknown as JsonValue),
  });
}

/** Reseal (validated) content into a sealed session. */
function reseal(content: FieldSessionContent): SealedFieldSession {
  return { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** The pause transition: active -> paused. */
export function pauseFieldSession(
  session: SealedFieldSession,
  at: string,
): MobileFieldResult<SealedFieldSession> {
  const verified = verifySealedFieldSession(session);
  if (!verified.ok) {
    return verified;
  }
  const current = contentOf(verified.value);
  if (current.state !== 'active') {
    return fieldError({
      code: 'session-state-conflict',
      message: `cannot pause a ${current.state} field session (pause requires active)`,
      recordId: current.sessionId,
    });
  }
  return fieldOk(reseal({ ...current, state: 'paused', pausedAt: at }));
}

/** The resume transition: paused -> active. */
export function resumeFieldSession(
  session: SealedFieldSession,
  at: string,
): MobileFieldResult<SealedFieldSession> {
  const verified = verifySealedFieldSession(session);
  if (!verified.ok) {
    return verified;
  }
  const current = contentOf(verified.value);
  if (current.state !== 'paused') {
    return fieldError({
      code: 'session-state-conflict',
      message: `cannot resume a ${current.state} field session (resume requires paused)`,
      recordId: current.sessionId,
    });
  }
  return fieldOk(reseal({ ...current, state: 'active', resumedAt: at }));
}

/** The close transition: active -> closed. */
export function closeFieldSession(
  session: SealedFieldSession,
  closedBy: string,
  at: string,
): MobileFieldResult<SealedFieldSession> {
  const verified = verifySealedFieldSession(session);
  if (!verified.ok) {
    return verified;
  }
  const current = contentOf(verified.value);
  if (current.state !== 'active') {
    return fieldError({
      code: 'session-state-conflict',
      message: `cannot close a ${current.state} field session (close requires active — resume first)`,
      recordId: current.sessionId,
    });
  }
  return fieldOk(reseal({ ...current, state: 'closed', closedAt: at, closedBy }));
}

/** Verify a sealed field session (schema + digest recomputation). */
export function verifySealedFieldSession(sealed: unknown): MobileFieldResult<SealedFieldSession> {
  const parsed = SealedFieldSessionSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fieldError(digestMismatchError(expected, contentDigest));
  }
  return fieldOk(parsed.data);
}

/** Tenant guard: a session scoped to the given tenant (typed rejection otherwise). */
export function sessionTenantGuard(
  session: SealedFieldSession,
  tenantId: string,
): MobileFieldResult<SealedFieldSession> {
  if (session.tenantId !== tenantId) {
    return fieldError(crossTenantDeniedError(tenantId, session.tenantId));
  }
  return fieldOk(session);
}

export { FIELD_SESSION_STATES };
export type { FieldSessionState, Sha256Hex };
