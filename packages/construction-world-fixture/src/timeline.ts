/**
 * @epoch/construction-world-fixture — the construction phase timeline
 * (W071, ACR-012 §7 — site → excavation → foundation → structure →
 * walls → roof → mep → finishes).
 *
 * The construction sequence expressed through the EXISTING W016
 * world-experience timeline/marker vocabulary (reused, NOT re-invented):
 * each phase is one timeline marker. The marker kind is one of the
 * existing W016 marker kinds (`event` / `phase-end` / `branch-point`).
 * The fixture-local ConstructionPhase record carries the per-entity
 * phase membership so a timeline position determines presented state.
 */
import type { ConstructionPhase } from './types';
import { MARKER_IDS, CONSTRUCTION_PHASE_IDS } from './version';
import { ENTITY_GEOMETRY } from './entities';

/**
 * The eight construction phases (ACR-012 §7) plus the branch-point marker
 * (the construction programme can fork there — the W016 marker kind is
 * `branch-point`, exactly the W061 pattern). Marker times are uniform
 * four-digit values (the W016 marker ordering compares
 * `${atMs}\0${markerId}` lexicographically — see the W061 ledger item
 * about mixed-width times).
 */
export const PHASES: readonly ConstructionPhase[] = (() => {
  const phaseLabels: Record<(typeof CONSTRUCTION_PHASE_IDS)[number], string> = {
    'phase-site': 'Site establishment',
    'phase-excavation': 'Excavation',
    'phase-foundation': 'Foundation',
    'phase-structure': 'Structure',
    'phase-walls': 'Walls',
    'phase-roof': 'Roof',
    'phase-mep': 'MEP',
    'phase-finishes': 'Finishes',
  };
  const phaseMarkerIds: Record<(typeof CONSTRUCTION_PHASE_IDS)[number], string> = {
    'phase-site': MARKER_IDS.site,
    'phase-excavation': MARKER_IDS.excavation,
    'phase-foundation': MARKER_IDS.foundation,
    'phase-structure': MARKER_IDS.structure,
    'phase-walls': MARKER_IDS.walls,
    'phase-roof': MARKER_IDS.roof,
    'phase-mep': MARKER_IDS.mep,
    'phase-finishes': MARKER_IDS.finishes,
  };
  // Uniform four-digit marker times (W016 lexicographic ordering safe).
  const phaseTimes: Record<(typeof CONSTRUCTION_PHASE_IDS)[number], number> = {
    'phase-site': 0,
    'phase-excavation': 2000,
    'phase-foundation': 4000,
    'phase-structure': 6000,
    'phase-walls': 8000,
    'phase-roof': 10000,
    'phase-mep': 12000,
    'phase-finishes': 14000,
  };
  return CONSTRUCTION_PHASE_IDS.map((phaseId) => {
    const entityIds = ENTITY_GEOMETRY.filter((e) => e.phase === phaseId)
      .map((e) => e.entityId)
      .sort();
    return {
      phaseId,
      label: phaseLabels[phaseId],
      markerId: phaseMarkerIds[phaseId],
      atMs: phaseTimes[phaseId],
      entityIds,
    };
  });
})();

/**
 * The construction programme branch-point phase (where Current / Alt A /
 * Alt B fork). Reuses the existing W016 `branch-point` marker kind —
 * the SAME semantics as the W061 fixture's branch-point marker.
 */
export const BRANCH_PHASE: ConstructionPhase = {
  phaseId: 'phase-walls',
  label: 'Walls (branch point)',
  markerId: MARKER_IDS.branch,
  atMs: 8000,
  entityIds: [],
};

/** The total phase count of the construction-solution fixture. */
export const PHASE_COUNT = PHASES.length;
