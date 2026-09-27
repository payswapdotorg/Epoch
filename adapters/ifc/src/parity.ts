/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the W036 pattern;
 * the frozen runtime dependency policy of this adapter is
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/world-model,
 * @epoch/tenancy, and zod).
 *
 * This file pins structural compatibility between the adapter's neutral
 * shapes and the sibling kernel vocabularies WITHOUT runtime edges:
 *
 * - the source reference is TYPE-EQUAL to the W006 `ExactRevisionRef`
 *   (the exact-revision digest discipline — building-model fixtures are
 *   evidence-grade addressable artifacts);
 * - the registration manifests' capability metadata is structurally
 *   compatible with the W007 registry manifest surface;
 * - the W007 adapter descriptor and binding pin are the REAL SDK types
 *   (imported at runtime — no parity needed, a direct edge);
 * - the semantic projection's assertion inputs are the REAL W002 types
 *   (imported at runtime from @epoch/world-model — no parity needed).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index. It is compiled by this package's
 * own `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { BuildingModelSourceRef } from './types';
import type { DerivedCapabilityRegistration } from './registration';
import type { CapabilityManifest, CapabilityRegistration } from '@epoch/capability-registry';
import type { ExactRevisionRef } from '@epoch/evidence';

/** The source reference is the W006 exact-revision grammar. */
export type SourceRefParity = Expect<Equals<BuildingModelSourceRef, ExactRevisionRef>>;

/** Derived registration manifests are structurally registrable (W007). */
export type ManifestAssignable = Expect<
  DerivedCapabilityRegistration['manifest'] extends CapabilityManifest ? true : false
>;

/** The registration envelope shape is the W007 registration envelope shape. */
export type RegistrationAssignable = Expect<
  DerivedCapabilityRegistration extends CapabilityRegistration ? true : false
>;
