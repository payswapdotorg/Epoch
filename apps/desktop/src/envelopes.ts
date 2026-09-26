/**
 * The host↔shell envelope seam (W017) — the typed IPC contract a native
 * wrapper backend carries.
 *
 * A real native host and the shell process exchange typed envelopes over
 * exactly this seam: versioned (one protocol version, skew fails fast),
 * content-addressed (every envelope is sealed with the SHA-256 of its
 * canonical JSON — the digest field excluded — so an envelope is
 * exact-revision evidence), and replay-safe (per-session, per-direction
 * channels chain envelopes: monotonic sequence numbers plus a
 * `prevEnvelopeDigest` hash chain, so gaps, forks, and out-of-order
 * deliveries are typed `replay-violation` failures, and replaying a
 * verified chain reproduces the identical state transitions).
 *
 * The payload taxonomy is CLOSED per direction (DIRECTION_KINDS): the host
 * commands lifecycle and OFFERS content-addressed experience projections
 * (sealed W011 graphs + compiled W012 plan documents); the shell REPORTS
 * — acknowledgements, admitted-invocation evidence (W013 receipts), typed
 * authoring proposals, and session-snapshot digests. Neither side ever
 * reaches into the other's state: the seam is the only door.
 *
 * Embedded documents (graphs, plans, renderers, receipts, proposals) are
 * carried as PRESENT-but-opaque values here; their deep validation is the
 * owning surface's admission (W011/W012/W013/the authoring surface) — the
 * seam validates transport structure, addressing, and chaining, and
 * refuses unknown fields on every envelope-controlled record (lock rule 13).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { z } from 'zod';
import { Sha256HexSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import {
  digestMismatchError,
  desktopOk,
  malformedRecordError,
  replayViolationError,
  versionUnsupportedError,
  type DesktopResult,
} from './errors';
import {
  DIRECTION_KINDS,
  HOST_SHELL_ENVELOPE_SCHEMA_NAME,
  DESKTOP_PROTOCOL_VERSION,
  type EnvelopeDirection,
} from './version';
import {
  DeviceSessionIdSchema,
  DesktopSessionIdSchema,
  EnvelopeIdSchema,
  OpaqueScopeIdSchema,
  PrincipalIdSchema,
  ProvenanceSchema,
  RendererSessionIdSchema,
  SequenceNumberSchema,
  VirtualTimeMsSchema,
  WindowBoundsSchema,
  WindowIdSchema,
} from './primitives';
import { EnvelopeDirectionSchema } from './version';

/** The digest that precedes the first envelope of every channel. */
export const GENESIS_DIGEST: string = '0'.repeat(64);

/** Require a present (non-absent) opaque embedded document field. */
function presentDoc(payload: Record<string, unknown>, key: string, ctx: z.RefinementCtx): void {
  if (!(key in payload) || payload[key] === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: `the embedded "${key}" document is required on this envelope kind`,
      path: [key],
    });
  }
}

// ---------------------------------------------------------------------------
// Payload schemas (closed taxonomy, discriminated on `kind`).
// ---------------------------------------------------------------------------

const SessionOpenPayloadSchema = z
  .strictObject({
    scope: z.strictObject({
      tenantId: OpaqueScopeIdSchema,
      workspaceId: OpaqueScopeIdSchema.optional(),
      projectId: OpaqueScopeIdSchema.optional(),
    }),
    principal: PrincipalIdSchema,
  })
  .meta({ id: 'SessionOpenPayload', title: 'SessionOpenPayload', description: 'Host→shell: open a tenant-scoped session for one operator principal.' });

const SessionClosePayloadSchema = z
  .strictObject({})
  .meta({ id: 'SessionClosePayload', title: 'SessionClosePayload', description: 'Host→shell: close the session.' });

const WindowOpenPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    title: z.string().min(1).max(256),
    /** The renderer descriptor the window's surface hosts (validated at binding). */
    renderer: z.unknown(),
    bounds: WindowBoundsSchema.optional(),
  })
  .superRefine((payload, ctx) => presentDoc(payload, 'renderer', ctx))
  .meta({ id: 'WindowOpenPayload', title: 'WindowOpenPayload', description: 'Host→shell: open a window surface with its renderer descriptor.' });

const WindowRefPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
  })
  .meta({ id: 'WindowRefPayload', title: 'WindowRefPayload', description: 'Host→shell: reference one window (close/focus/blur).' });

const ExperienceOfferPayloadSchema = z
  .strictObject({
    /** The sealed W011 Experience Graph document (content-addressed). */
    graph: z.unknown(),
    /** The compiled W012 plan document (content-addressed). */
    plan: z.unknown(),
  })
  .superRefine((payload, ctx) => {
    presentDoc(payload, 'graph', ctx);
    presentDoc(payload, 'plan', ctx);
  })
  .meta({ id: 'ExperienceOfferPayload', title: 'ExperienceOfferPayload', description: 'Host→shell: offer one content-addressed experience (sealed graph + compiled plan).' });

const CacheInvalidationPayloadSchema = z
  .strictObject({
    address: Sha256HexSchema,
    reason: z.enum(['host-invalidated', 'superseded', 'tenant-rotation']),
    supersededBy: Sha256HexSchema.optional(),
  })
  .meta({ id: 'CacheInvalidationPayload', title: 'CacheInvalidationPayload', description: 'Host→shell: invalidate one cached projection address.' });

const SessionOpenedPayloadSchema = z
  .strictObject({
    scope: TenantScopeSchema,
    principal: PrincipalIdSchema,
  })
  .meta({ id: 'SessionOpenedPayload', title: 'SessionOpenedPayload', description: 'Shell→host: the session opened with its resolved tenant scope.' });

const SessionClosedPayloadSchema = z
  .strictObject({})
  .meta({ id: 'SessionClosedPayload', title: 'SessionClosedPayload', description: 'Shell→host: the session closed.' });

const WindowOpenedPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    deviceSessionId: DeviceSessionIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    bindingDigest: Sha256HexSchema,
  })
  .meta({ id: 'WindowOpenedPayload', title: 'WindowOpenedPayload', description: 'Shell→host: the window opened with its bound renderer session.' });

const MountGraphPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    graphDigest: Sha256HexSchema,
    planDigest: Sha256HexSchema,
    invocationId: z.string().regex(/^inv-[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .meta({ id: 'MountGraphPayload', title: 'MountGraphPayload', description: 'Shell→host: an experience is being mounted through an admitted invocation.' });

const InvocationReceiptPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    /** The sealed W013 renderer receipt (content-addressed evidence). */
    receipt: z.unknown(),
  })
  .superRefine((payload, ctx) => presentDoc(payload, 'receipt', ctx))
  .meta({ id: 'InvocationReceiptPayload', title: 'InvocationReceiptPayload', description: 'Shell→host: the sealed execution receipt of one admitted invocation.' });

const AuthoringProposalPayloadSchema = z
  .strictObject({
    /** The sealed desktop authoring proposal (content-addressed). */
    proposal: z.unknown(),
  })
  .superRefine((payload, ctx) => presentDoc(payload, 'proposal', ctx))
  .meta({ id: 'AuthoringProposalPayload', title: 'AuthoringProposalPayload', description: 'Shell→host: one typed authoring proposal toward the kernel seams.' });

const SessionSnapshotPayloadSchema = z
  .strictObject({
    snapshotDigest: Sha256HexSchema,
  })
  .meta({ id: 'SessionSnapshotPayload', title: 'SessionSnapshotPayload', description: 'Shell→host: the content digest of one session-state snapshot.' });

const MountRequestPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    graphDigest: Sha256HexSchema,
    planDigest: Sha256HexSchema,
  })
  .meta({ id: 'MountRequestPayload', title: 'MountRequestPayload', description: 'Host→shell: mount the offered experience (by graph + plan digests) into one window.' });

const FrameRequestPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    frameIndex: z.number().int().nonnegative(),
  })
  .meta({ id: 'FrameRequestPayload', title: 'FrameRequestPayload', description: 'Host→shell: execute one frame of the mounted state (monotonic indices).' });

const IntentRequestPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    modality: z.enum(['gamepad', 'gaze', 'gesture', 'keyboard', 'pointer', 'touch', 'voice']),
    /** The typed control intent (R30 shape: action-type reference). */
    intent: z.strictObject({
      id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
    }),
  })
  .meta({ id: 'IntentRequestPayload', title: 'IntentRequestPayload', description: 'Host→shell: admit one typed control intent from a declared modality.' });

const AuthoringRequestPayloadSchema = z
  .strictObject({
    windowId: WindowIdSchema.optional(),
    /** The action-type reference (the kernel-seam shape). */
    actionType: z.strictObject({
      id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
    }),
    parameters: z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), z.unknown()),
    rationale: z.string().max(10000).optional(),
  })
  .meta({ id: 'AuthoringRequestPayload', title: 'AuthoringRequestPayload', description: 'Host→shell: propose one foundation-backed authoring intent (typed proposal, zero shell authority).' });

const SnapshotRequestPayloadSchema = z
  .strictObject({})
  .meta({ id: 'SnapshotRequestPayload', title: 'SnapshotRequestPayload', description: 'Host→shell: record a session-state snapshot and report its digest.' });

/** The closed envelope-body union (discriminated on `kind`). */
export const EnvelopeBodySchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('session-open'), payload: SessionOpenPayloadSchema }),
    z.strictObject({ kind: z.literal('session-close'), payload: SessionClosePayloadSchema }),
    z.strictObject({ kind: z.literal('window-open'), payload: WindowOpenPayloadSchema }),
    z.strictObject({ kind: z.literal('window-close'), payload: WindowRefPayloadSchema }),
    z.strictObject({ kind: z.literal('window-focus'), payload: WindowRefPayloadSchema }),
    z.strictObject({ kind: z.literal('window-blur'), payload: WindowRefPayloadSchema }),
    z.strictObject({ kind: z.literal('experience-offer'), payload: ExperienceOfferPayloadSchema }),
    z.strictObject({ kind: z.literal('cache-invalidation'), payload: CacheInvalidationPayloadSchema }),
    z.strictObject({ kind: z.literal('mount-request'), payload: MountRequestPayloadSchema }),
    z.strictObject({ kind: z.literal('frame-request'), payload: FrameRequestPayloadSchema }),
    z.strictObject({ kind: z.literal('intent-request'), payload: IntentRequestPayloadSchema }),
    z.strictObject({ kind: z.literal('authoring-request'), payload: AuthoringRequestPayloadSchema }),
    z.strictObject({ kind: z.literal('snapshot-request'), payload: SnapshotRequestPayloadSchema }),
    z.strictObject({ kind: z.literal('session-opened'), payload: SessionOpenedPayloadSchema }),
    z.strictObject({ kind: z.literal('session-closed'), payload: SessionClosedPayloadSchema }),
    z.strictObject({ kind: z.literal('window-opened'), payload: WindowOpenedPayloadSchema }),
    z.strictObject({ kind: z.literal('window-focused'), payload: WindowRefPayloadSchema }),
    z.strictObject({ kind: z.literal('window-blurred'), payload: WindowRefPayloadSchema }),
    z.strictObject({ kind: z.literal('window-closed'), payload: WindowRefPayloadSchema }),
    z.strictObject({ kind: z.literal('mount-graph'), payload: MountGraphPayloadSchema }),
    z.strictObject({ kind: z.literal('invocation-receipt'), payload: InvocationReceiptPayloadSchema }),
    z.strictObject({ kind: z.literal('authoring-proposal'), payload: AuthoringProposalPayloadSchema }),
    z.strictObject({ kind: z.literal('session-snapshot'), payload: SessionSnapshotPayloadSchema }),
  ])
  .meta({
    id: 'DesktopEnvelopeBody',
    title: 'DesktopEnvelopeBody',
    description: 'One typed host↔shell envelope body: the kind discriminator plus its closed payload (direction legality is enforced at the envelope level).',
  });

/** One envelope body. */
export type EnvelopeBody = z.infer<typeof EnvelopeBodySchema>;

/** The kind of one envelope body (either direction). */
export type EnvelopeBodyKind = EnvelopeBody['kind'];

/** The envelope content (digest-sealed form). */
export const HostShellEnvelopeContentSchema = z
  .strictObject({
    schema: z.literal(HOST_SHELL_ENVELOPE_SCHEMA_NAME),
    protocolVersion: z.literal(DESKTOP_PROTOCOL_VERSION),
    envelopeId: EnvelopeIdSchema,
    sessionId: DesktopSessionIdSchema,
    direction: EnvelopeDirectionSchema,
    sequence: SequenceNumberSchema,
    prevEnvelopeDigest: Sha256HexSchema,
    issuedAtMs: VirtualTimeMsSchema,
    body: EnvelopeBodySchema,
    provenance: ProvenanceSchema,
  })
  .superRefine((envelope, ctx) => {
    // Direction-kind legality (the closed dispatch table).
    if (!DIRECTION_KINDS[envelope.direction].includes(envelope.body.kind)) {
      ctx.addIssue({
        code: 'custom',
        message: `envelope kind "${envelope.body.kind}" is foreign to direction "${envelope.direction}"`,
        path: ['body', 'kind'],
      });
    }
    // Provenance-origin/direction coherence.
    if (envelope.direction === 'host-to-shell' && envelope.provenance.origin !== 'host-envelope') {
      ctx.addIssue({
        code: 'custom',
        message: 'host-to-shell envelopes must originate at the host',
        path: ['provenance', 'origin'],
      });
    }
    if (envelope.direction === 'shell-to-host' && envelope.provenance.origin === 'host-envelope') {
      ctx.addIssue({
        code: 'custom',
        message: 'shell-to-host envelopes never originate at the host',
        path: ['provenance', 'origin'],
      });
    }
  })
  .meta({
    id: 'HostShellEnvelopeContent',
    title: 'HostShellEnvelopeContent',
    description: 'The content of one host↔shell envelope: versioned addressing, chain position, typed body, and provenance.',
  });

/** One envelope content. */
export type HostShellEnvelopeContent = z.infer<typeof HostShellEnvelopeContentSchema>;

/** The sealed host↔shell envelope: content plus its SHA-256 digest. */
export const HostShellEnvelopeSchema = HostShellEnvelopeContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'HostShellEnvelope',
  title: 'HostShellEnvelope',
  description: 'The sealed host↔shell envelope: versioned, content-addressed, replay-chained.',
});

/** One sealed envelope. */
export type HostShellEnvelope = z.infer<typeof HostShellEnvelopeSchema>;

/** The content of one envelope (digest excluded), as canonical JSON input. */
function contentOf(envelope: HostShellEnvelope): JsonValue {
  const { digest: _claimed, ...content } = envelope;
  void _claimed;
  return content as unknown as JsonValue;
}

/** Seal an envelope content (computes the digest). */
export function sealHostShellEnvelope(content: HostShellEnvelopeContent): HostShellEnvelope {
  return { ...content, digest: canonicalDigest(content as unknown as JsonValue) };
}

/** Verify one envelope's own digest (tamper detection). */
export function verifyHostShellEnvelope(envelope: HostShellEnvelope): boolean {
  return canonicalDigest(contentOf(envelope)) === envelope.digest;
}

// ---------------------------------------------------------------------------
// Channels (per session, per direction) + chain verification.
// ---------------------------------------------------------------------------

/** The chain head of one seam channel (replay state). */
export interface SeamChannel {
  readonly sessionId: string;
  readonly direction: EnvelopeDirection;
  /** The last admitted sequence number (0 = fresh channel). */
  readonly lastSequence: number;
  /** The digest of the last admitted envelope (GENESIS_DIGEST = fresh). */
  readonly lastDigest: string;
}

/** Open a fresh seam channel. */
export function openChannel(sessionId: string, direction: EnvelopeDirection): SeamChannel {
  return { sessionId, direction, lastSequence: 0, lastDigest: GENESIS_DIGEST };
}

/** The next chain position of a channel (pure). */
export function nextChainPosition(channel: SeamChannel): { sequence: number; prevEnvelopeDigest: string } {
  return { sequence: channel.lastSequence + 1, prevEnvelopeDigest: channel.lastDigest };
}

/** The input of {@link appendEnvelope} (chain fields are derived). */
export type EnvelopeAppendInput = Omit<
  HostShellEnvelopeContent,
  'sequence' | 'prevEnvelopeDigest'
>;

/**
 * Append one envelope to a channel: derives the chain position from the
 * channel head, seals the envelope, and returns it with the advanced
 * channel. Total and typed; the input is never mutated.
 */
export function appendEnvelope(
  channel: SeamChannel,
  input: EnvelopeAppendInput,
): DesktopResult<{ envelope: HostShellEnvelope; channel: SeamChannel }> {
  const position = nextChainPosition(channel);
  const content: HostShellEnvelopeContent = {
    ...input,
    sequence: position.sequence,
    prevEnvelopeDigest: position.prevEnvelopeDigest,
  };
  const parsed = HostShellEnvelopeContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: malformedRecordError(
        'envelope content failed schema validation',
        parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      ),
    };
  }
  const envelope = sealHostShellEnvelope(parsed.data);
  return desktopOk({
    envelope,
    channel: {
      sessionId: channel.sessionId,
      direction: channel.direction,
      lastSequence: position.sequence,
      lastDigest: envelope.digest,
    },
  });
}

/** Total envelope admission (version gate -> schema gate -> digest gate). */
export function parseHostShellEnvelope(input: unknown): DesktopResult<HostShellEnvelope> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const encountered = (input as Record<string, unknown>).protocolVersion;
    if (typeof encountered === 'string' && encountered !== DESKTOP_PROTOCOL_VERSION) {
      return { ok: false, error: versionUnsupportedError(DESKTOP_PROTOCOL_VERSION, encountered) };
    }
    const schemaName = (input as Record<string, unknown>).schema;
    if (typeof schemaName === 'string' && schemaName !== HOST_SHELL_ENVELOPE_SCHEMA_NAME) {
      return { ok: false, error: versionUnsupportedError(HOST_SHELL_ENVELOPE_SCHEMA_NAME, schemaName) };
    }
  }
  const parsed = HostShellEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: malformedRecordError(
        'host↔shell envelope failed schema validation',
        parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      ),
    };
  }
  if (!verifyHostShellEnvelope(parsed.data)) {
    return {
      ok: false,
      error: digestMismatchError('$', canonicalDigest(contentOf(parsed.data)), parsed.data.digest),
    };
  }
  return desktopOk(parsed.data);
}

/**
 * Admit one envelope against a channel head: full envelope admission plus
 * the replay-safety gates (sequence continuity — no gaps, no replays, no
 * out-of-order delivery — and chain-link integrity). Returns the advanced
 * channel on success.
 */
export function admitEnvelope(
  channel: SeamChannel,
  input: unknown,
): DesktopResult<{ envelope: HostShellEnvelope; channel: SeamChannel }> {
  const admitted = parseHostShellEnvelope(input);
  if (!admitted.ok) {
    return admitted;
  }
  const envelope = admitted.value;
  if (envelope.sessionId !== channel.sessionId || envelope.direction !== channel.direction) {
    return {
      ok: false,
      error: replayViolationError(
        'chain-root',
        `envelope belongs to channel (${envelope.sessionId}, ${envelope.direction}), not (${channel.sessionId}, ${channel.direction})`,
      ),
    };
  }
  const expectedSequence = channel.lastSequence + 1;
  if (envelope.sequence !== expectedSequence) {
    return {
      ok: false,
      error: replayViolationError(
        envelope.sequence < expectedSequence ? 'out-of-order' : 'gap',
        `expected sequence ${expectedSequence}, encountered ${envelope.sequence}`,
        expectedSequence,
        envelope.sequence,
      ),
    };
  }
  if (envelope.prevEnvelopeDigest !== channel.lastDigest) {
    return {
      ok: false,
      error: replayViolationError(
        'fork',
        `envelope chains from ${envelope.prevEnvelopeDigest}, but the channel head is ${channel.lastDigest}`,
      ),
    };
  }
  return desktopOk({
    envelope,
    channel: {
      sessionId: channel.sessionId,
      direction: channel.direction,
      lastSequence: envelope.sequence,
      lastDigest: envelope.digest,
    },
  });
}

/**
 * Verify a whole envelope chain (replay evidence): the head must be the
 * channel's genesis, sequences run 1..n without gaps or repeats, every
 * chain link matches, and every envelope's own digest verifies. Returns
 * the resulting channel head.
 */
export function verifyEnvelopeChain(
  sessionId: string,
  direction: EnvelopeDirection,
  envelopes: readonly HostShellEnvelope[],
): DesktopResult<SeamChannel> {
  let channel = openChannel(sessionId, direction);
  for (const candidate of envelopes) {
    const admitted = admitEnvelope(channel, candidate);
    if (!admitted.ok) {
      return admitted;
    }
    channel = admitted.value.channel;
  }
  return desktopOk(channel);
}

/** The lowercase-hex digest pattern (re-export for callers/tests). */
export const Sha256HexPattern = /^[0-9a-f]{64}$/;
