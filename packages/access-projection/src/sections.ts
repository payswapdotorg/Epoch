/**
 * The canonical-object section registry (kernel DATA, the W041 dispatch
 * pin: "evidence scopes (which evidence records are visible), commercial
 * scopes (cost/rate fields, quotes), supplier scopes (supplier
 * identity/commitment visibility) — each a typed scope filter applied
 * AFTER the field walk").
 *
 * The registry classifies the W036 field taxonomy into the three
 * governed sections per object class:
 *
 * - `evidence` (ELEMENT-scoped): the W006 evidence-reference arrays —
 *   each element is a `{ digest }` reference whose exact-revision
 *   digest the evidence scope resolves (`listed` releases only the
 *   minimum-necessary digests);
 * - `commercial` (LEAF-scoped): cost/rate fields — planned costs, unit
 *   costs, cost measures (the measure union makes these paths exist
 *   only on cost-measured records, so the classification is
 *   kind-correct by construction);
 * - `supplier` (LEAF-scoped): supplier identity/commitment visibility —
 *   in the W036 canonical shapes, the commitment provenance of
 *   distinction records (who committed, when, to which acquisition);
 *   supplier identity as such is @epoch/procurement's (W037) opaque
 *   vocabulary and never enters these records.
 *
 * A section with no members for one object class is EMPTY (the filter is
 * a typed no-op there) — the registry is honest about what the canonical
 * shapes actually carry. The registry is data: a policy's scope filters
 * read it; no code path enumerates vendors or roles.
 */
import type { ObjectClass } from './version';

/** The governed sections of one object class. */
export interface ObjectClassSections {
  /** Evidence-reference element templates (each element carries `digest`). */
  readonly evidence: readonly string[];
  /** Commercial leaf templates (cost/rate fields). */
  readonly commercial: readonly string[];
  /** Supplier leaf templates (commitment/supplier-identity visibility). */
  readonly supplier: readonly string[];
}

/** The section registry over the four canonical W036 record families. */
export const OBJECT_CLASS_SECTIONS: Readonly<Record<ObjectClass, ObjectClassSections>> = {
  'program-of-work': {
    evidence: [
      'workPackages[].activities[].evidence[]',
      'workPackages[].verificationGates[].evidence[]',
      'milestones[].evidence[]',
    ],
    commercial: [
      'workPackages[].activities[].plannedCost.amount',
      'workPackages[].activities[].plannedCost.currency',
    ],
    supplier: [],
  },
  'delivery-record': {
    evidence: ['observations[].payload.evidence[]'],
    commercial: [
      'observations[].measure.amount',
      'observations[].measure.currency',
      'actuals[].measure.amount',
      'actuals[].measure.currency',
    ],
    supplier: [],
  },
  'solution-version': {
    evidence: [],
    commercial: ['solutionLines[].unitCost.amount', 'solutionLines[].unitCost.currency'],
    supplier: [],
  },
  'distinction-record': {
    evidence: ['payload.evidence[]'],
    commercial: ['measure.amount', 'measure.currency'],
    supplier: ['payload.committedBy', 'payload.committedAt', 'payload.acquisitionId'],
  },
};
