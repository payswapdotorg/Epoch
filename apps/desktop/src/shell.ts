/**
 * The desktop shell state machine (W017) — the composition layer a native
 * wrapper embeds.
 *
 * The shell CONSUMES host envelopes and PRODUCES shell envelopes over the
 * typed IPC seam (src/envelopes.ts); it owns the window/session model,
 * binds W013 renderer sessions for windows, admits experience offers
 * (W011 graphs + W012 plan artifacts), drives W013 invocations through
 * the enforcement boundary (NEVER bypassed — src/mounting.ts is the only
 * path to renderer state), projects authoring intents as typed proposals
 * (zero shell authority — src/authoring.ts), and records content-addressed
 * session snapshots with the offline cache (src/cache.ts).
 *
 * Determinism: zero wall-clock (every timestamp is caller-supplied virtual
 * time), zero randomness, and every derived identifier (device/renderer
 * session ids, invocation ids, envelope ids, proposal ids) is a pure
 * function of the applied host envelope chain — so replaying the chain
 * through a fresh shell reproduces byte-identical state and digests
 * ({@link replayDesktopSession}).
 *
 * The shell is single-session (one desktop shell hosts one tenant-scoped
 * session at a time) — the reference-implementation scope; multi-window
 * hosting within the session is first-class.
 */
import type { DeviceDescriptor } from '@epoch/experience-protocol';
import { TenancyHierarchy, type TenantId } from '@epoch/tenancy';
import {
  closeRendererSession,
  type RendererBinding,
  type RendererReceipt,
} from '@epoch/renderer-runtime';
import {
  admitEnvelope,
  appendEnvelope,
  nextChainPosition,
  openChannel,
  verifyEnvelopeChain,
  type HostShellEnvelope,
  type SeamChannel,
} from './envelopes';
import {
  admitExperienceOffer,
  advanceFrame,
  mountExperience,
  submitIntent,
  type MountableExperience,
} from './mounting';
import { proposeAuthoring } from './authoring';
import {
  createExperienceCache,
  sealSessionSnapshot,
  SESSION_SNAPSHOT_SCHEMA_NAME,
  type ExperienceCache,
  type SessionSnapshot,
  type SessionSnapshotContent,
} from './cache';
import { DESKTOP_DEVICE } from './device';
import {
  desktopOk,
  unknownSessionError,
  unknownWindowError,
  invalidTransitionError,
  type DesktopResult,
} from './errors';
import {
  applyWindowEvent,
  bindWindowRenderer,
  deviceSessionIdOf,
  rendererSessionIdOf,
  sealWindowRecord,
  type WindowRecord,
} from './window';
import { resolveSessionScope, tenantScopeOf, type DesktopSessionScope } from './tenancy';
import {
  DESKTOP_PROTOCOL_VERSION,
  HOST_SHELL_ENVELOPE_SCHEMA_NAME,
  SESSION_TRANSITIONS,
  type SessionEvent,
  type SessionState,
} from './version';
import type { PrincipalId, WindowId } from './primitives';

/** The shell construction options. */
export interface DesktopShellOptions {
  /** The tenancy hierarchy sessions resolve against (@epoch/tenancy). */
  readonly tenancy: TenancyHierarchy;
  /** The device descriptor (default: the canonical full-fidelity desktop). */
  readonly device?: DeviceDescriptor;
}

/** One receipt-log entry (execution evidence, digest-addressed). */
export interface ReceiptLogEntry {
  readonly receiptDigest: string;
  readonly invocationId: string;
  readonly kind: 'mount-receipt' | 'frame-receipt' | 'intent-receipt';
  readonly windowId: WindowId;
  readonly receipt: RendererReceipt;
}

/** The live state of one shell session. */
export interface ShellSessionState {
  readonly sessionId: string;
  readonly scope: DesktopSessionScope;
  readonly principal: PrincipalId;
  readonly state: SessionState;
  readonly device: DeviceDescriptor;
  readonly windows: ReadonlyMap<WindowId, WindowRecord>;
  readonly bindings: ReadonlyMap<WindowId, RendererBinding>;
  readonly experiences: ReadonlyMap<string, MountableExperience>;
  readonly receipts: readonly ReceiptLogEntry[];
  readonly cache: ExperienceCache;
  readonly hostChannel: SeamChannel;
  readonly shellChannel: SeamChannel;
  readonly createdAtMs: number;
  readonly invocationCounter: number;
}

/** The outcome of one applied host envelope. */
export interface HostEnvelopeOutcome {
  /** The shell→host envelopes produced (chained, sealed). */
  readonly emitted: readonly HostShellEnvelope[];
  /** The snapshot, when the envelope requested one. */
  readonly snapshot?: SessionSnapshot | undefined;
}

/** The desktop shell (single-session, multi-window). */
export interface DesktopShell {
  /** The session id, once a session has opened. */
  readonly sessionId: string | undefined;
  /** The live session state (null before the first session-open). */
  readonly session: ShellSessionState | undefined;
  /** Apply one host→shell envelope (total, typed). */
  applyHostEnvelope(envelope: unknown): DesktopResult<HostEnvelopeOutcome>;
  /** Record a session snapshot at a virtual time (typed, content-addressed). */
  snapshotSession(atMs: number): DesktopResult<SessionSnapshot>;
}

/** The session lifecycle gate (the closed transition table). */
export function isLegalSessionTransition(state: SessionState, event: SessionEvent): boolean {
  return SESSION_TRANSITIONS[state].includes(event);
}

/** The next state of one legal session transition. */
export function nextSessionState(event: SessionEvent): SessionState {
  switch (event) {
    case 'opened':
      return 'active';
    case 'suspended':
      return 'suspended';
    case 'resumed':
      return 'active';
    case 'close-requested':
      return 'closing';
    case 'closed':
      return 'closed';
  }
}

/** Deterministic shell-envelope id derivation (per channel sequence). */
function shellEnvelopeId(sequence: number): string {
  return `env-shell-${String(sequence).padStart(4, '0')}`;
}

/** Deterministic invocation-id derivation (per window + counter). */
function invocationIdFor(windowId: WindowId, counter: number): string {
  return `inv-${windowId.replace(/^win-/, '')}-${String(counter).padStart(4, '0')}`;
}

/** Deterministic proposal-id derivation (per channel sequence). */
function proposalIdFor(sequence: number): string {
  return `ap-${String(sequence).padStart(4, '0')}`;
}

/** Create a desktop shell (the composition layer). */
export function createDesktopShell(options: DesktopShellOptions): DesktopShell {
  const tenancy = options.tenancy;
  const device = options.device ?? DESKTOP_DEVICE;
  let session: ShellSessionState | undefined;

  /** Append one shell→host envelope to the session's shell channel. */
  function emit(
    state: ShellSessionState,
    body: HostShellEnvelope['body'],
    atMs: number,
  ): DesktopResult<{ state: ShellSessionState; envelope: HostShellEnvelope }> {
    const position = nextChainPosition(state.shellChannel);
    const appended = appendEnvelope(state.shellChannel, {
      schema: HOST_SHELL_ENVELOPE_SCHEMA_NAME,
      protocolVersion: DESKTOP_PROTOCOL_VERSION,
      envelopeId: shellEnvelopeId(position.sequence),
      sessionId: state.sessionId,
      direction: 'shell-to-host',
      issuedAtMs: atMs,
      body,
      provenance: { origin: 'shell-surface' },
    });
    if (!appended.ok) {
      return appended;
    }
    return desktopOk({
      state: { ...state, shellChannel: appended.value.channel },
      envelope: appended.value.envelope,
    });
  }

  /** The session-state transition gate. */
  function assertSessionActive(state: ShellSessionState): DesktopResult<ShellSessionState> {
    if (state.state !== 'active') {
      return {
        ok: false,
        error: invalidTransitionError('session', state.state, 'window-or-experience-operation'),
      };
    }
    return desktopOk(state);
  }

  function applyHostEnvelope(envelope: unknown): DesktopResult<HostEnvelopeOutcome> {
    // ---- Pre-session: only session-open starts a shell session. ----
    if (session === undefined) {
      const opened = openSession(envelope);
      if (!opened.ok) {
        return opened;
      }
      return desktopOk({ emitted: opened.value.emitted });
    }

    // ---- Established session: chain gate + dispatch. ----
    const admitted = admitEnvelope(session.hostChannel, envelope);
    if (!admitted.ok) {
      return admitted;
    }
    const host = admitted.value.envelope;
    const nextChannel = admitted.value.channel;
    // Delivery is committed: the channel advances even when dispatch
    // fails (the typed failure is the shell's answer to the embedding
    // caller; the chain stays gap-free for subsequent envelopes).
    const state: ShellSessionState = { ...session, hostChannel: nextChannel };
    session = state;
    const payload = host.body.payload as Record<string, unknown>;
    const atMs = host.issuedAtMs;

    switch (host.body.kind) {
      case 'session-open':
        return {
          ok: false,
          error: {
            code: 'malformed-record',
            message: 'this shell already hosts a session (single-session shell)',
            issues: [{ path: 'body.kind', message: 'duplicate session-open' }],
          },
        };
      case 'session-close': {
        if (!isLegalSessionTransition(state.state, 'close-requested')) {
          return { ok: false, error: invalidTransitionError('session', state.state, 'close-requested') };
        }
        const closing: ShellSessionState = { ...state, state: nextSessionState('close-requested') };
        const closedState: ShellSessionState = { ...closing, state: nextSessionState('closed') };
        // Close every open renderer binding (typed; failures pass through).
        let bindings = new Map(state.bindings);
        for (const [windowId, binding] of bindings) {
          if (binding.state !== 'closed') {
            const closed = closeRendererSession(binding, {
              expectedTenantId: state.scope.tenantId,
            });
            if (!closed.ok) {
              return {
                ok: false,
                error: {
                  code: 'invocation-rejected',
                  message: `closing the renderer session of window "${windowId}" failed (${closed.error.code}): ${closed.error.message}`,
                  cause: closed.error,
                },
              };
            }
            bindings = new Map(bindings).set(windowId, closed.value);
          }
        }
        const emittedResult = emit({ ...closedState, bindings }, { kind: 'session-closed', payload: {} }, atMs);
        if (!emittedResult.ok) {
          return emittedResult;
        }
        session = emittedResult.value.state;
        return desktopOk({ emitted: [emittedResult.value.envelope] });
      }
      case 'window-open': {
        const active = assertSessionActive(state);
        if (!active.ok) {
          return active;
        }
        return openWindow(active.value, host, atMs);
      }
      case 'window-close': {
        const windowId = payload.windowId as WindowId;
        const found = findWindow(state, windowId);
        if (!found.ok) {
          return found;
        }
        const closing = applyEvent(found.value, 'close-requested', atMs);
        if (!closing.ok) {
          return closing;
        }
        const closedRecord = applyEvent(closing.value, 'closed', atMs);
        if (!closedRecord.ok) {
          return closedRecord;
        }
        const binding = state.bindings.get(windowId);
        let bindings = new Map(state.bindings);
        if (binding !== undefined && binding.state !== 'closed') {
          const closedBinding = closeRendererSession(binding, {
            expectedTenantId: state.scope.tenantId,
          });
          if (!closedBinding.ok) {
            return {
              ok: false,
              error: {
                code: 'invocation-rejected',
                message: `closing the renderer session of window "${windowId}" failed (${closedBinding.error.code}): ${closedBinding.error.message}`,
                cause: closedBinding.error,
              },
            };
          }
          bindings = new Map(bindings).set(windowId, closedBinding.value);
        }
        const windows = new Map(state.windows).set(windowId, closedRecord.value);
        const emittedResult = emit(
          { ...state, windows, bindings },
          { kind: 'window-closed', payload: { windowId } },
          atMs,
        );
        if (!emittedResult.ok) {
          return emittedResult;
        }
        session = emittedResult.value.state;
        return desktopOk({ emitted: [emittedResult.value.envelope] });
      }
      case 'window-focus':
      case 'window-blur': {
        const windowId = payload.windowId as WindowId;
        const found = findWindow(state, windowId);
        if (!found.ok) {
          return found;
        }
        const event = host.body.kind === 'window-focus' ? 'focused' : 'blurred';
        const next = applyEvent(found.value, event, atMs);
        if (!next.ok) {
          return next;
        }
        const windows = new Map(state.windows).set(windowId, next.value);
        const emittedResult = emit(
          { ...state, windows },
          { kind: host.body.kind === 'window-focus' ? 'window-focused' : 'window-blurred', payload: { windowId } },
          atMs,
        );
        if (!emittedResult.ok) {
          return emittedResult;
        }
        session = emittedResult.value.state;
        return desktopOk({ emitted: [emittedResult.value.envelope] });
      }
      case 'experience-offer': {
        const active = assertSessionActive(state);
        if (!active.ok) {
          return active;
        }
        const admittedOffer = admitExperienceOffer(
          { tenantId: active.value.scope.tenantId },
          { graph: payload.graph, plan: payload.plan },
          { envelopeId: host.envelopeId, atMs },
        );
        if (!admittedOffer.ok) {
          return admittedOffer;
        }
        const experience = admittedOffer.value;
        // Record the projections into the offline cache (content-addressed).
        const graphEntry = active.value.cache.put({
          address: experience.graph.digest,
          kind: 'experience-graph',
          record: experience.graph,
          tenantScope: experience.graph.tenantScope,
          recordedAtMs: atMs,
          provenance: { origin: 'host-envelope', envelopeId: host.envelopeId },
        });
        if (!graphEntry.ok) {
          return graphEntry;
        }
        const planEntry = active.value.cache.put({
          address: experience.plan.digest,
          kind: 'plan-artifact',
          record: experience.planDocument,
          tenantScope: experience.plan.tenantScope,
          recordedAtMs: atMs,
          provenance: { origin: 'host-envelope', envelopeId: host.envelopeId },
        });
        if (!planEntry.ok) {
          return planEntry;
        }
        const experiences = new Map(active.value.experiences).set(experience.graph.digest, experience);
        session = { ...active.value, experiences };
        return desktopOk({ emitted: [] });
      }
      case 'cache-invalidation': {
        const invalidated = state.cache.invalidate(
          payload.address as string,
          payload.reason as 'host-invalidated' | 'superseded' | 'tenant-rotation',
          atMs,
          payload.supersededBy as string | undefined,
        );
        if (!invalidated.ok) {
          return invalidated;
        }
        session = state;
        return desktopOk({ emitted: [] });
      }
      case 'mount-request': {
        const active = assertSessionActive(state);
        if (!active.ok) {
          return active;
        }
        return driveMount(active.value, host, atMs);
      }
      case 'frame-request': {
        const active = assertSessionActive(state);
        if (!active.ok) {
          return active;
        }
        return driveFrame(active.value, host, atMs);
      }
      case 'intent-request': {
        const active = assertSessionActive(state);
        if (!active.ok) {
          return active;
        }
        return driveIntent(active.value, host, atMs);
      }
      case 'authoring-request': {
        const active = assertSessionActive(state);
        if (!active.ok) {
          return active;
        }
        return driveAuthoring(active.value, host, atMs);
      }
      case 'snapshot-request': {
        const snapshotResult = snapshotSessionOf(state, atMs);
        if (!snapshotResult.ok) {
          return snapshotResult;
        }
        const snapshot = snapshotResult.value;
        const emittedResult = emit(
          state,
          { kind: 'session-snapshot', payload: { snapshotDigest: snapshot.digest } },
          atMs,
        );
        if (!emittedResult.ok) {
          return emittedResult;
        }
        session = emittedResult.value.state;
        return desktopOk({ emitted: [emittedResult.value.envelope], snapshot });
      }
      default:
        return {
          ok: false,
          error: {
            code: 'malformed-record',
            message: `the shell cannot dispatch host envelope kind "${String((host.body as { kind?: unknown }).kind)}"`,
            issues: [{ path: 'body.kind', message: 'undispatchable host envelope kind' }],
          },
        };
    }
  }

  /** Open the shell session from the first host envelope. */
  function openSession(
    envelope: unknown,
  ): DesktopResult<{ emitted: readonly HostShellEnvelope[] }> {
    // Pre-validate structure enough to read the sessionId (chain root).
    if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'host envelope must be a JSON object',
          issues: [{ path: '$', message: 'expected a JSON object at the envelope root' }],
        },
      };
    }
    const record = envelope as Record<string, unknown>;
    const kind = (record.body as { kind?: unknown } | undefined)?.kind;
    if (kind !== 'session-open') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'the first host envelope must open the session (session-open)',
          issues: [{ path: 'body.kind', message: `expected "session-open", encountered "${String(kind)}"` }],
        },
      };
    }
    const sessionId = record.sessionId;
    if (typeof sessionId !== 'string') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'the session-open envelope must carry a sessionId',
          issues: [{ path: 'sessionId', message: 'expected an opaque session id' }],
        },
      };
    }
    // Admit against a fresh host channel rooted at this session id.
    const admitted = admitEnvelope(openChannel(sessionId, 'host-to-shell'), envelope);
    if (!admitted.ok) {
      return admitted;
    }
    const host = admitted.value.envelope;
    if (host.body.kind !== 'session-open') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'the first host envelope must open the session (session-open)',
          issues: [{ path: 'body.kind', message: `expected "session-open", encountered "${host.body.kind}"` }],
        },
      };
    }
    const payload = host.body.payload;
    const resolved = resolveSessionScope(tenancy, {
      tenantId: payload.scope.tenantId,
      workspaceId: payload.scope.workspaceId,
      projectId: payload.scope.projectId,
    });
    if (!resolved.ok) {
      return resolved;
    }
    const opening: ShellSessionState = {
      sessionId: host.sessionId,
      scope: resolved.value,
      principal: payload.principal,
      state: 'opening',
      device,
      windows: new Map(),
      bindings: new Map(),
      experiences: new Map(),
      receipts: [],
      cache: createExperienceCache(),
      hostChannel: admitted.value.channel,
      shellChannel: openChannel(host.sessionId, 'shell-to-host'),
      createdAtMs: host.issuedAtMs,
      invocationCounter: 0,
    };
    // opening --opened--> active (the reference host completes the open).
    const active: ShellSessionState = { ...opening, state: nextSessionState('opened') };
    const emittedResult = emit(
      active,
      {
        kind: 'session-opened',
        payload: { scope: tenantScopeOf(resolved.value), principal: payload.principal },
      },
      host.issuedAtMs,
    );
    if (!emittedResult.ok) {
      return emittedResult;
    }
    session = emittedResult.value.state;
    return desktopOk({ emitted: [emittedResult.value.envelope] });
  }

  /** Open one window (binds the renderer session deterministically). */
  function openWindow(
    state: ShellSessionState,
    host: HostShellEnvelope,
    atMs: number,
  ): DesktopResult<HostEnvelopeOutcome> {
    if (host.body.kind !== 'window-open') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'internal dispatch error: non window-open envelope',
          issues: [{ path: 'body.kind', message: 'expected "window-open"' }],
        },
      };
    }
    const payload = host.body.payload;
    const windowId = payload.windowId as WindowId;
    if (state.windows.has(windowId)) {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: `window "${windowId}" already exists in session "${state.sessionId}"`,
          issues: [{ path: 'body.payload.windowId', message: 'duplicate window id' }],
        },
      };
    }
    const bindingResult = bindWindowRenderer({
      windowId,
      tenantScope: tenantScopeOf(state.scope),
      renderer: payload.renderer,
      device: state.device,
      boundAtMs: atMs,
    });
    if (!bindingResult.ok) {
      return bindingResult;
    }
    const binding = bindingResult.value;
    const record = sealWindowRecord({
      schema: 'epoch.desktop.window-record',
      schemaVersion: 1,
      windowId,
      sessionId: state.sessionId,
      title: payload.title,
      state: 'opening',
      createdAtMs: atMs,
      bounds: payload.bounds,
      deviceSessionId: deviceSessionIdOf(windowId),
      rendererSessionId: rendererSessionIdOf(windowId),
      provenance: { origin: 'host-envelope', envelopeId: host.envelopeId },
    });
    // opening --opened--> open (the reference host completes the open).
    const opened = applyEvent(record, 'opened', atMs);
    if (!opened.ok) {
      return opened;
    }
    const windows = new Map(state.windows).set(windowId, opened.value);
    const bindings = new Map(state.bindings).set(windowId, binding);
    const emittedResult = emit(
      { ...state, windows, bindings },
      {
        kind: 'window-opened',
        payload: {
          windowId,
          deviceSessionId: deviceSessionIdOf(windowId),
          rendererSessionId: rendererSessionIdOf(windowId),
          bindingDigest: binding.digest,
        },
      },
      atMs,
    );
    if (!emittedResult.ok) {
      return emittedResult;
    }
    session = emittedResult.value.state;
    return desktopOk({ emitted: [emittedResult.value.envelope] });
  }

  /** Drive one mount request through the W013 boundary. */
  function driveMount(
    state: ShellSessionState,
    host: HostShellEnvelope,
    atMs: number,
  ): DesktopResult<HostEnvelopeOutcome> {
    if (host.body.kind !== 'mount-request') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'internal dispatch error: non mount-request envelope',
          issues: [{ path: 'body.kind', message: 'expected "mount-request"' }],
        },
      };
    }
    const payload = host.body.payload;
    const windowId = payload.windowId as WindowId;
    const found = findWindow(state, windowId);
    if (!found.ok) {
      return found;
    }
    const binding = state.bindings.get(windowId);
    if (binding === undefined) {
      return { ok: false, error: unknownWindowError(state.sessionId, windowId) };
    }
    const experience = state.experiences.get(payload.graphDigest);
    if (experience === undefined) {
      return {
        ok: false,
        error: {
          code: 'cache-violation',
          message: `no offered experience at graph digest ${payload.graphDigest}`,
          reason: 'unknown-address',
          address: payload.graphDigest,
        },
      };
    }
    if (experience.plan.digest !== payload.planDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: 'the mount request names a plan digest that does not match the offered experience',
          path: 'body.payload.planDigest',
          expected: experience.plan.digest,
          encountered: payload.planDigest,
        },
      };
    }
    const counter = state.invocationCounter + 1;
    const invocationId = invocationIdFor(windowId, counter);
    const mounted = mountExperience({ binding, experience, invocationId, atMs });
    if (!mounted.ok) {
      return mounted;
    }
    return recordInvocation(state, windowId, mounted.value.binding, mounted.value.receipt, atMs, {
      kind: 'mount-graph',
      payload: {
        windowId,
        graphDigest: payload.graphDigest,
        planDigest: payload.planDigest,
        invocationId,
      },
    });
  }

  /** Drive one frame request through the W013 boundary. */
  function driveFrame(
    state: ShellSessionState,
    host: HostShellEnvelope,
    atMs: number,
  ): DesktopResult<HostEnvelopeOutcome> {
    if (host.body.kind !== 'frame-request') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'internal dispatch error: non frame-request envelope',
          issues: [{ path: 'body.kind', message: 'expected "frame-request"' }],
        },
      };
    }
    const payload = host.body.payload;
    const windowId = payload.windowId as WindowId;
    const found = findWindow(state, windowId);
    if (!found.ok) {
      return found;
    }
    const binding = state.bindings.get(windowId);
    if (binding === undefined) {
      return { ok: false, error: unknownWindowError(state.sessionId, windowId) };
    }
    const counter = state.invocationCounter + 1;
    const invocationId = invocationIdFor(windowId, counter);
    const advanced = advanceFrame({
      binding,
      frameIndex: payload.frameIndex,
      invocationId,
      atMs,
    });
    if (!advanced.ok) {
      return advanced;
    }
    return recordInvocation(state, windowId, advanced.value.binding, advanced.value.receipt, atMs, undefined);
  }

  /** Drive one intent request through the W013 boundary. */
  function driveIntent(
    state: ShellSessionState,
    host: HostShellEnvelope,
    atMs: number,
  ): DesktopResult<HostEnvelopeOutcome> {
    if (host.body.kind !== 'intent-request') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'internal dispatch error: non intent-request envelope',
          issues: [{ path: 'body.kind', message: 'expected "intent-request"' }],
        },
      };
    }
    const payload = host.body.payload;
    const windowId = payload.windowId as WindowId;
    const found = findWindow(state, windowId);
    if (!found.ok) {
      return found;
    }
    const binding = state.bindings.get(windowId);
    if (binding === undefined) {
      return { ok: false, error: unknownWindowError(state.sessionId, windowId) };
    }
    const counter = state.invocationCounter + 1;
    const invocationId = invocationIdFor(windowId, counter);
    const submitted = submitIntent({
      binding,
      modality: payload.modality,
      intent: payload.intent,
      invocationId,
    });
    if (!submitted.ok) {
      return submitted;
    }
    return recordInvocation(state, windowId, submitted.value.binding, submitted.value.receipt, atMs, undefined);
  }

  /** Drive one authoring request (typed proposal, zero authority). */
  function driveAuthoring(
    state: ShellSessionState,
    host: HostShellEnvelope,
    atMs: number,
  ): DesktopResult<HostEnvelopeOutcome> {
    if (host.body.kind !== 'authoring-request') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'internal dispatch error: non authoring-request envelope',
          issues: [{ path: 'body.kind', message: 'expected "authoring-request"' }],
        },
      };
    }
    const payload = host.body.payload;
    if (payload.windowId !== undefined) {
      const found = findWindow(state, payload.windowId as WindowId);
      if (!found.ok) {
        return found;
      }
    }
    const position = nextChainPosition(state.shellChannel);
    const proposal = proposeAuthoring({
      proposalId: proposalIdFor(position.sequence),
      sessionId: state.sessionId,
      windowId: payload.windowId,
      actor: state.principal,
      actionType: payload.actionType,
      parameters: payload.parameters as Record<string, unknown>,
      rationale: payload.rationale,
      tenantScope: tenantScopeOf(state.scope),
      proposedAtMs: atMs,
    });
    if (!proposal.ok) {
      return proposal;
    }
    const emittedResult = emit(
      state,
      { kind: 'authoring-proposal', payload: { proposal: proposal.value } },
      atMs,
    );
    if (!emittedResult.ok) {
      return emittedResult;
    }
    session = emittedResult.value.state;
    return desktopOk({ emitted: [emittedResult.value.envelope] });
  }

  /** Record one admitted invocation (binding advance + receipt log + reports). */
  function recordInvocation(
    state: ShellSessionState,
    windowId: WindowId,
    binding: RendererBinding,
    receipt: RendererReceipt,
    atMs: number,
    mountReport: Extract<HostShellEnvelope['body'], { kind: 'mount-graph' }> | undefined,
  ): DesktopResult<HostEnvelopeOutcome> {
    const receipts = [
      ...state.receipts,
      {
        receiptDigest: receipt.digest,
        invocationId: receipt.invocationId,
        kind: receipt.kind,
        windowId,
        receipt,
      },
    ];
    const bindings = new Map(state.bindings).set(windowId, binding);
    let next: ShellSessionState = {
      ...state,
      bindings,
      receipts,
      invocationCounter: state.invocationCounter + 1,
    };
    const emitted: HostShellEnvelope[] = [];
    if (mountReport !== undefined) {
      const reported = emit(next, mountReport, atMs);
      if (!reported.ok) {
        return reported;
      }
      next = reported.value.state;
      emitted.push(reported.value.envelope);
    }
    const receiptReport = emit(
      next,
      { kind: 'invocation-receipt', payload: { windowId, receipt } },
      atMs,
    );
    if (!receiptReport.ok) {
      return receiptReport;
    }
    next = receiptReport.value.state;
    emitted.push(receiptReport.value.envelope);
    session = next;
    return desktopOk({ emitted });
  }

  /** Find one window (typed unknown-window rejection). */
  function findWindow(
    state: ShellSessionState,
    windowId: WindowId,
  ): DesktopResult<WindowRecord> {
    const record = state.windows.get(windowId);
    if (record === undefined) {
      return { ok: false, error: unknownWindowError(state.sessionId, windowId) };
    }
    return desktopOk(record);
  }

  /** Apply one window event through the typed lifecycle (pure). */
  function applyEvent(
    record: WindowRecord,
    event: 'opened' | 'focused' | 'blurred' | 'close-requested' | 'closed',
    atMs: number,
  ): DesktopResult<WindowRecord> {
    return applyWindowEvent(record, event, atMs);
  }

  /** Build the session snapshot (typed, content-addressed). */
  function snapshotSessionOf(
    state: ShellSessionState,
    atMs: number,
  ): DesktopResult<SessionSnapshot> {
    const windows = [...state.windows.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([windowId, record]) => {
        const binding = state.bindings.get(windowId);
        return {
          windowId,
          state: record.state,
          deviceSessionId: record.deviceSessionId,
          rendererSessionId: record.rendererSessionId,
          bindingDigest: binding?.digest ?? '0'.repeat(64),
          mountedGraphDigest: binding?.mountedStateDigest,
          mountedAtMs: binding?.mountedAtMs,
          lastFrameIndex: binding?.lastFrameIndex,
          invocationCount: binding?.invocationCount ?? 0,
        };
      });
    const receipts = state.receipts.map((entry) => ({
      receiptDigest: entry.receiptDigest,
      invocationId: entry.invocationId,
      kind: entry.kind,
      windowId: entry.windowId,
    }));
    const cacheAddresses = state.cache.listEntries().map((entry) => ({
      address: entry.address,
      kind: entry.kind,
      fresh: entry.freshness.fresh,
    }));
    const content: SessionSnapshotContent = {
      schema: SESSION_SNAPSHOT_SCHEMA_NAME,
      protocolVersion: DESKTOP_PROTOCOL_VERSION,
      sessionId: state.sessionId,
      tenantScope: tenantScopeOf(state.scope),
      principal: state.principal,
      sessionState: state.state,
      device: state.device,
      windows,
      receipts,
      cacheAddresses,
      channels: {
        host: { lastSequence: state.hostChannel.lastSequence, lastDigest: state.hostChannel.lastDigest },
        shell: { lastSequence: state.shellChannel.lastSequence, lastDigest: state.shellChannel.lastDigest },
      },
      capturedAtMs: atMs,
      provenance: { origin: 'desktop-shell' },
    };
    return desktopOk(sealSessionSnapshot(content));
  }

  function snapshotSession(atMs: number): DesktopResult<SessionSnapshot> {
    if (session === undefined) {
      return { ok: false, error: unknownSessionError('(no session)') };
    }
    return snapshotSessionOf(session, atMs);
  }

  return {
    get sessionId(): string | undefined {
      return session?.sessionId;
    },
    get session(): ShellSessionState | undefined {
      return session;
    },
    applyHostEnvelope,
    snapshotSession,
  };
}

/**
 * Replay a whole host envelope chain through a fresh shell: verifies the
 * chain (replay safety), applies every envelope in order, and snapshots
 * at the given virtual time. Identical host chains produce byte-identical
 * snapshots and identical emitted shell chains (the determinism
 * discipline; pinned by test/determinism.test.ts).
 */
export function replayDesktopSession(
  hostEnvelopes: readonly HostShellEnvelope[],
  options: DesktopShellOptions,
  snapshotAtMs: number,
): DesktopResult<{
  readonly shell: DesktopShell;
  readonly emitted: readonly HostShellEnvelope[];
  readonly snapshot: SessionSnapshot;
}> {
  if (hostEnvelopes.length === 0) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'a session replay requires at least the session-open envelope',
        issues: [{ path: '$', message: 'the host envelope chain is empty' }],
      },
    };
  }
  const sessionId = hostEnvelopes[0].sessionId;
  const verified = verifyEnvelopeChain(sessionId, 'host-to-shell', hostEnvelopes);
  if (!verified.ok) {
    return verified;
  }
  const shell = createDesktopShell(options);
  const emitted: HostShellEnvelope[] = [];
  for (const envelope of hostEnvelopes) {
    const outcome = shell.applyHostEnvelope(envelope);
    if (!outcome.ok) {
      return outcome;
    }
    emitted.push(...outcome.value.emitted);
  }
  const snapshot = shell.snapshotSession(snapshotAtMs);
  if (!snapshot.ok) {
    return snapshot;
  }
  return desktopOk({ shell, emitted, snapshot: snapshot.value });
}

/** Re-export for the session-scope tenant id (convenience). */
export type { TenantId };
