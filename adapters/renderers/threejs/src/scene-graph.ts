/**
 * Scene mounting (W058) — canonical envelopes -> the Three.js scene graph.
 *
 * THE MAPPING RULE (the architecture lock's Experience projection rule made
 * concrete): the adapter builds its provider-native presentation ONLY from
 * the ADMITTED typed data of the mount input — the compiled W011 '3d'
 * Experience Graph (which the W016 compiler already resolved through the
 * ontology: primitives, placement, material colors/opacities, overlay
 * attributes) plus the canonical scene's non-graph presentation aspects
 * (camera, timeline, agents, participants, focus). The adapter never
 * re-resolves the ontology and NEVER mutates the canonical scene: mount is
 * pure with respect to it (a frozen copy is byte-identical afterwards).
 *
 * EVERY presented Object3D carries its semantic identity (`src/semantics.ts`)
 * — entity meshes their entity id, agent representations their agent id —
 * and nothing in the graph is semantic state: it is disposable presentation,
 * rebuilt from the canonical projection on every mount, torn down fully at
 * dispose (`src/resources.ts`).
 */
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type Material,
} from 'three';
import type { RendererMountInput } from '@epoch/renderer-fabric';
import type {
  PortableViewState,
  RendererDegradationKind,
} from '@epoch/renderer-runtime';
import type {
  AnimationInstruction,
  SceneEntity,
  WorldScene,
} from '@epoch/world-experience';
import type { ExperienceGraph, Vec3 } from '@epoch/experience-protocol';
import {
  CameraControls,
  initialCameraOf,
} from './camera';
import {
  markAgentNode,
  markEntityNode,
  setPresentationBadge,
  setPresentationLabel,
} from './semantics';
import type { GpuResourceLedger } from './resources';
import {
  FULL_FIDELITY_SEGMENTS,
} from './version';

/** The neutral default presentation color of an entity without material attributes. */
export const PRESENTATION_DEFAULT_COLOR = '#9aa3ad' as const;

/** The deterministic presentation layer of one entity type ('ns:name' -> 'lyr-name'). */
export function layerOfEntityType(entityType: string): string {
  const name = entityType.includes(':') ? entityType.split(':')[1]! : entityType;
  return `lyr-${name}`;
}

/** The presentation focus-ring color (presentation-only constant). */
export const FOCUS_RING_COLOR = '#4da3ff' as const;

/** The agent-marker color (presentation-only constant). */
export const AGENT_MARKER_COLOR = '#8e6bff' as const;

/** The presence-seat marker color (presentation-only constant). */
export const PRESENCE_MARKER_COLOR = '#6fd3a8' as const;

/** The measurement-line color (presentation-only constant). */
export const MEASUREMENT_LINE_COLOR = '#ffd166' as const;

/** One mounted presentation: the adapter's ENTIRE provider-native state. */
export interface ThreePresentation {
  /** The root scene (the only object a host renderer draws). */
  readonly root: Scene;
  /** The group of semantic entity meshes (the hit-testable world). */
  readonly worldGroup: Group;
  /** The group of agent representations and presence markers. */
  readonly presenceGroup: Group;
  /** The presentation camera controls (orbit/pan/zoom state). */
  readonly controls: CameraControls;
  /** The GPU resource ledger (full teardown evidence). */
  readonly ledger: GpuResourceLedger;
  /** The canonical world digest this presentation was built from. */
  readonly mountedWorldDigest: string;
  /** The presented semantic entity ids (sorted; from the admitted 3d graph). */
  readonly presentedEntityIds: readonly string[];
  /** The entity presentation nodes by semantic entity id. */
  readonly entityNodes: ReadonlyMap<string, Mesh>;
  /** The opaque entity-type key of each presented entity (layer derivation). */
  readonly entityTypes: ReadonlyMap<string, string>;
  /** The presentation label of each presented entity (host chrome renders text). */
  readonly entityLabels: ReadonlyMap<string, string>;
  /** The agent representation nodes by agent id. */
  readonly agentNodes: ReadonlyMap<string, Mesh>;
  /** The presence-seat marker nodes by participant id. */
  readonly participantNodes: ReadonlyMap<string, Mesh>;
  /** The animation instructions targeting presented entities (virtual-time playback). */
  readonly animations: readonly AnimationInstruction[];
  /** The canonical replay-track window (key normalization + timeline clamping). */
  readonly trackStartMs: number;
  readonly trackEndMs: number;
  /** The presentation timeline cursor (disposable; the portable state is authoritative at restore). */
  timelineAtMs: number;
  timelinePaused: boolean;
  /** The currently applied degradation (typed; 'none' = full fidelity). */
  degradation: RendererDegradationKind;
  /** The current radial segment count of curved primitives (the LOD state). */
  lodSegments: number;
  /** The canonical entities (opaque references for evidence; never mutated). */
  readonly entities: readonly SceneEntity[];
}

/** The compiled W011 graph of one kind (null when the scene produced none). */
function graphOfKind(input: RendererMountInput, graphKind: string): ExperienceGraph | null {
  return input.compilation.graphs.find((graph) => graph.graphKind === graphKind) ?? null;
}

/** The deterministic world position of one entity's presentation node. */
export function worldPositionOf(presentation: ThreePresentation, entityId: string): Vec3 | undefined {
  const node = presentation.entityNodes.get(entityId);
  if (node === undefined) {
    return undefined;
  }
  return [node.position.x, node.position.y, node.position.z];
}

/** Build the geometry of one spatial primitive at a radial segment count. */
function geometryOfPrimitive(
  primitive: string,
  segments: number,
  ledger: GpuResourceLedger,
): BufferGeometry {
  switch (primitive) {
    case 'sphere':
      return ledger.registerGeometry(new SphereGeometry(0.5, segments, Math.max(4, segments / 2)));
    case 'cone':
      return ledger.registerGeometry(new ConeGeometry(0.5, 1, segments));
    case 'cylinder':
      return ledger.registerGeometry(new CylinderGeometry(0.5, 0.5, 1, segments));
    case 'plane':
      return ledger.registerGeometry(new PlaneGeometry(1, 1));
    case 'mesh':
      // A content-addressed mesh binding without a bound asset presents as
      // a deterministic placeholder box (the real mesh pipeline is the W060
      // asset-bridge surface; the placeholder is typed presentation, never
      // a silent substitution of semantics).
      return ledger.registerGeometry(new BoxGeometry(1, 1, 1));
    case 'box':
    default:
      return ledger.registerGeometry(new BoxGeometry(1, 1, 1));
  }
}

/** The attribute key of one spatial node (typed, from the admitted graph). */
function attrOf(node: { attributes?: Record<string, unknown> }, key: string): string | undefined {
  const value = node.attributes?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** The numeric attribute of one spatial node (typed, from the admitted graph). */
function attrNumberOf(node: { attributes?: Record<string, unknown> }, key: string): number | undefined {
  const value = node.attributes?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Mount the presentation from the canonical mount input (pure with respect
 * to the canonical scene — the frozen-copy proof lives in the batteries).
 */
export function mountPresentation(
  input: RendererMountInput,
  ledger: GpuResourceLedger,
): ThreePresentation {
  const scene: WorldScene = input.scene;
  const root = new Scene();
  const worldGroup = new Group();
  const presenceGroup = new Group();
  root.add(worldGroup);
  root.add(presenceGroup);

  const entityNodes = new Map<string, Mesh>();
  const entityTypes = new Map<string, string>();
  const entityLabels = new Map<string, string>();

  // --- semantic entity meshes from the ADMITTED 3d graph. -----------------
  const spatialGraph = graphOfKind(input, '3d');
  const typeByEntity = new Map<string, string>();
  for (const entity of scene.entities) {
    typeByEntity.set(entity.entityId, entity.entityType);
  }
  for (const node of spatialGraph?.nodes ?? []) {
    if (node.kind !== 'spatial-3d' || node.ref?.kind !== 'world-entity') {
      continue;
    }
    const entityId = node.ref.entityId;
    const descriptor = node.descriptor;
    const geometry = geometryOfPrimitive(descriptor.primitive, FULL_FIDELITY_SEGMENTS, ledger);
    const color = attrOf(node, 'material-color') ?? PRESENTATION_DEFAULT_COLOR;
    const opacity = attrNumberOf(node, 'material-opacity');
    const material = ledger.registerMaterial(
      new MeshStandardMaterial({
        color,
        ...(opacity !== undefined && opacity < 1
          ? { transparent: true, opacity: Math.min(1, Math.max(0, opacity)) }
          : {}),
      }),
    );
    const mesh = new Mesh(geometry, material);
    mesh.userData['epochPrimitive'] = descriptor.primitive;
    mesh.position.set(descriptor.position[0], descriptor.position[1], descriptor.position[2]);
    if (descriptor.orientation !== undefined) {
      mesh.quaternion.set(
        descriptor.orientation[0],
        descriptor.orientation[1],
        descriptor.orientation[2],
        descriptor.orientation[3],
      );
    }
    if (descriptor.scale !== undefined) {
      mesh.scale.set(descriptor.scale[0], descriptor.scale[1], descriptor.scale[2]);
    }
    markEntityNode(mesh, entityId);
    // Overlay attributes from the admitted graph (deterministic decoration).
    const highlight = attrOf(node, 'overlay-highlight-color');
    if (highlight !== undefined) {
      attachTintShell(mesh, highlight, ledger);
    }
    const stateTint = attrOf(node, 'overlay-state-tint');
    const stateKey = attrOf(node, 'overlay-state-key');
    if (stateTint !== undefined) {
      applyStateTint(mesh, stateTint);
    }
    if (stateKey !== undefined) {
      setPresentationBadge(mesh, stateKey);
    }
    const measureTo = attrOf(node, 'overlay-measure-to');
    if (measureTo !== undefined) {
      mesh.userData['epochMeasureTo'] = measureTo;
      const measureLabel = attrOf(node, 'overlay-measure-label');
      if (measureLabel !== undefined) {
        mesh.userData['epochMeasureLabel'] = measureLabel;
      }
    }
    const entityType = typeByEntity.get(entityId);
    if (entityType !== undefined) {
      entityTypes.set(entityId, entityType);
    }
    worldGroup.add(mesh);
    entityNodes.set(entityId, mesh);
  }

  // --- labels (entity labels + annotation overlays) as presentation text. -
  // Entity labels are 'label' nodes ANCHORED to their entity nodes by
  // 'anchors' edges (they carry no direct ref); annotation labels carry the
  // entity ref directly. Both become presentation text on the entity; an
  // entity's OWN label wins over an annotation overlay's text
  // (deterministic precedence).
  const entityOfNodeId = new Map<string, string>();
  for (const node of spatialGraph?.nodes ?? []) {
    if (node.kind === 'spatial-3d' && node.ref?.kind === 'world-entity') {
      entityOfNodeId.set(node.id, node.ref.entityId);
    }
  }
  const labelNodes = (spatialGraph?.nodes ?? []).filter(
    (node): node is Extract<typeof node, { kind: 'label' }> => node.kind === 'label',
  );
  const applyLabel = (nodeId: string, entityId: string): void => {
    const labelNode = labelNodes.find((candidate) => candidate.id === nodeId);
    const text = labelNode?.descriptor.text;
    const target = entityNodes.get(entityId);
    if (text !== undefined && target !== undefined) {
      setPresentationLabel(target, text);
      entityLabels.set(entityId, text);
    }
  };
  // Pass 1: edge-anchored entity labels (the entity's own label wins).
  for (const edge of spatialGraph?.edges ?? []) {
    if (edge.kind !== 'anchors') {
      continue;
    }
    if (!labelNodes.some((candidate) => candidate.id === edge.from)) {
      continue;
    }
    const entityId = entityOfNodeId.get(edge.to);
    if (entityId !== undefined && !entityLabels.has(entityId)) {
      applyLabel(edge.from, entityId);
    }
  }
  // Pass 2: directly-referenced annotation labels (only where no entity
  // label exists).
  for (const node of labelNodes) {
    if (node.ref?.kind === 'world-entity' && !entityLabels.has(node.ref.entityId)) {
      applyLabel(node.id, node.ref.entityId);
    }
  }

  // --- the presented set (sorted; the admitted graph's projected refs). ---
  const presentedEntityIds = [
    ...(spatialGraph?.projectedFrom ?? []).flatMap((ref) =>
      ref.kind === 'world-entity' ? [ref.entityId] : [],
    ),
  ].sort();

  // --- visible agent representations + presence markers (deterministic). --
  const agentNodes = new Map<string, Mesh>();
  const participantNodes = new Map<string, Mesh>();
  const centroid = centroidOf(scene, presentedEntityIds);
  scene.agents.forEach((agent, index) => {
    const marker = new Mesh(
      ledger.registerGeometry(new OctahedronGeometry(0.6)),
      ledger.registerMaterial(new MeshStandardMaterial({ color: AGENT_MARKER_COLOR })),
    );
    marker.position.set(centroid[0] + (index - (scene.agents.length - 1) / 2) * 2, centroid[1] + 3, centroid[2]);
    markAgentNode(marker, agent.agentId);
    setPresentationLabel(marker, agent.agentId);
    presenceGroup.add(marker);
    agentNodes.set(agent.agentId, marker);
  });
  scene.participants.forEach((participant, index) => {
    const marker = new Mesh(
      ledger.registerGeometry(new BoxGeometry(0.4, 0.4, 0.4)),
      ledger.registerMaterial(new MeshStandardMaterial({ color: PRESENCE_MARKER_COLOR })),
    );
    marker.position.set(
      centroid[0] + (index - (scene.participants.length - 1) / 2) * 1.2,
      centroid[1] + 4.5,
      centroid[2],
    );
    setPresentationLabel(marker, participant.participantId);
    presenceGroup.add(marker);
    participantNodes.set(participant.participantId, marker);
  });

  // --- the presentation camera from the canonical W016 camera. ------------
  const initial = initialCameraOf(scene.camera, centroid);
  const controls = new CameraControls(initial.position, initial.target, initial.fovRadians);

  // --- animations targeting presented entities (virtual-time playback). --
  const presented = new Set(presentedEntityIds);
  const animations = scene.animations.filter((instruction) => presented.has(instruction.targetEntityId));

  // --- measurement lines between overlay-measured entity pairs. -----------
  for (const [entityId, node] of entityNodes) {
    const to = node.userData['epochMeasureTo'];
    if (typeof to !== 'string') {
      continue;
    }
    const target = entityNodes.get(to);
    if (target === undefined) {
      continue;
    }
    attachMeasurementLine(worldGroup, node, target, ledger, entityId);
  }

  return {
    root,
    worldGroup,
    presenceGroup,
    controls,
    ledger,
    mountedWorldDigest: input.compilation.sceneDigest,
    presentedEntityIds,
    entityNodes,
    entityTypes,
    entityLabels,
    agentNodes,
    participantNodes,
    animations,
    trackStartMs: scene.timeline.trackStartMs,
    trackEndMs: scene.timeline.trackEndMs,
    timelineAtMs: scene.timeline.position.atMs,
    timelinePaused: scene.timeline.position.paused,
    degradation: 'none',
    lodSegments: FULL_FIDELITY_SEGMENTS,
    entities: scene.entities,
  };
}

/** The deterministic centroid of the presented entities (fallback origin). */
function centroidOf(scene: WorldScene, presentedEntityIds: readonly string[]): Vec3 {
  const presented = new Set(presentedEntityIds);
  const positions = scene.entities.filter((entity) => presented.has(entity.entityId));
  if (positions.length === 0) {
    return [0, 0, 0];
  }
  let x = 0;
  let y = 0;
  let z = 0;
  for (const entity of positions) {
    x += entity.position[0];
    y += entity.position[1];
    z += entity.position[2];
  }
  return [x / positions.length, y / positions.length, z / positions.length];
}

/** Attach a translucent tint shell to one entity mesh (highlight overlays). */
function attachTintShell(mesh: Mesh, color: string, ledger: GpuResourceLedger): void {
  const shell = new Mesh(
    mesh.geometry,
    ledger.registerMaterial(
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
    ),
  );
  shell.scale.setScalar(1.05);
  mesh.add(shell);
}

/** Apply a state-overlay tint to one entity mesh (emissive tint + badge). */
function applyStateTint(mesh: Mesh, tint: string): void {
  const material = mesh.material;
  if (material instanceof MeshStandardMaterial) {
    material.emissive.set(tint);
    material.emissiveIntensity = 0.35;
  }
}

/** Attach a measurement line between two entity meshes (presentation-only,
 * anchored in world space at mount time; it carries the source entity's
 * semantic id so hit-testing it resolves to that entity). */
function attachMeasurementLine(
  worldGroup: Group,
  from: Mesh,
  to: Mesh,
  ledger: GpuResourceLedger,
  fromEntityId: string,
): void {
  const geometry = ledger.registerGeometry(new BufferGeometry());
  geometry.setFromPoints([from.position.clone(), to.position.clone()]);
  const material = ledger.registerMaterial(new LineBasicMaterial({ color: MEASUREMENT_LINE_COLOR }));
  const line = new Line(geometry, material);
  line.userData['epochMeasurementOf'] = fromEntityId;
  markEntityNode(line, fromEntityId);
  worldGroup.add(line);
}

// ---------------------------------------------------------------------------
// Focus decorations (presentation-only, rebuilt on focus changes).
// ---------------------------------------------------------------------------

/** Rebuild the focus decorations of the world group for one focus set. */
export function applyFocusDecorations(
  presentation: ThreePresentation,
  focusedEntityIds: readonly string[],
): void {
  // Remove existing focus rings (the child meshes flagged as focus rings).
  for (const node of presentation.entityNodes.values()) {
    for (const child of [...node.children]) {
      if (child.userData['epochFocusRing'] === true) {
        node.remove(child);
      }
    }
  }
  for (const entityId of focusedEntityIds) {
    const node = presentation.entityNodes.get(entityId);
    if (node === undefined) {
      continue;
    }
    const ring = new Mesh(
      node.geometry,
      presentation.ledger.registerMaterial(
        new MeshBasicMaterial({
          color: FOCUS_RING_COLOR,
          wireframe: true,
          transparent: true,
          opacity: 0.9,
        }),
      ),
    );
    ring.scale.setScalar(1.15);
    ring.userData['epochFocusRing'] = true;
    node.add(ring);
  }
}

// ---------------------------------------------------------------------------
// View-state application (mount seeding + switch restore — one code path).
// ---------------------------------------------------------------------------

/**
 * Apply the portable view state to the presentation: focus decorations,
 * layer visibility (via the deterministic entity-type -> layer mapping),
 * hidden-entity presentation flags, and the portable camera. Presentation
 * only — never a semantic write.
 */
export function applyViewStateToPresentation(
  presentation: ThreePresentation,
  viewState: PortableViewState,
  fields: readonly ('camera' | 'focused-entities' | 'layer-visibility' | 'timeline-position')[],
): void {
  if (fields.includes('focused-entities')) {
    applyFocusDecorations(presentation, viewState.focusedEntityIds);
  }
  if (fields.includes('layer-visibility')) {
    const visibility = new Map<string, boolean>(
      viewState.layerVisibility.map((layer) => [layer.layerId, layer.visible]),
    );
    const hidden = new Set(viewState.hiddenEntityIds);
    const entityVisible = new Map<string, boolean>();
    for (const [entityId, node] of presentation.entityNodes) {
      const layerId = presentation.entityTypes.has(entityId)
        ? layerOfEntityType(presentation.entityTypes.get(entityId)!)
        : undefined;
      const layerVisible = layerId !== undefined ? (visibility.get(layerId) ?? true) : true;
      const visible = layerVisible && !hidden.has(entityId);
      node.visible = visible;
      entityVisible.set(entityId, visible);
    }
    // Decorations carrying a semantic entity id (e.g. world-anchored
    // measurement lines) follow their entity's visibility.
    for (const child of presentation.worldGroup.children) {
      const ownerId = child.userData['epochMeasurementOf'];
      if (typeof ownerId === 'string' && entityVisible.has(ownerId)) {
        child.visible = entityVisible.get(ownerId)!;
      }
    }
  }
  if (fields.includes('timeline-position')) {
    presentation.timelineAtMs = Math.min(
      presentation.trackEndMs,
      Math.max(presentation.trackStartMs, viewState.timelinePosition.atMs),
    );
    presentation.timelinePaused = viewState.timelinePosition.paused;
  }
  if (fields.includes('camera') && viewState.camera !== undefined) {
    presentation.controls.applyPortableCamera(viewState.camera);
  }
}

/** Whether one entity's presentation node is currently visible. */
export function isEntityVisible(presentation: ThreePresentation, entityId: string): boolean {
  const node = presentation.entityNodes.get(entityId);
  if (node === undefined) {
    return false;
  }
  let visible = node.visible;
  let parent = node.parent;
  while (visible && parent !== null) {
    visible = parent.visible;
    parent = parent.parent;
  }
  return visible;
}

/** The presentation material color of one entity (evidence helper). */
export function materialColorOf(presentation: ThreePresentation, entityId: string): string | undefined {
  const node = presentation.entityNodes.get(entityId);
  if (node === undefined) {
    return undefined;
  }
  const material: Material | Material[] = node.material;
  const single = Array.isArray(material) ? material[0] : material;
  return single instanceof MeshStandardMaterial ? `#${single.color.getHexString()}` : undefined;
}

/** Whether one entity's presentation material is wireframe (evidence helper). */
export function isWireframe(presentation: ThreePresentation, entityId: string): boolean {
  const node = presentation.entityNodes.get(entityId);
  if (node === undefined) {
    return false;
  }
  const material: Material | Material[] = node.material;
  const single = Array.isArray(material) ? material[0] : material;
  return single instanceof MeshStandardMaterial ? single.wireframe : false;
}
