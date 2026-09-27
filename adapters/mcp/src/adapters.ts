/**
 * @epoch/adapter-mcp — the W007 adapter surfaces (the reference
 * implementations of the SDK's per-category contracts).
 *
 * `McpActionAdapter` implements `ActionAdapter` (the neutral action
 * envelope -> the routed invocation with the authority's typed
 * records); `McpEvaluatorAdapter` implements `EvaluatorAdapter` (the
 * neutral evaluator envelope -> the typed verdict over a recorded
 * invocation).
 *
 * Every invocation is TOTAL (typed errors, never thrown) and runs the
 * same discipline:
 * 1. envelope admission — the SDK's `parseAdapterRequest` (strict
 *    objects reject unknown fields);
 * 2. binding check — the envelope's pin must reference THIS adapter's
 *    descriptor (identity + digest) and category — else the typed
 *    `binding-conflict`;
 * 3. tenant gate — the payload's tenant must match the pinned tenant —
 *    else the typed `tenant-isolation-rejected`;
 * 4. domain gates — credential-shaped parameters are rejected
 *    (`credential-rejected`) BEFORE any proposal exists; a request for
 *    direct execution is the typed `gateway-bypass-rejected`;
 * 5. domain logic (routing / judgment), mapped onto the SDK's
 *    per-category response payloads.
 */
import type {
  AdapterRequestEnvelope,
  AdapterResponseEnvelope,
  BindingPin,
  ActionAdapter,
  EvaluatorAdapter,
  EvaluatorRequestPayload,
} from '@epoch/adapter-sdk';
import { parseAdapterRequest } from '@epoch/adapter-sdk';
import type { JsonValue, Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import {
  buildInvocationProposal,
  credentialGate,
  routeInvocation,
  toolArgumentGate,
  verifyInvocationRecord,
} from './action';
import { evaluateInvocation } from './evaluation';
import type { ToolInvocationSurface, ToolInvocationRecord } from './types';
import {
  ACTION_ADAPTER_DESCRIPTOR,
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  EVALUATOR_ADAPTER_DESCRIPTOR,
  EVALUATOR_ADAPTER_DESCRIPTOR_DIGEST,
} from './descriptor';
import { EnvelopeCriteriaSchema, InvocationInputSchema } from './schema';
import type { McpAdapterResult } from './errors';

function validationFailure(
  message: string,
  issues: readonly { path: string; message: string }[],
): McpAdapterResult<never> {
  return { ok: false, error: { code: 'validation', message, issues } };
}

/** Flatten an SDK admission error into the adapter's issue list (typed). */
function sdkIssues(message: string): readonly { path: string; message: string }[] {
  return [{ path: '$', message }];
}

/** Check the envelope's binding pin against this adapter surface. */
function checkBinding(
  binding: BindingPin,
  adapterId: string,
  descriptorDigest: string,
  category: string,
): McpAdapterResult<true> {
  if (binding.adapterId !== adapterId || binding.adapterDescriptorDigest !== descriptorDigest) {
    return {
      ok: false,
      error: {
        code: 'binding-conflict',
        message: `the invocation envelope is not bound to this adapter surface (${category} "${adapterId}" at revision ${descriptorDigest})`,
        expected: `${adapterId}@${descriptorDigest}`,
        encountered: `${binding.adapterId}@${binding.adapterDescriptorDigest}`,
      },
    };
  }
  return { ok: true, value: true };
}

/** Tenant gate shared by both surfaces. */
function tenantGate(tenantId: TenantId, expected: TenantId | undefined): McpAdapterResult<TenantId> {
  if (expected !== undefined && tenantId !== expected) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `this adapter surface is pinned to tenant "${expected}" — the invocation named tenant "${tenantId}"`,
        expectedTenantId: expected,
        encounteredTenantId: tenantId,
      },
    };
  }
  return { ok: true, value: tenantId };
}

/** Options of {@link McpActionAdapter}. */
export interface McpActionAdapterOptions {
  /** The discovered invocation surfaces (from {@link discoverTools}). */
  readonly surfaces: readonly ToolInvocationSurface[];
  readonly authority: import('./types').ActionAuthorityPort;
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The reference action adapter: the tool-invocation routing surface.
 * Every invocation builds the deterministic W003 proposal from the
 * neutral parameters and routes it through the authority seam; the
 * response maps the authority's records onto the SDK's neutral action
 * payload (executed iff the authority authorized AND the dispatch
 * succeeded).
 *
 * A request carrying `mode: "execute-direct"` is the typed
 * `gateway-bypass-rejected` — the adapter NEVER executes directly.
 * Parameters carrying credential-shaped keys are the typed
 * `credential-rejected` — the adapter holds NO credentials.
 */
export class McpActionAdapter implements ActionAdapter {
  readonly descriptor = ACTION_ADAPTER_DESCRIPTOR;
  private readonly surfaces: ReadonlyMap<string, ToolInvocationSurface>;
  private readonly authority: import('./types').ActionAuthorityPort;
  private readonly expectedTenantId: TenantId | undefined;
  /** The routed invocation records, keyed by invocation id (the evaluation subjects). */
  private readonly invocations = new Map<string, ToolInvocationRecord>();

  constructor(options: McpActionAdapterOptions) {
    this.surfaces = new Map(options.surfaces.map((surface) => [surface.toolRef, surface]));
    this.authority = options.authority;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The routed invocation records (read view for the evaluator + tests). */
  invocationStore(): ReadonlyMap<string, ToolInvocationRecord> {
    return this.invocations;
  }

  /** The typed domain operation: build + route one tool invocation. */
  route(inputs: {
    readonly tenant: TenantId;
    readonly tool: string;
    readonly arguments: Readonly<Record<string, JsonValue>>;
    readonly actionId: string;
    readonly authority: { principalId: string; context: unknown; justification?: string | undefined };
    readonly approval?: { deadline: string; maxDelegationDepth: number } | undefined;
    readonly decidedAt: string;
    readonly executedAt: string;
  }): McpAdapterResult<ToolInvocationRecord> {
    const gate = tenantGate(inputs.tenant, this.expectedTenantId);
    if (!gate.ok) return gate;
    const credentials = credentialGate(inputs.arguments);
    if (!credentials.ok) return credentials;
    const surface = this.surfaces.get(inputs.tool);
    if (surface === undefined) {
      return validationFailure(`no discovered invocation surface for tool "${inputs.tool}"`, [
        { path: '$.tool', message: `unknown tool reference "${inputs.tool}" (discover the catalog first)` },
      ]);
    }
    const argumentsConform = toolArgumentGate(surface, inputs.arguments);
    if (!argumentsConform.ok) return argumentsConform;

    const plan = buildInvocationProposal({
      tenantId: inputs.tenant,
      toolRef: inputs.tool,
      actionId: inputs.actionId,
      arguments: inputs.arguments,
      proposedAt: inputs.decidedAt,
    });
    const invocation = routeInvocation({
      plan,
      arguments: inputs.arguments,
      authority: this.authority,
      authorization: inputs.authority,
      approval: inputs.approval,
      decidedAt: inputs.decidedAt,
      executedAt: inputs.executedAt,
    });
    if (invocation.ok) {
      this.invocations.set(invocation.value.invocationId, invocation.value);
    }
    return invocation;
  }

  async invoke(request: AdapterRequestEnvelope<'action'>): Promise<AdapterResponseEnvelope<'action'>> {
    const outcome = this.invokeTotal(request);
    if (outcome.ok) return outcome.value;
    throw new Error(`adapter invocation failed (${outcome.error.code}): ${outcome.error.message}`);
  }

  /** Total form of {@link invoke} (typed errors, never thrown). */
  invokeTotal(request: AdapterRequestEnvelope<'action'>): McpAdapterResult<AdapterResponseEnvelope<'action'>> {
    const admitted = parseAdapterRequest(request);
    if (!admitted.ok) {
      return validationFailure(admitted.error.message, sdkIssues(admitted.error.message));
    }
    const envelope = admitted.value;
    if (envelope.category !== 'action') {
      return {
        ok: false,
        error: {
          code: 'binding-conflict',
          message: `this surface implements the action contract; the envelope targets ${envelope.category}`,
          expected: 'action',
          encountered: envelope.category,
        },
      };
    }
    const binding = checkBinding(envelope.binding, this.descriptor.adapterId, ACTION_ADAPTER_DESCRIPTOR_DIGEST, 'action');
    if (!binding.ok) return binding;
    const parameters = InvocationInputSchema.safeParse(envelope.payload.parameters);
    if (!parameters.success) {
      return validationFailure('the neutral invocation parameters are malformed', parameters.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$.parameters' : `$.parameters.${issue.path.join('.')}`,
        message: issue.message,
      })));
    }
    const data = parameters.data;
    if (data.mode !== undefined && data.mode !== 'propose') {
      return {
        ok: false,
        error: {
          code: 'gateway-bypass-rejected',
          message: `direct execution mode "${data.mode}" is rejected — this adapter routes tool-invocation proposals through the action-authority seam and NEVER executes directly`,
          attemptedMode: data.mode,
        },
      };
    }

    const actionId = `action:${data.tool.replace(/^tool:/, '')}-${canonicalSeedOf(data.arguments, data['decided-at'])}`;
    const invocation = this.route({
      tenant: data.tenant,
      tool: data.tool,
      arguments: data.arguments,
      actionId,
      authority: {
        principalId: data.authority.principalId,
        context: data.authority.context,
        ...(data.authority.justification !== undefined ? { justification: data.authority.justification } : {}),
      },
      ...(data.approval !== undefined ? { approval: data.approval } : {}),
      decidedAt: data['decided-at'],
      executedAt: data['decided-at'],
    });
    if (!invocation.ok) return invocation;
    const record = invocation.value;
    const payload: AdapterResponseEnvelope<'action'>['payload'] =
      record.disposition === 'executed'
        ? { status: 'executed' }
        : { status: 'failed', failure: envelopeFailureOf(record) };
    const response: AdapterResponseEnvelope<'action'> = {
      schemaVersion: 1,
      category: 'action',
      binding: {
        capabilityId: this.descriptor.binding.capabilityId,
        capabilityVersion: envelope.binding.capabilityVersion,
        manifestDigest: envelope.binding.manifestDigest,
        adapterId: this.descriptor.adapterId,
        adapterDescriptorDigest: ACTION_ADAPTER_DESCRIPTOR_DIGEST,
      },
      payload,
    };
    return { ok: true, value: response };
  }
}

/** Deterministic action-id seed from the neutral invocation parameters. */
function canonicalSeedOf(
  args: Readonly<Record<string, JsonValue>>,
  decidedAt: Timestamp,
): string {
  const seed = `${JSON.stringify(args)}|${decidedAt}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return seed.slice(0, 24) || 'invocation';
}

/** Options of {@link McpEvaluatorAdapter}. */
export interface McpEvaluatorAdapterOptions {
  /** The invocation record store (typically the action adapter's store). */
  readonly invocations: ReadonlyMap<string, ToolInvocationRecord>;
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The reference evaluator adapter: the invocation-outcome judgment
 * surface. Every invocation judges a RECORDED tool invocation against
 * the declared criteria; verdicts carry mandatory justification.
 */
export class McpEvaluatorAdapter implements EvaluatorAdapter {
  readonly descriptor = EVALUATOR_ADAPTER_DESCRIPTOR;
  private readonly invocations: ReadonlyMap<string, ToolInvocationRecord>;
  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: McpEvaluatorAdapterOptions) {
    this.invocations = options.invocations;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The typed domain operation: judge a recorded invocation. */
  judge(inputs: {
    readonly tenant: TenantId;
    readonly subjectId: string;
    readonly subjectDigest: string;
    readonly criteria: { 'expected-disposition': string; 'require-evidence'?: boolean };
  }): McpAdapterResult<import('./types').InvocationEvaluation> {
    const gate = tenantGate(inputs.tenant, this.expectedTenantId);
    if (!gate.ok) return gate;
    return evaluateInvocation(
      {
        tenantId: inputs.tenant,
        subjectId: inputs.subjectId,
        subjectDigest: inputs.subjectDigest,
        criteria: inputs.criteria as import('./types').InvocationCriteria,
      },
      this.invocations,
    );
  }

  async invoke(request: AdapterRequestEnvelope<'evaluator'>): Promise<AdapterResponseEnvelope<'evaluator'>> {
    const outcome = this.invokeTotal(request);
    if (outcome.ok) return outcome.value;
    throw new Error(`adapter invocation failed (${outcome.error.code}): ${outcome.error.message}`);
  }

  /** Total form of {@link invoke} (typed errors, never thrown). */
  invokeTotal(request: AdapterRequestEnvelope<'evaluator'>): McpAdapterResult<AdapterResponseEnvelope<'evaluator'>> {
    const admitted = parseAdapterRequest(request);
    if (!admitted.ok) {
      return validationFailure(admitted.error.message, sdkIssues(admitted.error.message));
    }
    const envelope = admitted.value;
    if (envelope.category !== 'evaluator') {
      return {
        ok: false,
        error: {
          code: 'binding-conflict',
          message: `this surface implements the evaluator contract; the envelope targets ${envelope.category}`,
          expected: 'evaluator',
          encountered: envelope.category,
        },
      };
    }
    const binding = checkBinding(envelope.binding, this.descriptor.adapterId, EVALUATOR_ADAPTER_DESCRIPTOR_DIGEST, 'evaluator');
    if (!binding.ok) return binding;
    const criteria = EnvelopeCriteriaSchema.safeParse(envelope.payload.criteria);
    if (!criteria.success) {
      return validationFailure('the neutral evaluation criteria are malformed', criteria.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$.criteria' : `$.criteria.${issue.path.join('.')}`,
        message: issue.message,
      })));
    }
    const payload: EvaluatorRequestPayload = envelope.payload;
    const evaluation = this.judge({
      tenant: criteria.data.tenant,
      subjectId: payload.subject.subjectId,
      subjectDigest: payload.subject.subjectDigest,
      criteria: {
        'expected-disposition': criteria.data['expected-disposition'],
        ...(criteria.data['require-evidence'] !== undefined
          ? { 'require-evidence': criteria.data['require-evidence'] }
          : {}),
      },
    });
    if (!evaluation.ok) return evaluation;
    const response: AdapterResponseEnvelope<'evaluator'> = {
      schemaVersion: 1,
      category: 'evaluator',
      binding: {
        capabilityId: this.descriptor.binding.capabilityId,
        capabilityVersion: envelope.binding.capabilityVersion,
        manifestDigest: envelope.binding.manifestDigest,
        adapterId: this.descriptor.adapterId,
        adapterDescriptorDigest: EVALUATOR_ADAPTER_DESCRIPTOR_DIGEST,
      },
      payload: {
        verdict: evaluation.value.verdict,
        justification: evaluation.value.justification,
      },
    };
    return { ok: true, value: response };
  }
}

/** Map a routed invocation's disposition onto the SDK's neutral failure vocabulary. */
function envelopeFailureOf(record: ToolInvocationRecord): {
  code: 'precondition-not-met' | 'execution-rejected' | 'internal-error';
  message: string;
} {
  switch (record.disposition) {
    case 'authority-denied':
      return {
        code: 'execution-rejected',
        message: `authority-denied (${record.decision.denialCode ?? 'unknown'}): ${record.decision.denialReason ?? 'the action authority denied the proposal'}`,
      };
    case 'authority-pending-approval':
      return {
        code: 'precondition-not-met',
        message: `authority-pending-approval: the action authority requires human approval before execution (decision ${record.decision.decisionDigest})`,
      };
    case 'execution-failed': {
      const failure = record.outcome?.failure;
      return {
        code: 'internal-error',
        message: `execution-failed (${failure?.code ?? 'unknown'}): ${failure?.reason ?? 'the authority-recorded execution failed'}`,
      };
    }
    default:
      return { code: 'internal-error', message: 'executed' };
  }
}

/** Re-export the record verifier (host-observable convenience). */
export { verifyInvocationRecord };
