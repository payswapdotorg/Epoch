/**
 * Compile-time conformance assertions for the renderer contract surface.
 *
 * Mirrors `contracts/agent/parity.ts`, `contracts/actions/parity.ts`, and
 * `contracts/experience/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/renderer-runtime`) and asserts strict type identity for every
 * surface type, so the self-contained declarations cannot drift from the
 * zod-inferred implementation types. Compiled by
 * `packages/renderer-runtime/tsconfig.contracts.json` as part of
 * `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/renderer-runtime';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + vocabularies.
export type RendererProtocolVersionParity = Expect<
  Equals<contracts.RendererProtocolVersion, impl.RendererProtocolVersion>
>;
export type RendererBindingStateParity = Expect<
  Equals<contracts.RendererBindingState, impl.RendererBindingState>
>;
export type RendererInvocationKindParity = Expect<
  Equals<contracts.RendererInvocationKind, impl.RendererInvocationKind>
>;
export type RendererReceiptKindParity = Expect<
  Equals<contracts.RendererReceiptKind, impl.RendererReceiptKind>
>;
export type RendererErrorCodeParity = Expect<
  Equals<contracts.RendererErrorCode, impl.RendererErrorCode>
>;

// Mirrored shared primitives (canonical homes: contracts/agent,
// contracts/experience, @epoch/experience-runtime).
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type OpaqueScopeIdParity = Expect<Equals<contracts.OpaqueScopeId, impl.OpaqueScopeId>>;
export type TenantScopeParity = Expect<Equals<contracts.TenantScope, impl.TenantScope>>;
export type RendererIdParity = Expect<Equals<contracts.RendererId, impl.RendererId>>;
export type RendererSessionIdParity = Expect<
  Equals<contracts.RendererSessionId, impl.RendererSessionId>
>;
export type DeviceSessionIdParity = Expect<
  Equals<contracts.DeviceSessionId, impl.DeviceSessionId>
>;
export type InvocationIdParity = Expect<Equals<contracts.InvocationId, impl.InvocationId>>;
export type VirtualTimeMsParity = Expect<Equals<contracts.VirtualTimeMs, impl.VirtualTimeMs>>;

// Mirrored W011 device vocabulary.
export type DeviceClassParity = Expect<Equals<contracts.DeviceClass, impl.DeviceClass>>;
export type InteractionModalityParity = Expect<
  Equals<contracts.InteractionModality, impl.InteractionModality>
>;
export type PoseTrackingKindParity = Expect<
  Equals<contracts.PoseTrackingKind, impl.PoseTrackingKind>
>;
export type DeviceDisplayCapabilitiesParity = Expect<
  Equals<contracts.DeviceDisplayCapabilities, impl.DeviceDisplayCapabilities>
>;
export type DeviceSpatialCapabilitiesParity = Expect<
  Equals<contracts.DeviceSpatialCapabilities, impl.DeviceSpatialCapabilities>
>;
export type DeviceDescriptorParity = Expect<
  Equals<contracts.DeviceDescriptor, impl.DeviceDescriptor>
>;
export type ExperienceGraphKindParity = Expect<
  Equals<contracts.ExperienceGraphKind, impl.ExperienceGraphKind>
>;
export type ControlIntentParity = Expect<Equals<contracts.ControlIntent, impl.ControlIntent>>;
export type ExperienceIssueParity = Expect<
  Equals<contracts.ExperienceIssue, impl.ExperienceIssue>
>;
export type ExperienceProtocolErrorParity = Expect<
  Equals<contracts.ExperienceProtocolError, impl.ExperienceProtocolError>
>;

// Abstract renderer descriptors.
export type RendererOutputCapabilitiesParity = Expect<
  Equals<contracts.RendererOutputCapabilities, impl.RendererOutputCapabilities>
>;
export type RendererBudgetsParity = Expect<
  Equals<contracts.RendererBudgets, impl.RendererBudgets>
>;
export type RendererDescriptorParity = Expect<
  Equals<contracts.RendererDescriptor, impl.RendererDescriptor>
>;

// Device-session snapshots.
export type DeviceSessionSnapshotParity = Expect<
  Equals<contracts.DeviceSessionSnapshot, impl.DeviceSessionSnapshot>
>;

// Negotiated bindings.
export type EffectiveLimitsParity = Expect<
  Equals<contracts.EffectiveLimits, impl.EffectiveLimits>
>;
export type RendererBindingContentParity = Expect<
  Equals<contracts.RendererBindingContent, impl.RendererBindingContent>
>;
export type RendererBindingParity = Expect<
  Equals<contracts.RendererBinding, impl.RendererBinding>
>;

// Typed invocation envelopes.
export type InvocationEnvelopeParity = Expect<
  Equals<contracts.InvocationEnvelope, impl.InvocationEnvelope>
>;

// Content-addressed execution receipts.
export type RendererReceiptContentParity = Expect<
  Equals<contracts.RendererReceiptContent, impl.RendererReceiptContent>
>;
export type RendererReceiptParity = Expect<
  Equals<contracts.RendererReceipt, impl.RendererReceipt>
>;

// Typed renderer errors.
export type RendererIssueParity = Expect<Equals<contracts.RendererIssue, impl.RendererIssue>>;
export type RendererRuntimeErrorParity = Expect<
  Equals<contracts.RendererRuntimeError, impl.RendererRuntimeError>
>;
