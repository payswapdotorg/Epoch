'use client';

import {
  BrowserHostCommands,
  DesktopProduct,
  EmbeddedGatewayTransport,
  TauriHostCommands,
  WebFixtureSource,
  buildEmbeddedGateway,
  isTauriContext,
  loadFixtureBundle,
} from '../../src/native/web';
import type {
  EmbeddedGatewayBinding,
  FixtureBundle,
  FixtureDomain,
  HostCommandPort,
} from '../../src/native/web';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';

/**
 * The UI product-root composition (W048).
 *
 * The SAME composition the journey harness drives (qa/desktop/journeys/
 * runner.ts `freshProduct()` + `fixtureTenancy()`), with the two
 * environment substitutions the visible product needs:
 *
 *  - `WebFixtureSource` instead of the Node fixture source — the fixtures
 *    synced into `public/fixtures` (scripts/sync-fixtures.mjs), sha256
 *    re-verified at load time through SubtleCrypto;
 *  - `BrowserHostCommands` / `TauriHostCommands` instead of the memory
 *    host — the platform host seam the packaged app binds;
 *  - the REAL wall clock — determinism is the harness's job, not the
 *    product's.
 *
 * One code path: the React UI and the journey runner drive the identical
 * `DesktopProduct` over the identical embedded Application Gateway.
 */

/** The composed product root (one per domain binding). */
export interface ProductRoot {
  readonly product: DesktopProduct;
  readonly binding: EmbeddedGatewayBinding;
  readonly bundle: FixtureBundle;
  readonly host: HostCommandPort;
}

/** Compose the product root for one fixture domain (client-side only). */
export async function composeProductRoot(domain: FixtureDomain): Promise<ProductRoot> {
  // The webview-safe fixture source (public/fixtures — registry-verified).
  const source = new WebFixtureSource('fixtures');
  const bundle = await loadFixtureBundle(source, domain);

  // The tenancy hierarchy restored from the fixture snapshot (parents
  // first — platform, tenant, workspace, project), exactly like the
  // journey runner's fixtureTenancy().
  const tenancy = fixtureTenancy(bundle);

  // The embedded fixture-backed Application Gateway (the W046
  // single-process composition) — real wall clock for the UI.
  const binding = buildEmbeddedGateway({ bundle, clock: () => new Date().toISOString() });

  // The platform host seam: the packaged Tauri shell or the dev-server
  // browser host (durable projections in localStorage, memory-only
  // secure store, typed dialog refusals).
  const host = isTauriContext() ? new TauriHostCommands() : new BrowserHostCommands();

  const product = new DesktopProduct({
    host,
    transport: new EmbeddedGatewayTransport(binding.gateway),
    clock: () => new Date().toISOString(),
    tenancy,
    gatewayMode: 'embedded',
  });

  return { product, binding, bundle, host };
}

/**
 * Restore the fixture tenancy hierarchy (parents first) — the runner's
 * fixtureTenancy(), verbatim: sealTenancyNode then hierarchy.createNode,
 * rejection is a composition failure (never a partial boot).
 */
function fixtureTenancy(bundle: FixtureBundle): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const records = (bundle.files['tenancy.json'] as { records: Record<string, unknown>[] }).records;
  const order = ['platform', 'tenant', 'workspace', 'project'];
  const sorted = [...records].sort(
    (a, b) =>
      order.indexOf(String((a.node as Record<string, unknown>).kind)) -
      order.indexOf(String((b.node as Record<string, unknown>).kind)),
  );
  for (const record of sorted) {
    const sealed = sealTenancyNode(record.node as Record<string, unknown>);
    if (!sealed.ok) throw new Error(`fixture tenancy node rejected: ${sealed.error.message}`);
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) throw new Error(`fixture tenancy node rejected: ${created.error.message}`);
  }
  return hierarchy;
}
