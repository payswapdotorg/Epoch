/**
 * The desktop authoring surface (W017) — OPTIONAL, foundation-backed, and
 * a PROJECTION (architecture.md §Client family: "Desktop may expose
 * optional foundation-backed authoring surfaces, but their native
 * timelines/documents/projects remain projections and working
 * artifacts").
 *
 * The shell PROPOSES; it never decides, approves, or executes:
 * - an authoring intent is TYPED DATA — an action-type reference (the R30
 *   kernel-seam shape: qualified id + semver, structurally identical to
 *   the action-protocol `ActionTypeReference` and the W011 control
 *   intent, so the future wiring through the Action Gateway needs no
 *   translation layer) plus opaque parameters;
 * - the proposal status is `proposed` — the ONLY status that exists on
 *   this surface. Approval, authorization, and execution are
 *   kernel-side (lock rule 3: actions execute only through the Action
 *   Gateway); a record that claims any other status, or smuggles
 *   authority vocabulary, is a typed `authority-violation` /
 *   `malformed-record` rejection;
 * - {@link rejectAuthoringAuthority} is the typed negative surface: every
 *   self-approval, self-execution, authority claim, or kernel-state
 *   embed attempt is rejected with the typed error, so the boundary is
 *   explicit and testable.
 *
 * Proposals are content-addressed (canonical JSON -> SHA-256) and carry
 * provenance (origin `desktop-authoring-surface`), so a proposal is
 * exact-revision addressable evidence routed toward the kernel seams.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { z } from 'zod';
import { TenantScopeSchema } from '@epoch/experience-protocol';
import {
  authorityViolationError,
  crossTenantDeniedError,
  desktopOk,
  type DesktopResult,
} from './errors';
import {
  AUTHORING_PROPOSAL_SCHEMA_NAME,
  AuthoringProposalStatusSchema,
  DESKTOP_PROTOCOL_VERSION,
  type AuthoringAuthorityAttempt,
  type AuthoringProposalStatus,
} from './version';
import {
  ActionTypeReferenceSchema,
  DesktopSessionIdSchema,
  MessageIdSchema,
  PrincipalIdSchema,
  ProvenanceSchema,
  VirtualTimeMsSchema,
  WindowIdSchema,
  type Provenance,
} from './primitives';

/** The authoring-proposal content (digest-sealed form). */
export const AuthoringProposalContentSchema = z
  .strictObject({
    schema: z.literal(AUTHORING_PROPOSAL_SCHEMA_NAME),
    protocolVersion: z.literal(DESKTOP_PROTOCOL_VERSION),
    proposalId: MessageIdSchema,
    sessionId: DesktopSessionIdSchema,
    /** The window the authoring gesture occurred in, when applicable. */
    windowId: WindowIdSchema.optional(),
    /** The operator principal proposing (opaque identity reference). */
    actor: PrincipalIdSchema,
    /** The action-type reference (the R30 kernel-seam shape). */
    actionType: ActionTypeReferenceSchema,
    /** Opaque parameters (the kernel seams validate them; the shell does not). */
    parameters: z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), z.unknown()),
    rationale: z.string().max(10000).optional(),
    tenantScope: TenantScopeSchema,
    proposedAtMs: VirtualTimeMsSchema,
    status: AuthoringProposalStatusSchema,
    provenance: ProvenanceSchema,
  })
  .superRefine((proposal, ctx) => {
    // The authoring surface always originates its own proposals.
    if (proposal.provenance.origin !== 'desktop-authoring-surface') {
      ctx.addIssue({
        code: 'custom',
        message: 'an authoring proposal must originate at the desktop authoring surface',
        path: ['provenance', 'origin'],
      });
    }
  })
  .meta({
    id: 'DesktopAuthoringProposalContent',
    title: 'DesktopAuthoringProposalContent',
    description:
      'The content of a desktop authoring proposal: actor, action-type reference, opaque parameters, tenant scope, and provenance — status is always "proposed".',
  });

/** One authoring-proposal content. */
export type AuthoringProposalContent = z.infer<typeof AuthoringProposalContentSchema>;

/** The sealed authoring proposal: content plus its SHA-256 digest. */
export const AuthoringProposalSchema = AuthoringProposalContentSchema.extend({
  digest: z.string().regex(/^[0-9a-f]{64}$/),
}).meta({
  id: 'DesktopAuthoringProposal',
  title: 'DesktopAuthoringProposal',
  description: 'The sealed desktop authoring proposal: content plus its SHA-256 content digest.',
});

/** One sealed authoring proposal. */
export type AuthoringProposal = z.infer<typeof AuthoringProposalSchema>;

/** The content of a sealed proposal (digest excluded). */
function proposalContent(proposal: AuthoringProposal): JsonValue {
  const { digest: _claimed, ...content } = proposal;
  void _claimed;
  return content as unknown as JsonValue;
}

/** Seal a valid proposal content (computes the digest). */
export function sealAuthoringProposal(content: AuthoringProposalContent): AuthoringProposal {
  return { ...content, digest: canonicalDigest(content as unknown as JsonValue) };
}

/** Verify a sealed proposal (tamper detection). */
export function verifyAuthoringProposal(proposal: AuthoringProposal): boolean {
  return canonicalDigest(proposalContent(proposal)) === proposal.digest;
}

/** Total proposal admission (version gate -> schema gate -> digest gate -> authority gate). */
export function parseAuthoringProposal(input: unknown): DesktopResult<AuthoringProposal> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const encountered = (input as Record<string, unknown>).protocolVersion;
    if (typeof encountered === 'string' && encountered !== DESKTOP_PROTOCOL_VERSION) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `protocol version mismatch: expected ${DESKTOP_PROTOCOL_VERSION}, encountered ${encountered}`,
          expected: DESKTOP_PROTOCOL_VERSION,
          encountered,
        },
      };
    }
    const schemaName = (input as Record<string, unknown>).schema;
    if (typeof schemaName === 'string' && schemaName !== AUTHORING_PROPOSAL_SCHEMA_NAME) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `schema discriminator mismatch: expected ${AUTHORING_PROPOSAL_SCHEMA_NAME}, encountered ${schemaName}`,
          expected: AUTHORING_PROPOSAL_SCHEMA_NAME,
          encountered: schemaName,
        },
      };
    }
  }
  const parsed = AuthoringProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'authoring proposal failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  if (!verifyAuthoringProposal(parsed.data)) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'authoring proposal digest does not match its content — the proposal is rejected (tamper detection)',
        path: '$',
        expected: canonicalDigest(proposalContent(parsed.data)),
        encountered: parsed.data.digest,
      },
    };
  }
  return desktopOk(parsed.data);
}

/** The input of {@link proposeAuthoring}. */
export interface AuthoringProposalInput {
  readonly proposalId: string;
  readonly sessionId: string;
  readonly windowId?: string | undefined;
  readonly actor: string;
  readonly actionType: { readonly id: string; readonly version: string };
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly rationale?: string | undefined;
  readonly tenantScope: { readonly tenantId: string; readonly workspaceId?: string; readonly projectId?: string };
  readonly proposedAtMs: number;
}

/**
 * Build one typed authoring proposal (the projection surface). The
 * proposal carries NO authority: status is always `proposed`, and the
 * parameters stay opaque (the kernel seams validate them).
 */
export function proposeAuthoring(input: AuthoringProposalInput): DesktopResult<AuthoringProposal> {
  const content: AuthoringProposalContent = {
    schema: AUTHORING_PROPOSAL_SCHEMA_NAME,
    protocolVersion: DESKTOP_PROTOCOL_VERSION,
    proposalId: input.proposalId,
    sessionId: input.sessionId,
    windowId: input.windowId,
    actor: input.actor,
    actionType: input.actionType,
    parameters: { ...input.parameters },
    rationale: input.rationale,
    tenantScope: input.tenantScope,
    proposedAtMs: input.proposedAtMs,
    status: 'proposed',
    provenance: { origin: 'desktop-authoring-surface' },
  };
  const parsed = AuthoringProposalContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the authoring intent failed proposal validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return desktopOk(sealAuthoringProposal(parsed.data));
}

/** One authoring authority-bypass attempt (always rejected). */
export interface AuthoringAuthorityAttemptInput {
  readonly kind: AuthoringAuthorityAttempt;
  readonly proposalId?: string | undefined;
  /** What the attempt tried to decide/claim (free-form, for the typed record). */
  readonly detail?: string | undefined;
}

/**
 * The authoring authority guard: EVERY attempt to make the shell decide,
 * approve, execute, or speak for the kernel is a typed
 * `authority-violation`. The surface exists so the boundary is explicit
 * and testable — the proposal schema itself admits only `proposed`, and
 * no API on this surface approves or executes anything.
 */
export function rejectAuthoringAuthority(
  attempt: AuthoringAuthorityAttemptInput,
): DesktopResult<never> {
  const subject = attempt.proposalId ? `proposal "${attempt.proposalId}"` : 'an authoring proposal';
  const detail = attempt.detail ?? 'no detail provided';
  return {
    ok: false,
    error: authorityViolationError(
      `the desktop shell holds no authoring authority (attempt: ${attempt.kind}, ${subject}) — ` +
      `approval and execution are kernel-side through the Action Gateway (${detail})`,
      [{ path: 'authoring', attempt: attempt.kind }],
    ),
  };
}

/** The tenant gate for proposal submission (R12). */
export function admitProposalForTenant(
  proposal: AuthoringProposal,
  expectedTenantId: string,
): DesktopResult<AuthoringProposal> {
  if (proposal.tenantScope.tenantId !== expectedTenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        'proposal.tenantScope.tenantId',
        expectedTenantId,
        proposal.tenantScope.tenantId,
      ),
    };
  }
  return desktopOk(proposal);
}

/** The typed denial record the kernel seams may answer with (mirrored vocabulary). */
export interface AuthoringDenialRecord {
  readonly proposalDigest: string;
  readonly code: string;
  readonly detail: string;
}

/** Record one kernel-side typed denial of a proposal (the shell records; it never decides). */
export function recordAuthoringDenial(
  proposal: AuthoringProposal,
  denial: { readonly code: string; readonly detail: string },
): DesktopResult<AuthoringDenialRecord> {
  return desktopOk({
    proposalDigest: proposal.digest,
    code: denial.code,
    detail: denial.detail,
  });
}

/** The proposal status type re-export. */
export type { AuthoringProposalStatus, Provenance };
