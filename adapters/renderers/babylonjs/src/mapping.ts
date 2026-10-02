/**
 * Semantic scene-graph mapping (W059) — canonical projection -> Babylon.js.
 *
 * THE SEMANTIC MAPPING RULE (work order requirement 1): every Babylon
 * mesh/node the adapter presents for a world entity CARRIES ITS SEMANTIC
 * ENTITY ID in `metadata.epochEntityId` (plus the entity's content digest),
 * so Babylon picking resolves straight back to canonical semantic identity.
 * Agent representations carry `metadata.epochAgentId` (agents are projected
 * participants, not world entities — they are deliberately NOT pickable as
 * entities).
 *
 * Inputs are the ADMITTED typed structures only (the W013 boundary already
 * admitted the mount): the compiled W011 graphs of the mounted revision
 * (the render-ready presentation source) plus the canonical scene for the
 * agent references, camera, and timeline. The canonical scene object is
 * NEVER mutated (mount is pure with respect to it); all Babylon nodes are
 * provider-native, disposable presentation state.
 *
 * Determinism: unit extents, agent ring placement, material derivation and
 * animation frame numbers are fixed formulas — zero wall-clock, zero
 * randomness. The same projection always builds the same scene graph.
 */
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { ExperienceNode, ProjectedAgentRef } from '@epoch/experience-protocol';
import type { SceneCompilation, WorldScene } from '@epoch/world-experience';

/** One spatial-3d graph node (the compiled spatial descriptor + entity ref). */
type SpatialNode = ExperienceNode & { kind: 'spatial-3d' };

/** Deterministic unit extent of a primitive when no scale is declared. */
export const UNIT_EXTENT = 4;

/** Deterministic agent-ring geometry (agents carry no projected position). */
const AGENT_RING_RADIUS = 8;
const AGENT_RING_HEIGHT = 2;

/** The semantic metadata every entity mesh carries (the mapping contract). */
export interface BabylonEntityMetadata {
  readonly epochEntityId: string;
  readonly epochEntityDigest: string;
  readonly epochPrimitive: string;
  readonly epochLabel?: string;
}

/** The metadata every agent representation carries. */
export interface BabylonAgentMetadata {
  readonly epochAgentId: string;
  readonly epochAgentDigest: string;
  readonly epochAgentTenantId: string;
}

/** One recorded anchored label (entity label or annotation overlay). */
export interface BabylonLabelRecord {
  readonly nodeId: string;
  readonly text: string;
  readonly anchoredEntityId?: string;
  readonly offset: readonly [number, number, number];
}

/** One mapped animation clip record (Babylon Animation objects per track). */
export interface BabylonClipRecord {
  readonly clipNodeId: string;
  readonly durationMs: number;
  readonly tracks: readonly {
    readonly propertyPath: string;
    readonly targetEntityId: string | undefined;
    readonly animation: Animation;
    readonly keyframeCount: number;
  }[];
}

/** The built presentation of one mounted projection. */
export interface BabylonPresentation {
  /** Semantic entity id -> its pickable Babylon mesh (visible entities). */
  readonly entityMeshes: ReadonlyMap<string, Mesh>;
  /** Agent id -> its (non-entity) Babylon representation. */
  readonly agentMeshes: ReadonlyMap<string, Mesh>;
  /** The sorted presented semantic entity ids. */
  readonly presentedEntityIds: readonly string[];
  /** The anchored labels (entity labels + annotation overlays). */
  readonly labels: readonly BabylonLabelRecord[];
  /** The mapped animation clips. */
  readonly clips: readonly BabylonClipRecord[];
  /** The recorded timeline marker ids (presentation state). */
  readonly timelineMarkerIds: readonly string[];
  /** The recorded narrative beat ids (presentation state). */
  readonly narrativeBeatIds: readonly string[];
  /** The recorded control node ids (surfaced to the Epoch chrome). */
  readonly controlIds: readonly string[];
  /** Neutral build notes (presentation-only diagnostics). */
  readonly notes: readonly string[];
}

/** The entity-mesh root node name (all entity meshes parent here). */
export const ENTITY_ROOT_NAME = 'epoch-entities';

/** The agent-mesh root node name. */
export const AGENT_ROOT_NAME = 'epoch-agents';

/** Build (or rebuild) the presentation from the compiled graphs + scene. */
export function buildPresentation(
  babylonScene: Scene,
  compilation: SceneCompilation,
  scene: WorldScene,
): BabylonPresentation {
  // Dispose any previous presentation nodes (provider-native state is
  // disposable by construction; a remount rebuilds from the canonical data).
  disposeChildrenOf(babylonScene, ENTITY_ROOT_NAME);
  disposeChildrenOf(babylonScene, AGENT_ROOT_NAME);
  const entityRoot = rootOf(babylonScene, ENTITY_ROOT_NAME);
  const agentRoot = rootOf(babylonScene, AGENT_ROOT_NAME);

  const spatialGraph = compilation.graphs.find((g) => g.graphKind === '3d');
  const animationGraph = compilation.graphs.find((g) => g.graphKind === 'animation');
  const timelineGraph = compilation.graphs.find((g) => g.graphKind === 'timeline-replay');
  const narrativeGraph = compilation.graphs.find((g) => g.graphKind === 'narrative');
  const presenceGraph = compilation.graphs.find((g) => g.graphKind === 'presence');
  const controlsGraph = compilation.graphs.find((g) => g.graphKind === 'controls');

  const notes: string[] = [];
  const entityMeshes = new Map<string, Mesh>();
  const labels: BabylonLabelRecord[] = [];

  // --- the spatial graph: entity meshes + anchored labels -----------------
  if (spatialGraph !== undefined) {
    const anchorTargets = new Map<string, string>(); // nodeId -> entityId (of spatial nodes)
    for (const node of spatialGraph.nodes) {
      if (node.kind === 'spatial-3d' && node.ref?.kind === 'world-entity') {
        anchorTargets.set(node.id, node.ref.entityId);
      }
    }
    for (const node of spatialGraph.nodes) {
      if (node.kind === 'spatial-3d') {
        const mesh = buildEntityMesh(babylonScene, entityRoot, node, notes);
        if (mesh !== null) {
          entityMeshes.set(entityIdOf(node)!, mesh);
        }
      } else if (node.kind === 'label') {
        const anchored = node.ref?.kind === 'world-entity' ? node.ref.entityId : undefined;
        labels.push({
          nodeId: node.id,
          text: node.descriptor.text,
          anchoredEntityId: anchored,
          offset: node.descriptor.offset3d ?? [0, 1, 0],
        });
      }
    }
  }

  // --- visible agent representations (canonical scene refs) ---------------
  const agentMeshes = new Map<string, Mesh>();
  scene.agents.forEach((agent, index) => {
    const mesh = buildAgentMesh(babylonScene, agentRoot, agent, index, scene.agents.length);
    agentMeshes.set(agent.agentId, mesh);
  });
  if (scene.participants.length > 0 && presenceGraph !== undefined) {
    notes.push(`presence graph hosted: ${presenceGraph.nodes.length} seat/cursor nodes recorded`);
  }

  // --- animation clips -----------------------------------------------------
  const clips: BabylonClipRecord[] = [];
  if (animationGraph !== undefined) {
    // The animation graph repeats the animated spatial nodes: nodeId ->
    // entity id resolution uses ITS spatial nodes (same derivation).
    const animTargets = new Map<string, string>();
    for (const node of animationGraph.nodes) {
      if (node.kind === 'spatial-3d' && node.ref?.kind === 'world-entity') {
        animTargets.set(node.id, node.ref.entityId);
      }
    }
    for (const node of animationGraph.nodes) {
      if (node.kind !== 'animation-clip') continue;
      const record = buildClip(node, animTargets, notes);
      if (record !== null) {
        clips.push(record);
        // Attach every resolvable track to its entity mesh (the Babylon
        // animation runtime picks mesh.animations up when the host plays).
        for (const track of record.tracks) {
          if (track.targetEntityId !== undefined) {
            entityMeshes.get(track.targetEntityId)?.animations.push(track.animation);
          }
        }
      }
    }
  }

  const presentedEntityIds = [...entityMeshes.keys()].sort();
  return {
    entityMeshes,
    agentMeshes,
    presentedEntityIds,
    labels,
    clips,
    timelineMarkerIds:
      timelineGraph?.nodes.filter((n) => n.kind === 'timeline-marker').map((n) => n.id) ?? [],
    narrativeBeatIds:
      narrativeGraph?.nodes.filter((n) => n.kind === 'narrative-beat').map((n) => n.id) ?? [],
    controlIds: controlsGraph?.nodes.filter((n) => n.kind === 'control').map((n) => n.id) ?? [],
    notes,
  };
}

/** Build the Babylon mesh of one spatial-3d node (the semantic mapping). */
function buildEntityMesh(
  babylonScene: Scene,
  parent: TransformNode,
  node: SpatialNode,
  notes: string[],
): Mesh | null {
  const ref = node.ref;
  if (ref === undefined || ref === null || ref.kind !== 'world-entity') {
    // A spatial node without a world-entity reference cannot be picked
    // semantically — recorded, never fatal (presentation-only).
    notes.push(`spatial node ${node.id} carries no world-entity reference; skipped`);
    return null;
  }
  const entityId = ref.entityId;
  const descriptor = node.descriptor;
  const attributes = node.attributes ?? {};
  let mesh: Mesh | undefined;
  switch (descriptor.primitive) {
    case 'box':
      mesh = MeshBuilder.CreateBox(entityId, { size: UNIT_EXTENT }, babylonScene);
      break;
    case 'sphere':
      mesh = MeshBuilder.CreateSphere(entityId, { diameter: UNIT_EXTENT }, babylonScene);
      break;
    case 'cylinder':
      mesh = MeshBuilder.CreateCylinder(
        entityId,
        { height: UNIT_EXTENT, diameter: UNIT_EXTENT },
        babylonScene,
      );
      break;
    case 'cone':
      mesh = MeshBuilder.CreateCylinder(
        entityId,
        { height: UNIT_EXTENT, diameterBottom: UNIT_EXTENT, diameterTop: 0 },
        babylonScene,
      );
      break;
    case 'plane':
      mesh = MeshBuilder.CreatePlane(entityId, { size: UNIT_EXTENT }, babylonScene);
      break;
    case 'mesh':
      // The content-addressed mesh asset path: a deterministic wireframe
      // PROXY is presented now; the actual geometry binds through the
      // validated asset-binding surface (browser GL path) — never invented
      // geometry. The wireframe flag rides the entity material below.
      mesh = MeshBuilder.CreateBox(entityId, { size: UNIT_EXTENT }, babylonScene);
      notes.push(`entity ${entityId} binds a content-addressed mesh asset; wireframe proxy presented pending asset binding`);
      break;
  }
  if (mesh === undefined) {
    notes.push(`entity ${entityId} carries an unknown primitive "${descriptor.primitive}"; skipped`);
    return null;
  }
  mesh.position.set(descriptor.position[0], descriptor.position[1], descriptor.position[2]);
  if (descriptor.orientation !== undefined) {
    const [x, y, z, w] = descriptor.orientation;
    mesh.rotationQuaternion = new Quaternion(x, y, z, w);
  }
  if (descriptor.scale !== undefined) {
    mesh.scaling.set(descriptor.scale[0], descriptor.scale[1], descriptor.scale[2]);
  }
  mesh.parent = parent;
  mesh.isPickable = true;

  // Materials: the node's declared material attributes (compiled from the
  // ontology material records) + applied highlight overlay tint.
  const material = new StandardMaterial(`${entityId}-material`, babylonScene);
  const materialColor = typeof attributes['material-color'] === 'string' ? attributes['material-color'] : undefined;
  if (materialColor !== undefined) {
    material.diffuseColor = Color3.FromHexString(materialColor);
  }
  const materialOpacity = typeof attributes['material-opacity'] === 'number' ? attributes['material-opacity'] : undefined;
  if (materialOpacity !== undefined) {
    material.alpha = materialOpacity;
  }
  const highlightColor = typeof attributes['overlay-highlight-color'] === 'string' ? attributes['overlay-highlight-color'] : undefined;
  if (highlightColor !== undefined) {
    material.emissiveColor = Color3.FromHexString(highlightColor);
  }
  if (descriptor.primitive === 'mesh') {
    material.wireframe = true;
  }
  mesh.material = material;

  // THE semantic mapping: the mesh carries its entity identity.
  const metadata: BabylonEntityMetadata = {
    epochEntityId: entityId,
    epochEntityDigest: ref.contentDigest,
    epochPrimitive: descriptor.primitive,
  };
  mesh.metadata = metadata;
  // Deterministic world matrix for headless picking (no render loop needed).
  mesh.computeWorldMatrix(true);
  return mesh;
}

/** Build the visible representation of one projected agent (non-pickable). */
function buildAgentMesh(
  babylonScene: Scene,
  parent: TransformNode,
  agent: ProjectedAgentRef,
  index: number,
  count: number,
): Mesh {
  const mesh = MeshBuilder.CreatePolyhedron(
    `agent-${agent.agentId}`,
    { type: 1, size: 1.5 }, // octahedron: the neutral agent marker
    babylonScene,
  );
  // Deterministic ring placement (agents carry no projected position).
  const angle = count <= 1 ? 0 : (index * (2 * Math.PI)) / count;
  mesh.position.set(
    AGENT_RING_RADIUS * Math.sin(angle),
    AGENT_RING_HEIGHT,
    AGENT_RING_RADIUS * Math.cos(angle),
  );
  mesh.parent = parent;
  mesh.isPickable = false; // agents are participants, not world entities
  const material = new StandardMaterial(`agent-${agent.agentId}-material`, babylonScene);
  material.emissiveColor = Color3.FromHexString('#33ddff');
  mesh.material = material;
  const metadata: BabylonAgentMetadata = {
    epochAgentId: agent.agentId,
    epochAgentDigest: agent.contentDigest,
    epochAgentTenantId: agent.tenantId,
  };
  mesh.metadata = metadata;
  mesh.computeWorldMatrix(true);
  return mesh;
}

/** Map one animation-clip node to Babylon Animation objects per track. */
function buildClip(
  node: ExperienceNode & { kind: 'animation-clip' },
  targets: ReadonlyMap<string, string>,
  notes: string[],
): BabylonClipRecord | null {
  const FPS = 60;
  const tracks = node.descriptor.tracks.map((track) => {
    const animation = new Animation(
      `${node.id}:${track.propertyPath}`,
      track.propertyPath,
      FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    const keys = track.keyframes.map((keyframe) => {
      const value =
        typeof keyframe.value === 'number'
          ? keyframe.value
          : Array.isArray(keyframe.value) && keyframe.value.length === 3
            ? new Vector3(
                Number(keyframe.value[0]),
                Number(keyframe.value[1]),
                Number(keyframe.value[2]),
              )
            : 0;
      return { frame: (keyframe.atMs / 1000) * FPS, value };
    });
    animation.setKeys(keys);
    const targetEntityId = targets.get(track.targetNodeId);
    if (targetEntityId === undefined) {
      notes.push(
        `clip ${node.id} track ${track.propertyPath} targets non-spatial node ${track.targetNodeId}; recorded unmapped`,
      );
    }
    return {
      propertyPath: track.propertyPath,
      targetEntityId,
      animation,
      keyframeCount: keys.length,
    };
  });
  if (tracks.length === 0) {
    notes.push(`clip ${node.id} carries no tracks`);
    return null;
  }
  return { clipNodeId: node.id, durationMs: node.descriptor.durationMs, tracks };
}

/** The semantic entity id of one spatial node (undefined when unprojected). */
function entityIdOf(node: SpatialNode): string | undefined {
  return node.ref?.kind === 'world-entity' ? node.ref.entityId : undefined;
}

/** The (idempotent) root transform node of one name. */
function rootOf(babylonScene: Scene, name: string): TransformNode {
  const existing = babylonScene.getTransformNodeByName(name);
  if (existing !== null) {
    return existing;
  }
  return new TransformNode(name, babylonScene);
}

/** Dispose every child of the named root (a remount rebuilds presentation). */
function disposeChildrenOf(babylonScene: Scene, rootName: string): void {
  const root = babylonScene.getTransformNodeByName(rootName);
  if (root === null) {
    return;
  }
  for (const child of [...root.getChildren()]) {
    child.dispose(false, false);
  }
}
