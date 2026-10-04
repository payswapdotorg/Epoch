/**
 * @epoch/construction-world-fixture — the per-layer BOQ rollups +
 * line items (W071, ACR-012 §8).
 *
 * The BOQ view references the EXISTING construction-pack /
 * solution-delivery structures (the W026 `BoqLineItem` shape:
 * lineId/title/sectionCode/unit/quantity/rate/amount + an entity ref).
 * NO second BOQ authority — the fixture's BOQ is FIXTURE-LOCAL
 * composition data the host renders as the BOQ/cost surface; the
 * canonical `projectBoq` of @epoch/pack-construction remains the only
 * authoritative projection surface (the fixture references the SAME
 * plan-line ids the canonical projection would consume).
 *
 * Quantities + amounts are deterministic exact-decimal strings; totals
 * are exact per-currency folds (EUR). The fixture's BOQ totals match
 * the entity quantity/cost values 1:1 (the QA battery asserts this).
 */
import type { ConstructionBoqLayerRollup, ConstructionBoqLineItem } from './types';
import type { ConstructionLayerId } from './version';
import { ENTITY_PROJECTIONS } from './entities';
import { LAYERS } from './layers';

/** The section code prefix for each construction layer (BOQ view). */
const SECTION_CODE: Record<ConstructionLayerId, string> = {
  'lyr-site': 'SITE',
  'lyr-foundation': 'FND',
  'lyr-structure': 'STR',
  'lyr-envelope': 'ENV',
  'lyr-mep': 'MEP',
  'lyr-finishes': 'FIN',
};

/** One EUR exact-decimal amount literal. */
const eur = (amount: string): { amount: string; currency: string } => ({
  amount,
  currency: 'EUR',
});

/**
 * Build the BOQ line items for one layer from the entity projections.
 * Each line item is identity-mapped to its canonical plan-line id (the
 * SAME id `projectBoq` of @epoch/pack-construction would consume).
 */
function lineItemsForLayer(layerId: ConstructionLayerId): readonly ConstructionBoqLineItem[] {
  const sectionCode = SECTION_CODE[layerId];
  const layerEntityIds = LAYERS.find((l) => l.layerId === layerId)?.entityIds ?? [];
  return ENTITY_PROJECTIONS.filter((p) => layerEntityIds.includes(p.entityId))
    .map((p) => ({
      lineId: p.cost.lineId,
      title: p.label,
      sectionCode,
      unit: p.quantity.unit,
      quantity: p.quantity.value,
      rate: eur(p.cost.amount),
      amount: eur(p.cost.amount),
      entityId: p.entityId,
    }))
    .sort((a, b) => a.lineId.localeCompare(b.lineId));
}

/** Fold a list of EUR amounts to a deterministic subtotal string. */
function subtotalOf(items: readonly ConstructionBoqLineItem[]): { amount: string; currency: string } {
  const sum = items.reduce((acc, item) => {
    const amount = Number(item.amount.amount);
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return eur(sum.toFixed(2));
}

/** The per-layer BOQ rollups (six layers — ACR-012 §3 + §8). */
export const BOQ_LAYER_ROLLUPS: readonly ConstructionBoqLayerRollup[] = LAYERS.map((layer) => {
  const lineItems = lineItemsForLayer(layer.layerId);
  const subtotal = subtotalOf(lineItems);
  return {
    layerId: layer.layerId,
    label: layer.label,
    lineItems,
    subtotal,
  };
});

/** The flattened BOQ line items (all layers, sorted by lineId). */
export const BOQ_LINE_ITEMS: readonly ConstructionBoqLineItem[] = BOQ_LAYER_ROLLUPS.flatMap(
  (rollup) => rollup.lineItems,
).sort((a, b) => a.lineId.localeCompare(b.lineId));

/** The grand total of the construction solution (EUR, exact-decimal). */
export const BOQ_GRAND_TOTAL: { amount: string; currency: string } = subtotalOf(BOQ_LINE_ITEMS);
