/**
 * COMPILE-TIME CONTRACT PARITY with @epoch/extension-sdk
 * (devDependency, type-only — NO runtime coupling): the runtime's
 * manifest mirror infers EXACTLY the SDK's published manifest types
 * (member-for-member), the shared error-taxonomy codes are a superset
 * of the SDK's codes, and the mirrored payload contracts infer the
 * SDK's payload types. Runtime equality of the mirrored vocabularies
 * is pinned by test/sdk-parity.test.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  ExtensionManifest,
  ExtensionRegistration,
  HostFunctionId,
} from '@epoch/extension-sdk';
import type {
  ClockReadRequest,
  ClockReadResponse,
  LogWriteRequest,
  LogWriteResponse,
  WorldReadRequest,
  WorldReadResponse,
  EvidenceAppendRequest,
  EvidenceAppendResponse,
  CapabilityInvokeRequest,
  CapabilityInvokeResponse,
  StorageReadRequest,
  StorageReadResponse,
  StorageWriteRequest,
  StorageWriteResponse,
  ExtensionSdkErrorCode,
} from '@epoch/extension-sdk';
import type {
  CapabilityInvokeRequestMirrorSchema,
  CapabilityInvokeResponseMirrorSchema,
  ClockReadRequestMirrorSchema,
  ClockReadResponseMirrorSchema,
  EvidenceAppendRequestMirrorSchema,
  EvidenceAppendResponseMirrorSchema,
  ExtensionManifestViewSchema,
  HostInvocationEnvelopeSchema,
  LogWriteRequestMirrorSchema,
  LogWriteResponseMirrorSchema,
  StorageReadRequestMirrorSchema,
  StorageReadResponseMirrorSchema,
  StorageWriteRequestMirrorSchema,
  StorageWriteResponseMirrorSchema,
  WorldReadRequestMirrorSchema,
  WorldReadResponseMirrorSchema,
} from './schema';
import type { ExtensionManifestView, ExtensionRuntimeErrorCode } from './types';

/** The manifest mirror is member-for-member the SDK's manifest type. */
export type ExtensionRuntimeManifestMirrorSync = [
  Expect<Equals<z.infer<typeof ExtensionManifestViewSchema>, ExtensionManifestView>>,
  Expect<Equals<ExtensionManifestView, ExtensionManifest>>,
];

/** The shared error taxonomy: runtime codes include every SDK code. */
export type ExtensionRuntimeErrorTaxonomySync = [
  Expect<
    Equals<
      ExtensionRuntimeErrorCode,
      | ExtensionSdkErrorCode
      | 'unknown-capability'
      | 'version-unsatisfied'
      | 'permission-denied'
      | 'sandbox-violation'
    >
  >,
];

/** The payload mirrors infer the SDK payload types exactly. */
export type ExtensionRuntimePayloadMirrorSync = [
  Expect<Equals<z.infer<typeof ClockReadRequestMirrorSchema>, ClockReadRequest>>,
  Expect<Equals<z.infer<typeof ClockReadResponseMirrorSchema>, ClockReadResponse>>,
  Expect<Equals<z.infer<typeof LogWriteRequestMirrorSchema>, LogWriteRequest>>,
  Expect<Equals<z.infer<typeof LogWriteResponseMirrorSchema>, LogWriteResponse>>,
  Expect<Equals<z.infer<typeof WorldReadRequestMirrorSchema>, WorldReadRequest>>,
  Expect<Equals<z.infer<typeof WorldReadResponseMirrorSchema>, WorldReadResponse>>,
  Expect<Equals<z.infer<typeof EvidenceAppendRequestMirrorSchema>, EvidenceAppendRequest>>,
  Expect<Equals<z.infer<typeof EvidenceAppendResponseMirrorSchema>, EvidenceAppendResponse>>,
  Expect<Equals<z.infer<typeof CapabilityInvokeRequestMirrorSchema>, CapabilityInvokeRequest>>,
  Expect<Equals<z.infer<typeof CapabilityInvokeResponseMirrorSchema>, CapabilityInvokeResponse>>,
  Expect<Equals<z.infer<typeof StorageReadRequestMirrorSchema>, StorageReadRequest>>,
  Expect<Equals<z.infer<typeof StorageReadResponseMirrorSchema>, StorageReadResponse>>,
  Expect<Equals<z.infer<typeof StorageWriteRequestMirrorSchema>, StorageWriteRequest>>,
  Expect<Equals<z.infer<typeof StorageWriteResponseMirrorSchema>, StorageWriteResponse>>,
];

/** Envelope sanity: the envelope's hostFunction is the SDK host-function type. */
export type ExtensionRuntimeEnvelopeSync = [
  Expect<Equals<z.infer<typeof HostInvocationEnvelopeSchema>['hostFunction'], HostFunctionId>>,
  Expect<Equals<z.infer<typeof HostInvocationEnvelopeSchema>['extensionId'], ExtensionRegistration['manifest']['extensionId']>>,
];
