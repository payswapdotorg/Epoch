/**
 * Total admission surface for serialized agent-orchestration documents.
 *
 * `parseOrchestrationPlan`, `parseOrchestratedAgent`, `parseCompiledPlan`,
 * `parseAgentBinding`, `parseOrchestrationSession` and `parseProposalHandoff`
 * never throw: every failure is a typed {@link OrchestrationError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically; the
 * W009/W010 parse precedent):
 *
 * 1. root shape — a non-object root is a `validation` error;
 * 2. version gate — a numeric `schemaVersion` that differs from 1 fails
 *    fast with `version-unsupported`;
 * 3. schema gate — full zod validation; strict objects reject unknown
 *    (vendor/provider) fields; failures surface as `validation` with
 *    precise dotted paths;
 * 4. digest gate (compiled plans only) — the claimed plan digest must
 *    match the recomputed canonical SHA-256 (`digest-mismatch`).
 */
import type { ZodType } from 'zod';
import {
  AgentBindingSchema,
  CompiledPlanSchema,
  OrchestrationPlanSchema,
  OrchestrationSessionSchema,
  OrchestratedAgentSchema,
  ProposalHandoffSchema,
} from './schema';
import { validationError } from './issues';
import { verifyCompiledPlanDigest } from './digest';
import type {
  AgentBinding,
  CompiledPlan,
  OrchestrationPlan,
  OrchestrationResult,
  OrchestrationSession,
  OrchestratedAgent,
  ProposalHandoff,
} from './types';

function rootShapeError(path: string) {
  return {
    code: 'validation' as const,
    message: 'orchestration document root must be a JSON object',
    issues: [{ path, message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown, path: string) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError(path);
  }
  const source = (input as Record<string, unknown>).schemaVersion;
  if (typeof source === 'number' && source !== 1) {
    return {
      code: 'version-unsupported' as const,
      message: `orchestration record version mismatch: expected 1, encountered ${source}`,
      expected: '1',
      encountered: String(source),
    };
  }
  return null;
}

/** Parse + validate through the shared precedence; generic over the document type. */
function admit<T>(
  input: unknown,
  schema: ZodType<T>,
  verify?: (value: T) => OrchestrationResult<T>,
): OrchestrationResult<T> {
  const versionFailure = versionGate(input, '$');
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  if (verify !== undefined) {
    return verify(parsed.data);
  }
  return { ok: true, value: parsed.data };
}

/** Admit an authored orchestration plan (version gate -> schema gate). Total. */
export function parseOrchestrationPlan(input: unknown): OrchestrationResult<OrchestrationPlan> {
  return admit(input, OrchestrationPlanSchema);
}

/** Admit an orchestrated agent descriptor (version gate -> schema gate). Total. */
export function parseOrchestratedAgent(input: unknown): OrchestrationResult<OrchestratedAgent> {
  return admit(input, OrchestratedAgentSchema);
}

/**
 * Admit a compiled plan (version gate -> schema gate -> digest gate).
 * Total; a tampered compiled plan (claimed digest ≠ recomputed digest of
 * its content) is rejected with `digest-mismatch`.
 */
export function parseCompiledPlan(input: unknown): OrchestrationResult<CompiledPlan> {
  return admit(input, CompiledPlanSchema, verifyCompiledPlanDigest);
}

/** Admit an agent binding (version gate -> schema gate). Total. */
export function parseAgentBinding(input: unknown): OrchestrationResult<AgentBinding> {
  return admit(input, AgentBindingSchema);
}

/** Admit an orchestration session (version gate -> schema gate). Total. */
export function parseOrchestrationSession(input: unknown): OrchestrationResult<OrchestrationSession> {
  return admit(input, OrchestrationSessionSchema);
}

/** Admit a proposal handoff record (version gate -> schema gate). Total. */
export function parseProposalHandoff(input: unknown): OrchestrationResult<ProposalHandoff> {
  return admit(input, ProposalHandoffSchema);
}
