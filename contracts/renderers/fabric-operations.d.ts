/**
 * Epoch Renderer Fabric — the v1.2.0 ADDITIVE OPERATION LAYER (W065, ACR-010).
 *
 * This file declares the fabric-level session-asset-binding operation added
 * by contract version 1.2.0, ON TOP of the unchanged v1.1.0 surface
 * (`./index`, byte-identical to the v1.1.0 emission): the typed input, the
 * applied/declined outcome, and the content-addressed, tenant-scoped
 * `RendererAssetBindingReceipt`.
 *
 * Frozen-contract discipline (additive only):
 * - every v1.1.0 type in `./index` is UNCHANGED (the emitted manifest
 *   surface — `manifest.json` dataTypes and `schemas/*.schema.json` — is
 *   exactly the v1.1.0 emission; only the manifest's contractVersion moved
 *   to 1.2.0);
 * - the optional adapter-seam `bindAsset` (the v1.1.0 seam this operation
 *   composes) is UNCHANGED — adapters implement nothing new;
 * - nothing existing is renamed, narrowed, or moved.
 *
 * Layering: this module IMPORTS the frozen v1.1.0 declarations from
 * `./index` (it references those documents verbatim — a sealed
 * `RendererAssetBinding`, the fabric id grammars, the tenant scope) rather
 * than duplicating them, so the additive layer can never drift from the
 * base it builds on. `./index` itself stays self-contained and untouched.
 *
 * Implementation home: the runtime schemas and the operation are implemented
 * by `@epoch/renderer-fabric` (the orchestration layer — this is a
 * FABRIC-level operation, not a runtime hosting-surface document, so it is
 * deliberately NOT part of the `@epoch/renderer-runtime` emission surface).
 * `./parity.ts` pins the compile-time identity of every type declared here
 * against the fabric's public API, exactly as it pins the v1.1.0 surface
 * against `@epoch/renderer-runtime`.
 *
 * Provider neutrality (architecture lock rule 13): zero vendor, engine,
 * renderer, or framework vocabulary — the same blocklist discipline as
 * `./index`.
 */

import type {
  AssetBindingId,
  FabricSessionId,
  RendererAssetBinding,
  RendererAssetKind,
  RendererFabricProtocolVersion,
  RendererId,
  Sha256Hex,
  TenantScope,
  VirtualTimeMs,
} from './index';

/**
 * The outcome of one session-asset binding application:
 * - `applied` — the adapter's `bindAsset` seam bound the sealed binding
 *   onto its presentation (the digest-addressed bound-asset ledger grows);
 * - `declined` — the adapter accepted the orchestration but did NOT apply
 *   the binding (a soft decline, distinct from a typed refusal: no failure
 *   occurred, the session stays healthy, and the receipt records why).
 */
export type RendererAssetBindingOutcome = 'applied' | 'declined';

/**
 * The input of the fabric-level `bindSessionAsset` operation (W065): the
 * target fabric session, the SEALED asset binding (validated upstream by
 * the asset bridge — the trust gate is NOT re-implemented here), and the
 * caller-supplied virtual time (determinism: no wall clock).
 */
export type BindSessionAssetInput = {
  /** The live fabric session the sealed binding is applied to ("fx-" grammar). */
  readonly sessionId: FabricSessionId;
  /** The sealed, content-addressed, tenant-scoped asset binding. */
  readonly binding: RendererAssetBinding;
  /** Virtual time of the application (caller-supplied). */
  readonly atMs: VirtualTimeMs;
};

/**
 * The content of a renderer asset-binding receipt (W065): the typed
 * evidence of one fabric-level binding application. Content-addressed by
 * the sealed binding's digest (`bindingDigest`), tenant-scoped, and
 * carrying the adapter's rendererId and the applied/declined outcome.
 * Consistency rules: a `declined` receipt carries its neutral reason; an
 * `applied` receipt carries none.
 */
export type RendererAssetBindingReceiptContent = {
  schema: 'epoch.renderer-asset-binding-receipt';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  rendererId: RendererId;
  tenantScope: TenantScope;
  bindingId: AssetBindingId;
  /** The sealed binding's digest — the receipt's content address. */
  bindingDigest: Sha256Hex;
  /** The bound asset's content digest (the digest-addressed ledger key). */
  assetDigest: Sha256Hex;
  assetKind: RendererAssetKind;
  outcome: RendererAssetBindingOutcome;
  /** Neutral decline reason (declined receipts only). */
  reason?: string | undefined;
  atMs: VirtualTimeMs;
};

/**
 * The sealed renderer asset-binding receipt: content plus its SHA-256
 * digest over the canonical JSON of the content (the digest field
 * excluded) — content-addressed execution evidence, never authority.
 */
export type RendererAssetBindingReceipt = {
  schema: 'epoch.renderer-asset-binding-receipt';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  rendererId: RendererId;
  tenantScope: TenantScope;
  bindingId: AssetBindingId;
  /** The sealed binding's digest — the receipt's content address. */
  bindingDigest: Sha256Hex;
  /** The bound asset's content digest (the digest-addressed ledger key). */
  assetDigest: Sha256Hex;
  assetKind: RendererAssetKind;
  outcome: RendererAssetBindingOutcome;
  /** Neutral decline reason (declined receipts only). */
  reason?: string | undefined;
  atMs: VirtualTimeMs;
  digest: Sha256Hex;
};
