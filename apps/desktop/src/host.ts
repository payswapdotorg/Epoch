/**
 * The in-memory reference host (W017) — the native-side counterpart of
 * the desktop shell over the typed IPC seam.
 *
 * A real native wrapper backend implements the host side of the seam
 * (lifecycle commands, the native input loop relayed as typed requests,
 * content-addressed experience offers, cache invalidations). This module
 * is the REFERENCE implementation of that side: pure in-memory state, an
 * envelope channel chained through the same seam machinery, and a
 * digest-addressed ledger of everything the shell reports (execution
 * receipts, authoring proposals, session snapshots). It embeds NO engine,
 * NO toolkit, and NO I/O — determinism is total (every timestamp is
 * caller-supplied virtual time; every identifier is derived).
 *
 * The reference host is what the verification battery drives: it opens a
 * session, opens windows, offers experiences, requests mounts/frames/
 * intents/authoring, and receives the shell's reports — exercising the
 * exact contract a native backend will carry.
 */
import type { DeviceDescriptor } from '@epoch/experience-protocol';
import type { InteractionModality, RendererDescriptor } from '@epoch/renderer-runtime';
import {
  appendEnvelope,
  admitEnvelope,
  openChannel,
  type HostShellEnvelope,
  type SeamChannel,
} from './envelopes';
import { KIND_COMPLETE_RENDERER } from './device';
import { desktopOk, type DesktopResult } from './errors';
import type { CacheInvalidationReason } from './version';
import type { PrincipalId, WindowId } from './primitives';

/** The reference-host construction options. */
export interface ReferenceHostOptions {
  readonly sessionId: string;
  /** The tenant scope the host opens the session with. */
  readonly scope: {
    readonly tenantId: string;
    readonly workspaceId?: string | undefined;
    readonly projectId?: string | undefined;
  };
  readonly principal: PrincipalId;
  /** The renderer descriptor windows bind (default: the kind-complete reference renderer). */
  readonly renderer?: RendererDescriptor;
  /** The device descriptor (default: the canonical full-fidelity desktop). */
  readonly device?: DeviceDescriptor;
}

/** One ledger entry of the host-side record (digest-addressed). */
export interface HostLedgerEntry {
  readonly kind: 'receipt' | 'proposal' | 'snapshot';
  readonly digest: string;
  readonly atMs: number;
}

/** The in-memory reference host. */
export interface ReferenceHost {
  readonly sessionId: string;
  /** The host→shell channel head. */
  readonly channel: SeamChannel;
  /** The host-side digest-addressed ledger of shell reports. */
  readonly ledger: readonly HostLedgerEntry[];
  /** The shell→host channel head (advanced by `receive`). */
  readonly shellChannel: SeamChannel;
  /** Append one host→shell envelope (chained, sealed). */
  send(
    body: HostShellEnvelope['body'],
    atMs: number,
    envelopeId?: string,
  ): DesktopResult<{ envelope: HostShellEnvelope; host: ReferenceHost }>;
  /** Receive one shell→host envelope (chain gate + ledger record). */
  receive(envelope: unknown): DesktopResult<ReferenceHost>;
  // Convenience drivers (each appends one envelope; the envelope is
  // available through `channel`/`send` when needed).
  openSession(atMs: number): DesktopResult<ReferenceHost>;
  openWindow(windowId: WindowId, title: string, atMs: number): DesktopResult<ReferenceHost>;
  focusWindow(windowId: WindowId, atMs: number): DesktopResult<ReferenceHost>;
  blurWindow(windowId: WindowId, atMs: number): DesktopResult<ReferenceHost>;
  closeWindow(windowId: WindowId, atMs: number): DesktopResult<ReferenceHost>;
  offerExperience(
    experience: { readonly graph: unknown; readonly plan: unknown },
    atMs: number,
  ): DesktopResult<ReferenceHost>;
  requestMount(
    windowId: WindowId,
    graphDigest: string,
    planDigest: string,
    atMs: number,
  ): DesktopResult<ReferenceHost>;
  requestFrame(windowId: WindowId, frameIndex: number, atMs: number): DesktopResult<ReferenceHost>;
  requestIntent(
    windowId: WindowId,
    modality: InteractionModality,
    intent: { readonly id: string; readonly version: string },
    atMs: number,
  ): DesktopResult<ReferenceHost>;
  requestAuthoring(
    authoring: {
      readonly windowId?: WindowId | undefined;
      readonly actionType: { readonly id: string; readonly version: string };
      readonly parameters: Readonly<Record<string, unknown>>;
      readonly rationale?: string | undefined;
    },
    atMs: number,
  ): DesktopResult<ReferenceHost>;
  requestSnapshot(atMs: number): DesktopResult<ReferenceHost>;
  invalidateCache(
    address: string,
    reason: CacheInvalidationReason,
    atMs: number,
    supersededBy?: string,
  ): DesktopResult<ReferenceHost>;
  closeSession(atMs: number): DesktopResult<ReferenceHost>;
}

/** Create the in-memory reference host. */
export function createReferenceHost(options: ReferenceHostOptions): ReferenceHost {
  let channel = openChannel(options.sessionId, 'host-to-shell');
  let shellChannel = openChannel(options.sessionId, 'shell-to-host');
  let ledger: HostLedgerEntry[] = [];
  let counter = 0;
  const renderer = options.renderer ?? KIND_COMPLETE_RENDERER;
  void options.device; // reserved: the host-side device mirror (the shell admits the authoritative descriptor)
  const scope = options.scope;

  function nextEnvelopeId(): string {
    counter += 1;
    return `env-host-${String(counter).padStart(4, '0')}`;
  }

  function withChannel(
    result: DesktopResult<{ envelope: HostShellEnvelope; channel: SeamChannel }>,
  ): DesktopResult<{ envelope: HostShellEnvelope; host: ReferenceHost }> {
    if (!result.ok) {
      return result;
    }
    channel = result.value.channel;
    return desktopOk({ envelope: result.value.envelope, host: api() });
  }

  function send(
    body: HostShellEnvelope['body'],
    atMs: number,
    envelopeId?: string,
  ): DesktopResult<{ envelope: HostShellEnvelope; host: ReferenceHost }> {
    const id = envelopeId ?? nextEnvelopeId();
    const appended = appendEnvelope(channel, {
      schema: 'epoch.desktop.host-shell-envelope',
      protocolVersion: '1.0.0',
      envelopeId: id,
      sessionId: options.sessionId,
      direction: 'host-to-shell',
      issuedAtMs: atMs,
      body,
      provenance: { origin: 'host-envelope' },
    });
    return withChannel(appended);
  }

  function receive(envelope: unknown): DesktopResult<ReferenceHost> {
    const admitted = admitEnvelope(shellChannel, envelope);
    if (!admitted.ok) {
      return admitted;
    }
    const shell = admitted.value.envelope;
    shellChannel = admitted.value.channel;
    const atMs = shell.issuedAtMs;
    switch (shell.body.kind) {
      case 'invocation-receipt': {
        const receipt = shell.body.payload.receipt as { digest?: unknown };
        if (typeof receipt.digest !== 'string') {
          return {
            ok: false,
            error: {
              code: 'malformed-record',
              message: 'the invocation-receipt payload carries no digest-addressed receipt',
              issues: [{ path: 'body.payload.receipt.digest', message: 'expected a sealed receipt' }],
            },
          };
        }
        ledger = [...ledger, { kind: 'receipt', digest: receipt.digest, atMs }];
        break;
      }
      case 'authoring-proposal': {
        const proposal = shell.body.payload.proposal as { digest?: unknown };
        if (typeof proposal.digest !== 'string') {
          return {
            ok: false,
            error: {
              code: 'malformed-record',
              message: 'the authoring-proposal payload carries no digest-addressed proposal',
              issues: [{ path: 'body.payload.proposal.digest', message: 'expected a sealed proposal' }],
            },
          };
        }
        ledger = [...ledger, { kind: 'proposal', digest: proposal.digest, atMs }];
        break;
      }
      case 'session-snapshot': {
        ledger = [...ledger, { kind: 'snapshot', digest: shell.body.payload.snapshotDigest, atMs }];
        break;
      }
      default:
        // Lifecycle acknowledgements are chain evidence (the channel head
        // records them); the ledger keeps digest-addressed artifacts only.
        break;
    }
    return desktopOk(api());
  }

  /** Map a send outcome onto the host view (drops the envelope). */
  function sent(result: DesktopResult<{ envelope: HostShellEnvelope; host: ReferenceHost }>): DesktopResult<ReferenceHost> {
    if (!result.ok) {
      return result;
    }
    return desktopOk(result.value.host);
  }

  function api(): ReferenceHost {
    return {
      get sessionId(): string {
        return options.sessionId;
      },
      get channel(): SeamChannel {
        return channel;
      },
      get ledger(): readonly HostLedgerEntry[] {
        return ledger;
      },
      get shellChannel(): SeamChannel {
        return shellChannel;
      },
      send,
      receive,
      openSession(atMs) {
        return sent(
          send(
            { kind: 'session-open', payload: { scope, principal: options.principal } },
            atMs,
            'env-host-session-open',
          ),
        );
      },
      openWindow(windowId, title, atMs) {
        return sent(send({ kind: 'window-open', payload: { windowId, title, renderer } }, atMs));
      },
      focusWindow(windowId, atMs) {
        return sent(send({ kind: 'window-focus', payload: { windowId } }, atMs));
      },
      blurWindow(windowId, atMs) {
        return sent(send({ kind: 'window-blur', payload: { windowId } }, atMs));
      },
      closeWindow(windowId, atMs) {
        return sent(send({ kind: 'window-close', payload: { windowId } }, atMs));
      },
      offerExperience(experience, atMs) {
        return sent(
          send(
            { kind: 'experience-offer', payload: { graph: experience.graph, plan: experience.plan } },
            atMs,
          ),
        );
      },
      requestMount(windowId, graphDigest, planDigest, atMs) {
        return sent(send({ kind: 'mount-request', payload: { windowId, graphDigest, planDigest } }, atMs));
      },
      requestFrame(windowId, frameIndex, atMs) {
        return sent(send({ kind: 'frame-request', payload: { windowId, frameIndex } }, atMs));
      },
      requestIntent(windowId, modality, intent, atMs) {
        return sent(send({ kind: 'intent-request', payload: { windowId, modality, intent } }, atMs));
      },
      requestAuthoring(authoring, atMs) {
        return sent(
          send(
            {
              kind: 'authoring-request',
              payload: {
                windowId: authoring.windowId,
                actionType: authoring.actionType,
                parameters: authoring.parameters,
                rationale: authoring.rationale,
              },
            },
            atMs,
          ),
        );
      },
      requestSnapshot(atMs) {
        return sent(send({ kind: 'snapshot-request', payload: {} }, atMs));
      },
      invalidateCache(address, reason, atMs, supersededBy) {
        return sent(send({ kind: 'cache-invalidation', payload: { address, reason, supersededBy } }, atMs));
      },
      closeSession(atMs) {
        return sent(send({ kind: 'session-close', payload: {} }, atMs));
      },
    };
  }

  return api();
}
