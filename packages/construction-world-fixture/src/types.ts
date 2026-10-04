/**
 * @epoch/construction-world-fixture — typed data shapes (W071, ACR-012).
 *
 * The typed projection records the construction-solution fixture carries
 * IN ADDITION to the W016 WorldScene vocabulary. These are FIXTURE-OWNED
 * renderer-neutral data (the work order's no-go rules: richer projection
 * data lives IN THE FIXTURE, never as contract changes). They are NOT
 * consumed by world-experience as semantic authority — they are
 * fixture-local composition values consumed by W072/W073 host renderers
 * to present equivalent geometry under Three.js and Babylon.js without
 * renderer-local authority.
 */
import type { Vec3, Quaternion } from '@epoch/experience-protocol';
import type {
  ConstructionLayerId,
  ConstructionPhaseId,
  ConstructionGeometryPrimitive,
  SolutionVariantId,
  SolutionRiskLevel,
  ConstraintSeverity,
  ConstraintCategory,
} from './version';

// ---------------------------------------------------------------------------
// Renderer-neutral geometry (per entity).
// ---------------------------------------------------------------------------

/** One fixture-owned renderer-neutral geometry record per entity. */
export interface ConstructionEntityGeometry {
  readonly entityId: string;
  /** The primitive shape description (consumed by both engines). */
  readonly primitive: ConstructionGeometryPrimitive;
  /** The entity's anchor position in world space (meters). */
  readonly position: Vec3;
  /** The entity's bounding-box size (meters; extents from anchor). */
  readonly bbox: Vec3;
  /** The entity's rotation as a quaternion (x,y,z,w). */
  readonly rotation: Quaternion;
  /** The entity's layer membership (one of the six canonical layers). */
  readonly layer: ConstructionLayerId;
  /** The construction phase the entity first appears in. */
  readonly phase: ConstructionPhaseId;
  /** Whether the entity is visible by default in the world viewport. */
  readonly visibleByDefault: boolean;
}

// ---------------------------------------------------------------------------
// The construction entity's engineering projection (ACR-012 §4 fields).
// The fixture carries these as fixture-local composition values; they are
// NOT consumed by world-experience as semantic authority. The host
// inspector renders them as a projection of the same world.
// ---------------------------------------------------------------------------

/** The construction material of one entity (fixture-local). */
export interface ConstructionMaterial {
  readonly name: string;
  readonly grade: string;
}

/** The quantity of one entity (fixture-local; matches the BOQ line item). */
export interface ConstructionQuantity {
  readonly value: string;
  readonly unit: string;
}

/** The cost reference of one entity (fixture-local; canonical plan-line id). */
export interface ConstructionCostReference {
  readonly lineId: string;
  readonly currency: string;
  readonly amount: string;
}

/** The engineering projection of one construction entity (ACR-012 §4). */
export interface ConstructionEntityProjection {
  readonly entityId: string;
  readonly entityType: string;
  readonly label: string;
  readonly material: ConstructionMaterial;
  readonly dimensions: Vec3;
  readonly quantity: ConstructionQuantity;
  readonly phase: ConstructionPhaseId;
  readonly status: 'pending' | 'in-progress' | 'complete' | 'blocked';
  readonly cost: ConstructionCostReference;
  readonly constraints: readonly string[];
}

// ---------------------------------------------------------------------------
// The construction layer (layer-navigator data).
// ---------------------------------------------------------------------------

/** One construction layer record (layer navigator). */
export interface ConstructionLayer {
  readonly layerId: ConstructionLayerId;
  readonly label: string;
  readonly description: string;
  /** The entity IDs that belong to this layer (sorted ascending). */
  readonly entityIds: readonly string[];
}

// ---------------------------------------------------------------------------
// The construction phase timeline (reuses W016 marker vocabulary).
// ---------------------------------------------------------------------------

/** One construction phase record (the fixture-local timeline composition). */
export interface ConstructionPhase {
  readonly phaseId: ConstructionPhaseId;
  readonly label: string;
  /** The virtual-time marker id (reuses the W016 timeline marker). */
  readonly markerId: string;
  /** The virtual-time marker ms (reuses the W016 timeline marker). */
  readonly atMs: number;
  /** The entity IDs that first appear / complete during this phase. */
  readonly entityIds: readonly string[];
}

// ---------------------------------------------------------------------------
// The spatial agent (reuses W016 agent presence vocabulary).
// ---------------------------------------------------------------------------

/** One spatial construction agent (the spatial-world presence). */
export interface ConstructionAgent {
  readonly agentId: string;
  readonly label: string;
  readonly role: string;
  /** The agent's anchor position in world space (meters). */
  readonly position: Vec3;
  /** The entity the agent is currently working on (entityId). */
  readonly currentWorkEntityId: string;
  /** The agent's task description (free text; the inspector renders it). */
  readonly task: string;
  /** The agent's deterministic movement script (virtual-time waypoints). */
  readonly movementScript: readonly { readonly atMs: number; readonly position: Vec3 }[];
}

// ---------------------------------------------------------------------------
// The solution variant (Current / Alternative A / Alternative B).
// ---------------------------------------------------------------------------

/** One world-state delta of a solution variant. */
export interface SolutionVariantDelta {
  readonly kind: 'added' | 'removed' | 'changed';
  readonly entityId: string;
  readonly note: string;
}

/** One solution variant (ACR-012 §8). */
export interface ConstructionSolutionVariant {
  readonly variantId: SolutionVariantId;
  readonly label: string;
  readonly description: string;
  /** The variant's deterministic cost (currency + total). */
  readonly cost: { readonly currency: string; readonly total: string };
  /** The variant's deterministic programme duration (days). */
  readonly days: number;
  /** The variant's risk level (low/medium/high). */
  readonly risk: SolutionRiskLevel;
  /** The variant's world-state deltas (vs the Current baseline). */
  readonly deltas: readonly SolutionVariantDelta[];
  /** The variant-level constraints (free text + severity). */
  readonly constraints: readonly { readonly note: string; readonly severity: ConstraintSeverity }[];
}

// ---------------------------------------------------------------------------
// The BOQ rollup (per-layer) + line items (referencing existing
// construction-pack/solution-delivery structures).
// ---------------------------------------------------------------------------

/** One BOQ line item (identity-mapped to its canonical plan-line id). */
export interface ConstructionBoqLineItem {
  readonly lineId: string;
  readonly title: string;
  readonly sectionCode: string;
  readonly unit: string;
  readonly quantity: string;
  readonly rate: { readonly amount: string; readonly currency: string };
  readonly amount: { readonly amount: string; readonly currency: string };
  readonly entityId: string;
}

/** One per-layer BOQ rollup. */
export interface ConstructionBoqLayerRollup {
  readonly layerId: ConstructionLayerId;
  readonly label: string;
  readonly lineItems: readonly ConstructionBoqLineItem[];
  readonly subtotal: { readonly amount: string; readonly currency: string };
}

// ---------------------------------------------------------------------------
// The constraint / finding record (ACR-012 §8).
// ---------------------------------------------------------------------------

/** One constraint / finding record (OK + WARN severities). */
export interface ConstructionConstraintRecord {
  readonly constraintId: string;
  readonly severity: ConstraintSeverity;
  readonly category: ConstraintCategory;
  readonly title: string;
  readonly description: string;
  /** The entity IDs the finding references (spatially discoverable). */
  readonly entityIds: readonly string[];
}
