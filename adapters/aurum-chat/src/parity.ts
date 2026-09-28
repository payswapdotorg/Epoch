/**
 * COMPILE-TIME PARITY (devDependencies only — the W029 adapter
 * precedent; the frozen runtime dependency policy of this adapter is
 * @epoch/external-event-bridge, @epoch/adapter-sdk,
 * @epoch/agent-protocol, @epoch/tenancy, and zod).
 *
 * This file pins structural compatibility between the adapter's shapes
 * and the sibling vocabularies WITHOUT runtime edges:
 *
 * - the provider port implements the REAL bridge `ExternalEventProvider`
 *   interface (type-level: the class is assignable to the port);
 * - the derived registration manifests are structurally registrable in
 *   the REAL W007 registry (`CapabilityRegistration`-assignable);
 * - the inbound adaptation output is the REAL bridge sealed external
 *   event (no re-declaration).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts, test/registration.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { ExternalEventProvider, SealedExternalEvent } from '@epoch/external-event-bridge';
import type { ChatReferenceProvider } from './adapters';
import type { DerivedExchangeCapabilityRegistration } from './registration';
import type { CapabilityRegistration } from '@epoch/capability-registry';

/** The reference provider satisfies the REAL bridge provider port. */
export type ProviderPortParity = Expect<
  Equals<ChatReferenceProvider extends ExternalEventProvider ? true : false, true>
>;

/** The derived registrations are registrable in the REAL W007 registry. */
export type RegistrationAssignable = Expect<
  DerivedExchangeCapabilityRegistration extends CapabilityRegistration ? true : false
>;


/** The inbound adaptation emits the REAL bridge sealed event type. */
export type InboundOutputParity = Expect<
  Equals<
    Extract<ReturnType<typeof import('./inbound').adaptInboundMessage>, { ok: true }>['value'],
    SealedExternalEvent
  >
>;
