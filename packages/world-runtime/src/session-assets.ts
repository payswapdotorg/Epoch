/**
 * THE FOUNDATION-ASSET SEAM (W067, ACR-010) — the neutral, injectable
 * interchange-bridge contract + the digest-addressed import registry and
 * bound-asset ledger records of the workspace runtime.
 *
 * This module is the runtime's ONE neutral vocabulary surface for the
 * in-page foundation path (lock rule 13: a foundation bridge names ROLES —
 * admission, binding — never a vendor, engine, or concrete format). The
 * CONCRETE default bridge (the registered glTF 2.0 interchange adapter of
 * W060) lives in `./foundation-bridge` — the single module of this package
 * that reaches an adapter package — and callers may inject any bridge that
 * satisfies this seam, exactly as hosts inject renderers behind the fabric.
 *
 * What this seam OWNS (and only that):
 * - {@link FoundationAssetAdmission} — the trust-gated admission token of
 *   ONE imported foundation asset: the content-addressed asset facts plus
 *   the admitting bridge's OPAQUE token (never inspected here — the bridge
 *   alone can turn its own token back into a sealed binding);
 * - {@link FoundationAssetBridge} — validate → normalize → content-address
 *   (admit) + seal (bindingOf): the two-step trust gate whose output is the
 *   sealed, content-addressed, tenant-scoped `RendererAssetBinding` the
 *   frozen W065 fabric operation consumes;
 * - {@link SessionAssetEntry} / {@link BoundAssetEntry} — the pure,
 *   presenter-agnostic view-model records of the import registry and the
 *   bound-asset ledger (digest-addressed experience state, never semantic
 *   authority — the ledger never becomes a second store, lock rule 8).
 *
 * What this seam NEVER does:
 * - it never re-implements validation: untrusted bytes are the BRIDGE's
 *   refusal, verbatim (the trust gate is NOT weakened here);
 * - it never seals bindings itself: only the admitting bridge's
 *   `bindingOf` produces a validated sealed binding from its own admission
 *   token (the trust chain stays bridge-internal by construction);
 * - it never persists anything: the registry and ledger live in the
 *   runtime's in-memory ephemeral state only.
 */
import type { RendererAssetBinding, RendererAssetKind, TenantScope } from '@epoch/renderer-runtime';
import type { RuntimeResult } from './intents';

// ---------------------------------------------------------------------------
// The neutral bridge seam.
// ---------------------------------------------------------------------------

/**
 * One admitted foundation asset (the output of a bridge's trust gate):
 * the content-addressed asset facts plus the bridge's OPAQUE admission
 * token. The token is the trust anchor — only the admitting bridge can
 * turn it back into a sealed validated binding (`bindingOf`), so a
 * registered admission can never be forged into trust by any other layer.
 */
export interface FoundationAssetAdmission {
  /** The content address of the RAW asset bytes (SHA-256, 64 hex). */
  readonly assetDigest: string;
  /** The typed asset kind the binding will carry (the glTF bridge: mesh). */
  readonly assetKind: RendererAssetKind;
  /** The admitted asset's byte size. */
  readonly byteSize: number;
  /** Non-authoritative presentation label (the imported file name). */
  readonly label: string | null;
  /** Optional neutral geometry facts for the presentation surfaces. */
  readonly vertexCount: number | null;
  readonly triangleCount: number | null;
  /**
   * The admitting bridge's opaque admission token (the typed value only
   * the bridge's own `bindingOf` accepts — never inspected here).
   */
  readonly token: unknown;
}

/**
 * The inputs of one session-addressed sealed binding (the bridge's seal
 * step): the live fabric session the binding addresses, the owning tenant
 * scope (R12 — the scene's), and the caller-supplied virtual time.
 */
export interface FoundationBindingSealInput {
  /** The binding id ("rab-" + lowercase slug, per contracts/renderers). */
  readonly bindingId: string;
  /** The LIVE fabric session the sealed binding addresses ("fx-" grammar). */
  readonly fabricSessionId: string;
  /** The owning tenant scope (R12 — assets never cross tenants). */
  readonly tenantScope: TenantScope;
  /** Virtual time of the binding (caller-supplied; determinism). */
  readonly boundAtMs: number;
}

/**
 * The neutral foundation-asset bridge seam: the trust gate
 * (validate → normalize → content-address) and the seal step
 * (admission → the sealed, session-addressed, tenant-scoped
 * `RendererAssetBinding`). The default implementation is the registered
 * glTF 2.0 interchange adapter (`./foundation-bridge`); hosts may inject
 * any bridge satisfying this interface (lock rule 13 — the format is
 * replaceable behind the neutral role vocabulary).
 */
export interface FoundationAssetBridge {
  /** The bridge's neutral identity (evidence surfaces; e.g. the digest prefix bookkeeping). */
  readonly bridgeId: string;
  /**
   * THE TRUST GATE: untrusted bytes in, a typed admission out (or the
   * bridge's typed refusal, propagated verbatim — never a throw, never a
   * parse). Nothing downstream of this seam parses asset bytes again.
   */
  admit(bytes: Uint8Array): RuntimeResult<FoundationAssetAdmission>;
  /**
   * THE SEAL: turn ONE of this bridge's own admissions into the sealed,
   * content-addressed, tenant-scoped `RendererAssetBinding` addressed to
   * the LIVE fabric session. Only values THIS bridge produced (its own
   * opaque tokens) are accepted — the trust chain is internal by
   * construction.
   */
  bindingOf(
    admission: FoundationAssetAdmission,
    input: FoundationBindingSealInput,
  ): RendererAssetBinding;
}

// ---------------------------------------------------------------------------
// The view-model records (pure, presenter-agnostic).
// ---------------------------------------------------------------------------

/** One imported foundation asset of the digest-addressed registry. */
export interface SessionAssetEntry {
  /** The content address of the RAW asset bytes (the registry key). */
  readonly assetDigest: string;
  readonly assetKind: string;
  readonly byteSize: number;
  readonly label: string | null;
  readonly vertexCount: number | null;
  readonly triangleCount: number | null;
  /** Virtual time of the import (the admission's registration). */
  readonly importedAtMs: number;
}

/** One bound-asset ledger entry: digest-addressed evidence of one binding application. */
export interface BoundAssetEntry {
  /** The bound asset's content digest — the digest-addressed LEDGER KEY. */
  readonly assetDigest: string;
  /** The sealed binding's content address (the bind intent's reference). */
  readonly bindingDigest: string;
  /** The applied binding's identity. */
  readonly bindingId: string;
  readonly assetKind: string;
  /** The applied/declined outcome of the fabric operation. */
  readonly outcome: 'applied' | 'declined';
  /** The neutral decline reason (declined entries only). */
  readonly reason: string | null;
  /** The sealed receipt's content address (the typed evidence). */
  readonly receiptDigest: string;
  /** The adapter's renderer id that answered the application. */
  readonly rendererId: string;
  /** The fabric session the binding was applied to. */
  readonly fabricSessionId: string;
  readonly atMs: number;
}

/** The foundation-asset surface of the workspace view model. */
export interface SessionAssetsViewModel {
  /** The digest-addressed import registry (deterministic order: newest first). */
  readonly imported: readonly SessionAssetEntry[];
  /** The bound-asset ledger (digest-addressed; newest first). */
  readonly ledger: readonly BoundAssetEntry[];
}
