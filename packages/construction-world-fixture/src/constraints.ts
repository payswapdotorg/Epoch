/**
 * @epoch/construction-world-fixture — the constraint / finding records
 * (W071, ACR-012 §8 — ≥5 records with OK and WARN severities, including
 * one MEP clash finding, each referencing its entity IDs).
 *
 * Each finding is FIXTURE-LOCAL composition data the host renders as
 * the spatially-discoverable constraints/findings surface. Selecting a
 * finding focuses the relevant element(s) in the world. The entity IDs
 * reference real entities in the fixture's entity set — the spatial
 * world focuses the finding, never a table.
 */
import type { ConstructionConstraintRecord } from './types';
import { ENTITY_IDS } from './version';

/**
 * The six constraint / finding records (ACR-012 §8 requires ≥5; this
 * fixture carries 6 — including one MEP clash finding).
 *
 *  - W071-finding-001 (OK, budget): BOQ grand total within envelope.
 *  - W071-finding-002 (WARN, clash): HVAC duct clashes with the legacy
 *    conduit — the spatial-world acceptance: the clash is findable by
 *    revealing the MEP layer.
 *  - W071-finding-003 (OK, programme): critical path fits the programme.
 *  - W071-finding-004 (WARN, clearance): front door clear width meets
 *    accessibility min but threshold height needs trimming.
 *  - W071-finding-005 (OK, spacing): column spacing supports 8m beam span.
 *  - W071-finding-006 (WARN, availability): AAC blockwork supply
 *    constrained this week (3-day lead time).
 */
export const CONSTRAINTS: readonly ConstructionConstraintRecord[] = [
  {
    constraintId: 'W071-finding-001',
    severity: 'ok',
    category: 'budget',
    title: 'BOQ grand total within approved envelope',
    description:
      'The Current-solution BOQ grand total is within the EUR 50,000 approved budget envelope for the Pioneer Block-A building/site.',
    entityIds: [ENTITY_IDS.groundSlab, ENTITY_IDS.roofCladding],
  },
  {
    constraintId: 'W071-finding-002',
    severity: 'warn',
    category: 'clash',
    title: 'MEP clash — HVAC duct vs legacy conduit L2',
    description:
      'The HVAC supply duct run crosses the legacy steel conduit L2 at the south-east corner of the building. The legacy conduit is hidden by default (visible=false); reveal the MEP layer to find the clash in the world. Alternative A reroutes the duct and removes the conduit.',
    entityIds: [ENTITY_IDS.hvacDuct, ENTITY_IDS.legacyConduit, ENTITY_IDS.plumbingRiser],
  },
  {
    constraintId: 'W071-finding-003',
    severity: 'ok',
    category: 'programme',
    title: 'Critical path fits the 60-day programme',
    description:
      'The construction critical path (site → excavation → foundation → structure → walls → roof → mep → finishes) fits the 60-day programme envelope with 4 days float at the walls phase.',
    entityIds: [ENTITY_IDS.foundationStrip, ENTITY_IDS.column01, ENTITY_IDS.wallSouth],
  },
  {
    constraintId: 'W071-finding-004',
    severity: 'warn',
    category: 'clearance',
    title: 'Front door threshold clearance needs trimming',
    description:
      'The front entrance door clear width (1000mm) meets the accessibility minimum but the threshold height (35mm) requires trimming to 25mm to meet the step-free access requirement.',
    entityIds: [ENTITY_IDS.doorFront],
  },
  {
    constraintId: 'W071-finding-005',
    severity: 'ok',
    category: 'spacing',
    title: 'Column spacing supports 8m beam span',
    description:
      'The four-column grid (COL-01 to COL-04) at 8m spacing supports the proposed 8m RC beam span (B1, B2) with the bearing and rebar schedule specified.',
    entityIds: [ENTITY_IDS.column01, ENTITY_IDS.column02, ENTITY_IDS.column03, ENTITY_IDS.column04, ENTITY_IDS.beam01, ENTITY_IDS.beam02],
  },
  {
    constraintId: 'W071-finding-006',
    severity: 'warn',
    category: 'availability',
    title: 'AAC blockwork supply constrained this week',
    description:
      'The 200mm AAC blockwork (north/south/east/west walls) has a 3-day lead time this week due to plant maintenance. Programme floats accommodate; Alternative B re-sequences walls before roof.',
    entityIds: [ENTITY_IDS.wallNorth, ENTITY_IDS.wallSouth, ENTITY_IDS.wallEast, ENTITY_IDS.wallWest],
  },
];

/** The hidden MEP clash finding (the spatial-world acceptance evidence). */
export const MEP_CLASH_FINDING = CONSTRAINTS.find(
  (c) => c.category === 'clash' && c.severity === 'warn',
) as ConstructionConstraintRecord;
