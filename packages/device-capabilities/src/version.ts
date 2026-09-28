/**
 * @epoch/device-capabilities — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the experience-protocol discipline): a
 * serialized device-capabilities document is admitted only when its
 * `protocolVersion` equals {@link DEVICE_CAPABILITIES_PROTOCOL_VERSION}
 * exactly; skew surfaces as a typed `version-unsupported` admission error
 * (checked before any schema validation, so version skew is always
 * distinguishable from malformed payloads).
 * {@link DEVICE_CAPABILITIES_CONTRACT_VERSION} versions the published
 * contract surface at `packages/device-capabilities/schemas` (the
 * W007/W009/W015 in-package convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a CAPABILITY, TIER, or BOUNDARY — never a vendor, product, engine,
 * or API. The adaptation tier vocabulary encodes the frozen spec table
 * (spec/experience-architecture.md "Device adaptation"): same semantics,
 * different fidelity — desktop = full, web/laptop = normal, mobile =
 * field, low capability = 2D/reduced, remote rendering = optional.
 */
import { z } from 'zod';
import { DEVICE_CLASSES, INTERACTION_MODALITIES } from '@epoch/experience-protocol';

/** Version of the published device-capabilities contract surface (schemas/ + types). */
export const DEVICE_CAPABILITIES_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized device-capabilities document. */
export const DEVICE_CAPABILITIES_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type DeviceCapabilitiesProtocolVersion = typeof DEVICE_CAPABILITIES_PROTOCOL_VERSION;

export const DeviceCapabilitiesProtocolVersionSchema = z
  .literal(DEVICE_CAPABILITIES_PROTOCOL_VERSION)
  .meta({
    id: 'DeviceCapabilitiesProtocolVersion',
    title: 'DeviceCapabilitiesProtocolVersion',
    description:
      'Exact device-capabilities protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator of the sealed capability-assessment record. */
export const DEVICE_CAPABILITY_ASSESSMENT_SCHEMA_NAME = 'epoch.device-capability-assessment' as const;

/** Schema-name discriminator of a presentation-fit analysis. */
export const PRESENTATION_FIT_SCHEMA_NAME = 'epoch.presentation-fit' as const;

/**
 * The document kinds of device-capabilities v1 (manifest inventory; each
 * kind is a distinct serialized document with its own schema discriminator).
 */
export const DEVICE_CAPABILITIES_DOCUMENT_KINDS = [
  'device-capabilities.assessment',
  'device-capabilities.presentation-fit',
] as const;

/** One device-capabilities document kind. */
export type DeviceCapabilitiesDocumentKind = (typeof DEVICE_CAPABILITIES_DOCUMENT_KINDS)[number];

/**
 * The typed device adaptation tiers — the frozen device-adaptation
 * semantics (spec/experience-architecture.md "Device adaptation"):
 * same semantics, different fidelity. Alphabetized (the closed-
 * vocabulary convention); the capability rank lives in {@link TIER_RANK}
 * and the derivation iterates tiers by descending rank.
 */
export const DEVICE_ADAPTATION_TIERS = ['field', 'full', 'normal', 'reduced'] as const;

/** One device adaptation tier. */
export type DeviceAdaptationTier = (typeof DEVICE_ADAPTATION_TIERS)[number];

export const DeviceAdaptationTierSchema = z.enum(DEVICE_ADAPTATION_TIERS).meta({
  id: 'DeviceAdaptationTier',
  title: 'DeviceAdaptationTier',
  description:
    'Typed device adaptation tier derived from the W011 device descriptor: full, normal, field, or reduced (same semantics, different fidelity).',
});

/** Tier ordering (ascending capability): reduced < field < normal < full. */
export const TIER_RANK: Readonly<Record<DeviceAdaptationTier, number>> = {
  reduced: 0,
  field: 1,
  normal: 2,
  full: 3,
};

/**
 * The typed presentation-requirement gap kinds. Every gap names the axis
 * that fell short and carries the encountered vs required values —
 * capability shortfalls are typed data, never silent.
 */
export const CAPABILITY_GAP_KINDS = [
  'modality-gap',
  'pixel-budget-shortfall',
  'pose-tracking-insufficient',
  'stereoscopic-mismatch',
  'texture-budget-shortfall',
  'triangle-budget-shortfall',
] as const;

/** One capability-gap kind. */
export type CapabilityGapKind = (typeof CAPABILITY_GAP_KINDS)[number];

export const CapabilityGapKindSchema = z.enum(CAPABILITY_GAP_KINDS).meta({
  id: 'CapabilityGapKind',
  title: 'CapabilityGapKind',
  description:
    'Typed kind of one presentation-requirement gap: which capability axis fell short.',
});

/**
 * The typed admission-error taxonomy of the device-capabilities kernel.
 * Every admission failure is one of these codes (never a bare throw):
 * - `version-unsupported` — protocolVersion skew, checked first;
 * - `malformed-record` — schema violations with precise dotted paths
 *   (strict objects also reject unknown/vendor fields here);
 * - `digest-mismatch` — a sealed assessment whose claimed SHA-256 digest
 *   does not match its content (tamper detection);
 * - `unknown-device-class` — a profile lookup for a class outside the
 *   frozen W011 device-class vocabulary.
 */
export const DEVICE_CAPABILITIES_ERROR_CODES = [
  'digest-mismatch',
  'malformed-record',
  'unknown-device-class',
  'version-unsupported',
] as const;

/** One typed admission-error code. */
export type DeviceCapabilitiesErrorCode = (typeof DEVICE_CAPABILITIES_ERROR_CODES)[number];

export const DeviceCapabilitiesErrorCodeSchema = z
  .enum(DEVICE_CAPABILITIES_ERROR_CODES)
  .meta({
    id: 'DeviceCapabilitiesErrorCode',
    title: 'DeviceCapabilitiesErrorCode',
    description: 'Typed admission-error code of the device-capabilities kernel.',
  });

/**
 * Canonical budget floors per tier — the deterministic thresholds the
 * assessment derivation uses. A DECLARED budget below a tier's floor
 * downgrades the assessment; an UNDECLARED budget never downgrades
 * (undeclared = unconstrained, the W013 negotiation convention). All
 * floors are inclusive (>= floor satisfies the tier).
 */
export const TIER_BUDGET_FLOORS: Readonly<
  Record<DeviceAdaptationTier, { readonly minPixels: number; readonly minTriangles: number; readonly minTextureBytes: number }>
> = {
  full: { minPixels: 2_073_600, minTriangles: 500_000, minTextureBytes: 134_217_728 },
  normal: { minPixels: 921_600, minTriangles: 100_000, minTextureBytes: 33_554_432 },
  field: { minPixels: 480_000, minTriangles: 25_000, minTextureBytes: 8_388_608 },
  reduced: { minPixels: 76_800, minTriangles: 1_000, minTextureBytes: 262_144 },
};

/**
 * Canonical per-device-class tier CEILINGS — a device class's ergonomic
 * expectation caps the derived tier regardless of declared budgets (a
 * phone declaring desktop-class budgets is still a field-class surface:
 * same semantics, different fidelity is a class+capability decision, not
 * a raw-number decision).
 */
export const DEVICE_CLASS_TIER_CEILINGS: Readonly<Record<(typeof DEVICE_CLASSES)[number], DeviceAdaptationTier>> = {
  desktop: 'full',
  'wall-display': 'full',
  laptop: 'normal',
  headset: 'normal',
  tablet: 'field',
  phone: 'field',
};

/**
 * The mirrored W016 world-fidelity guidance vocabulary (structural mirror;
 * canonical home: @epoch/world-experience `WorldFidelityLevel`). Pinned
 * member-for-member by compile-time parity (src/kernel-parity.ts) and
 * runtime parity tests — never a runtime dependency. The correspondence
 * table ({@link ADAPTATION_TIER_FIDELITY_GUIDANCE}) documents how a
 * device adaptation tier GUIDES the host's fidelity-level choice; the
 * host remains the chooser (the W016 pin: "the HOST chooses the level;
 * this layer projects").
 */
export const GUIDED_FIDELITY_LEVELS = ['desktop', 'low', 'mobile', 'remote', 'web'] as const;

/** One guided fidelity level (mirrored W016 vocabulary). */
export type GuidedFidelityLevel = (typeof GUIDED_FIDELITY_LEVELS)[number];

export const GuidedFidelityLevelSchema = z.enum(GUIDED_FIDELITY_LEVELS).meta({
  id: 'GuidedFidelityLevel',
  title: 'GuidedFidelityLevel',
  description:
    'Fidelity-level guidance vocabulary (structural mirror of the W016 WorldFidelityLevel; the host remains the chooser).',
});

/**
 * The tier -> guided-fidelity-level correspondence (the frozen spec table
 * rendered as data; the `remote-assist` recommendation is a separate
 * assessment flag, mirroring W016's optional remote fidelity level).
 */
export const ADAPTATION_TIER_FIDELITY_GUIDANCE: Readonly<
  Record<DeviceAdaptationTier, GuidedFidelityLevel>
> = {
  full: 'desktop',
  normal: 'web',
  field: 'mobile',
  reduced: 'low',
};

/** Upper bound on interaction modalities per assessment axis (DoS discipline). */
export const MAX_ASSESSED_MODALITIES = INTERACTION_MODALITIES.length;
