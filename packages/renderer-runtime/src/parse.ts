/**
 * Total admission surface for serialized renderer documents.
 *
 * `parseRendererDescriptor`, `parseRendererBinding`, and
 * `parseRendererReceipt` never throw: every failure is a typed
 * {@link RendererRuntimeError}.
 *
 * Admission precedence for versioned documents (bindings, receipts) is
 * fixed, so consumers branch deterministically:
 *
 * 1. root shape — a non-object root is a `malformed-record`;
 * 2. version gate — a string `protocolVersion` that differs from `1.0.0`
 *    fails fast with `version-unsupported`;
 * 3. schema gate — full zod validation; strict objects reject unknown
 *    (vendor/engine) fields; negotiation-consistency refinements reject
 *    drifted effective limits; failures surface as `malformed-record`
 *    with precise dotted paths;
 * 4. digest gate — the claimed digest must match the recomputed canonical
 *    SHA-256 (`digest-mismatch`);
 * 5. tenant gate — the optional caller-supplied expected tenant must match
 *    the document scope (`cross-tenant-denied`, R12).
 *
 * Renderer descriptors are declarations (like the W011 device
 * descriptor): they carry no protocolVersion or digest, so their
 * admission is the schema gate alone.
 */
import { RendererDescriptorSchema, type RendererDescriptor } from './descriptor';
import { RendererBindingSchema, type RendererBinding } from './binding';
import { RendererReceiptSchema, type RendererReceipt } from './receipt';
import { malformedRecordError } from './issues';
import { verifyRendererBindingDigest, verifyRendererReceiptDigest } from './serialize';
import { RENDERER_PROTOCOL_VERSION } from './version';
import type { RendererRuntimeError, RendererRuntimeResult } from './errors';

/** Options shared by the admission entry points. */
export interface AdmissionOptions {
  /**
   * The tenant the caller is admitting FOR. When provided, a document
   * scoped to a different tenant is rejected with `cross-tenant-denied`
   * (R12 — the hosting boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

function rootShapeError(): RendererRuntimeError {
  return {
    code: 'malformed-record',
    message: 'renderer document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown): RendererRuntimeError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== RENDERER_PROTOCOL_VERSION) {
    return {
      code: 'version-unsupported',
      message: `protocol version mismatch: expected ${RENDERER_PROTOCOL_VERSION}, encountered ${encountered}`,
      expected: RENDERER_PROTOCOL_VERSION,
      encountered,
    };
  }
  return null;
}

function tenantDenial(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): RendererRuntimeError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant document denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

/**
 * Parse, validate, and admit a serialized renderer descriptor (the
 * abstract declaration). Total: schema violations surface as typed
 * `malformed-record` issues with precise dotted paths (strict objects
 * reject unknown — vendor/engine — fields).
 */
export function parseRendererDescriptor(
  input: unknown,
): RendererRuntimeResult<RendererDescriptor> {
  const parsed = RendererDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse, validate, and admit a serialized renderer binding. Total; see
 * the module docs for the fixed precedence of typed errors.
 */
export function parseRendererBinding(
  input: unknown,
  options?: AdmissionOptions,
): RendererRuntimeResult<RendererBinding> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate (structure, strictness, negotiation).
  const schemaParsed = RendererBindingSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedRecordError(schemaParsed.error) };
  }
  const binding = schemaParsed.data;

  // Precedence 4: digest gate (tamper detection).
  const digestVerified = verifyRendererBindingDigest(binding);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== binding.device.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['device', 'tenantScope', 'tenantId'],
        options.expectedTenantId,
        binding.device.tenantScope.tenantId,
      ),
    };
  }

  return { ok: true, value: binding };
}

/**
 * Parse, validate, and admit a serialized renderer receipt. Total; see
 * the module docs for the fixed precedence of typed errors.
 */
export function parseRendererReceipt(
  input: unknown,
  options?: AdmissionOptions,
): RendererRuntimeResult<RendererReceipt> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate (structure, strictness).
  const schemaParsed = RendererReceiptSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedRecordError(schemaParsed.error) };
  }
  const receipt = schemaParsed.data;

  // Precedence 4: digest gate (tamper detection).
  const digestVerified = verifyRendererReceiptDigest(receipt);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== receipt.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        receipt.tenantScope.tenantId,
      ),
    };
  }

  return { ok: true, value: receipt };
}
