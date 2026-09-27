/**
 * Construction verification-method descriptors (DP1.0 "verification
 * methods"): inspection, measurement-against-BOQ, material certificate,
 * commissioning test — as typed DATA referencing the W006 evidence and
 * provenance conventions (exact-revision evidence references, confidence
 * methods, production provenance). The descriptors are vocabulary; the
 * W006/W036 verification AUTHORITY is never re-implemented here — gates on
 * the ProgramOfWork carry opaque method references, and this fold merely
 * DESCRIBES those references with construction vocabulary.
 */
import { z } from 'zod';
import { QualifiedNameSchema, type VerificationGate } from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_VERIFICATION_KINDS,
  VERIFICATION_METHOD_SCHEMA_NAME,
} from './version';

/**
 * The confidence-method vocabulary mirrored from the W006/W002
 * CONFIDENCE_METHODS (stated/measured/estimated/derived/imported) so
 * construction verification descriptors stay evidence-shaped. Pinned by
 * the devDep runtime parity test — never a runtime dependency on
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

/** One construction verification-method descriptor. */
export const ConstructionVerificationMethodSchema = z
  .strictObject({
    schema: z.literal(VERIFICATION_METHOD_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    methodId: QualifiedNameSchema,
    kind: z.enum(CONSTRUCTION_VERIFICATION_KINDS),
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
    id: 'ConstructionVerificationMethod',
    title: 'ConstructionVerificationMethod',
    description:
      'One construction verification-method descriptor: kind (inspection/measurement-against-boq/material-certificate/commissioning-test) with the W006 confidence-method and evidence-provenance conventions it references — a descriptor, never a verification authority.',
  });

/** One construction verification-method descriptor. */
export type ConstructionVerificationMethod = z.infer<typeof ConstructionVerificationMethodSchema>;

/**
 * The construction verification methods: typed vocabulary data, sorted by
 * methodId ascending, duplicate-free.
 */
export const CONSTRUCTION_VERIFICATION_METHODS: readonly ConstructionVerificationMethod[] = [
  {
    schema: 'epoch.pack-construction.verification-method',
    schemaVersion: 1,
    methodId: 'construction.verify.commissioning-test',
    kind: 'commissioning-test',
    title: 'Commissioning test',
    description:
      'Functional commissioning tests of completed technical systems (structural, mechanical, electrical) against acceptance criteria before handover.',
    confidenceMethod: 'measured',
    evidenceConvention:
      'Test results are recorded as exact-revision evidence (W006 content digests) with run/actor/method production provenance; the W036 verification gate carries the pass instant and approver.',
  },
  {
    schema: 'epoch.pack-construction.verification-method',
    schemaVersion: 1,
    methodId: 'construction.verify.inspection',
    kind: 'inspection',
    title: 'Site inspection',
    description:
      'Visual and dimensional site inspections of completed works against drawings, specifications and method statements.',
    confidenceMethod: 'stated',
    evidenceConvention:
      'Inspection reports are exact-revision evidence (W006 content digests) with observer provenance; acceptance remains a distinct authority act on the W036 gate.',
  },
  {
    schema: 'epoch.pack-construction.verification-method',
    schemaVersion: 1,
    methodId: 'construction.verify.material-certificate',
    kind: 'material-certificate',
    title: 'Material certificate',
    description:
      'Supplier material certificates and test certificates for delivered permanent-works materials, checked against the specification before installation.',
    confidenceMethod: 'imported',
    evidenceConvention:
      'Certificates are imported artifacts referenced by exact-revision digest (W006); provenance records the issuing body as an opaque external reference, never a vendor name.',
  },
  {
    schema: 'epoch.pack-construction.verification-method',
    schemaVersion: 1,
    methodId: 'construction.verify.measurement-against-boq',
    kind: 'measurement-against-boq',
    title: 'Measurement against BOQ',
    description:
      'Re-measurement of executed quantities against the BOQ projection of the plan quantity schedule for valuation and progress actualization.',
    confidenceMethod: 'measured',
    evidenceConvention:
      'Measurements are exact-revision evidence (W006 digests) tied to the sealed program/BOQ digests they were measured against — the BOQ itself stays a projection, never the authority.',
  },
];

// --------------------------------------------------------------------------------
// The gate-description fold (pure projection over W036 verification gates).
// --------------------------------------------------------------------------------

/** One described verification gate: the canonical gate plus construction vocabulary. */
export interface DescribedVerificationGate {
  readonly gateId: string;
  readonly activityId: string;
  readonly title: string;
  /** The matched construction verification-method descriptor id (opaque method reference). */
  readonly constructionMethodId: string | undefined;
  /** The matched construction verification-method kind. */
  readonly constructionKind: string | undefined;
  readonly passedAt: string | undefined;
}

/**
 * Describe the verification gates of one program with construction
 * vocabulary: a pure fold matching each gate's OPAQUE method reference
 * against the descriptor method ids. Unmatched methods describe with
 * `undefined` construction terms (SN1.0 partial data — the gate itself is
 * untouched). Deterministic: sorted by gateId; input order never leaks.
 */
export function describeVerificationGates(
  gates: readonly VerificationGate[],
  methods: readonly ConstructionVerificationMethod[],
): readonly DescribedVerificationGate[] {
  const byMethodId = new Map<string, ConstructionVerificationMethod>();
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
        constructionMethodId: method?.methodId,
        constructionKind: method?.kind,
        passedAt: gate.passedAt,
      };
    })
    .sort((a, b) => (a.gateId < b.gateId ? -1 : 1));
}
