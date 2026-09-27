/**
 * @epoch/adapter-github — the W007 adapter surfaces (the reference
 * implementations of the SDK's per-category contracts).
 *
 * `GithubSourceAdapter` implements `SourceAdapter` (the neutral
 * named-parameter envelope -> the projection outputs);
 * `GithubActionAdapter` implements `ActionAdapter` (the neutral action
 * envelope -> the routed change with the authority's typed records).
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
 * 4. domain logic (projection / proposal routing), mapped onto the
 *    SDK's per-category response payloads.
 */
import type {
  AdapterRequestEnvelope,
  AdapterResponseEnvelope,
  BindingPin,
  SourceAdapter,
  ActionAdapter,
} from '@epoch/adapter-sdk';
import { parseAdapterRequest } from '@epoch/adapter-sdk';
import type { JsonValue } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import { GithubAdapterHost } from './ingestion';
import { projectSnapshot } from './projection';
import { buildChangeProposal, routeChange } from './action';
import {
  ACTION_ADAPTER_DESCRIPTOR,
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  SOURCE_ADAPTER_DESCRIPTOR,
  SOURCE_ADAPTER_DESCRIPTOR_DIGEST,
} from './descriptor';
import { ChangeRoutingInputSchema, ProjectionInputSchema } from './schema';
import type {
  ChangeDispatchRecord,
  ChangeProposalPlan,
  WorkspaceProjection,
  ActionAuthorityPort,
} from './types';
import type { GithubAdapterResult } from './errors';

function validationFailure(
  message: string,
  issues: readonly { path: string; message: string }[],
): GithubAdapterResult<never> {
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
): GithubAdapterResult<true> {
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
function tenantGate(tenantId: TenantId, expected: TenantId | undefined): GithubAdapterResult<TenantId> {
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

/** Options of {@link GithubSourceAdapter}. */
export interface GithubSourceAdapterOptions {
  readonly host: GithubAdapterHost;
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The reference source adapter: the hosted software-workspace
 * observation surface. Construct with the shared host (the sealed
 * snapshot store) and the pinned tenant; every invocation projects the
 * workspace's CURRENT sealed snapshot into W002-convention observation
 * records.
 */
export class GithubSourceAdapter implements SourceAdapter {
  readonly descriptor = SOURCE_ADAPTER_DESCRIPTOR;
  private readonly host: GithubAdapterHost;
  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: GithubSourceAdapterOptions) {
    this.host = options.host;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The typed domain operation: project a sealed workspace snapshot. */
  project(inputs: { readonly tenant: TenantId; readonly workspace: string }): GithubAdapterResult<WorkspaceProjection> {
    const gate = tenantGate(inputs.tenant, this.expectedTenantId);
    if (!gate.ok) return gate;
    const sealed = this.host.sealedSnapshot(inputs.tenant, inputs.workspace);
    if (!sealed.ok) {
      return validationFailure(sealed.error.message, [
        { path: '$.workspace', message: sealed.error.message },
      ]);
    }
    return {
      ok: true,
      value: projectSnapshot({
        tenantId: sealed.value.record.tenantId,
        snapshot: sealed.value.snapshot,
        observedAt: sealed.value.record.ingestedAt,
      }),
    };
  }

  async invoke(request: AdapterRequestEnvelope<'source'>): Promise<AdapterResponseEnvelope<'source'>> {
    const outcome = this.invokeTotal(request);
    if (outcome.ok) return outcome.value;
    throw new Error(`adapter invocation failed (${outcome.error.code}): ${outcome.error.message}`);
  }

  /** Total form of {@link invoke} (typed errors, never thrown). */
  invokeTotal(request: AdapterRequestEnvelope<'source'>): GithubAdapterResult<AdapterResponseEnvelope<'source'>> {
    const admitted = parseAdapterRequest(request);
    if (!admitted.ok) {
      return validationFailure(admitted.error.message, sdkIssues(admitted.error.message));
    }
    const envelope = admitted.value;
    if (envelope.category !== 'source') {
      return {
        ok: false,
        error: {
          code: 'binding-conflict',
          message: `this surface implements the source contract; the envelope targets ${envelope.category}`,
          expected: 'source',
          encountered: envelope.category,
        },
      };
    }
    const binding = checkBinding(envelope.binding, this.descriptor.adapterId, SOURCE_ADAPTER_DESCRIPTOR_DIGEST, 'source');
    if (!binding.ok) return binding;
    const inputs = ProjectionInputSchema.safeParse(envelope.payload.inputs);
    if (!inputs.success) {
      return validationFailure('the neutral projection inputs are malformed', inputs.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$.inputs' : `$.inputs.${issue.path.join('.')}`,
        message: issue.message,
      })));
    }
    const domain = this.project({ tenant: inputs.data.tenant, workspace: inputs.data.workspace });
    if (!domain.ok) return domain;
    const response: AdapterResponseEnvelope<'source'> = {
      schemaVersion: 1,
      category: 'source',
      binding: {
        capabilityId: this.descriptor.binding.capabilityId,
        capabilityVersion: envelope.binding.capabilityVersion,
        manifestDigest: envelope.binding.manifestDigest,
        adapterId: this.descriptor.adapterId,
        adapterDescriptorDigest: SOURCE_ADAPTER_DESCRIPTOR_DIGEST,
      },
      payload: {
        outputs: {
          projection: domain.value as unknown as Record<string, JsonValue>,
          'projection-digest': domain.value.projectionDigest,
        },
      },
    };
    return { ok: true, value: response };
  }
}

/** Options of {@link GithubActionAdapter}. */
export interface GithubActionAdapterOptions {
  readonly host: GithubAdapterHost;
  readonly authority: ActionAuthorityPort;
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The reference action adapter: the change-routing surface. Every
 * invocation builds the deterministic W003 proposal from the neutral
 * parameters and routes it through the authority seam; the response
 * maps the authority's records onto the SDK's neutral action payload
 * (executed iff the authority allowed AND the dispatch succeeded).
 *
 * A request carrying `mode: "execute-direct"` is the typed
 * `gateway-bypass-rejected` — the adapter NEVER executes directly.
 */
export class GithubActionAdapter implements ActionAdapter {
  readonly descriptor = ACTION_ADAPTER_DESCRIPTOR;
  private readonly host: GithubAdapterHost;
  private readonly authority: ActionAuthorityPort;
  private readonly expectedTenantId: TenantId | undefined;
  /** The last routed dispatch (host-observable, for tests/audit). */
  private lastDispatch: ChangeDispatchRecord | undefined;

  constructor(options: GithubActionAdapterOptions) {
    this.host = options.host;
    this.authority = options.authority;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The last routed dispatch record (if any). */
  dispatched(): ChangeDispatchRecord | undefined {
    return this.lastDispatch;
  }

  /** The typed domain operation: build + route one change proposal. */
  route(inputs: {
    readonly tenant: TenantId;
    readonly workspace: string;
    readonly changeKind: 'revision' | 'integration';
    readonly summary: string;
    readonly subjectRevision?: string | undefined;
    readonly baseRevision?: string | undefined;
    readonly actionId: string;
    readonly authority: { principalId: string; context: unknown; justification?: string | undefined };
    readonly approval?: { deadline: string; maxDelegationDepth: number } | undefined;
    readonly decidedAt: string;
    readonly executedAt: string;
  }): GithubAdapterResult<ChangeDispatchRecord> {
    const gate = tenantGate(inputs.tenant, this.expectedTenantId);
    if (!gate.ok) return gate;
    const sealed = this.host.sealedSnapshot(inputs.tenant, inputs.workspace);
    if (!sealed.ok) {
      return validationFailure(sealed.error.message, [
        { path: '$.workspace', message: sealed.error.message },
      ]);
    }
    const plan: ChangeProposalPlan = buildChangeProposal({
      tenantId: inputs.tenant,
      workspaceId: inputs.workspace,
      changeKind: inputs.changeKind,
      actionId: inputs.actionId,
      summary: inputs.summary,
      subjectRevision: inputs.subjectRevision,
      baseRevision: inputs.baseRevision,
      proposedAt: inputs.decidedAt,
    });
    const dispatch = routeChange({
      plan,
      authority: this.authority,
      authorization: inputs.authority,
      approval: inputs.approval,
      decidedAt: inputs.decidedAt,
      executedAt: inputs.executedAt,
    });
    if (dispatch.ok) {
      this.lastDispatch = dispatch.value;
    }
    return dispatch;
  }

  async invoke(request: AdapterRequestEnvelope<'action'>): Promise<AdapterResponseEnvelope<'action'>> {
    const outcome = this.invokeTotal(request);
    if (outcome.ok) return outcome.value;
    throw new Error(`adapter invocation failed (${outcome.error.code}): ${outcome.error.message}`);
  }

  /** Total form of {@link invoke} (typed errors, never thrown). */
  invokeTotal(request: AdapterRequestEnvelope<'action'>): GithubAdapterResult<AdapterResponseEnvelope<'action'>> {
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
    const parameters = ChangeRoutingInputSchema.safeParse(envelope.payload.parameters);
    if (!parameters.success) {
      return validationFailure('the neutral change-routing parameters are malformed', parameters.error.issues.map((issue) => ({
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
          message: `direct execution mode "${data.mode}" is rejected — this adapter routes proposals through the action-authority seam and NEVER executes directly`,
          attemptedMode: data.mode,
        },
      };
    }

    const actionId = deriveActionId(data.workspace, data['change-kind'], data.summary);
    const dispatch = this.route({
      tenant: data.tenant,
      workspace: data.workspace,
      changeKind: data['change-kind'],
      summary: data.summary,
      subjectRevision: data['subject-revision'],
      baseRevision: data['base-revision'],
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
    if (!dispatch.ok) return dispatch;
    const record = dispatch.value;
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

/** Deterministic action id derived from the neutral routing parameters. */
function deriveActionId(workspace: string, changeKind: string, summary: string): string {
  const seed = `${workspace}|${changeKind}|${summary}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `action:${seed.slice(0, 80) || 'change'}`;
}

/** Map a routed change's disposition onto the SDK's neutral failure vocabulary. */
function envelopeFailureOf(record: ChangeDispatchRecord): {
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
