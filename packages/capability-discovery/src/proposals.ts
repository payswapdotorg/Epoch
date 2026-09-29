/**
 * The ecosystem proposal mechanism (R41, acceptance: "proposal mechanism
 * for adapters/extensions/new domain packs").
 *
 * Discovery evidence (recurring capability gaps) may PROPOSE new
 * adapters, extensions or domain packs as {@link EcosystemProposal}
 * records — proposals carry evidence (gap references, task examples,
 * missing semantics) and, for domain packs, the DP1.0 detail (required
 * vocabulary, world-model bindings, capability dependencies, evaluation
 * requirements, UX projections).
 *
 * A proposal is a RECORD ONLY: activation of a new adapter, extension or
 * domain pack remains Epoch governance (ACR-004 "The proposal is not
 * automatically activated merely because a model was discovered"). This
 * module can never change semantic authority — it emits typed records.
 */
import type {
  CapabilityGap,
  DiscoveryRunId,
  DiscoveryResult,
  DomainPackProposalDetail,
  EcosystemProposal,
  EcosystemProposalKind,
  EcosystemProposalStatus,
  Timestamp,
} from './types';
import { EcosystemProposalSchema } from './schema';
import { contentDigest, digestSuffix16 } from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION } from './version';
import { validationError } from './errors';

/** Inputs for deriving a proposal from gap evidence. */
export interface EcosystemProposalInput {
  readonly kind: EcosystemProposalKind;
  readonly summary: string;
  readonly gaps: readonly CapabilityGap[];
  /** Task examples feeding the evidence (gap demand summaries by default). */
  readonly taskExamples?: readonly string[] | undefined;
  readonly missingSemantics?: readonly string[] | undefined;
  /** Required for domain-pack proposals (DP1.0 detail). */
  readonly domainPackDetail?: DomainPackProposalDetail | undefined;
  readonly at: Timestamp;
  readonly proposedByRunId?: DiscoveryRunId | undefined;
}

/** Derive a proposed ecosystem artifact from discovery evidence. */
export function deriveEcosystemProposal(
  input: EcosystemProposalInput,
): DiscoveryResult<EcosystemProposal> {
  if (input.kind === 'domain-pack' && input.domainPackDetail === undefined) {
    return {
      ok: false,
      error: validationError('domain-pack proposals require domainPackDetail', [
        { path: 'domainPackDetail', message: 'required for kind "domain-pack"' },
      ]),
    };
  }
  const gaps = [...input.gaps].sort((a, b) => (a.gapId < b.gapId ? -1 : 1));
  const proposal: EcosystemProposal = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    proposalId: 'ecoprop:0000000000000000',
    kind: input.kind,
    summary: input.summary,
    evidence: {
      gapIds: gaps.map((gap) => gap.gapId),
      taskExamples: [...(input.taskExamples ?? gaps.map((gap) => gap.demandSummary))].sort(),
      missingSemantics: [
        ...(input.missingSemantics ?? gaps.map((gap) => `${gap.operation.id}: ${gap.demandSummary}`)),
      ].sort(),
      recurringGapCount: gaps.length,
    },
    domainPackDetail: input.domainPackDetail,
    status: 'proposed',
    proposedAt: input.at,
    proposedByRunId: input.proposedByRunId,
  };
  const digest = contentDigest({ ...proposal, proposalId: undefined });
  const sealed = { ...proposal, proposalId: `ecoprop:${digestSuffix16(digest)}` };
  const parsed = EcosystemProposalSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(
        'ecosystem proposal failed validation',
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '$',
          message: issue.message,
        })),
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

/** Review a proposal (append-only by convention: returns a new record). */
export function reviewEcosystemProposal(
  proposal: EcosystemProposal,
  review: {
    readonly status: Exclude<EcosystemProposalStatus, 'proposed'>;
    readonly reviewNote: string;
  },
): EcosystemProposal {
  return { ...proposal, status: review.status, reviewNote: review.reviewNote };
}

/** The body digest of a proposal (lineage + tamper detection). */
export function ecosystemProposalDigestOf(proposal: EcosystemProposal): string {
  return contentDigest({ ...proposal, proposalId: undefined });
}
