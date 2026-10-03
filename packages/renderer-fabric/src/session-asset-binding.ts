/**
 * THE FABRIC-LEVEL SESSION-ASSET-BINDING OPERATION SURFACE (W065, ACR-010 —
 * contract v1.2.0, additive) — the typed receipt document, the
 * applied/declined outcome vocabulary, and the operation input.
 *
 * This is the orchestration layer of the in-page foundation asset path: the
 * FABRIC composes the EXISTING adapter-seam `bindAsset` (v1.1.0, UNCHANGED)
 * into a session-level operation — session resolution, tenant-scope
 * verification, adapter capability/asset-kind check, seam application, and
 * a typed, content-addressed, tenant-scoped receipt. The receipt is
 * DIGEST-ADDRESSED evidence (the sealed binding's digest), never authority:
 * an asset binding is presentation (the digest-addressed bound-asset ledger
 * it feeds is experience state owned by the host), and this document never
 * becomes a second semantic store (lock rule 8).
 *
 * The implementation home is deliberately THIS PACKAGE, not
 * `@epoch/renderer-runtime`: the receipt is a fabric-level orchestration
 * document composed over the unchanged adapter seam, so the runtime's
 * emitted schema surface (contracts/renderers manifest dataTypes +
 * schemas/*) is UNCHANGED by v1.2.0. The published declarations live at
 * `contracts/renderers/fabric-operations.d.ts`, and
 * `contracts/renderers/parity.ts` pins the compile-time identity of every
 * type here against those declarations (the W056 discipline, one layer up).
 *
 * Determinism: zero wall-clock, zero randomness — all times are
 * caller-supplied virtual times; the seal is the canonical-JSON SHA-256
 * digest of the content (the digest field excluded), so identical inputs
 * produce byte-identical receipts.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { TenantScopeSchema } from '@epoch/experience-protocol';
import {
  AssetBindingIdSchema,
  FabricSessionIdSchema,
  MAX_FABRIC_DETAIL_LENGTH,
  RendererAssetKindSchema,
  RendererFabricProtocolVersionSchema,
  RendererIdSchema,
  Sha256HexSchema,
  VirtualTimeMsSchema,
  type FabricSessionId,
  type RendererAssetBinding,
  type VirtualTimeMs,
} from '@epoch/renderer-runtime';

/**
 * Schema-name discriminator carried by every renderer asset-binding receipt
 * (the W065 fabric document; the v1.1.0 discriminators live in
 * `@epoch/renderer-runtime`).
 */
export const RENDERER_ASSET_BINDING_RECEIPT_SCHEMA_NAME =
  'epoch.renderer-asset-binding-receipt' as const;

/**
 * The outcomes of one fabric-level session-asset binding application:
 * `applied` (the adapter's seam bound the sealed binding onto its
 * presentation) or `declined` (the adapter took the orchestration but did
 * not apply the binding — a soft decline, never a failure).
 */
export const RENDERER_ASSET_BINDING_OUTCOMES = ['applied', 'declined'] as const;

/** One asset-binding receipt outcome. */
export type RendererAssetBindingOutcome = (typeof RENDERER_ASSET_BINDING_OUTCOMES)[number];

export const RendererAssetBindingOutcomeSchema = z
  .enum(RENDERER_ASSET_BINDING_OUTCOMES)
  .meta({
    id: 'RendererAssetBindingOutcome',
    title: 'RendererAssetBindingOutcome',
    description:
      'Outcome of one fabric-level session-asset binding: applied (the seam bound it) or declined (a soft decline, never a failure).',
  });

/**
 * The input of {@link RendererFabric.bindSessionAsset} (the W065 typed
 * fabric-level operation): the target fabric session, the SEALED asset
 * binding (validated upstream by the asset bridge — the trust gate is NOT
 * re-implemented at the fabric level; the seam owns it), and the
 * caller-supplied virtual time.
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
 * The content of a renderer asset-binding receipt (everything except the
 * digest). Consistency rules: a `declined` receipt carries its neutral
 * reason; an `applied` receipt carries none.
 */
export const RendererAssetBindingReceiptContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_ASSET_BINDING_RECEIPT_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    /** The session the binding was applied to. */
    fabricSessionId: FabricSessionIdSchema,
    /** The ADAPTER's rendererId (the session's presenting renderer). */
    rendererId: RendererIdSchema,
    /** The owning tenant scope (R12 — receipts never cross tenants). */
    tenantScope: TenantScopeSchema,
    /** The applied binding's identity. */
    bindingId: AssetBindingIdSchema,
    /** The sealed binding's digest — the receipt's content address. */
    bindingDigest: Sha256HexSchema,
    /** The bound asset's content digest (the digest-addressed ledger key). */
    assetDigest: Sha256HexSchema,
    /** The applied binding's typed asset kind. */
    assetKind: RendererAssetKindSchema,
    /** The applied/declined outcome. */
    outcome: RendererAssetBindingOutcomeSchema,
    /** Neutral decline reason (declined receipts only). */
    reason: z.string().max(MAX_FABRIC_DETAIL_LENGTH).optional(),
    /** Virtual time of the application (caller-supplied). */
    atMs: VirtualTimeMsSchema,
  })
  .superRefine((receipt, ctx) => {
    if (receipt.outcome === 'declined' && receipt.reason === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a declined asset-binding receipt carries its decline reason',
        path: ['reason'],
      });
    }
    if (receipt.outcome === 'applied' && receipt.reason !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'an applied asset-binding receipt carries no decline reason',
        path: ['reason'],
      });
    }
  })
  .meta({
    id: 'RendererAssetBindingReceiptContent',
    title: 'RendererAssetBindingReceiptContent',
    description:
      'The content of a renderer asset-binding receipt: the sealed binding digest (content addressing), the adapter rendererId, the tenant scope, the applied/declined outcome, and the virtual time.',
  });

/** One asset-binding receipt content. */
export type RendererAssetBindingReceiptContent = z.infer<
  typeof RendererAssetBindingReceiptContentSchema
>;

/**
 * The sealed renderer asset-binding receipt: content plus its SHA-256
 * digest over the canonical JSON of the content (the digest field
 * excluded) — content-addressed execution evidence, never authority.
 */
export const RendererAssetBindingReceiptSchema = RendererAssetBindingReceiptContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererAssetBindingReceipt',
  title: 'RendererAssetBindingReceipt',
  description:
    'The sealed renderer asset-binding receipt: digest-addressed (the sealed binding), tenant-scoped applied/declined evidence of one fabric-level binding application.',
});

/** One sealed asset-binding receipt. */
export type RendererAssetBindingReceipt = z.infer<typeof RendererAssetBindingReceiptSchema>;

/** Seal valid asset-binding receipt content (content + its SHA-256 digest). */
export function sealRendererAssetBindingReceipt(
  content: RendererAssetBindingReceiptContent,
): RendererAssetBindingReceipt {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}

/** The neutral reason recorded on a declined (soft) receipt. */
export const RENDERER_ASSET_BINDING_DECLINED_REASON = 'adapter-declined' as const;
