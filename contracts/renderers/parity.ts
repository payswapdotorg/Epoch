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
// W065 (contract v1.2.0, additive): the fabric-level operation surface is
// implemented by @epoch/renderer-fabric, so its parity home imports the
// fabric's public API (type-only; the assertions live in the W065 section
// at the end of this file).
import type * as fabric from '../../packages/renderer-fabric/src/index';
import type * as operations from './fabric-operations';

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

// ---------------------------------------------------------------------------
// W056 — the Renderer Fabric contract (additive).
// ---------------------------------------------------------------------------

// Fabric protocol version + vocabularies.
export type RendererFabricProtocolVersionParity = Expect<
  Equals<contracts.RendererFabricProtocolVersion, impl.RendererFabricProtocolVersion>
>;
export type RendererSessionStateParity = Expect<
  Equals<contracts.RendererSessionState, impl.RendererSessionState>
>;
export type RendererHealthStateParity = Expect<
  Equals<contracts.RendererHealthState, impl.RendererHealthState>
>;
export type RendererDegradationKindParity = Expect<
  Equals<contracts.RendererDegradationKind, impl.RendererDegradationKind>
>;
export type RendererInputKindParity = Expect<
  Equals<contracts.RendererInputKind, impl.RendererInputKind>
>;
export type PortableViewStateFieldParity = Expect<
  Equals<contracts.PortableViewStateField, impl.PortableViewStateField>
>;
export type RendererAssetKindParity = Expect<
  Equals<contracts.RendererAssetKind, impl.RendererAssetKind>
>;
export type RendererAssetTrustStateParity = Expect<
  Equals<contracts.RendererAssetTrustState, impl.RendererAssetTrustState>
>;
export type RendererIntentOutcomeParity = Expect<
  Equals<contracts.RendererIntentOutcome, impl.RendererIntentOutcome>
>;
export type RendererConformanceCheckKindParity = Expect<
  Equals<contracts.RendererConformanceCheckKind, impl.RendererConformanceCheckKind>
>;
export type RendererFailureCodeParity = Expect<
  Equals<contracts.RendererFailureCode, impl.RendererFailureCode>
>;

// Mirrored W011 primitives newly consumed by the fabric contract.
export type ProjectedAgentRefParity = Expect<
  Equals<contracts.ProjectedAgentRef, impl.ProjectedAgentRef>
>;
export type QuaternionParity = Expect<Equals<contracts.Quaternion, impl.Quaternion>>;
export type ReplayWindowParity = Expect<Equals<contracts.ReplayWindow, impl.ReplayWindow>>;
export type Vec3Parity = Expect<Equals<contracts.Vec3, impl.Vec3>>;

// Fabric-owned + mirrored W016 id grammars and input primitives.
export type AssetBindingIdParity = Expect<
  Equals<contracts.AssetBindingId, impl.AssetBindingId>
>;
export type FabricSessionIdParity = Expect<
  Equals<contracts.FabricSessionId, impl.FabricSessionId>
>;
export type InputIdParity = Expect<Equals<contracts.InputId, impl.InputId>>;
export type InputKeyParity = Expect<Equals<contracts.InputKey, impl.InputKey>>;
export type PointerPositionParity = Expect<
  Equals<contracts.PointerPosition, impl.PointerPosition>
>;
export type SwitchIdParity = Expect<Equals<contracts.SwitchId, impl.SwitchId>>;
export type SemanticLayerIdParity = Expect<
  Equals<contracts.SemanticLayerId, impl.SemanticLayerId>
>;
export type WorldEntityIdMirrorParity = Expect<
  Equals<contracts.WorldEntityIdMirror, impl.WorldEntityIdMirror>
>;
export type WorldSceneIdMirrorParity = Expect<
  Equals<contracts.WorldSceneIdMirror, impl.WorldSceneIdMirror>
>;

// The portable view state (mirrored W016 camera/timeline grammars).
export type PortableCameraStateParity = Expect<
  Equals<contracts.PortableCameraState, impl.PortableCameraState>
>;
export type PortableFollowAgentCameraParity = Expect<
  Equals<contracts.PortableFollowAgentCamera, impl.PortableFollowAgentCamera>
>;
export type PortableFollowCursorStateParity = Expect<
  Equals<contracts.PortableFollowCursorState, impl.PortableFollowCursorState>
>;
export type PortableFreeCameraParity = Expect<
  Equals<contracts.PortableFreeCamera, impl.PortableFreeCamera>
>;
export type PortableOrbitCameraParity = Expect<
  Equals<contracts.PortableOrbitCamera, impl.PortableOrbitCamera>
>;
export type PortableTimelinePositionParity = Expect<
  Equals<contracts.PortableTimelinePosition, impl.PortableTimelinePosition>
>;
export type PortableViewStateParity = Expect<
  Equals<contracts.PortableViewState, impl.PortableViewState>
>;
export type SemanticLayerVisibilityParity = Expect<
  Equals<contracts.SemanticLayerVisibility, impl.SemanticLayerVisibility>
>;

// The renderer capability set.
export type RendererCapabilitySetParity = Expect<
  Equals<contracts.RendererCapabilitySet, impl.RendererCapabilitySet>
>;

// Renderer health.
export type RendererHealthParity = Expect<
  Equals<contracts.RendererHealth, impl.RendererHealth>
>;

// The typed fabric failure taxonomy.
export type RendererFailureParity = Expect<
  Equals<contracts.RendererFailure, impl.RendererFailure>
>;
export type RendererFailureTriggerParity = Expect<
  Equals<contracts.RendererFailureTrigger, impl.RendererFailureTrigger>
>;

// The canonical world projection reference.
export type WorldProjectionRefParity = Expect<
  Equals<contracts.WorldProjectionRef, impl.WorldProjectionRef>
>;

// The ephemeral renderer session.
export type RendererSessionContentParity = Expect<
  Equals<contracts.RendererSessionContent, impl.RendererSessionContent>
>;
export type RendererSessionParity = Expect<
  Equals<contracts.RendererSession, impl.RendererSession>
>;

// The portable session snapshot.
export type RendererSessionSnapshotContentParity = Expect<
  Equals<contracts.RendererSessionSnapshotContent, impl.RendererSessionSnapshotContent>
>;
export type RendererSessionSnapshotParity = Expect<
  Equals<contracts.RendererSessionSnapshot, impl.RendererSessionSnapshot>
>;

// Renderer switching.
export type RendererSwitchRequestParity = Expect<
  Equals<contracts.RendererSwitchRequest, impl.RendererSwitchRequest>
>;
export type RendererSwitchReceiptContentParity = Expect<
  Equals<contracts.RendererSwitchReceiptContent, impl.RendererSwitchReceiptContent>
>;
export type RendererSwitchReceiptParity = Expect<
  Equals<contracts.RendererSwitchReceipt, impl.RendererSwitchReceipt>
>;

// The frame envelope.
export type RendererFrameEnvelopeParity = Expect<
  Equals<contracts.RendererFrameEnvelope, impl.RendererFrameEnvelope>
>;

// The input envelope + intent receipt.
export type RendererInputEnvelopeParity = Expect<
  Equals<contracts.RendererInputEnvelope, impl.RendererInputEnvelope>
>;
export type RendererIntentReceiptContentParity = Expect<
  Equals<contracts.RendererIntentReceiptContent, impl.RendererIntentReceiptContent>
>;
export type RendererIntentReceiptParity = Expect<
  Equals<contracts.RendererIntentReceipt, impl.RendererIntentReceipt>
>;

// The asset binding.
export type RendererAssetBindingContentParity = Expect<
  Equals<contracts.RendererAssetBindingContent, impl.RendererAssetBindingContent>
>;
export type RendererAssetBindingParity = Expect<
  Equals<contracts.RendererAssetBinding, impl.RendererAssetBinding>
>;

// The conformance result.
export type RendererConformanceCheckParity = Expect<
  Equals<contracts.RendererConformanceCheck, impl.RendererConformanceCheck>
>;
export type RendererConformanceResultContentParity = Expect<
  Equals<contracts.RendererConformanceResultContent, impl.RendererConformanceResultContent>
>;
export type RendererConformanceResultParity = Expect<
  Equals<contracts.RendererConformanceResult, impl.RendererConformanceResult>
>;

// ---------------------------------------------------------------------------
// W065 — the fabric-level session-asset-binding operation (contract v1.2.0,
// additive). The operation surface is implemented by @epoch/renderer-fabric
// (the orchestration layer), NOT by @epoch/renderer-runtime: the receipt is
// a fabric-level orchestration document composed over the UNCHANGED
// adapter-seam bindAsset, so it is deliberately not part of the runtime's
// emitted schema surface. The assertions below pin the v1.2.0 declarations
// (./fabric-operations) against the fabric's public API exactly as the
// sections above pin the v1.1.0 declarations against the runtime — the
// same compile-time identity discipline, one layer up.
// ---------------------------------------------------------------------------

/** The fabric's bindSessionAsset input IS the declared operation input. */
export type BindSessionAssetInputParity = Expect<
  Equals<operations.BindSessionAssetInput, fabric.BindSessionAssetInput>
>;

/** The fabric's applied/declined outcome IS the declared outcome. */
export type RendererAssetBindingOutcomeParity = Expect<
  Equals<operations.RendererAssetBindingOutcome, fabric.RendererAssetBindingOutcome>
>;

/** The fabric's receipt content IS the declared receipt content. */
export type RendererAssetBindingReceiptContentParity = Expect<
  Equals<operations.RendererAssetBindingReceiptContent, fabric.RendererAssetBindingReceiptContent>
>;

/** The fabric's sealed receipt IS the declared sealed receipt. */
export type RendererAssetBindingReceiptParity = Expect<
  Equals<operations.RendererAssetBindingReceipt, fabric.RendererAssetBindingReceipt>
>;
