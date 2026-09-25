/**
 * Total admission surface for serialized Render Plan documents.
 *
 * `parseRenderPlan` never throws: every failure is a typed
 * {@link CompilerError}. It is the consumer-side mirror of the compile
 * pipeline — a presenter (W013 renderer runtime, W019 adaptation) admits
 * a compiled plan exactly the way the compiler admitted its envelope.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object root is a `malformed-descriptor`;
 * 2. version gate — a string `protocolVersion` that differs from `1.0.0`
 *    fails fast with `version-unsupported` (version skew is always
 *    distinguishable from malformed payloads);
 * 3. schema gate — full zod validation; strict objects reject unknown
 *    (vendor/engine) fields; canonical-ordering refinements reject
 *    non-deterministic stage/op orders and inconsistent usage
 *    (`malformed-descriptor` with precise dotted paths);
 * 4. digest gate — the claimed digest must match the recomputed
 *    canonical SHA-256 (`digest-mismatch`);
 * 5. tenant gate — the optional caller-supplied expected tenant must
 *    match the plan scope (`cross-tenant-denied`, R12 — the plan carries
 *    the envelope's tenant scope verbatim);
 * 6. resolvability gate — label anchor targets must resolve against the
 *    plan's own op node ids (`unknown-reference`).
 */
import { RenderPlanSchema, type RenderPlan } from './plan';
import { malformedDescriptorError } from './issues';
import { RENDER_PLAN_PROTOCOL_VERSION } from './version';
import { verifyRenderPlanDigest } from './serialize';
import type { CompilerError, CompilerResult } from './errors';

/** Options shared by the plan-admission entry points. */
export interface PlanAdmissionOptions {
  /**
   * The tenant the caller is admitting FOR. When provided, a plan scoped
   * to a different tenant is rejected with `cross-tenant-denied` (R12 —
   * the projection boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

function rootShapeError(): CompilerError {
  return {
    code: 'malformed-descriptor',
    message: 'render plan root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown): CompilerError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== RENDER_PLAN_PROTOCOL_VERSION) {
    return {
      code: 'version-unsupported',
      message: `protocol version mismatch: expected ${RENDER_PLAN_PROTOCOL_VERSION}, encountered ${encountered}`,
      expected: RENDER_PLAN_PROTOCOL_VERSION,
      encountered,
    };
  }
  return null;
}

/** Collect every node id referenced by the plan's ops (for resolvability). */
function collectPlanNodeIds(plan: RenderPlan): Set<string> {
  const ids = new Set<string>();
  for (const stage of plan.stages) {
    switch (stage.stage) {
      case 'relate':
        for (const relation of stage.relations) {
          ids.add(relation.from);
          ids.add(relation.to);
        }
        break;
      case 'draw-2d':
        for (const draw of stage.draws) ids.add(draw.nodeId);
        break;
      case 'place-3d':
        for (const placement of stage.placements) ids.add(placement.nodeId);
        break;
      case 'animate':
        for (const binding of stage.bindings) {
          ids.add(binding.clipNodeId);
          ids.add(binding.targetNodeId);
        }
        break;
      case 'narrate':
        for (const beat of stage.beats) ids.add(beat.nodeId);
        break;
      case 'timeline':
        for (const track of stage.tracks) ids.add(track.nodeId);
        for (const marker of stage.markers) ids.add(marker.nodeId);
        break;
      case 'presence':
        for (const seat of stage.seats) ids.add(seat.nodeId);
        for (const cursor of stage.cursors) ids.add(cursor.nodeId);
        break;
      case 'controls':
        for (const control of stage.controls) ids.add(control.nodeId);
        break;
    }
  }
  return ids;
}

/**
 * Parse, validate, and admit a serialized Render Plan envelope. Total;
 * see the module docs for the fixed precedence of typed errors.
 */
export function parseRenderPlan(
  input: unknown,
  options?: PlanAdmissionOptions,
): CompilerResult<RenderPlan> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate (structure, strictness, canonical ordering).
  // (The digest verification below re-parses; the schema check there is a
  // superset of this one, so a structurally invalid plan never reaches
  // the digest comparison.)
  const schemaParsed = RenderPlanSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedDescriptorError(schemaParsed.error) };
  }
  const plan = schemaParsed.data;

  // Precedence 4: digest gate (tamper detection).
  const digestVerified = verifyRenderPlanDigest(plan);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== plan.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `cross-tenant plan admission denied: expected tenant "${options.expectedTenantId}", encountered "${plan.tenantScope.tenantId}"`,
        path: ['tenantScope', 'tenantId'],
        expectedTenantId: options.expectedTenantId,
        encounteredTenantId: plan.tenantScope.tenantId,
      },
    };
  }

  // Precedence 6: resolvability gate (label anchors resolve in-plan).
  const nodeIds = collectPlanNodeIds(plan);
  for (const stage of plan.stages) {
    if (stage.stage !== 'draw-2d' && stage.stage !== 'place-3d') continue;
    const labelOps =
      stage.stage === 'draw-2d'
        ? stage.draws.filter((d) => d.op === 'draw-label')
        : stage.placements.filter((p) => p.op === 'place-label');
    for (const labelOp of labelOps) {
      if (labelOp.anchorNodeIds === undefined) continue;
      for (const anchor of labelOp.anchorNodeIds) {
        if (!nodeIds.has(anchor)) {
          return {
            ok: false,
            error: {
              code: 'unknown-reference',
              message: `label op "${labelOp.nodeId}" anchors to node "${anchor}", which does not exist in the plan`,
              path: ['stages', stage.stage],
              reference: `plan-op:${anchor}`,
            },
          };
        }
      }
    }
  }

  return { ok: true, value: plan };
}
