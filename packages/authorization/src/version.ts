/**
 * Authorization contract versions and the closed decision vocabularies.
 *
 * Authorization is a DECISION POINT, not a policy engine (W009
 * architecture direction, binding): this package owns typed
 * authorization requests, typed decisions (allow/deny/not-applicable
 * with reasons and exact evidence paths), and the fail-closed decision
 * pipeline. Policy SEMANTICS stay in W004 (@epoch/policy-contracts) —
 * wired behind the caller-supplied facts interface, never a runtime
 * dependency (kernel-to-kernel compatibility is pinned by
 * devDependencies + parity tests).
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a
 * serialized authorization request or decision record is admitted only
 * when its `schemaVersion` equals {@link AUTHORIZATION_RECORD_VERSION}
 * exactly; skew surfaces as a typed `validation` issue at path
 * ["schemaVersion"] before any other schema diagnostics.
 * {@link AUTHORIZATION_CONTRACT_VERSION} versions the published
 * contract surface (`schemas/` + the typed index export).
 */

/** Version of the published authorization contract surface (schemas/ + types). */
export const AUTHORIZATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized authorization document. */
export const AUTHORIZATION_RECORD_VERSION = 1 as const;

/**
 * Decision outcomes (architecture direction, binding — "typed
 * authorization requests/decisions (allow/deny/not-applicable + reasons
 * + exact evidence paths)"):
 *
 * - `allow` — authorization granted for the exact request revision.
 * - `deny` — authorization explicitly refused.
 * - `not-applicable` — policies were evaluated but none applied to the
 *   request target. NOT an allow: consumers MUST treat not-applicable
 *   as "no authorization granted" and fail closed.
 */
export const DECISION_OUTCOMES = ['allow', 'deny', 'not-applicable'] as const;

/** One decision outcome. */
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/**
 * Typed decision reason codes — the closed vocabulary of the decision
 * point's own reasoning steps (policy-side reason TEXTS flow through as
 * bounded details on the policy codes):
 *
 * - `principal-verified` — the principal resolved and its membership in
 *   the request tenant was verified (allow-path step evidence).
 * - `tenant-verified` — the tenant scope resolved.
 * - `policy-allows` — the host-wired policy evaluation returned allow.
 * - `policy-denies` — the host-wired policy evaluation returned deny.
 * - `no-applicable-policy` — the policy evaluation found no applicable
 *   policy for the request target.
 */
export const DECISION_REASON_CODES = [
  'principal-verified',
  'tenant-verified',
  'policy-allows',
  'policy-denies',
  'no-applicable-policy',
] as const;

/** One typed decision reason code. */
export type DecisionReasonCode = (typeof DECISION_REASON_CODES)[number];
