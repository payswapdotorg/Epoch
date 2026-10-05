/**
 * The WEB WORLD HOST FIXTURE (W061 → W072, ACR-012) — the canonical
 * problem the `/world` route presents: the CONSTRUCTION SOLUTION world
 * (the frozen W071 `@epoch/construction-world-fixture` — Pioneer Block-A),
 * composed through the REAL stack:
 *
 * - the canonical W016 `WorldScene` (admitted + sealed through the real W016
 *   admission — the construction entities across the six construction
 *   layers, the hidden legacy-conduit clash risk, the declared structure-
 *   span measurement, the ground-slab state, the eight-phase programme
 *   timeline with its branch point, the two spatial agents, and the
 *   branch/simulate/pause scene controls);
 * - the REAL `RendererFabric` with the REAL interactive renderers
 *   registered (W058 Three.js + W059 Babylon.js — the same adapters the
 *   conformance batteries prove) plus the contract-only reference renderer
 *   as the final declared fallback;
 * - the full-fidelity DESKTOP-class device snapshot (the W013 binding).
 *
 * W072 evolution: this module WAS the W061 plant-room fixture; it is now
 * the CONSTRUCTION FIXTURE SEAM — every value re-exported from the frozen
 * W071 package (consume only, never modify). The export names keep the
 * W061 host/battery import surface stable while the values became the
 * construction fixture's (the entity/agent/control/overlay id vocabularies
 * and the renderer ids are the construction fixture's frozen constants).
 *
 * Marker-time note (the W016 ledger item, W057 advisory 3): every marker
 * time of the construction fixture is a uniform four-digit value, so the
 * lexicographic `${atMs}\0${markerId}` ordering of the W016 admission is
 * safe (see docs/journeys/interactive-world.md — the defect ledger).
 *
 * Deterministic: fixed seeds produce identical evidence.
 */
import {
  AGENT_IDS,
  BRANCH_AT_MS,
  CONSTRUCTION_LAYER_IDS,
  CONTROL_IDS,
  ENTITY_IDS,
  FIXTURE,
  MARKER_IDS,
  OVERLAY_IDS,
  RENDERER_PREFERENCE,
  SCENE_ID,
  TENANT,
  TRACK,
  buildHeadlessWorldFabric as buildConstructionHeadlessWorldFabric,
  buildWorldFabric as buildConstructionWorldFabric,
  type ConstructionWorldFabric,
  type ConstructionWorldFabricOptions,
} from '@epoch/construction-world-fixture';

// ---------------------------------------------------------------------------
// The construction-solution problem constants (the frozen W071 fixture).
// ---------------------------------------------------------------------------

export { TENANT, SCENE_ID, ENTITY_IDS, AGENT_IDS, OVERLAY_IDS, CONTROL_IDS, MARKER_IDS, BRANCH_AT_MS, TRACK };

/** The sealed canonical construction-solution scene (the W016 admission). */
export const SCENE = FIXTURE.scene;

/** The sealed canonical scene content (host evidence). */
export const SCENE_CONTENT = FIXTURE.sceneContent;

/** The pack-contributed W016 ontology (the representation-3d records). */
export const ONTOLOGY = FIXTURE.ontology;

/**
 * The six construction layers of the problem (the fixture's layer records;
 * the runtime DERIVES the same `lyr-` ids from the entity-type namespaces).
 */
export const LAYERS = CONSTRUCTION_LAYER_IDS;

// ---------------------------------------------------------------------------
// The renderers behind the seam: the REAL engines + the reference fallback
// (the W061 pattern — the frozen W071 construction fixture's own chain).
// ---------------------------------------------------------------------------

/** The W013 renderer ids of the REAL engine adapters (re-exported for hosts). */
export { THREE_RENDERER_ID, BABYLONJS_RENDERER_ID } from '@epoch/construction-world-fixture';

/** The W013 renderer id of the contract-only reference fallback presenter. */
export { REFERENCE_RENDERER_ID } from '@epoch/construction-world-fixture';

/** The renderer ids behind the seam, in the ordered preference/fallback chain. */
export { RENDERER_PREFERENCE };

/** The renderer ids whose presenters draw real engine pixels. */
export const ENGINE_RENDERER_IDS: readonly string[] = RENDERER_PREFERENCE.slice(0, 2);

/** The desktop-class device session the workspace binds (W013 snapshot). */
export const DEVICE = FIXTURE.device;

/** Whether one renderer id presents through a real engine (pixels). */
export function isEngineRenderer(rendererId: string): boolean {
  return (ENGINE_RENDERER_IDS as readonly string[]).includes(rendererId);
}

/**
 * The construction inputs of the web world fabric (the W061 shape over the
 * frozen W071 factory — the host injects the browser GL surfaces).
 */
export type WebWorldFabricOptions = ConstructionWorldFabricOptions;

/** The built fabric + its adapters (evidence helpers for hosts/tests). */
export type WebWorldFabric = ConstructionWorldFabric;

/**
 * Build the web world fabric: the REAL Three.js and Babylon.js renderers
 * registered through the REAL capability registry (the same adapters the
 * W058/W059 conformance batteries prove), plus the contract-only reference
 * renderer as the final declared fallback of the switching chain (the
 * frozen construction fixture's own registration).
 */
export function buildWorldFabric(
  options: WebWorldFabricOptions,
): WebWorldFabric {
  return buildConstructionWorldFabric(options);
}

/**
 * The HEADLESS construction default (tests, SSR-safe composition): the real
 * adapters with their deterministic cores — the Three.js adapter without a
 * GL surface factory and the Babylon.js adapter over the NullEngine host.
 */
export function buildHeadlessWorldFabric(): WebWorldFabric {
  return buildConstructionHeadlessWorldFabric();
}
