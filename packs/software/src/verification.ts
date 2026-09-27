/**
 * Software verification-method descriptors (DP1.0 "verification
 * methods"): test-suite pass, review approval, deploy gate, SLO check —
 * as typed DATA referencing the W006 evidence and provenance conventions
 * (exact-revision evidence references, confidence methods, production
 * provenance). The descriptors are vocabulary; the W006/W036 verification
 * AUTHORITY is never re-implemented here — gates on the ProgramOfWork
 * carry opaque method references, and this fold merely DESCRIBES those
 * references with software vocabulary.
 */
import { z } from 'zod';
import { QualifiedNameSchema, type VerificationGate } from '@epoch/solution-delivery';
import {
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_VERIFICATION_KINDS,
  VERIFICATION_METHOD_SCHEMA_NAME,
} from './version';

/**
 * The confidence-method vocabulary mirrored from the W006/W002
 * CONFIDENCE_METHODS (stated/measured/estimated/derived/imported) so
 * software verification descriptors stay evidence-shaped. Pinned by the
 * devDep runtime parity test — never a runtime dependency on
 * @epoch/evidence.
 */
export const PACK_CONFIDENCE_METHODS = [
  'stated',
  'measured',
  'estimated',
  'derived',
  'imported',
] as const;

/** One mirrored confidence method (the W006 grammar). */
export type PackConfidenceMethod = (typeof PACK_CONFIDENCE_METHODS)[number];

// --------------------------------------------------------------------------------
// The verification-method descriptors.
// --------------------------------------------------------------------------------

/** One software verification-method descriptor. */
export const SoftwareVerificationMethodSchema = z
  .strictObject({
    schema: z.literal(VERIFICATION_METHOD_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    methodId: QualifiedNameSchema,
    kind: z.enum(SOFTWARE_VERIFICATION_KINDS),
    title: z.string().min(1).max(256),
    description: z.string().max(2048),
    /** The W006 confidence method this method's evidence conventionally carries. */
    confidenceMethod: z.enum(PACK_CONFIDENCE_METHODS),
    /**
     * The evidence-provenance convention note: how the method references
     * exact-revision evidence (W006 digests) and records production
     * provenance (run/actor/method).
     */
    evidenceConvention: z.string().min(1).max(2048),
  })
  .readonly()
  .meta({
    id: 'SoftwareVerificationMethod',
    title: 'SoftwareVerificationMethod',
    description:
      'One software verification-method descriptor: kind (test-suite-pass/review-approval/deploy-gate/slo-check) with the W006 confidence-method and evidence-provenance conventions it references — a descriptor, never a verification authority.',
  });

/** One software verification-method descriptor. */
export type SoftwareVerificationMethod = z.infer<typeof SoftwareVerificationMethodSchema>;

/**
 * The software verification methods: typed vocabulary data, sorted by
 * methodId ascending, duplicate-free.
 */
export const SOFTWARE_VERIFICATION_METHODS: readonly SoftwareVerificationMethod[] = [
  {
    schema: 'epoch.pack-software.verification-method',
    schemaVersion: 1,
    methodId: 'software.verify.deploy-gate',
    kind: 'deploy-gate',
    title: 'Deploy gate',
    description:
      'Deployment readiness gates: pre-rollout checks (test results, approvals, environment readiness) that must pass before a release unit rolls out to an environment.',
    confidenceMethod: 'derived',
    evidenceConvention:
      'Gate outcomes are derived from the exact-revision evidence of their constituent checks (W006 content digests) with run/actor provenance; the W036 verification gate carries the pass instant and approver.',
  },
  {
    schema: 'epoch.pack-software.verification-method',
    schemaVersion: 1,
    methodId: 'software.verify.review-approval',
    kind: 'review-approval',
    title: 'Review approval',
    description:
      'Peer review approvals: a design or change reviewed by the responsible approvers against the acceptance criteria before merge/realization proceeds.',
    confidenceMethod: 'stated',
    evidenceConvention:
      'Review approvals are stated-by-reviewer evidence referenced by exact-revision digest (W006) with reviewer provenance; acceptance remains a distinct authority act on the W036 gate.',
  },
  {
    schema: 'epoch.pack-software.verification-method',
    schemaVersion: 1,
    methodId: 'software.verify.slo-check',
    kind: 'slo-check',
    title: 'SLO check',
    description:
      'Service-level-objective checks: measured attainment of reliability/performance objectives over an attestation window, evaluated from service telemetry.',
    confidenceMethod: 'measured',
    evidenceConvention:
      'SLO evaluations are measured telemetry-derived evidence (W006 digests) with evaluation-window provenance; the objective target and window are stated on the gate criteria.',
  },
  {
    schema: 'epoch.pack-software.verification-method',
    schemaVersion: 1,
    methodId: 'software.verify.test-suite-pass',
    kind: 'test-suite-pass',
    title: 'Test suite pass',
    description:
      'Automated test suite passes: unit, integration and end-to-end suites executed against a change or release candidate with a green result at the referenced revision.',
    confidenceMethod: 'measured',
    evidenceConvention:
      'Suite runs are exact-revision evidence (W006 content digests) tied to the sealed source revision digests they ran against; run/actor/method production provenance is retained.',
  },
];

// --------------------------------------------------------------------------------
// The gate-description fold (pure projection over W036 verification gates).
// --------------------------------------------------------------------------------

/** One described verification gate: the canonical gate plus software vocabulary. */
export interface DescribedVerificationGate {
  readonly gateId: string;
  readonly activityId: string;
  readonly title: string;
  /** The matched software verification-method descriptor id (opaque method reference). */
  readonly softwareMethodId: string | undefined;
  /** The matched software verification-method kind. */
  readonly softwareKind: string | undefined;
  readonly passedAt: string | undefined;
}

/**
 * Describe the verification gates of one program with software vocabulary:
 * a pure fold matching each gate's OPAQUE method reference against the
 * descriptor method ids. Unmatched methods describe with `undefined`
 * software terms (SN1.0 partial data — the gate itself is untouched).
 * Deterministic: sorted by gateId; input order never leaks.
 */
export function describeVerificationGates(
  gates: readonly VerificationGate[],
  methods: readonly SoftwareVerificationMethod[],
): readonly DescribedVerificationGate[] {
  const byMethodId = new Map<string, SoftwareVerificationMethod>();
  for (const method of [...methods].sort((a, b) => (a.methodId < b.methodId ? -1 : 1))) {
    byMethodId.set(method.methodId, method);
  }
  return gates
    .map((gate) => {
      const method = byMethodId.get(gate.method);
      return {
        gateId: gate.gateId,
        activityId: gate.activityId,
        title: gate.title,
        softwareMethodId: method?.methodId,
        softwareKind: method?.kind,
        passedAt: gate.passedAt,
      };
    })
    .sort((a, b) => (a.gateId < b.gateId ? -1 : 1));
}
