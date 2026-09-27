/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the W036 pattern;
 * the frozen runtime dependency policy of this adapter is
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/simulation-protocol,
 * @epoch/tenancy, and zod).
 *
 * This file pins structural compatibility between the adapter's neutral
 * shapes and the sibling kernel vocabularies WITHOUT runtime edges:
 *
 * - the derived capability registration manifest is structurally
 *   compatible with the W007 registry manifest surface;
 * - the step input/output payload mirrors the W007 simulation payload
 *   (which itself parity-pins the W005 shapes — one chain, no drift);
 * - the W007 adapter descriptor and binding pin are the REAL SDK types
 *   (imported at runtime — no parity needed, a direct edge);
 * - the W005 simulator registrations are the REAL simulation-protocol
 *   types (imported at runtime — no parity needed, a direct edge).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index. It is compiled by this package's
 * own `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { DerivedCapabilityRegistration } from './descriptor';
import type { SimulationRequestPayload, SimulationResponsePayload } from '@epoch/adapter-sdk';
import type { SimulationFailureCode } from '@epoch/adapter-sdk';
import type { CapabilityManifest, CapabilityRegistration } from '@epoch/capability-registry';
import type {
  SimulationFailureCode as W005SimulationFailureCode,
  SimulationInvocationRequest,
  SimulationOutcome,
  SimulatorRegistration,
} from '@epoch/simulation-protocol';

/** Derived registration manifests are structurally registrable (W007). */
export type ManifestAssignable = Expect<
  DerivedCapabilityRegistration['manifest'] extends CapabilityManifest ? true : false
>;

/** The registration envelope shape is the W007 registration envelope shape. */
export type RegistrationAssignable = Expect<
  DerivedCapabilityRegistration extends CapabilityRegistration ? true : false
>;

/** The W007 simulation failure vocabulary is the W005 failure vocabulary. */
export type FailureCodeParity = Expect<Equals<SimulationFailureCode, W005SimulationFailureCode>>;

/** The adapter's request payload surface mirrors the W005 invocation inputs. */
export type RequestInputsParity = Expect<
  Equals<SimulationRequestPayload['inputs'], SimulationInvocationRequest['inputs']>
>;

/** The adapter's response outcome surface mirrors the W005 outcome union. */
export type ResponseOutcomeParity = Expect<
  Equals<SimulationResponsePayload, SimulationOutcome>
>;

/** The derived W005 registration is the REAL protocol type (direct runtime edge). */
export type RegistrationDirect = Expect<
  Equals<ReturnType<typeof import('./registration').deriveSimulatorRegistration>, SimulatorRegistration>
>;
