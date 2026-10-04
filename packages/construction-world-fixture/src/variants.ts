/**
 * @epoch/construction-world-fixture — the three solution variants
 * (W071, ACR-012 §8 — Current + Alternative A + Alternative B).
 *
 * The variants express world-state deltas (added/removed/changed
 * entities), deterministic cost / days / risk values, and variant-level
 * constraints. They reuse the existing W016 branch-point marker
 * (BRANCH_PHASE) — the variant fork happens at the construction
 * programme branch point (W061 pattern). NO second lifecycle, NO
 * second timeline, NO second BOQ authority — the variants are
 * fixture-local composition values the host renders as the variant
 * comparison surface.
 */
import type { ConstructionSolutionVariant } from './types';
import { ENTITY_IDS } from './version';

/**
 * The Current baseline solution: standard RC frame + AAC envelope + RTU
 * HVAC. Cost EUR 41,000; programme 60 days; risk MEDIUM (HVAC clash with
 * legacy conduit — the W071-finding-002 clash).
 */
export const VARIANT_CURRENT: ConstructionSolutionVariant = {
  variantId: 'variant-current',
  label: 'Current solution',
  description:
    'RC frame, AAC envelope, roof-top HVAC unit. Carries the legacy conduit clash risk (W071-finding-002).',
  cost: { currency: 'EUR', total: '41000.00' },
  days: 60,
  risk: 'medium',
  deltas: [],
  constraints: [
    { note: 'HVAC duct clashes with legacy conduit L2 (W071-finding-002).', severity: 'warn' },
    { note: 'Programme allows 60 days; excavation+foundation 12 days.', severity: 'ok' },
  ],
};

/**
 * Alternative A — relocate the HVAC duct run + remove the legacy
 * conduit. Cost +5% (EUR 43,000) for rework; programme -2 days (58); risk
 * LOW (clash resolved).
 */
export const VARIANT_ALT_A: ConstructionSolutionVariant = {
  variantId: 'variant-alt-a',
  label: 'Alternative A — reroute HVAC',
  description:
    'Reroute the HVAC supply duct south of the plumbing riser and remove the legacy conduit. Eliminates the clash.',
  cost: { currency: 'EUR', total: '43000.00' },
  days: 58,
  risk: 'low',
  deltas: [
    {
      kind: 'changed',
      entityId: ENTITY_IDS.hvacDuct,
      note: 'HVAC supply duct rerouted south (+0.5m Z offset, +1.0m extra run).',
    },
    {
      kind: 'removed',
      entityId: ENTITY_IDS.legacyConduit,
      note: 'Legacy conduit L2 removed (clash source eliminated).',
    },
    {
      kind: 'changed',
      entityId: ENTITY_IDS.plumbingRiser,
      note: 'Plumbing riser insulated +1 layer (clash-avoidance buffer).',
    },
  ],
  constraints: [
    { note: 'Rerouted duct maintains 250mm clearance to plumbing riser.', severity: 'ok' },
    { note: 'Legacy conduit removal adds 5% cost (EUR 2000).', severity: 'ok' },
  ],
};

/**
 * Alternative B — replace the RTU HVAC with a split-system (interior unit
 * + smaller roof condenser). Cost -3% (EUR 39,800); programme +4 days
 * (64); risk MEDIUM (different routing, additional interior unit, longer
 * MEP install).
 */
export const VARIANT_ALT_B: ConstructionSolutionVariant = {
  variantId: 'variant-alt-b',
  label: 'Alternative B — split-system HVAC',
  description:
    'Replace the roof-top HVAC unit with a split-system (interior AHU + roof condenser). Smaller roof loading; longer install.',
  cost: { currency: 'EUR', total: '39800.00' },
  days: 64,
  risk: 'medium',
  deltas: [
    {
      kind: 'changed',
      entityId: ENTITY_IDS.hvacUnit,
      note: 'Roof-top HVAC unit downsized 60% (split-system condenser only).',
    },
    {
      kind: 'added',
      entityId: 'cs-mep-hvac-ahu-interior',
      note: 'New interior air-handling unit (AHU) added at ceiling level.',
    },
    {
      kind: 'changed',
      entityId: ENTITY_IDS.hvacDuct,
      note: 'HVAC duct shortened 40% (interior AHU shortens supply run).',
    },
    {
      kind: 'changed',
      entityId: ENTITY_IDS.ceiling,
      note: 'Ceiling system upgraded (acoustic + access tiles at AHU).',
    },
  ],
  constraints: [
    { note: 'Interior AHU adds ceiling load — verify hanger capacity.', severity: 'warn' },
    { note: 'Split-system 4-day install extension on critical path.', severity: 'warn' },
    { note: 'Cap-ex reduces 3%; life-cycle cost remains comparable.', severity: 'ok' },
  ],
};

/** The three solution variants (ACR-012 §8). */
export const VARIANTS: readonly ConstructionSolutionVariant[] = [
  VARIANT_CURRENT,
  VARIANT_ALT_A,
  VARIANT_ALT_B,
];
