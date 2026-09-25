/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008).
 *
 * This file pins structural compatibility between the experience
 * protocol's reference vocabulary and the kernel vocabularies it touches
 * WITHOUT adding runtime dependencies:
 *
 * - `ControlIntent` ≡ action-protocol `ActionTypeReference` (W003): the
 *   typed UI intent a control emits (R30) is shape-identical to the action
 *   type reference, so the future control-to-proposal wiring through the
 *   Action Gateway (lock rule 3) needs no translation layer.
 * - `ProjectedEvidenceRef.recordDigest` ≡ evidence `EvidenceReceipt.digest`
 *   (W006): evidence records are content-addressed; the reference carries
 *   the same SHA-256 identity.
 * - `ProjectedCapabilityRef` identity fields ≡ capability-registry
 *   `CapabilityManifest` identity fields (W007): `capabilityId` +
 *   `capabilityVersion` (semver core) reference a registered capability
 *   manifest at an exact revision.
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests
 * (test/kernel-parity.test.ts, test/world-parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { ControlIntent, ProjectedCapabilityRef, ProjectedEvidenceRef } from './index';
import type { ActionTypeReference } from '@epoch/action-protocol';
import type { EvidenceReceipt } from '@epoch/evidence';
import type { CapabilityManifest } from '@epoch/capability-registry';

/** Control intents are action-type references, structurally (W003 parity). */
export type ControlIntentParity = Expect<Equals<ControlIntent, ActionTypeReference>>;

/** Evidence references carry the evidence chain's content-addressed identity (W006 parity). */
export type EvidenceDigestParity = Expect<
  Equals<ProjectedEvidenceRef['recordDigest'], EvidenceReceipt['digest']>
>;

/** Capability references carry the registry's manifest identity field types (W007 parity). */
export type CapabilityIdentityParity = Expect<
  Equals<ProjectedCapabilityRef['capabilityId'], CapabilityManifest['capabilityId']> &
    Equals<ProjectedCapabilityRef['capabilityVersion'], CapabilityManifest['version']>
>;
