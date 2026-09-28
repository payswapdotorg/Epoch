/**
 * @epoch/device-capabilities — public API (experience layer, Work Order
 * W019, device-side adaptation).
 *
 * The DEVICE half of Renderer/Device Adaptation (R29 device-aware
 * fidelity; spec/experience-architecture.md "Device adaptation"):
 *
 * - CANONICAL DEVICE-CLASS PROFILES fill the abstract W011 device slot:
 *   a host that knows only a neutral device class gets a valid,
 *   provider-neutral `DeviceDescriptor` (`descriptorFromProfile`), with
 *   caller overrides merged under W011 deterministic set semantics.
 * - DETERMINISTIC SEALED ASSESSMENTS: `assessDeviceDescriptor` derives a
 *   content-addressed `DeviceCapabilityAssessment` — the typed
 *   adaptation tier (full / normal / field / reduced — the frozen
 *   "same semantics, different fidelity" table), the full derivation
 *   trace (budget-floor tier, class ceiling, guided fidelity level,
 *   remote-assist recommendation), and axis snapshots. Pure typed data:
 *   zero wall-clock, zero randomness, zero I/O, zero
 *   environment-sniffing.
 * - PRESENTATION FIT / GAP ANALYSIS: `assessPresentationFit` compares a
 *   device descriptor against a declared presentation requirement and
 *   yields typed gap records (encountered vs required) — never silent.
 * - GUIDANCE, NEVER CHOICE: the tier-to-fidelity correspondence
 *   (`ADAPTATION_TIER_FIDELITY_GUIDANCE`) GUIDES the host's W016
 *   fidelity-level choice; the host remains the chooser (the W016 pin).
 *   The mirrored vocabulary is parity-pinned to
 *   @epoch/world-experience via devDependencies — never a runtime edge.
 * - Provider-NEUTRAL by construction (lock rule 13): strict zod objects
 *   reject unknown (vendor) fields with precise typed paths; the tables
 *   name classes and tiers, never products or engines.
 *
 * Runtime dependencies are exactly @epoch/agent-protocol (canonical
 * digest machinery) and @epoch/experience-protocol (the W011 device
 * vocabulary — genuine runtime composition). Compatibility with
 * @epoch/renderer-runtime, @epoch/experience-runtime, and
 * @epoch/world-experience is pinned via devDependencies + compile-time
 * parity (src/kernel-parity.ts) and runtime parity tests — never runtime
 * deps.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), and the committed JSON
 * Schema projection under schemas/ pinned by test/contract-drift.test.ts
 * (the W007/W009/W015/W016 in-package convention).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  DEVICE_CAPABILITIES_CONTRACT_VERSION,
  DEVICE_CAPABILITIES_PROTOCOL_VERSION,
  DEVICE_CAPABILITIES_DOCUMENT_KINDS,
  DEVICE_CAPABILITY_ASSESSMENT_SCHEMA_NAME,
  PRESENTATION_FIT_SCHEMA_NAME,
  DEVICE_ADAPTATION_TIERS,
  TIER_RANK,
  TIER_BUDGET_FLOORS,
  DEVICE_CLASS_TIER_CEILINGS,
  CAPABILITY_GAP_KINDS,
  DEVICE_CAPABILITIES_ERROR_CODES,
  GUIDED_FIDELITY_LEVELS,
  ADAPTATION_TIER_FIDELITY_GUIDANCE,
} from './version';
export type {
  DeviceCapabilitiesProtocolVersion,
  DeviceCapabilitiesDocumentKind,
  DeviceAdaptationTier,
  CapabilityGapKind,
  DeviceCapabilitiesErrorCode,
  GuidedFidelityLevel,
} from './version';
export {
  DeviceCapabilitiesProtocolVersionSchema,
  DeviceAdaptationTierSchema,
  CapabilityGapKindSchema,
  DeviceCapabilitiesErrorCodeSchema,
  GuidedFidelityLevelSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (device-capabilities-owned ids + reused W011 vocab).
// ---------------------------------------------------------------------------
export {
  ASSESSMENT_ID_PATTERN,
  PRESENTATION_REQUIREMENT_ID_PATTERN,
  AssessmentIdSchema,
  PresentationRequirementIdSchema,
} from './primitives';
export type { AssessmentId, PresentationRequirementId } from './primitives';
export type {
  Sha256Hex,
  DeviceClass,
  DeviceDescriptor,
  DeviceDisplayCapabilities,
  DeviceSpatialCapabilities,
  InteractionModality,
  PoseTrackingKind,
} from '@epoch/experience-protocol';

// ---------------------------------------------------------------------------
// Canonical device-class profiles (the W011 device-slot filler).
// ---------------------------------------------------------------------------
export {
  DEVICE_CLASSES,
  DEVICE_CLASS_PROFILES,
  DeviceClassProfileSchema,
  deviceClassProfileOf,
  descriptorFromProfile,
  tierCeilingOf,
} from './profile';
export type { DeviceClassProfile, ProfileOverrides } from './profile';

// ---------------------------------------------------------------------------
// Deterministic sealed capability assessments.
// ---------------------------------------------------------------------------
export {
  DisplayAxisSchema,
  SpatialAxisSchema,
  ModalityCoverageSchema,
  TierDerivationSchema,
  DeviceCapabilityAssessmentContentSchema,
  DeviceCapabilityAssessmentSchema,
  budgetFloorTierOf,
  adaptationTierOf,
  remoteAssistRecommendedFor,
  tierDerivationOf,
  assessDeviceDescriptor,
} from './assessment';
export type {
  DisplayAxis,
  SpatialAxis,
  ModalityCoverage,
  TierDerivation,
  DeviceCapabilityAssessmentContent,
  DeviceCapabilityAssessment,
} from './assessment';

// ---------------------------------------------------------------------------
// Presentation fit / gap analysis.
// ---------------------------------------------------------------------------
export {
  PRESENTATION_REQUIREMENT_VERSION,
  PresentationRequirementSchema,
  CapabilityGapSchema,
  PresentationFitSchema,
  assessPresentationFit,
} from './fit';
export type { PresentationRequirement, CapabilityGap, PresentationFit } from './fit';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 + tamper detection).
// ---------------------------------------------------------------------------
export {
  assessmentContentOf,
  computeAssessmentDigest,
  verifyAssessmentDigest,
  verifyPresentationFitDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export { parseDeviceCapabilityAssessment, parsePresentationFit } from './parse';

// ---------------------------------------------------------------------------
// Typed error taxonomy.
// ---------------------------------------------------------------------------
export {
  DeviceCapabilitiesIssueSchema,
  DeviceCapabilitiesErrorSchema,
} from './errors';
export type {
  DeviceCapabilitiesIssue,
  DeviceCapabilitiesError,
  DeviceCapabilitiesResult,
} from './errors';

// ---------------------------------------------------------------------------
// Published schema surface + contract emission.
// ---------------------------------------------------------------------------
export { DEVICE_CAPABILITIES_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  DEVICE_CAPABILITIES_CONTRACT_DIR,
  renderDeviceCapabilitiesContractFiles,
} from './contract-emission';
export { typeToKebabCase } from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
