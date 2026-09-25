/**
 * Total admission surface for serialized experience documents.
 *
 * `parseExperienceGraph`, `parseProjectionRequest`, and
 * `validateDeviceDescriptor` never throw: every failure is a typed
 * {@link ExperienceProtocolError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object root is a `malformed-descriptor`;
 * 2. version gate — a string `protocolVersion` that differs from
 *    `1.0.0` fails fast with `version-unsupported` (version skew is always
 *    distinguishable from malformed payloads);
 * 3. schema gate — full zod validation; strict objects reject unknown
 *    (vendor/engine) fields; canonical-ordering refinements reject
 *    non-deterministic array orders; failures surface as
 *    `malformed-descriptor` with precise dotted paths;
 * 4. digest gate (graphs only) — the claimed digest must match the
 *    recomputed canonical SHA-256 (`digest-mismatch`);
 * 5. tenant gate — the optional caller-supplied expected tenant must match
 *    the document scope, and every projected reference must belong to the
 *    document's tenant (`cross-tenant-denied`, R12);
 * 6. resolvability gate (graphs only) — node refs must resolve against the
 *    projection inputs, edge endpoints and animation targets against the
 *    node set (`unknown-reference`);
 * 7. authority gate (graphs only) — presentation attributes must not carry
 *    kernel-reserved keys (`authority-violation`, lock rule 8).
 */
import { ExperienceGraphSchema, type ExperienceGraph } from './graph';
import { ProjectionRequestSchema, type ProjectionRequest } from './request';
import { DeviceDescriptorSchema, type DeviceDescriptor } from './device';
import { malformedDescriptorError } from './issues';
import { scanAuthorityViolations, authorityViolationError } from './authority';
import { projectedReferenceKey } from './reference';
import { EXPERIENCE_PROTOCOL_VERSION } from './version';
import { verifyExperienceGraphDigest } from './serialize';
import type { ExperienceProtocolError, ExperienceResult } from './errors';

/** Options shared by the admission entry points. */
export interface AdmissionOptions {
  /**
   * The tenant the caller is admitting FOR. When provided, a document
   * scoped to a different tenant is rejected with `cross-tenant-denied`
   * (R12 — the projection boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

function rootShapeError(): ExperienceProtocolError {
  return {
    code: 'malformed-descriptor',
    message: 'experience document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown): ExperienceProtocolError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== EXPERIENCE_PROTOCOL_VERSION) {
    return {
      code: 'version-unsupported',
      message: `protocol version mismatch: expected ${EXPERIENCE_PROTOCOL_VERSION}, encountered ${encountered}`,
      expected: EXPERIENCE_PROTOCOL_VERSION,
      encountered,
    };
  }
  return null;
}

function tenantDenial(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): ExperienceProtocolError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant projection denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

/**
 * Parse, validate, and admit a serialized Experience Graph envelope.
 * Total; see the module docs for the fixed precedence of typed errors.
 */
export function parseExperienceGraph(
  input: unknown,
  options?: AdmissionOptions,
): ExperienceResult<ExperienceGraph> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate (structure, strictness, canonical ordering).
  const schemaParsed = ExperienceGraphSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedDescriptorError(schemaParsed.error) };
  }
  const graph = schemaParsed.data;

  // Precedence 4: digest gate (tamper detection).
  const digestVerified = verifyExperienceGraphDigest(graph);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== graph.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        graph.tenantScope.tenantId,
      ),
    };
  }
  const inputKeys = new Set(graph.projectedFrom.map(projectedReferenceKey));
  for (let i = 0; i < graph.projectedFrom.length; i += 1) {
    const ref = graph.projectedFrom[i];
    if (ref.tenantId !== graph.tenantScope.tenantId) {
      return {
        ok: false,
        error: tenantDenial(
          ['projectedFrom', i, 'tenantId'],
          graph.tenantScope.tenantId,
          ref.tenantId,
        ),
      };
    }
  }
  for (let i = 0; i < graph.nodes.length; i += 1) {
    const node = graph.nodes[i];
    if (node.ref !== undefined && node.ref.tenantId !== graph.tenantScope.tenantId) {
      return {
        ok: false,
        error: tenantDenial(['nodes', i, 'ref', 'tenantId'], graph.tenantScope.tenantId, node.ref.tenantId),
      };
    }
  }

  // Precedence 6: resolvability gate.
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (let i = 0; i < graph.nodes.length; i += 1) {
    const node = graph.nodes[i];
    if (node.ref !== undefined && !inputKeys.has(projectedReferenceKey(node.ref))) {
      return {
        ok: false,
        error: {
          code: 'unknown-reference',
          message:
            `node "${node.id}" references projected kernel state outside the graph's projection inputs — ` +
            'every node ref must resolve against projectedFrom',
          path: ['nodes', i, 'ref'],
          reference: projectedReferenceKey(node.ref),
        },
      };
    }
    if (node.kind === 'animation-clip') {
      for (let t = 0; t < node.descriptor.tracks.length; t += 1) {
        const track = node.descriptor.tracks[t];
        if (!nodeIds.has(track.targetNodeId)) {
          return {
            ok: false,
            error: {
              code: 'unknown-reference',
              message:
                `animation track targets node "${track.targetNodeId}", which does not exist in the graph`,
              path: ['nodes', i, 'descriptor', 'tracks', t, 'targetNodeId'],
              reference: `experience-node:${track.targetNodeId}`,
            },
          };
        }
      }
    }
  }
  for (let i = 0; i < graph.edges.length; i += 1) {
    const edge = graph.edges[i];
    if (!nodeIds.has(edge.from)) {
      return {
        ok: false,
        error: {
          code: 'unknown-reference',
          message: `edge "from" references node "${edge.from}", which does not exist in the graph`,
          path: ['edges', i, 'from'],
          reference: `experience-node:${edge.from}`,
        },
      };
    }
    if (!nodeIds.has(edge.to)) {
      return {
        ok: false,
        error: {
          code: 'unknown-reference',
          message: `edge "to" references node "${edge.to}", which does not exist in the graph`,
          path: ['edges', i, 'to'],
          reference: `experience-node:${edge.to}`,
        },
      };
    }
  }

  // Precedence 7: authority gate (presentation attributes).
  const violations = scanAuthorityViolations(graph);
  if (violations.length > 0) {
    return { ok: false, error: authorityViolationError(violations) };
  }

  return { ok: true, value: graph };
}

/**
 * Parse, validate, and admit a serialized projection request. Total;
 * see the module docs for the fixed precedence of typed errors.
 */
export function parseProjectionRequest(
  input: unknown,
  options?: AdmissionOptions,
): ExperienceResult<ProjectionRequest> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate.
  const schemaParsed = ProjectionRequestSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedDescriptorError(schemaParsed.error) };
  }
  const request = schemaParsed.data;

  // Precedence 5: tenant gate (requests carry no digest or node graph).
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== request.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        request.tenantScope.tenantId,
      ),
    };
  }
  for (let i = 0; i < request.references.length; i += 1) {
    const ref = request.references[i];
    if (ref.tenantId !== request.tenantScope.tenantId) {
      return {
        ok: false,
        error: tenantDenial(
          ['references', i, 'tenantId'],
          request.tenantScope.tenantId,
          ref.tenantId,
        ),
      };
    }
  }

  return { ok: true, value: request };
}

/**
 * Validate a serialized device descriptor (the abstract W019 slot).
 * Total: schema violations surface as typed `malformed-descriptor` issues
 * with precise dotted paths.
 */
export function validateDeviceDescriptor(
  input: unknown,
): ExperienceResult<DeviceDescriptor> {
  const parsed = DeviceDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedDescriptorError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
