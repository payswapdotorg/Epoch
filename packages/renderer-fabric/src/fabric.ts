/**
 * The RENDERER FABRIC (W056) — the provider-neutral orchestration layer:
 * resolve -> probe -> create session -> mount canonical projection ->
 * render/update -> translate input -> switch -> dispose.
 *
 * What the fabric OWNS (and only that):
 * - the adapter registry integration (capability-registry manifests +
 *   local adapter objects — src/registry.ts);
 * - the W013 boundary: every binding and invocation goes through the REAL
 *   @epoch/renderer-runtime admission (bindRendererSession,
 *   admitInvocation) — the fabric never bypasses the hosting surface;
 * - the canonical-projection mount pipeline: W016 world-experience
 *   compileWorldScene -> W013 mount-graph admission -> adapter mount;
 * - input normalization orchestration: adapter hit-test + normalization ->
 *   W016 intent admission (the Dynamic UI law) -> W013 submit-intent
 *   admission -> sealed intent receipt;
 * - the SWITCHING INVARIANT (see {@link RendererFabric.switchRenderer}).
 *
 * What the fabric NEVER does:
 * - it never persists anything: the session map is in-memory EPHEMERAL
 *   presentation state (no second semantic store — lock rule 8/16); there
 *   is no write API for any durable store;
 * - it never authors presentation: presentation is recreated from the
 *   canonical projection on every mount and switch;
 * - it never becomes semantic authority: world entities are referenced
 *   opaquely; the canonical scene object handed in is NEVER mutated
 *   (mount/switch are pure with respect to it);
 * - it never reads a wall clock or randomness: all times are
 *   caller-supplied virtual times; all ids are caller-scoped.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { CapabilityRegistry } from '@epoch/capability-registry';
import {
  DeviceSessionSnapshotSchema,
  RendererInputEnvelopeSchema,
  admitInvocation,
  bindRendererSession,
  captureSwitchReceiptContent,
  createRendererSessionContent,
  emptyPortableViewState,
  sealRendererSwitchReceipt,
  sealRendererSession,
  type DeviceSessionSnapshot,
  type FabricResult,
  type PortableViewState,
  type RendererBinding,
  type RendererFailure,
  type RendererFrameEnvelope,
  type RendererHealth,
  type RendererId,
  type RendererInputEnvelope,
  type RendererIntentReceipt,
  type RendererIntentReceiptContent,
  type RendererReceipt,
  type RendererRuntimeError,
  type RendererSession,
  type RendererSessionSnapshot,
  type RendererSwitchReceipt,
  type RendererSwitchRequest,
  type WorldProjectionRef,
} from '@epoch/renderer-runtime';
import {
  admitWorldIntent,
  compileFrameAdvance,
  compileIntentSubmission,
  compileWorldScene,
  controlIntentOf,
  type WorldOntology,
  type WorldScene,
} from '@epoch/world-experience';
import { RendererAdapterRegistry } from './registry';
import type {
  RendererAdapter,
  RendererAdapterSession,
  RendererMountInput,
} from './adapter';

/** One live fabric session: the sealed record plus its adapter state. */
interface LiveSession {
  record: RendererSession;
  adapter: RendererAdapter;
  adapterSession: RendererAdapterSession;
}

/** The input of {@link RendererFabric.createSession}. */
export interface CreateFabricSessionInput {
  /** The W013 renderer descriptor identity to present with. */
  readonly rendererId: RendererId;
  /** The device session the renderer binds to (W013 snapshot). */
  readonly device: DeviceSessionSnapshot;
  /** The canonical world projection reference (identity continuity). */
  readonly worldProjection: WorldProjectionRef;
  /** The initial portable view state (defaults to the paused empty state). */
  readonly viewState?: PortableViewState;
  /** The caller-scoped fabric session id ("fx-" grammar). */
  readonly fabricSessionId: string;
  /** Virtual time of the creation (caller-supplied). */
  readonly atMs: number;
  /** The tenant the caller acts FOR (R12 gate). */
  readonly expectedTenantId?: string;
}

/** The input of {@link RendererFabric.mountScene}. */
export interface MountSceneInput {
  /** The canonical world scene to present (NEVER mutated by the fabric). */
  readonly scene: WorldScene;
  /** The ontology resolving the scene's representation records. */
  readonly ontology: WorldOntology;
  readonly atMs: number;
  readonly expectedTenantId?: string;
}

/** The input of {@link RendererFabric.applyFrame}. */
export interface ApplyFrameInput {
  readonly atMs: number;
  /** Optional typed presentation fidelity (must be declared by the adapter). */
  readonly degradation?: 'reduced-fidelity' | 'static-frame' | 'wireframe';
}

/** The outcome of one applied frame. */
export interface FrameOutcome {
  readonly session: RendererSession;
  readonly frame: RendererFrameEnvelope;
  readonly presented: boolean;
  readonly degradation: string;
}

/** The outcome of one completed switch. */
export interface SwitchOutcome {
  /** The new active session (the switch target). */
  readonly session: RendererSession;
  /** The sealed switch receipt (content-addressed execution evidence). */
  readonly receipt: RendererSwitchReceipt;
  /** The disposed source session (terminal record). */
  readonly disposedSource: RendererSession;
  /** The portable fields the target actually restored (typed, listed). */
  readonly restoredViewFields: readonly string[];
  /** The portable fields the target's capability set cannot restore (typed, listed — never silent). */
  readonly skippedViewFields: readonly string[];
  /** Informational typed failure when a fallback (not the primary target) completed the switch. */
  readonly fallback?: RendererFailure;
}

/** The input of {@link RendererFabric.switchRenderer}'s canonical remount. */
export interface SwitchMountInput extends MountSceneInput {
  /** Virtual time the switch completes at. */
  readonly completedAtMs: number;
}

/** Map a typed W013 hosting error to a typed fabric failure (verbatim cause). */
function w013Failure(error: RendererRuntimeError): RendererFailure {
  if (error.code === 'cross-tenant-denied') {
    return {
      code: 'cross-tenant-denied',
      message: error.message,
      expectedTenantId: error.expectedTenantId,
      encounteredTenantId: error.encounteredTenantId,
    };
  }
  return {
    code: 'invalid-fabric-record',
    message: `the W013 hosting surface rejected the operation (${error.code}): ${error.message}`,
    issues: [{ path: 'admission', message: error.message }],
  };
}

/** Build the W013 budgets from a binding's effective limits. */
function budgetsOf(binding: RendererBinding) {
  return {
    maxGraphNodes: binding.effective.maxGraphNodes,
    maxGraphEdges: binding.effective.maxGraphEdges,
    maxTriangles: binding.effective.maxTriangles,
    maxTextureBytes: binding.effective.maxTextureBytes,
  };
}

/**
 * The Renderer Fabric. Construct directly; inject a capability registry to
 * share one registry with the rest of the host (the default is a fresh
 * in-memory registry).
 */
export class RendererFabric {
  private readonly registryAdapter: RendererAdapterRegistry;
  /** EPHEMERAL in-memory session map — presentation state ONLY. */
  private readonly sessions = new Map<string, LiveSession>();

  constructor(registry: CapabilityRegistry | RendererAdapterRegistry = new RendererAdapterRegistry()) {
    this.registryAdapter =
      registry instanceof RendererAdapterRegistry ? registry : new RendererAdapterRegistry(registry);
  }

  /** The adapter registry (registration + renderer-selector listing). */
  get adapters(): RendererAdapterRegistry {
    return this.registryAdapter;
  }

  // -------------------------------------------------------------------------
  // resolve / probe
  // -------------------------------------------------------------------------

  /** Resolve one renderer adapter by renderer id (lifecycle-aware). */
  resolveRenderer(rendererId: RendererId) {
    return this.registryAdapter.resolveByRendererId(rendererId);
  }

  /** Probe one renderer against a device session (no session created). */
  async probeRenderer(
    rendererId: RendererId,
    device: DeviceSessionSnapshot,
    atMs: number,
  ): Promise<FabricResult<{ compatible: boolean; reason?: string; degradation?: string }>> {
    const resolved = this.registryAdapter.resolveByRendererId(rendererId);
    if (!resolved.ok) {
      return resolved;
    }
    const probed = await resolved.value.adapter.probe({ device, atMs });
    if (!probed.ok) {
      return probed;
    }
    return {
      ok: true,
      value: {
        compatible: probed.value.compatible,
        reason: probed.value.reason,
        degradation: probed.value.degradation,
      },
    };
  }

  // -------------------------------------------------------------------------
  // create session
  // -------------------------------------------------------------------------

  /**
   * Create one ephemeral renderer session: resolve the adapter, tenant-gate
   * the device/world pairing, probe compatibility, bind through the REAL
   * W013 boundary, create the session content, and create the adapter
   * session. The session starts in `created` (mount pending).
   */
  async createSession(input: CreateFabricSessionInput): Promise<FabricResult<RendererSession>> {
    const resolved = this.registryAdapter.resolveByRendererId(input.rendererId);
    if (!resolved.ok) {
      return resolved;
    }
    const adapter = resolved.value.adapter;

    const deviceParsed = DeviceSessionSnapshotSchema.safeParse(input.device);
    if (!deviceParsed.success) {
      return {
        ok: false,
        error: {
          code: 'invalid-fabric-record',
          message: 'the device session snapshot failed schema validation',
          issues: deviceParsed.error.issues.map((issue) => ({
            path: issue.path.length === 0 ? 'device' : `device.${issue.path.map(String).join('.')}`,
            message: issue.message,
          })),
        },
      };
    }
    const device = deviceParsed.data;

    if (device.tenantScope.tenantId !== input.worldProjection.tenantScope.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `the device session (tenant "${device.tenantScope.tenantId}") cannot present the world projection of tenant "${input.worldProjection.tenantScope.tenantId}"`,
          expectedTenantId: input.worldProjection.tenantScope.tenantId,
          encounteredTenantId: device.tenantScope.tenantId,
        },
      };
    }

    const probed = await adapter.probe({ device, atMs: input.atMs });
    if (!probed.ok) {
      return probed;
    }
    if (!probed.value.compatible) {
      return {
        ok: false,
        error: {
          code: 'probe-rejected',
          message: `renderer "${input.rendererId}" is incompatible with device session "${device.deviceSessionId}"`,
          rendererId: input.rendererId,
          reason: probed.value.reason ?? 'incompatible',
        },
      };
    }

    const rendererSessionId = `rs-${input.fabricSessionId.slice(3)}`;
    const bound = bindRendererSession(
      { rendererSessionId, renderer: adapter.descriptor(), device, boundAtMs: input.atMs },
      { expectedTenantId: input.expectedTenantId },
    );
    if (!bound.ok) {
      return { ok: false, error: w013Failure(bound.error) };
    }

    const created = createRendererSessionContent({
      fabricSessionId: input.fabricSessionId,
      capabilityId: resolved.value.record.manifest.capabilityId,
      binding: bound.value,
      capabilities: adapter.capabilities(),
      worldProjection: input.worldProjection,
      viewState: input.viewState ?? emptyPortableViewState(input.atMs),
      createdAtMs: input.atMs,
    });
    if (!created.ok) {
      return created;
    }

    const adapterSession = await adapter.createSession({
      fabricSessionId: input.fabricSessionId,
      binding: bound.value,
      worldProjection: input.worldProjection,
      viewState: created.value.viewState,
      createdAtMs: input.atMs,
    });
    if (!adapterSession.ok) {
      return adapterSession;
    }

    const record = sealRendererSession(created.value);
    this.sessions.set(input.fabricSessionId, {
      record,
      adapter,
      adapterSession: adapterSession.value,
    });
    return { ok: true, value: record };
  }

  // -------------------------------------------------------------------------
  // mount
  // -------------------------------------------------------------------------

  /**
   * Mount (or replace) the canonical world projection on one session: the
   * W016 compiler produces the graphs + envelopes, the REAL W013 boundary
   * admits every mount invocation (digest, capability, and budget gates),
   * and the adapter mounts its presentation from the admitted typed data.
   * The canonical scene object is NEVER mutated.
   */
  async mountScene(
    fabricSessionId: string,
    input: MountSceneInput,
  ): Promise<FabricResult<RendererSession>> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    const { record, adapter, adapterSession } = live;
    if (record.state === 'disposed') {
      return disposedSession(fabricSessionId);
    }
    const tenant = record.worldProjection.tenantScope.tenantId;
    if (input.expectedTenantId !== undefined && input.expectedTenantId !== tenant) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `mount denied: the caller acts for tenant "${input.expectedTenantId}" but the session presents tenant "${tenant}"`,
          expectedTenantId: input.expectedTenantId,
          encounteredTenantId: tenant,
        },
      };
    }

    // Digest continuity: the mounted scene must be the session's world.
    if (input.scene.tenantScope.tenantId !== tenant) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `the canonical scene belongs to tenant "${input.scene.tenantScope.tenantId}" but the session presents tenant "${tenant}"`,
          expectedTenantId: tenant,
          encounteredTenantId: input.scene.tenantScope.tenantId,
        },
      };
    }
    if (input.scene.digest !== record.worldProjection.worldDigest) {
      return {
        ok: false,
        error: {
          code: 'switch-incompatible',
          message: 'the canonical scene digest does not match the session world projection — the session presents one exact world revision',
          field: 'world-digest',
          expected: record.worldProjection.worldDigest,
          encountered: input.scene.digest,
        },
      };
    }

    const compiled = compileWorldScene(input.scene, {
      ontology: input.ontology,
      device: record.binding.device.device,
      invocation: {
        invocationId: `${fabricSessionId}-m${record.invocationCount}`,
        rendererSessionId: record.rendererSessionId,
        atMs: input.atMs,
      },
      budgets: budgetsOf(record.binding),
    });
    if (!compiled.ok) {
      return {
        ok: false,
        error: {
          code: 'mount-failed',
          message: `scene compilation failed: ${compiled.error.message}`,
          worldDigest: record.worldProjection.worldDigest,
          compileMessage: compiled.error.message,
        },
      };
    }

    // Admit every mount envelope through the REAL W013 boundary.
    const admitted: RendererReceipt[] = [];
    let binding = record.binding;
    for (const envelope of compiled.value.mountEnvelopes) {
      const graph = compiled.value.graphs.find((g) => g.digest === envelope.graphDigest);
      const outcome = admitInvocation(binding, envelope, {
        graph,
        expectedTenantId: tenant,
      });
      if (!outcome.ok) {
        return {
          ok: false,
          error: {
            code: 'mount-failed',
            message: `the W013 hosting surface rejected a mount invocation (${outcome.error.code})`,
            worldDigest: record.worldProjection.worldDigest,
            cause: outcome.error,
          },
        };
      }
      binding = outcome.value.binding;
      admitted.push(outcome.value.receipt);
    }

    // Admit the initial frame advance (frame index 0 of the mount).
    const advance = compileFrameAdvance({
      invocationId: `${fabricSessionId}-m${record.invocationCount}-f`,
      rendererSessionId: record.rendererSessionId,
      lastFrameIndex: record.lastFrameIndex ?? -1,
      atMs: input.atMs,
    });
    const advanced = admitInvocation(binding, advance, { expectedTenantId: tenant });
    if (!advanced.ok) {
      return {
        ok: false,
        error: {
          code: 'mount-failed',
          message: `the W013 hosting surface rejected the mount frame advance (${advanced.error.code})`,
          worldDigest: record.worldProjection.worldDigest,
          cause: advanced.error,
        },
      };
    }
    binding = advanced.value.binding;
    admitted.push(advanced.value.receipt);

    // Adapter mounts its presentation from the admitted typed data.
    const mountInput: RendererMountInput = {
      scene: input.scene,
      compilation: compiled.value,
      admittedReceipts: admitted,
    };
    const mounted = await adapter.mountProjection(adapterSession, mountInput);
    if (!mounted.ok) {
      return mounted;
    }

    const nextRecord = sealRendererSession({
      ...record,
      binding,
      state: record.state === 'created' ? 'active' : record.state,
      mountedWorldDigest: mounted.value.mountedWorldDigest,
      mountedAtMs: input.atMs,
      lastFrameIndex: advance.frameIndex,
      invocationCount: record.invocationCount + admitted.length,
    });
    this.sessions.set(fabricSessionId, { record: nextRecord, adapter, adapterSession });
    return { ok: true, value: nextRecord };
  }

  // -------------------------------------------------------------------------
  // frames
  // -------------------------------------------------------------------------

  /** Apply one frame: W013 advance-frame admission, then adapter execution. */
  async applyFrame(
    fabricSessionId: string,
    input: ApplyFrameInput,
  ): Promise<FabricResult<FrameOutcome>> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    const { record, adapter, adapterSession } = live;
    if (record.state === 'disposed') {
      return disposedSession(fabricSessionId);
    }
    const degradation = input.degradation ?? 'none';
    if (degradation !== 'none' && !record.capabilities.degradation.includes(degradation)) {
      return {
        ok: false,
        error: {
          code: 'degraded',
          message: `renderer "${record.rendererId}" does not declare the "${degradation}" degradation — typed fidelity reductions must be declared`,
          degradation,
          reason: 'undeclared degradation',
        },
      };
    }

    const advance = compileFrameAdvance({
      invocationId: `${fabricSessionId}-f${record.invocationCount}`,
      rendererSessionId: record.rendererSessionId,
      lastFrameIndex: record.lastFrameIndex ?? -1,
      atMs: input.atMs,
    });
    const advanced = admitInvocation(record.binding, advance, {
      expectedTenantId: record.worldProjection.tenantScope.tenantId,
    });
    if (!advanced.ok) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: `the W013 hosting surface rejected the frame advance (${advanced.error.code})`,
          fabricSessionId,
        },
      };
    }

    const frame: RendererFrameEnvelope = {
      schema: 'epoch.renderer-frame-envelope',
      fabricProtocolVersion: '1.0.0',
      fabricSessionId,
      frameIndex: advance.frameIndex,
      atMs: input.atMs,
      worldDigest: record.worldProjection.worldDigest,
      degradation,
      admissionDigest: advanced.value.receipt.digest,
    };
    const applied = await adapter.applyFrame(adapterSession, frame);
    if (!applied.ok) {
      return applied;
    }

    const nextRecord = sealRendererSession({
      ...record,
      binding: advanced.value.binding,
      lastFrameIndex: advance.frameIndex,
      invocationCount: record.invocationCount + 1,
      state: degradation === 'none' ? (record.state === 'degraded' ? 'active' : record.state) : 'degraded',
    });
    this.sessions.set(fabricSessionId, { record: nextRecord, adapter, adapterSession });
    return {
      ok: true,
      value: {
        session: nextRecord,
        frame,
        presented: applied.value.presented,
        degradation: applied.value.degradation,
      },
    };
  }

  // -------------------------------------------------------------------------
  // input normalization
  // -------------------------------------------------------------------------

  /**
   * Submit ONE raw input envelope: the adapter hit-tests and normalizes it
   * into the EXISTING typed Epoch intent vocabulary; the fabric re-admits
   * the normalized intent through the W016 total admission (the Dynamic UI
   * law — adapters are never trusted), compiles the W013 submit-intent
   * envelope, admits it through the REAL W013 boundary, and seals the
   * intent receipt. A miss is `outcome: 'no-target'` (no intent), not a
   * failure.
   */
  async submitInput(
    fabricSessionId: string,
    input: unknown,
  ): Promise<FabricResult<RendererIntentReceipt>> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    const { record, adapter, adapterSession } = live;
    if (record.state === 'disposed') {
      return disposedSession(fabricSessionId);
    }
    const parsed = RendererInputEnvelopeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'input-unsupported',
          message: 'the raw input envelope failed schema validation',
          inputKind: typeof input === 'object' && input !== null && 'inputKind' in input
            ? String((input as { inputKind: unknown }).inputKind)
            : 'unknown',
          reason: parsed.error.issues.map((issue) => issue.message).join('; '),
        },
      };
    }
    const envelope: RendererInputEnvelope = parsed.data;
    if (envelope.fabricSessionId !== fabricSessionId) {
      return {
        ok: false,
        error: {
          code: 'unknown-session',
          message: `the input envelope targets session "${envelope.fabricSessionId}" but was submitted to "${fabricSessionId}"`,
          encounteredFabricSessionId: envelope.fabricSessionId,
        },
      };
    }
    if (!record.binding.effective.interaction.includes(envelope.modality)) {
      return {
        ok: false,
        error: {
          code: 'input-unsupported',
          message: `modality "${envelope.modality}" is not serviced by this session's binding`,
          inputKind: envelope.inputKind,
          reason: 'undeclared interaction modality',
        },
      };
    }

    const translated = await adapter.translateInput(adapterSession, envelope);
    if (!translated.ok) {
      return translated;
    }

    // Miss: no semantic target, no intent (a typed no-target receipt).
    if (translated.value.intent === undefined) {
      const content: RendererIntentReceiptContent = {
        schema: 'epoch.renderer-intent-receipt',
        fabricProtocolVersion: '1.0.0',
        inputId: envelope.inputId,
        fabricSessionId,
        modality: envelope.modality,
        inputKind: envelope.inputKind,
        outcome: 'no-target',
        rejectionDetail: translated.value.reason,
        atMs: envelope.atMs,
      };
      const nextRecord = sealRendererSession({
        ...record,
        invocationCount: record.invocationCount + 1,
      });
      this.sessions.set(fabricSessionId, { record: nextRecord, adapter, adapterSession });
      return {
        ok: true,
        value: { ...content, digest: canonicalDigest(content as unknown as JsonValue) },
      };
    }

    // The Dynamic UI law: re-admit the adapter's normalized intent through
    // the W016 total admission (adapters are NEVER trusted).
    const admitted = admitWorldIntent(translated.value.intent);
    if (!admitted.ok) {
      return {
        ok: false,
        error: {
          code: 'input-unsupported',
          message: `the adapter's normalized intent failed W016 admission (${admitted.error.code})`,
          inputKind: envelope.inputKind,
          reason: admitted.error.message,
        },
      };
    }
    const intent = admitted.value;

    const submit = compileIntentSubmission(intent, {
      modality: envelope.modality,
      invocationId: `${fabricSessionId}-i${record.invocationCount}`,
      rendererSessionId: record.rendererSessionId,
    });
    const outcome = admitInvocation(record.binding, submit, {
      expectedTenantId: record.worldProjection.tenantScope.tenantId,
    });
    if (!outcome.ok) {
      return {
        ok: false,
        error: {
          code: 'input-unsupported',
          message: `the W013 hosting surface rejected the submit-intent invocation (${outcome.error.code})`,
          inputKind: envelope.inputKind,
          reason: outcome.error.message,
          admissionCause: outcome.error,
        },
      };
    }

    const content: RendererIntentReceiptContent = {
      schema: 'epoch.renderer-intent-receipt',
      fabricProtocolVersion: '1.0.0',
      inputId: envelope.inputId,
      fabricSessionId,
      modality: envelope.modality,
      inputKind: envelope.inputKind,
      hitEntityId: translated.value.hitEntityId,
      intent: controlIntentOf(intent),
      intentPayloadDigest: canonicalDigest(intent as unknown as JsonValue),
      outcome: 'normalized',
      admissionDigest: outcome.value.receipt.digest,
      atMs: envelope.atMs,
    };
    const nextRecord = sealRendererSession({
      ...record,
      binding: outcome.value.binding,
      invocationCount: record.invocationCount + 1,
    });
    this.sessions.set(fabricSessionId, { record: nextRecord, adapter, adapterSession });
    return {
      ok: true,
      value: { ...content, digest: canonicalDigest(content as unknown as JsonValue) },
    };
  }

  // -------------------------------------------------------------------------
  // snapshots
  // -------------------------------------------------------------------------

  /** Capture the portable view-state snapshot of one session. */
  async captureSnapshot(
    fabricSessionId: string,
    atMs: number,
  ): Promise<FabricResult<RendererSessionSnapshot>> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    if (live.record.state === 'disposed') {
      return disposedSession(fabricSessionId);
    }
    const captured = await live.adapter.captureSnapshot(live.adapterSession, {
      invocationCount: live.record.invocationCount,
      switchCount: live.record.switchCount,
      atMs,
    });
    if (!captured.ok) {
      return captured;
    }
    // Continuity verification: the snapshot must address the session's world.
    if (captured.value.worldProjection.worldDigest !== live.record.worldProjection.worldDigest) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the adapter captured a snapshot of a different world revision — digest continuity violated',
          fabricSessionId,
        },
      };
    }
    return captured;
  }

  // -------------------------------------------------------------------------
  // THE SWITCHING INVARIANT
  // -------------------------------------------------------------------------

  /**
   * Switch one session to a target renderer, following the switching
   * invariant exactly:
   *
   * 1. save the canonical session snapshot (source adapter capture,
   *    digest-verified);
   * 2. resolve the target renderer (primary, then the ordered fallback
   *    chain when the request allows it — typed, recorded in the receipt);
   * 3. verify digest/tenant compatibility (snapshot world digest ==
   *    request expected digest == the canonical scene's digest; tenant
   *    match) — violations are typed `switch-incompatible` failures;
   * 4. create the target session and mount it from the CANONICAL
   *    projection (never from the source's presentation state);
   * 5. restore the portable focus/layers/timeline (capability-filtered;
   *    skipped fields are listed, never silent);
   * 6. emit the sealed switch receipt;
   * 7. dispose the previous session (terminal).
   *
   * A switch NEVER creates durable semantic state: the only state the
   * fabric holds is the in-memory session map; the canonical scene input
   * is never mutated; the receipt is evidence, not authority. If any step
   * fails, the switch ABORTS with the previous session RETAINED (never
   * lost) — typed `switch-aborted`.
   */
  async switchRenderer(
    request: RendererSwitchRequest,
    mount: SwitchMountInput,
  ): Promise<FabricResult<SwitchOutcome>> {
    const source = this.sessions.get(request.sourceFabricSessionId);
    if (source === undefined) {
      return unknownSession(request.sourceFabricSessionId);
    }
    if (source.record.state === 'disposed') {
      return disposedSession(request.sourceFabricSessionId);
    }

    // 1. Save the canonical session snapshot.
    const snapshot = await this.captureSnapshot(request.sourceFabricSessionId, request.atMs);
    if (!snapshot.ok) {
      return snapshot;
    }

    // 2/3. Resolve the target, verifying digest/tenant compatibility.
    const targets = [request.targetRendererId, ...request.fallbackRendererIds];
    let lastResolveFailure: RendererFailure | undefined;
    let chosen: { rendererId: RendererId; adapter: RendererAdapter } | undefined;
    for (const rendererId of targets) {
      const resolved = this.registryAdapter.resolveByRendererId(rendererId);
      if (!resolved.ok) {
        lastResolveFailure = resolved.error;
        continue;
      }
      const probed = await resolved.value.adapter.probe({
        device: source.record.binding.device,
        atMs: request.atMs,
      });
      if (!probed.ok) {
        lastResolveFailure = probed.error;
        continue;
      }
      if (!probed.value.compatible) {
        lastResolveFailure = {
          code: 'probe-rejected',
          message: `renderer "${rendererId}" is incompatible with the source device session`,
          rendererId,
          reason: probed.value.reason ?? 'incompatible',
        };
        continue;
      }
      chosen = { rendererId, adapter: resolved.value.adapter };
      break;
    }
    if (chosen === undefined) {
      return {
        ok: false,
        error: {
          code: 'switch-aborted',
          message: 'no target renderer could be resolved for the switch — the previous session is retained',
          stage: 'resolve',
          retainedFabricSessionId: request.sourceFabricSessionId,
          trigger: {
            code: lastResolveFailure?.code ?? 'adapter-unavailable',
            message: lastResolveFailure?.message ?? 'no target renderer available',
          },
        },
      };
    }

    // 3. Verify digest/tenant compatibility (the continuity claims).
    if (snapshot.value.worldProjection.worldDigest !== request.expectedWorldDigest) {
      return {
        ok: false,
        error: {
          code: 'switch-incompatible',
          message: 'the captured snapshot addresses a different world revision than the switch claims',
          field: 'world-digest',
          expected: request.expectedWorldDigest,
          encountered: snapshot.value.worldProjection.worldDigest,
        },
      };
    }
    if (mount.scene.digest !== request.expectedWorldDigest) {
      return {
        ok: false,
        error: {
          code: 'switch-incompatible',
          message: 'the canonical remount scene addresses a different world revision than the switch claims',
          field: 'world-digest',
          expected: request.expectedWorldDigest,
          encountered: mount.scene.digest,
        },
      };
    }
    const tenant = source.record.worldProjection.tenantScope.tenantId;
    if (request.expectedTenantId !== tenant) {
      return {
        ok: false,
        error: {
          code: 'switch-incompatible',
          message: 'the switch claims a tenant the source session does not present',
          field: 'tenant',
          expected: request.expectedTenantId,
          encountered: tenant,
        },
      };
    }
    if (mount.scene.tenantScope.tenantId !== tenant) {
      return {
        ok: false,
        error: {
          code: 'switch-incompatible',
          message: 'the canonical remount scene belongs to a different tenant',
          field: 'tenant',
          expected: tenant,
          encountered: mount.scene.tenantScope.tenantId,
        },
      };
    }

    // 4. Create the target session + mount from the canonical projection.
    //    The target's world projection is the SNAPSHOT's (continuity), and
    //    the mount input is the caller's canonical scene (verified above).
    const created = await this.createSession({
      rendererId: chosen.rendererId,
      device: source.record.binding.device,
      worldProjection: snapshot.value.worldProjection,
      viewState: snapshot.value.viewState,
      fabricSessionId: request.targetFabricSessionId,
      atMs: request.atMs,
      expectedTenantId: tenant,
    });
    if (!created.ok) {
      return {
        ok: false,
        error: {
          code: 'switch-aborted',
          message: `the target session could not be created — the previous session is retained (${created.error.code})`,
          stage: 'create',
          retainedFabricSessionId: request.sourceFabricSessionId,
          trigger: { code: created.error.code, message: created.error.message },
        },
      };
    }
    const mounted = await this.mountScene(request.targetFabricSessionId, {
      scene: mount.scene,
      ontology: mount.ontology,
      atMs: mount.atMs,
      expectedTenantId: tenant,
    });
    if (!mounted.ok) {
      // The half-created target session is disposed before aborting.
      await this.disposeSession(request.targetFabricSessionId, mount.completedAtMs);
      return {
        ok: false,
        error: {
          code: 'switch-aborted',
          message: `the canonical projection could not be mounted on the target — the previous session is retained (${mounted.error.code})`,
          stage: 'mount',
          retainedFabricSessionId: request.sourceFabricSessionId,
          trigger: { code: mounted.error.code, message: mounted.error.message },
        },
      };
    }

    // 5. Restore the portable focus/layers/timeline (capability-filtered).
    const targetLive = this.sessions.get(request.targetFabricSessionId)!;
    const declared = targetLive.record.capabilities.portableViewState;
    const portableFields = ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'] as const;
    const appliedFields = portableFields.filter((field) => declared.includes(field));
    const skippedFields = portableFields.filter((field) => !declared.includes(field));
    const restored = await chosen.adapter.restoreViewState(
      targetLive.adapterSession,
      snapshot.value.viewState,
    );
    if (!restored.ok) {
      await this.disposeSession(request.targetFabricSessionId, mount.completedAtMs);
      return {
        ok: false,
        error: {
          code: 'switch-aborted',
          message: `the portable view state could not be restored — the previous session is retained (${restored.error.code})`,
          stage: 'restore',
          retainedFabricSessionId: request.sourceFabricSessionId,
          trigger: { code: restored.error.code, message: restored.error.message },
        },
      };
    }
    // The adapter may itself skip undeclared fields; the receipt lists the
    // intersection (typed, never silent).
    const restoredFields = appliedFields.filter((field) =>
      restored.value.appliedFields.includes(field),
    );

    // 6. Emit the sealed switch receipt.
    const receiptContent = captureSwitchReceiptContent({
      switchId: request.switchId,
      fromRendererId: source.record.rendererId,
      toRendererId: chosen.rendererId,
      fromFabricSessionId: request.sourceFabricSessionId,
      toFabricSessionId: request.targetFabricSessionId,
      tenantScope: source.record.worldProjection.tenantScope,
      worldDigest: snapshot.value.worldProjection.worldDigest,
      sourceSnapshotDigest: snapshot.value.digest,
      mountedProjectionDigest: mounted.value.worldProjection.worldDigest,
      restoredViewFields: restoredFields,
      restoredViewState: snapshot.value.viewState,
      fallbackApplied: chosen.rendererId !== request.targetRendererId,
      atMs: mount.completedAtMs,
    });
    if (!receiptContent.ok) {
      await this.disposeSession(request.targetFabricSessionId, mount.completedAtMs);
      return {
        ok: false,
        error: {
          code: 'switch-aborted',
          message: 'the switch receipt could not be captured — the previous session is retained',
          stage: 'restore',
          retainedFabricSessionId: request.sourceFabricSessionId,
          trigger: { code: receiptContent.error.code, message: receiptContent.error.message },
        },
      };
    }
    const receipt = sealRendererSwitchReceipt(receiptContent.value);

    // Update the target record: the restored portable view state + switch count.
    const targetNext = sealRendererSession({
      ...targetLive.record,
      viewState: snapshot.value.viewState,
      switchCount: source.record.switchCount + 1,
    });
    this.sessions.set(request.targetFabricSessionId, {
      record: targetNext,
      adapter: targetLive.adapter,
      adapterSession: targetLive.adapterSession,
    });

    // 7. Dispose the previous session (terminal).
    const disposed = await this.disposeSession(request.sourceFabricSessionId, mount.completedAtMs);
    if (!disposed.ok) {
      // The switch completed; the source dispose failure is surfaced but
      // the target stays active (the switch itself succeeded) — the
      // disposed-source evidence is the last retained record.
      return {
        ok: true,
        value: {
          session: targetNext,
          receipt,
          disposedSource: source.record,
          restoredViewFields: restoredFields,
          skippedViewFields: skippedFields,
        },
      };
    }

    const fallback: RendererFailure | undefined =
      chosen.rendererId !== request.targetRendererId
        ? {
            code: 'fallback-applied',
            message: `the primary target "${request.targetRendererId}" could not complete the switch — the fallback "${chosen.rendererId}" mounted the canonical projection`,
            fromRendererId: request.targetRendererId,
            toRendererId: chosen.rendererId,
            trigger: {
              code: lastResolveFailure?.code ?? 'probe-rejected',
              message: lastResolveFailure?.message ?? 'the primary target was not mountable',
            },
          }
        : undefined;

    return {
      ok: true,
      value: {
        session: targetNext,
        receipt,
        disposedSource: disposed.value,
        restoredViewFields: restoredFields,
        skippedViewFields: skippedFields,
        fallback,
      },
    };
  }

  // -------------------------------------------------------------------------
  // dispose / health / reads
  // -------------------------------------------------------------------------

  /** Dispose one session (terminal; the adapter's state is discarded). */
  async disposeSession(
    fabricSessionId: string,
    atMs: number,
  ): Promise<FabricResult<RendererSession>> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    if (live.record.state === 'disposed') {
      return disposedSession(fabricSessionId);
    }
    await live.adapter.dispose(live.adapterSession);
    const disposed = sealRendererSession({
      ...live.record,
      state: 'disposed',
      mountedWorldDigest: undefined,
      mountedAtMs: undefined,
      health: { state: 'healthy', degradation: 'none', atMs },
    });
    this.sessions.set(fabricSessionId, {
      record: disposed,
      adapter: live.adapter,
      adapterSession: live.adapterSession,
    });
    return { ok: true, value: disposed };
  }

  /** The health projection of one live session. */
  async healthOf(fabricSessionId: string, atMs: number): Promise<FabricResult<RendererHealth>> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    const health = await live.adapter.health(live.adapterSession, atMs);
    return { ok: true, value: health };
  }

  /** Read the current sealed record of one session (never a new binding). */
  session(fabricSessionId: string): FabricResult<RendererSession> {
    const live = this.sessions.get(fabricSessionId);
    if (live === undefined) {
      return unknownSession(fabricSessionId);
    }
    return { ok: true, value: live.record };
  }

  /** The live fabric session ids (deterministic order; presentation state only). */
  sessionIds(): readonly string[] {
    return [...this.sessions.keys()].sort();
  }

  /** Whether one session is live (not disposed). */
  hasSession(fabricSessionId: string): boolean {
    return this.sessions.get(fabricSessionId)?.record.state !== undefined;
  }
}

function unknownSession(fabricSessionId: string): { ok: false; error: RendererFailure } {
  return {
    ok: false,
    error: {
      code: 'unknown-session',
      message: `no renderer fabric session "${fabricSessionId}" is hosted by this fabric`,
      encounteredFabricSessionId: fabricSessionId,
    },
  };
}

function disposedSession(fabricSessionId: string): { ok: false; error: RendererFailure } {
  return {
    ok: false,
    error: {
      code: 'session-disposed',
      message: `renderer fabric session "${fabricSessionId}" is disposed (terminal) — invocations are rejected`,
      fabricSessionId,
    },
  };
}
