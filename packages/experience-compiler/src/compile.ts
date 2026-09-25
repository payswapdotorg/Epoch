/**
 * The compile pipeline — the total entry point of the experience
 * compiler (W012).
 *
 * `compileExperienceGraph` consumes a serialized W011 Experience Graph
 * envelope, validates it with the W011 admission discipline (genuine
 * runtime reuse: the compiler's inputs ARE W011 envelopes), shapes the
 * plan for a target device descriptor, and seals a deterministic,
 * content-addressed Render Plan. It NEVER mutates kernel state, never
 * becomes a second semantic store, and never embeds new world/agent
 * semantics (architecture lock rules 8/16).
 *
 * Compile precedence (fixed, so consumers branch deterministically):
 *
 * 1. envelope admission — the full W011 pipeline (root shape, version
 *    gate, schema gate, digest gate, tenant gate, resolvability gate,
 *    kernel authority gate) via `parseExperienceGraph`; its typed
 *    failures surface 1:1 as compiler errors of the same code;
 * 2. target-device version gate — a numeric `descriptorVersion` other
 *    than the W011 slot version fails fast with `version-unsupported`;
 * 3. target-device schema gate — full W011 device-descriptor validation
 *    (`malformed-descriptor` with precise dotted paths);
 * 4. vendor-field authority gate — presentation attributes carrying
 *    vendor/engine token segments are rejected (`authority-violation`,
 *    origin `vendor-blocklist`);
 * 5. structural compile gate — per-graph-kind compilation passes
 *    (a cyclic `follows` chain in a narrative graph is a
 *    `malformed-descriptor`);
 * 6. device budget gate — deterministic usage accounting enforced
 *    against the target device's declared budgets
 *    (`device-budget-exceeded` / accountability `malformed-descriptor`);
 * 7. seal — the plan content is schema-validated and sealed with its
 *    canonical SHA-256 digest (envelope digest -> plan digest).
 */
import {
  parseExperienceGraph,
  DeviceDescriptorSchema,
  DEVICE_DESCRIPTOR_VERSION,
  type DeviceDescriptor,
  type ExperienceGraph,
  type ExperienceProtocolError,
} from '@epoch/experience-protocol';
import type { CompilerError, CompilerResult } from './errors';
import { malformedDescriptorError } from './issues';
import { scanVendorFieldViolations, vendorFieldViolationError } from './authority';
import { computePlanUsage, constraintsOf, enforceDeviceBudgets } from './usage';
import {
  RenderPlanContentSchema,
  type PlanStage,
  type RenderPlan,
  type RenderPlanContent,
} from './plan';
import {
  RENDER_PLAN_PROTOCOL_VERSION,
  RENDER_PLAN_SCHEMA_NAME,
  MAX_PLAN_ANCHORS_PER_OP,
} from './version';
import { sealRenderPlan } from './serialize';

// ---------------------------------------------------------------------------
// The compile request.
// ---------------------------------------------------------------------------

/** The typed input of {@link compileExperienceGraph}. */
export interface CompileRequest {
  /** The serialized, sealed W011 Experience Graph envelope (JSON value). */
  readonly envelope: unknown;
  /**
   * The target device descriptor (W011 vocabulary): the device the plan
   * is compiled FOR. May equal or differ from the envelope's device —
   * device-aware plan shaping derives the plan's constraints from THIS
   * descriptor.
   */
  readonly device: unknown;
  /**
   * The tenant the caller is compiling FOR. When provided, an envelope
   * scoped to a different tenant is rejected with `cross-tenant-denied`
   * (R12 — the projection boundary is the tenant; the plan carries the
   * envelope's tenant scope verbatim).
   */
  readonly expectedTenantId?: string;
}

// ---------------------------------------------------------------------------
// W011 admission-error mapping (codes surface 1:1).
// ---------------------------------------------------------------------------

/** Map a W011 admission error onto the compiler taxonomy (same code). */
function mapAdmissionError(error: ExperienceProtocolError): CompilerError {
  if (error.code === 'authority-violation') {
    return {
      code: 'authority-violation',
      message: error.message,
      violations: error.violations.map((v) => ({
        path: v.path,
        key: v.key,
        origin: 'kernel-reserved' as const,
      })),
    };
  }
  return error;
}

// ---------------------------------------------------------------------------
// Target-device admission (version gate before schema gate).
// ---------------------------------------------------------------------------

function deviceVersionGate(device: unknown): CompilerError | null {
  if (typeof device !== 'object' || device === null || Array.isArray(device)) return null;
  const encountered = (device as Record<string, unknown>).descriptorVersion;
  if (typeof encountered === 'number' && encountered !== DEVICE_DESCRIPTOR_VERSION) {
    return {
      code: 'version-unsupported',
      message:
        `device descriptor version mismatch: expected ${DEVICE_DESCRIPTOR_VERSION}, ` +
        `encountered ${encountered}`,
      expected: String(DEVICE_DESCRIPTOR_VERSION),
      encountered: String(encountered),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-graph-kind compilation passes (pure, deterministic).
// ---------------------------------------------------------------------------

/** Anchor target ids of one label node (sorted, unique). */
function anchorsOf(graph: ExperienceGraph, labelNodeId: string): string[] | undefined {
  const targets = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind === 'anchors' && edge.from === labelNodeId) {
      targets.add(edge.to);
    }
  }
  if (targets.size === 0) return undefined;
  return [...targets].sort();
}

/**
 * The structural gate of the compile pass: label anchor targets are
 * bounded (MAX_PLAN_ANCHORS_PER_OP) — an over-anchored label is a typed
 * `malformed-descriptor` rejection, never a silent truncation.
 */
function anchorBoundGate(graph: ExperienceGraph): CompilerError | null {
  const counts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.kind !== 'anchors') continue;
    counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
  }
  for (const [nodeId, count] of [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (count > MAX_PLAN_ANCHORS_PER_OP) {
      return {
        code: 'malformed-descriptor',
        message:
          `label node "${nodeId}" carries ${count} anchor targets ` +
          `(the plan bound is ${MAX_PLAN_ANCHORS_PER_OP}) — over-anchored labels are rejected, never truncated`,
        issues: [
          {
            path: 'edges',
            message: `node "${nodeId}" has ${count} "anchors" edges (max ${MAX_PLAN_ANCHORS_PER_OP})`,
          },
        ],
      };
    }
  }
  return null;
}

/** The relate stage (present iff the graph has edges). */
function compileRelations(graph: ExperienceGraph): PlanStage | null {
  if (graph.edges.length === 0) return null;
  return {
    stage: 'relate',
    relations: graph.edges.map((edge) => ({
      kind: edge.kind,
      from: edge.from,
      to: edge.to,
      ...(edge.attributes === undefined ? {} : { attributes: edge.attributes }),
    })),
  };
}

/**
 * The draw-2d stage (shape-2d nodes of 2d/animation graphs; label nodes
 * of 2d graphs — labels route to draw ops in 2D graphs and to placement
 * ops in 3D graphs, per the W011 GRAPH_KIND_NODE_KINDS tables).
 */
function compileDraw2d(graph: ExperienceGraph): PlanStage | null {
  type Draw = Extract<PlanStage, { stage: 'draw-2d' }>['draws'][number];
  const draws: Draw[] = [];
  const labelsDraw = graph.graphKind === '2d';
  for (const node of graph.nodes) {
    switch (node.kind) {
      case 'shape-2d': {
        const draw: Extract<Draw, { op: 'draw-shape' }> = {
          op: 'draw-shape',
          nodeId: node.id,
          geometry: node.descriptor.geometry,
          ...(node.ref === undefined ? {} : { ref: node.ref }),
          ...(node.descriptor.stroke === undefined ? {} : { stroke: node.descriptor.stroke }),
          ...(node.descriptor.fill === undefined ? {} : { fill: node.descriptor.fill }),
          ...(node.descriptor.zIndex === undefined ? {} : { zIndex: node.descriptor.zIndex }),
          ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
        };
        draws.push(draw);
        break;
      }
      case 'label': {
        if (!labelsDraw) break;
        const draw: Extract<Draw, { op: 'draw-label' }> = {
          op: 'draw-label',
          nodeId: node.id,
          text: node.descriptor.text,
          offset2d: node.descriptor.offset2d ?? { x: 0, y: 0 },
          ...(node.ref === undefined ? {} : { ref: node.ref }),
          ...(node.descriptor.style === undefined ? {} : { style: node.descriptor.style }),
          ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
        };
        const anchors = anchorsOf(graph, node.id);
        if (anchors !== undefined) draw.anchorNodeIds = anchors;
        draws.push(draw);
        break;
      }
      default:
        break;
    }
  }
  if (draws.length === 0) return null;
  const zOf = (draw: Draw): number => (draw.op === 'draw-shape' ? (draw.zIndex ?? 0) : 0);
  draws.sort((a, b) => (zOf(a) - zOf(b) !== 0 ? zOf(a) - zOf(b) : a.nodeId < b.nodeId ? -1 : 1));
  return { stage: 'draw-2d', draws };
}

/**
 * The place-3d stage (spatial-3d nodes of 3d/animation graphs; label
 * nodes of 3d graphs — 3D labels place with offset3d).
 */
function compilePlace3d(graph: ExperienceGraph): PlanStage | null {
  type Placement = Extract<PlanStage, { stage: 'place-3d' }>['placements'][number];
  const placements: Placement[] = [];
  const labelsPlace = graph.graphKind === '3d';
  for (const node of graph.nodes) {
    switch (node.kind) {
      case 'spatial-3d': {
        const placement: Extract<Placement, { op: 'place-spatial' }> = {
          op: 'place-spatial',
          nodeId: node.id,
          primitive: node.descriptor.primitive,
          position: node.descriptor.position,
          ...(node.ref === undefined ? {} : { ref: node.ref }),
          ...(node.descriptor.orientation === undefined
            ? {}
            : { orientation: node.descriptor.orientation }),
          ...(node.descriptor.scale === undefined ? {} : { scale: node.descriptor.scale }),
          ...(node.descriptor.mesh === undefined ? {} : { mesh: node.descriptor.mesh }),
          ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
        };
        placements.push(placement);
        break;
      }
      case 'label': {
        if (!labelsPlace) break;
        const placement: Extract<Placement, { op: 'place-label' }> = {
          op: 'place-label',
          nodeId: node.id,
          text: node.descriptor.text,
          offset3d: node.descriptor.offset3d ?? [0, 0, 0],
          ...(node.ref === undefined ? {} : { ref: node.ref }),
          ...(node.descriptor.style === undefined ? {} : { style: node.descriptor.style }),
          ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
        };
        const anchors = anchorsOf(graph, node.id);
        if (anchors !== undefined) placement.anchorNodeIds = anchors;
        placements.push(placement);
        break;
      }
      default:
        break;
    }
  }
  if (placements.length === 0) return null;
  placements.sort((a, b) => (a.nodeId < b.nodeId ? -1 : 1));
  return { stage: 'place-3d', placements };
}

/** The animate stage: clips flattened into (clip, target, property) bindings. */
function compileAnimations(graph: ExperienceGraph): PlanStage | null {
  const bindings: Extract<PlanStage, { stage: 'animate' }>['bindings'] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'animation-clip') continue;
    for (const track of node.descriptor.tracks) {
      bindings.push({
        clipNodeId: node.id,
        targetNodeId: track.targetNodeId,
        propertyPath: track.propertyPath,
        durationMs: node.descriptor.durationMs,
        keyframes: track.keyframes,
        ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
      });
    }
  }
  if (bindings.length === 0) return null;
  bindings.sort((a, b) => {
    if (a.clipNodeId !== b.clipNodeId) return a.clipNodeId < b.clipNodeId ? -1 : 1;
    if (a.targetNodeId !== b.targetNodeId) return a.targetNodeId < b.targetNodeId ? -1 : 1;
    return a.propertyPath < b.propertyPath ? -1 : 1;
  });
  return { stage: 'animate', bindings };
}

/**
 * The narrate stage: beats ordered by their `follows` chain (deterministic
 * Kahn's algorithm — the smallest node id is emitted first among ready
 * beats). A cyclic `follows` chain is a typed `malformed-descriptor`.
 */
function compileNarrative(
  graph: ExperienceGraph,
): CompilerResult<Extract<PlanStage, { stage: 'narrate' }>> {
  const beats = graph.nodes.filter((node) => node.kind === 'narrative-beat');
  const beatIds = beats.map((beat) => beat.id);
  const idSet = new Set<string>(beatIds);

  // in-degree over `follows` edges between narrative beats.
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of beatIds) {
    successors.set(id, []);
    inDegree.set(id, 0);
  }
  for (const edge of graph.edges) {
    if (edge.kind !== 'follows') continue;
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue;
    successors.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Deterministic ready set: a sorted array used as a priority queue.
  const ready: string[] = beatIds.filter((id) => (inDegree.get(id) ?? 0) === 0).sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift()!;
    order.push(current);
    for (const successor of successors.get(current)!) {
      const remaining = (inDegree.get(successor) ?? 0) - 1;
      inDegree.set(successor, remaining);
      if (remaining === 0) {
        ready.push(successor);
        ready.sort();
      }
    }
  }

  if (order.length !== beatIds.length) {
    return {
      ok: false,
      error: {
        code: 'malformed-descriptor',
        message:
          'the narrative graph contains a cyclic "follows" chain — beat order is unresolvable ' +
          '(every beat must be reachable from a chain start)',
        issues: [{ path: 'edges', message: 'cyclic "follows" chain among narrative beats' }],
      },
    };
  }

  const byId = new Map(beats.map((beat) => [beat.id, beat] as const));
  const compiled = order.map((id, index) => {
    const beat = byId.get(id)!;
    if (beat.kind !== 'narrative-beat') throw new Error('unreachable: filtered by kind');
    return {
      sequence: index,
      nodeId: beat.id,
      title: beat.descriptor.title,
      ...(beat.ref === undefined ? {} : { ref: beat.ref }),
      ...(beat.descriptor.body === undefined ? {} : { body: beat.descriptor.body }),
      ...(beat.descriptor.tone === undefined ? {} : { tone: beat.descriptor.tone }),
      ...(beat.attributes === undefined ? {} : { attributes: beat.attributes }),
    };
  });
  return { ok: true, value: { stage: 'narrate', beats: compiled } };
}

/** The timeline stage: tracks and markers in compiled time order. */
function compileTimeline(graph: ExperienceGraph): PlanStage | null {
  const tracks: Extract<PlanStage, { stage: 'timeline' }>['tracks'] = [];
  const markers: Extract<PlanStage, { stage: 'timeline' }>['markers'] = [];
  for (const node of graph.nodes) {
    if (node.kind === 'timeline-track') {
      tracks.push({
        nodeId: node.id,
        label: node.descriptor.label,
        startMs: node.descriptor.startMs,
        endMs: node.descriptor.endMs,
        ...(node.ref === undefined ? {} : { ref: node.ref }),
        ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
      });
    } else if (node.kind === 'timeline-marker') {
      markers.push({
        nodeId: node.id,
        atMs: node.descriptor.atMs,
        markerKind: node.descriptor.markerKind,
        ...(node.ref === undefined ? {} : { ref: node.ref }),
        ...(node.descriptor.label === undefined ? {} : { label: node.descriptor.label }),
        ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
      });
    }
  }
  if (tracks.length === 0 && markers.length === 0) return null;
  tracks.sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    if (a.endMs !== b.endMs) return a.endMs - b.endMs;
    return a.nodeId < b.nodeId ? -1 : 1;
  });
  markers.sort((a, b) => (a.atMs !== b.atMs ? a.atMs - b.atMs : a.nodeId < b.nodeId ? -1 : 1));
  return { stage: 'timeline', tracks, markers };
}

/** The presence stage: seats and cursors in (participant, node) order. */
function compilePresence(graph: ExperienceGraph): PlanStage | null {
  const seats: Extract<PlanStage, { stage: 'presence' }>['seats'] = [];
  const cursors: Extract<PlanStage, { stage: 'presence' }>['cursors'] = [];
  for (const node of graph.nodes) {
    if (node.kind === 'presence-seat') {
      seats.push({
        nodeId: node.id,
        participant: node.descriptor.participant,
        ...(node.ref === undefined ? {} : { ref: node.ref }),
        ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
      });
    } else if (node.kind === 'presence-cursor') {
      cursors.push({
        nodeId: node.id,
        participant: node.descriptor.participant,
        ...(node.ref === undefined ? {} : { ref: node.ref }),
        ...(node.descriptor.position2d === undefined
          ? {}
          : { position2d: node.descriptor.position2d }),
        ...(node.descriptor.position3d === undefined
          ? {}
          : { position3d: node.descriptor.position3d }),
        ...(node.descriptor.atMs === undefined ? {} : { atMs: node.descriptor.atMs }),
        ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
      });
    }
  }
  if (seats.length === 0 && cursors.length === 0) return null;
  const byParticipant = <T extends { participant: { participantId: string }; nodeId: string }>(
    list: T[],
  ): T[] =>
    [...list].sort((a, b) =>
      a.participant.participantId !== b.participant.participantId
        ? a.participant.participantId < b.participant.participantId
          ? -1
          : 1
        : a.nodeId < b.nodeId
          ? -1
          : 1,
    );
  return { stage: 'presence', seats: byParticipant(seats), cursors: byParticipant(cursors) };
}

/** The controls stage: control bindings in node order. */
function compileControls(graph: ExperienceGraph): PlanStage | null {
  const controls: Extract<PlanStage, { stage: 'controls' }>['controls'] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'control') continue;
    controls.push({
      nodeId: node.id,
      controlKind: node.descriptor.controlKind,
      intent: node.descriptor.intent,
      ...(node.ref === undefined ? {} : { ref: node.ref }),
      ...(node.descriptor.label === undefined ? {} : { label: node.descriptor.label }),
      ...(node.descriptor.options === undefined ? {} : { options: node.descriptor.options }),
      ...(node.attributes === undefined ? {} : { attributes: node.attributes }),
    });
  }
  if (controls.length === 0) return null;
  controls.sort((a, b) => (a.nodeId < b.nodeId ? -1 : 1));
  return { stage: 'controls', controls };
}

// ---------------------------------------------------------------------------
// The total entry point.
// ---------------------------------------------------------------------------

/**
 * Compile a sealed W011 Experience Graph envelope into a deterministic,
 * renderer-ready Render Plan for one target device. Total: every failure
 * is a typed {@link CompilerError}; see the module docs for the fixed
 * compile precedence.
 */
export function compileExperienceGraph(request: CompileRequest): CompilerResult<RenderPlan> {
  // Precedence 1: envelope admission (the full W011 discipline, reused).
  const admitted = parseExperienceGraph(request.envelope, {
    expectedTenantId: request.expectedTenantId,
  });
  if (!admitted.ok) {
    return { ok: false, error: mapAdmissionError(admitted.error) };
  }
  const graph = admitted.value;

  // Precedence 2: target-device version gate (fail fast on skew).
  const versionFailure = deviceVersionGate(request.device);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: target-device schema gate.
  const deviceParsed = DeviceDescriptorSchema.safeParse(request.device);
  if (!deviceParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedDescriptorError(deviceParsed.error),
        message: 'target device descriptor failed schema validation',
      },
    };
  }
  const device: DeviceDescriptor = deviceParsed.data;

  // Precedence 4: vendor-field authority gate.
  const vendorViolations = scanVendorFieldViolations(graph);
  if (vendorViolations.length > 0) {
    return { ok: false, error: vendorFieldViolationError(vendorViolations) };
  }

  // Precedence 5: structural compile gate (per-graph-kind passes).
  const anchorFailure = anchorBoundGate(graph);
  if (anchorFailure !== null) {
    return { ok: false, error: anchorFailure };
  }
  const stages: PlanStage[] = [];
  const relations = compileRelations(graph);
  if (relations !== null) stages.push(relations);

  if (graph.graphKind === 'narrative') {
    const narrated = compileNarrative(graph);
    if (!narrated.ok) {
      return { ok: false, error: narrated.error };
    }
    stages.push(narrated.value);
  } else {
    const draws = compileDraw2d(graph);
    if (draws !== null) stages.push(draws);
    const placements = compilePlace3d(graph);
    if (placements !== null) stages.push(placements);
    const animations = compileAnimations(graph);
    if (animations !== null) stages.push(animations);
    const timeline = compileTimeline(graph);
    if (timeline !== null) stages.push(timeline);
    const presence = compilePresence(graph);
    if (presence !== null) stages.push(presence);
    const controls = compileControls(graph);
    if (controls !== null) stages.push(controls);
  }

  // Precedence 6: device budget gate.
  const usage = computePlanUsage(graph);
  const budgetFailure = enforceDeviceBudgets(graph, usage, device);
  if (budgetFailure !== null) {
    return { ok: false, error: budgetFailure };
  }

  // Precedence 7: seal (schema-validated, content-addressed).
  const content: RenderPlanContent = {
    schema: RENDER_PLAN_SCHEMA_NAME,
    protocolVersion: RENDER_PLAN_PROTOCOL_VERSION,
    sourceGraphId: graph.graphId,
    sourceGraphKind: graph.graphKind,
    sourceEnvelopeDigest: graph.digest,
    tenantScope: graph.tenantScope,
    sourceRefs: graph.projectedFrom,
    target: device,
    constraints: constraintsOf(device),
    usage,
    stages,
  };
  const contentCheck = RenderPlanContentSchema.safeParse(content);
  if (!contentCheck.success) {
    // Defensive: the compiler only emits schema-valid content; a failure
    // here is an internal invariant breach surfaced as a typed error.
    return { ok: false, error: malformedDescriptorError(contentCheck.error) };
  }
  const sealed = sealRenderPlan(contentCheck.data);
  if (!sealed.ok) {
    return { ok: false, error: sealed.error };
  }
  return { ok: true, value: sealed.value };
}
