/**
 * @epoch/adapter-ifc — the W007 adapter surfaces (the reference
 * implementations of the SDK's per-category contracts).
 *
 * `IfcSourceAdapter` implements `SourceAdapter` (the neutral
 * named-parameter envelope -> the model observation record);
 * `IfcSemanticAdapter` implements `SemanticAdapter` (the neutral
 * envelope -> the world-model assertion-input projection).
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
 * 4. authority check — a projection request naming an
 *    authoritative/direct mode is the typed
 *    `external-semantics-not-authority` (external-standard semantics
 *    are ADAPTED into world-model inputs, never authoritative);
 * 5. domain logic (observation / projection), mapped onto the SDK's
 *    per-category response payloads.
 */
import type {
  AdapterRequestEnvelope,
  AdapterResponseEnvelope,
  BindingPin,
  SourceAdapter,
  SemanticAdapter,
} from '@epoch/adapter-sdk';
import { parseAdapterRequest } from '@epoch/adapter-sdk';
import type { JsonValue } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import { IfcAdapterHost } from './ingestion';
import { observeModel, projectModel } from './projection';
import {
  SOURCE_ADAPTER_DESCRIPTOR,
  SOURCE_ADAPTER_DESCRIPTOR_DIGEST,
  SEMANTIC_ADAPTER_DESCRIPTOR,
  SEMANTIC_ADAPTER_DESCRIPTOR_DIGEST,
} from './descriptor';
import { ProjectionRequestSchema } from './schema';
import type { BuildingModelObservation, BuildingModelProjection } from './types';
import type { IfcAdapterResult } from './errors';

function validationFailure(
  message: string,
  issues: readonly { path: string; message: string }[],
): IfcAdapterResult<never> {
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
): IfcAdapterResult<true> {
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
function tenantGate(tenantId: TenantId, expected: TenantId | undefined): IfcAdapterResult<TenantId> {
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

/** Options of {@link IfcSourceAdapter}. */
export interface IfcSourceAdapterOptions {
  readonly host: IfcAdapterHost;
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The reference source adapter: the building-model observation surface.
 * Every invocation observes the workspace's CURRENT sealed model as a
 * content-addressed, provenance-carrying record (the W006
 * exact-revision conventions).
 */
export class IfcSourceAdapter implements SourceAdapter {
  readonly descriptor = SOURCE_ADAPTER_DESCRIPTOR;
  private readonly host: IfcAdapterHost;
  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: IfcSourceAdapterOptions) {
    this.host = options.host;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The typed domain operation: observe a sealed building model. */
  observe(inputs: { readonly tenant: TenantId; readonly model: string }): IfcAdapterResult<BuildingModelObservation> {
    const gate = tenantGate(inputs.tenant, this.expectedTenantId);
    if (!gate.ok) return gate;
    const sealed = this.host.sealedModel(inputs.tenant, inputs.model);
    if (!sealed.ok) {
      return validationFailure(sealed.error.message, [
        { path: '$.model', message: sealed.error.message },
      ]);
    }
    return {
      ok: true,
      value: observeModel({
        tenantId: sealed.value.record.tenantId,
        model: sealed.value.model,
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
  invokeTotal(request: AdapterRequestEnvelope<'source'>): IfcAdapterResult<AdapterResponseEnvelope<'source'>> {
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
    const inputs = ProjectionRequestSchema.safeParse(envelope.payload.inputs);
    if (!inputs.success) {
      return validationFailure('the neutral observation inputs are malformed', inputs.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$.inputs' : `$.inputs.${issue.path.join('.')}`,
        message: issue.message,
      })));
    }
    const domain = this.observe({ tenant: inputs.data.tenant, model: inputs.data.model });
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
          observation: domain.value as unknown as Record<string, JsonValue>,
          'observation-digest': domain.value.contentDigest,
        },
      },
    };
    return { ok: true, value: response };
  }
}

/** Options of {@link IfcSemanticAdapter}. */
export interface IfcSemanticAdapterOptions {
  readonly host: IfcAdapterHost;
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The reference semantic adapter: the building-model projection
 * surface. Every invocation maps the sealed model INTO the world-model
 * graph as REAL W002 assertion inputs — the ADAPTED semantics are
 * INPUT records for the world-model authority, never authority
 * themselves. A request naming an authoritative/direct mode is the
 * typed `external-semantics-not-authority`.
 */
export class IfcSemanticAdapter implements SemanticAdapter {
  readonly descriptor = SEMANTIC_ADAPTER_DESCRIPTOR;
  private readonly host: IfcAdapterHost;
  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: IfcSemanticAdapterOptions) {
    this.host = options.host;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The typed domain operation: project a sealed building model. */
  project(inputs: { readonly tenant: TenantId; readonly model: string }): IfcAdapterResult<BuildingModelProjection> {
    const gate = tenantGate(inputs.tenant, this.expectedTenantId);
    if (!gate.ok) return gate;
    const sealed = this.host.sealedModel(inputs.tenant, inputs.model);
    if (!sealed.ok) {
      return validationFailure(sealed.error.message, [
        { path: '$.model', message: sealed.error.message },
      ]);
    }
    return {
      ok: true,
      value: projectModel({
        tenantId: sealed.value.record.tenantId,
        model: sealed.value.model,
        observedAt: sealed.value.record.ingestedAt,
      }),
    };
  }

  async invoke(request: AdapterRequestEnvelope<'semantic'>): Promise<AdapterResponseEnvelope<'semantic'>> {
    const outcome = this.invokeTotal(request);
    if (outcome.ok) return outcome.value;
    throw new Error(`adapter invocation failed (${outcome.error.code}): ${outcome.error.message}`);
  }

  /** Total form of {@link invoke} (typed errors, never thrown). */
  invokeTotal(request: AdapterRequestEnvelope<'semantic'>): IfcAdapterResult<AdapterResponseEnvelope<'semantic'>> {
    const admitted = parseAdapterRequest(request);
    if (!admitted.ok) {
      return validationFailure(admitted.error.message, sdkIssues(admitted.error.message));
    }
    const envelope = admitted.value;
    if (envelope.category !== 'semantic') {
      return {
        ok: false,
        error: {
          code: 'binding-conflict',
          message: `this surface implements the semantic contract; the envelope targets ${envelope.category}`,
          expected: 'semantic',
          encountered: envelope.category,
        },
      };
    }
    const binding = checkBinding(envelope.binding, this.descriptor.adapterId, SEMANTIC_ADAPTER_DESCRIPTOR_DIGEST, 'semantic');
    if (!binding.ok) return binding;
    const inputs = ProjectionRequestSchema.safeParse(envelope.payload.inputs);
    if (!inputs.success) {
      return validationFailure('the neutral projection inputs are malformed', inputs.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? '$.inputs' : `$.inputs.${issue.path.join('.')}`,
        message: issue.message,
      })));
    }
    if (inputs.data.mode !== undefined && inputs.data.mode !== 'projected') {
      return {
        ok: false,
        error: {
          code: 'external-semantics-not-authority',
          message: `projection mode "${inputs.data.mode}" is rejected — external-standard semantics are ADAPTED into world-model assertion inputs and are never authoritative (the world model authority admits them, never this adapter)`,
          attemptedMode: inputs.data.mode,
        },
      };
    }
    const domain = this.project({ tenant: inputs.data.tenant, model: inputs.data.model });
    if (!domain.ok) return domain;
    const response: AdapterResponseEnvelope<'semantic'> = {
      schemaVersion: 1,
      category: 'semantic',
      binding: {
        capabilityId: this.descriptor.binding.capabilityId,
        capabilityVersion: envelope.binding.capabilityVersion,
        manifestDigest: envelope.binding.manifestDigest,
        adapterId: this.descriptor.adapterId,
        adapterDescriptorDigest: SEMANTIC_ADAPTER_DESCRIPTOR_DIGEST,
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
