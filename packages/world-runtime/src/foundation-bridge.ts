/**
 * THE DEFAULT FOUNDATION-ASSET BRIDGE (W067, ACR-010) — the registered
 * glTF 2.0 interchange adapter (W060) behind the neutral
 * {@link FoundationAssetBridge} seam.
 *
 * WHY this module exists (the composition constraint, recorded honestly):
 * the web `/world` host lives in `apps/web` whose manifest is FROZEN to
 * this Work Order's surface set (`apps/web/src/features/world/**` +
 * `apps/web/e2e/**` — no dependency edges may be added there), so the
 * host composition CANNOT reach an adapter package directly. The runtime
 * package — the W067-owned composition point every host already drives —
 * is therefore where the registered interchange bridge becomes reachable,
 * as ONE workspace-package edge (`@epoch/adapter-foundation-gltf`,
 * `workspace:*`, zero external dependencies; exactly the ACR-010 lock
 * record's sanction: "W065/W066/W067 use only registered workspace
 * packages"). The bridge stays REPLACEABLE: the seam
 * (`./session-assets`) is neutral, any bridge can be injected per
 * runtime construction or per import, and this default is the only
 * module of this package that names the concrete interchange format.
 *
 * The trust chain is the W060 gate, UNCHANGED and NOT re-implemented:
 * `admitGltfAsset` is the one-call validate → normalize → content-address
 * boundary (only it produces the `GltfAdmission` token), and
 * `gltfRendererAssetBinding` is the trust-gated sealed-binding factory
 * (only a `GltfAdmission` can bind validated — unvalidated bytes can
 * never become a validated binding through this path). The opaque
 * admission token of the seam IS the bridge's `GltfAdmission`; the seal
 * step re-invokes the SAME factory against the live fabric session, so a
 * binding always addresses the session that will apply it (sessions are
 * ephemeral by construction — every canonical revision is presented by a
 * fresh session — and the digest-addressed asset identity is the RAW-byte
 * content address, which survives every session rotation).
 */
import {
  admitGltfAsset,
  gltfRendererAssetBinding,
  type GltfAdmission,
} from '@epoch/adapter-foundation-gltf';
import type { RendererAssetBinding } from '@epoch/renderer-runtime';
import type { RuntimeResult } from './intents';
import type {
  FoundationAssetAdmission,
  FoundationBindingSealInput,
} from './session-assets';

/** The default bridge's neutral identity (evidence surfaces). */
export const DEFAULT_FOUNDATION_BRIDGE_ID = 'epoch.foundation.interchange-default' as const;

/**
 * The default interchange bridge: UNTRUSTED glTF/GLB bytes in, a typed
 * neutral admission out (or the bridge's typed refusal, verbatim); the
 * seal step turns one of ITS OWN admissions into the sealed,
 * session-addressed, tenant-scoped binding through the bridge's
 * trust-gated factory.
 */
export const defaultFoundationBridge = {
  bridgeId: DEFAULT_FOUNDATION_BRIDGE_ID,
  admit(bytes: Uint8Array): RuntimeResult<FoundationAssetAdmission> {
    if (bytes.length === 0) {
      return {
        ok: false,
        error: { code: 'input-empty', message: 'the imported foundation asset is empty (zero bytes)' },
      };
    }
    const admitted = admitGltfAsset(bytes);
    if (!admitted.ok) {
      // The bridge's typed refusal propagates VERBATIM (the trust gate is
      // the bridge's; this layer never softens, wraps, or re-codes it).
      return { ok: false, error: { code: admitted.error.code, message: admitted.error.message } };
    }
    const asset = admitted.value.asset;
    const firstMesh = asset.meshes[0] ?? null;
    return {
      ok: true,
      value: {
        assetDigest: asset.assetBytesDigest,
        assetKind: 'mesh' as const,
        byteSize: asset.byteSize,
        label: firstMesh?.name ?? asset.labelSuggestions[0]?.label ?? null,
        vertexCount: asset.vertexCount,
        triangleCount: asset.triangleCount,
        token: admitted.value,
      },
    };
  },
  bindingOf(
    admission: FoundationAssetAdmission,
    input: FoundationBindingSealInput,
  ): RendererAssetBinding {
    // The trust-gated factory accepts ONLY this bridge's own admission
    // type (the opaque token) — a foreign token is a runtime type error
    // at the seam's single construction site, never a forged binding.
    return gltfRendererAssetBinding({
      admission: admission.token as GltfAdmission,
      bindingId: input.bindingId,
      fabricSessionId: input.fabricSessionId,
      tenantScope: input.tenantScope,
      boundAtMs: input.boundAtMs,
    });
  },
} as const;
