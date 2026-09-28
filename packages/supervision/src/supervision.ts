/**
 * The SUPERVISION PASS — the total admission over the evaluation input:
 *
 * 1. pre-classifiers: schedule-MUTATION vocabulary on the input (or on
 *    any sibling-kernel summary) is a typed `re-schedule-rejected`
 *    BEFORE validation (supervision observes, never re-schedules);
 * 2. schema validation (strict objects; vendor fields classify);
 * 3. the W036 authorities verify through the REAL kernels
 *    (`verifySealedProgramOfWork` / `verifySealedDeliveryRecord` —
 *    digest recomputation, tamper detection);
 * 4. tenant isolation (R12): the program, the delivery, every issue
 *    summary, every lead-time input and every info request must be
 *    scoped to the pass tenant (`tenant-isolation-rejected`);
 * 5. binding: the delivery must ground the SAME baseline as the program
 *    (exact solutionVersionDigest) — a foreign delivery is a typed
 *    `dangling-reference-rejected`;
 * 6. the six check families run as pure folds over the verified state;
 * 7. findings seal individually (content-addressed), the pass seals
 *    over the canonically-ordered finding list.
 *
 * Determinism: identical inputs produce identical findings, identical
 * digests, and an identical pass digest (replay-safe). Zero wall-clock,
 * zero randomness — the evaluation instant is a caller-supplied input.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  PrincipalIdSchema,
  ProgramIdSchema,
  DeliveryIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
} from '@epoch/solution-delivery';
import {
  FINDING_CLASSES,
  FINDING_STATUSES,
  SUPERVISION_PASS_SCHEMA_NAME,
  SUPERVISION_RECORD_VERSION,
  type FindingClass,
  type FindingStatus,
} from './version';
import {
  admitExecutionIssueSummary,
  admitLeadTimeRiskInput,
  SupervisionEvaluationInputSchema,
  SupervisionThresholdsSchema,
  type ExecutionIssueSummary,
  type LeadTimeRiskInput,
} from './inputs';
import { SealedSupervisionFindingSchema, sealSupervisionFinding } from './findings';
import type { SealedSupervisionFinding } from './findings';
import { runAllChecks, type SupervisionCheckContext } from './checks';
import { scanScheduleMutation, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { SupervisionError, SupervisionResult } from './errors';

// --------------------------------------------------------------------------------
// The supervision pass record.
// --------------------------------------------------------------------------------

/** The immutable content of one supervision pass (everything except the digest). */
export const SupervisionPassContentSchema = z
  .strictObject({
    schema: z.literal(SUPERVISION_PASS_SCHEMA_NAME),
    schemaVersion: z.literal(SUPERVISION_RECORD_VERSION),
    passId: z.string().regex(/^pass:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    programId: ProgramIdSchema,
    programDigest: Sha256HexSchema,
    deliveryId: DeliveryIdSchema,
    deliveryDigest: Sha256HexSchema,
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
    evaluatedAt: TimestampSchema,
    evaluatedBy: PrincipalIdSchema,
    thresholds: SupervisionThresholdsSchema,
    findings: z.array(SealedSupervisionFindingSchema).max(1024),
    findingCounts: z
      .strictObject({
        byClass: z.record(z.string(), z.number().int().min(0)),
        byStatus: z.record(z.string(), z.number().int().min(0)),
      })
      .readonly(),
  })
  .readonly()
  .superRefine((pass, ctx) => {
    for (let i = 1; i < pass.findings.length; i += 1) {
      if (pass.findings[i]!.findingId < pass.findings[i - 1]!.findingId) {
        ctx.addIssue({
          code: 'custom',
          message: 'findings must be sorted by findingId ascending (deterministic serialization)',
          path: ['findings'],
        });
        break;
      }
      if (pass.findings[i]!.findingId === pass.findings[i - 1]!.findingId) {
        ctx.addIssue({
          code: 'custom',
          message: 'findings must be duplicate-free by findingId',
          path: ['findings'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'SupervisionPassContent',
    title: 'SupervisionPassContent',
    description:
      'The immutable content of one supervision pass: identity, tenant scope, the exact-revision program/delivery digests, the evaluation instant and principal, the applied thresholds, the sealed findings, and the deterministic finding counts.',
  });

/** One supervision pass content. */
export type SupervisionPassContent = z.infer<typeof SupervisionPassContentSchema>;

/** The SEALED supervision pass: content plus its SHA-256 content digest. */
export const SealedSupervisionPassSchema = z
  .strictObject({
    schema: z.literal(SUPERVISION_PASS_SCHEMA_NAME),
    schemaVersion: z.literal(SUPERVISION_RECORD_VERSION),
    passId: z.string().regex(/^pass:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    programId: ProgramIdSchema,
    programDigest: Sha256HexSchema,
    deliveryId: DeliveryIdSchema,
    deliveryDigest: Sha256HexSchema,
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
    evaluatedAt: TimestampSchema,
    evaluatedBy: PrincipalIdSchema,
    thresholds: SupervisionThresholdsSchema,
    findings: z.array(SealedSupervisionFindingSchema).max(1024),
    findingCounts: z
      .strictObject({
        byClass: z.record(z.string(), z.number().int().min(0)),
        byStatus: z.record(z.string(), z.number().int().min(0)),
      })
      .readonly(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedSupervisionPass',
    title: 'SealedSupervisionPass',
    description:
      'The sealed supervision pass: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing of one evaluation pass).',
  });

/** One sealed supervision pass. */
export type SealedSupervisionPass = z.infer<typeof SealedSupervisionPassSchema>;

/** Compute the content digest of a pass content. */
export function computeSupervisionPassDigest(content: SupervisionPassContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Verify a sealed pass: schema validation + digest recomputation. */
export function verifySealedSupervisionPass(sealed: unknown): SupervisionResult<SealedSupervisionPass> {
  const parsed = SealedSupervisionPassSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed supervision pass digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.passId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The total evaluation admission.
// --------------------------------------------------------------------------------

/** The typed outcome of one evaluation pass. */
export interface SupervisionPassEvaluation {
  readonly pass: SealedSupervisionPass;
  readonly findings: readonly SealedSupervisionFinding[];
}

/** Map a W036 error into the supervision taxonomy (the W038 adapter pattern). */
function mapDeliveryError(error: { message: string }, subject: string): SupervisionError {
  return {
    code: 'validation',
    message: `the W036 authority rejected the input for "${subject}": ${error.message}`,
    issues: [{ path: '$', message: error.message }],
  };
}

/**
 * RUN ONE SUPERVISION EVALUATION PASS (the total admission). Pure:
 * identical inputs produce identical sealed passes. The W036 records are
 * verified through the REAL kernels; sibling-kernel inputs are admitted
 * through their supervision-side mirrors with the schedule-authority
 * pre-classifier.
 */
export function evaluateSupervisionPass(input: unknown): SupervisionResult<SealedSupervisionPass> {
  // 1. Schedule-mutation pre-classifier on the raw input.
  const mutation = scanScheduleMutation(input, 'supervision-evaluation-input');
  if (mutation !== null) {
    return { ok: false, error: mutation };
  }

  // 2. Structural validation of the input envelope.
  const parsed = SupervisionEvaluationInputSchema.safeParse(input);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const raw = parsed.data;

  // 3. The W036 authorities verify through the REAL kernels.
  const programResult = verifySealedProgramOfWork(raw.program);
  if (!programResult.ok) {
    return { ok: false, error: mapDeliveryError(programResult.error, 'program') };
  }
  const program = programResult.value;
  const deliveryResult = verifySealedDeliveryRecord(raw.delivery);
  if (!deliveryResult.ok) {
    return { ok: false, error: mapDeliveryError(deliveryResult.error, 'delivery') };
  }
  const delivery = deliveryResult.value;

  // 4. Tenant isolation (R12).
  if (program.tenantId !== raw.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `program "${program.programId}" belongs to tenant "${program.tenantId}" but the pass is scoped to "${raw.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: raw.tenantId,
        encounteredTenantId: program.tenantId,
        subject: program.programId,
      },
    };
  }
  if (delivery.tenantId !== raw.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `delivery "${delivery.deliveryId}" belongs to tenant "${delivery.tenantId}" but the pass is scoped to "${raw.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: raw.tenantId,
        encounteredTenantId: delivery.tenantId,
        subject: delivery.deliveryId,
      },
    };
  }

  // 5. Baseline binding: the delivery grounds the SAME solution revision.
  if (
    delivery.solutionId !== program.solutionId ||
    delivery.solutionVersionDigest !== program.solutionVersionDigest
  ) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `delivery "${delivery.deliveryId}" grounds a different baseline than program "${program.programId}" — a supervision pass binds one program to the delivery of the same exact solution revision`,
        referenceKind: 'delivery',
        referenceId: delivery.deliveryId,
      },
    };
  }

  // 6. Sibling-kernel inputs admit through the mirrors (tenant-checked).
  const executionIssues: ExecutionIssueSummary[] = [];
  for (const rawIssue of raw.executionIssues) {
    const admitted = admitExecutionIssueSummary(rawIssue);
    if (!admitted.ok) {
      return admitted;
    }
    if (admitted.value.tenantId !== raw.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `execution-issue summary "${admitted.value.recordId}" belongs to tenant "${admitted.value.tenantId}" but the pass is scoped to "${raw.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: raw.tenantId,
          encounteredTenantId: admitted.value.tenantId,
          subject: admitted.value.recordId,
        },
      };
    }
    executionIssues.push(admitted.value);
  }
  const leadTimeInputs: LeadTimeRiskInput[] = [];
  for (const rawLeadTime of raw.leadTimeInputs) {
    const admitted = admitLeadTimeRiskInput(rawLeadTime);
    if (!admitted.ok) {
      return admitted;
    }
    if (admitted.value.tenantId !== raw.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `lead-time input "${admitted.value.leadTimeInputId}" belongs to tenant "${admitted.value.tenantId}" but the pass is scoped to "${raw.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: raw.tenantId,
          encounteredTenantId: admitted.value.tenantId,
          subject: admitted.value.leadTimeInputId,
        },
      };
    }
    leadTimeInputs.push(admitted.value);
  }
  for (const request of raw.infoRequests) {
    if (request.tenantId !== raw.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `information-acquisition request "${request.requestId}" belongs to tenant "${request.tenantId}" but the pass is scoped to "${raw.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: raw.tenantId,
          encounteredTenantId: request.tenantId,
          subject: request.requestId,
        },
      };
    }
  }

  // 7. The checks run as pure folds over the verified state.
  const context: SupervisionCheckContext = {
    program,
    delivery,
    tenantId: raw.tenantId,
    solutionId: program.solutionId,
    programId: program.programId,
    deliveryId: delivery.deliveryId,
    evaluatedAt: raw.evaluatedAt,
    evaluatedBy: raw.evaluatedBy,
    thresholds: raw.thresholds,
    executionIssues,
    leadTimeInputs,
    infoRequests: raw.infoRequests,
  };
  const findingContents = runAllChecks(context);
  const findings: SealedSupervisionFinding[] = [];
  const seenFindingIds = new Set<string>();
  for (const content of findingContents) {
    const sealed = sealSupervisionFinding(content);
    if (!sealed.ok) {
      return sealed;
    }
    if (seenFindingIds.has(sealed.value.findingId)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `two findings derived the same id "${sealed.value.findingId}" — finding identity must be unique within a pass`,
          issues: [{ path: 'findings', message: `duplicate finding id ${sealed.value.findingId}` }],
        },
      };
    }
    seenFindingIds.add(sealed.value.findingId);
    findings.push(sealed.value);
  }

  const byClass: Record<string, number> = {};
  for (const status of FINDING_CLASSES) {
    byClass[status] = 0;
  }
  const byStatus: Record<string, number> = {};
  for (const status of FINDING_STATUSES) {
    byStatus[status] = 0;
  }
  for (const finding of findings) {
    byClass[finding.findingClass] = (byClass[finding.findingClass] ?? 0) + 1;
    byStatus[finding.status] = (byStatus[finding.status] ?? 0) + 1;
  }

  const content: SupervisionPassContent = {
    schema: SUPERVISION_PASS_SCHEMA_NAME,
    schemaVersion: SUPERVISION_RECORD_VERSION,
    passId: raw.passId,
    tenantId: raw.tenantId,
    solutionId: program.solutionId,
    programId: program.programId,
    programDigest: program.contentDigest,
    deliveryId: delivery.deliveryId,
    deliveryDigest: delivery.contentDigest,
    solutionVersion: program.solutionVersion,
    solutionVersionDigest: program.solutionVersionDigest,
    evaluatedAt: raw.evaluatedAt,
    evaluatedBy: raw.evaluatedBy,
    thresholds: raw.thresholds,
    findings,
    findingCounts: { byClass, byStatus },
  };
  return { ok: true, value: { ...content, contentDigest: computeSupervisionPassDigest(content) } };
}

// --------------------------------------------------------------------------------
// The derived supervision-state projection (deterministic fold).
// --------------------------------------------------------------------------------

/** One row of the projection: the latest observed state of one finding. */
export interface SupervisionFindingRow {
  readonly findingId: string;
  readonly findingClass: FindingClass;
  readonly status: FindingStatus;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly firstSeenPassDigest: string;
  readonly latestPassDigest: string;
  readonly latestFindingDigest: string;
  readonly presentInLatestPass: boolean;
}

/** The deterministic supervision-state projection over a pass history. */
export interface SupervisionStateProjection {
  readonly passCount: number;
  readonly latestPassDigest: string | null;
  readonly findings: readonly SupervisionFindingRow[];
  readonly counts: Readonly<{ byClass: Readonly<Record<string, number>>; byStatus: Readonly<Record<string, number>>; presentInLatestPass: number }>;
}

/**
 * Fold the derived supervision state over a pass history: the LATEST
 * observed status of every finding ever produced (passes ordered by
 * (evaluatedAt, passId); a finding absent from the latest pass keeps its
 * last observed status with `presentInLatestPass: false`). Input order
 * never leaks — the fold sorts first.
 */
export function projectSupervisionState(
  passes: readonly SealedSupervisionPass[],
): SupervisionStateProjection {
  const ordered = [...passes].sort((a, b) => {
    if (a.evaluatedAt !== b.evaluatedAt) return a.evaluatedAt < b.evaluatedAt ? -1 : 1;
    if (a.passId !== b.passId) return a.passId < b.passId ? -1 : 1;
    return a.contentDigest < b.contentDigest ? -1 : 1;
  });
  const latest = ordered.length > 0 ? ordered[ordered.length - 1]! : null;
  const latestFindingIds =
    latest === null ? new Set<string>() : new Set(latest.findings.map((finding) => finding.findingId));

  const rows = new Map<string, SupervisionFindingRow>();
  for (const pass of ordered) {
    for (const finding of pass.findings) {
      const existing = rows.get(finding.findingId);
      if (existing === undefined) {
        rows.set(finding.findingId, {
          findingId: finding.findingId,
          findingClass: finding.findingClass,
          status: finding.status,
          subjectKind: finding.subject.subjectKind,
          subjectId: finding.subject.subjectId,
          firstSeenPassDigest: pass.contentDigest,
          latestPassDigest: pass.contentDigest,
          latestFindingDigest: finding.contentDigest,
          presentInLatestPass: latestFindingIds.has(finding.findingId),
        });
        continue;
      }
      rows.set(finding.findingId, {
        ...existing,
        status: finding.status,
        latestPassDigest: pass.contentDigest,
        latestFindingDigest: finding.contentDigest,
        presentInLatestPass: latestFindingIds.has(finding.findingId),
      });
    }
  }

  const byClass: Record<string, number> = {};
  for (const status of FINDING_CLASSES) {
    byClass[status] = 0;
  }
  const byStatus: Record<string, number> = {};
  for (const status of FINDING_STATUSES) {
    byStatus[status] = 0;
  }
  let presentCount = 0;
  const sortedRows = [...rows.values()].sort((a, b) => (a.findingId < b.findingId ? -1 : 1));
  for (const row of sortedRows) {
    byClass[row.findingClass] = (byClass[row.findingClass] ?? 0) + 1;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.presentInLatestPass) {
      presentCount += 1;
    }
  }

  return {
    passCount: ordered.length,
    latestPassDigest: latest?.contentDigest ?? null,
    findings: sortedRows,
    counts: { byClass, byStatus, presentInLatestPass: presentCount },
  };
}
