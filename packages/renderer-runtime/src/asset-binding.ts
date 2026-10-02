/**
 * The RENDERER ASSET BINDING (W056) — the typed, content-addressed binding
 * of ONE asset to a renderer session.
 *
 * Security boundary (spec/renderer-fabric-architecture.md): external
 * engines receive typed inputs and SCOPED ASSETS only — an asset crosses
 * the adapter seam only as a digest-addressed binding record, never as an
 * untyped byte stream; untrusted assets remain untrusted until explicit
 * validation and NEVER mount. The binding carries the tenant scope (R12),
 * the asset kind, the byte size, and the trust state.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { TenantScopeSchema } from '@epoch/experience-protocol';
import {
  RENDERER_ASSET_BINDING_SCHEMA_NAME,
  RendererAssetKindSchema,
  RendererAssetTrustStateSchema,
  RendererFabricProtocolVersionSchema,
} from './version';
import { AssetBindingIdSchema, FabricSessionIdSchema } from './fabric-primitives';
import { Sha256HexSchema, VirtualTimeMsSchema } from './primitives';

/**
 * The content of a renderer asset binding (everything except the digest).
 * Consistency rules: only a `validated` binding carries its validation
 * time; a bound byte size is a non-negative integer.
 */
export const RendererAssetBindingContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_ASSET_BINDING_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    bindingId: AssetBindingIdSchema,
    /** The session the asset is bound to. */
    fabricSessionId: FabricSessionIdSchema,
    /** The owning tenant scope (R12 — assets never cross tenants). */
    tenantScope: TenantScopeSchema,
    /** The content digest of the asset bytes (content addressing). */
    assetDigest: Sha256HexSchema,
    /** The typed asset kind. */
    assetKind: RendererAssetKindSchema,
    /** The asset's byte size. */
    byteSize: z.number().int().nonnegative(),
    /** The trust state: untrusted assets never mount. */
    trustState: RendererAssetTrustStateSchema,
    /** Virtual time of the explicit validation (validated bindings only). */
    validatedAtMs: VirtualTimeMsSchema.optional(),
    /** Virtual time the binding was established (caller-supplied). */
    boundAtMs: VirtualTimeMsSchema,
  })
  .superRefine((binding, ctx) => {
    if (binding.trustState === 'validated' && binding.validatedAtMs === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a validated asset binding carries its validation time',
        path: ['validatedAtMs'],
      });
    }
    if (binding.trustState === 'untrusted' && binding.validatedAtMs !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'an untrusted asset binding carries no validation time',
        path: ['validatedAtMs'],
      });
    }
  })
  .meta({
    id: 'RendererAssetBindingContent',
    title: 'RendererAssetBindingContent',
    description:
      'The content of a renderer asset binding: identity, session, tenant scope, content digest, typed kind, byte size, and trust state.',
  });

/** One asset-binding content. */
export type RendererAssetBindingContent = z.infer<typeof RendererAssetBindingContentSchema>;

/**
 * The sealed renderer asset binding: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded).
 */
export const RendererAssetBindingSchema = RendererAssetBindingContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererAssetBinding',
  title: 'RendererAssetBinding',
  description:
    'The sealed renderer asset binding: digest-addressed, tenant-scoped, trust-gated asset record.',
});

/** One sealed asset binding. */
export type RendererAssetBinding = z.infer<typeof RendererAssetBindingSchema>;

/** Seal valid asset-binding content (content + its SHA-256 digest). */
export function sealRendererAssetBinding(
  content: RendererAssetBindingContent,
): RendererAssetBinding {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}
