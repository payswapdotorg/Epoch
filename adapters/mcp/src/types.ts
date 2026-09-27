/**
 * @epoch/adapter-mcp — published contract types (v1), the NEUTRAL seam
 * (architecture lock rule 13).
 *
 * The record surfaces below are the protocol-AGNOSTIC shapes everything
 * outside `src/provider/` speaks: W007 tool-invocation capability
 * registrations (derived from discovery), W003 action proposals (the
 * REAL action-protocol types — a runtime dependency), the W022
 * authority decision/outcome mirrors the action surface routes through,
 * and the evaluator-side invocation records + evaluation verdicts. No
 * tool-protocol vocabulary appears in any shape, key, or enum (pinned
 * by test/neutrality.test.ts).
 */
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { ActionProposal, ProposalReference } from '@epoch/action-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { JustificationReference } from '@epoch/adapter-sdk';
import type { MCP_ADAPTER_RECORD_VERSION } from './version';
import type { InvocationDisposition } from './version';

// ---------------------------------------------------------------------------
// Discovery: typed tool invocation surfaces (W007 registration documents).
// ---------------------------------------------------------------------------

/** A discovered tool's typed invocation surface (the neutral view). */
export interface ToolInvocationSurface {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  /** Neutral tool reference (`tool:<slug>`). */
  readonly toolRef: string;
  /** The neutral W007 capability id the tool's invocation registers under. */
  readonly capabilityId: string;
  readonly displayName: string;
  readonly description: string;
  /** Declared argument surfaces: name, value kind, requiredness, description. */
  readonly inputArguments: readonly {
    readonly name: string;
    readonly valueKind: 'string' | 'number' | 'boolean';
    readonly required: boolean;
    readonly description: string;
  }[];
  readonly outputSummary: string;
  /** Digest of the discovery content this surface was derived from. */
  readonly sourceDigest: Sha256Hex;
  readonly surfaceDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The action surface: proposal plans, invocation records, authority seam.
// ---------------------------------------------------------------------------

/** The neutral invocation plan: the W003 proposal + exact-revision reference. */
export interface InvocationPlan {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly toolRef: string;
  readonly actionId: string;
  readonly proposal: ActionProposal;
  readonly proposalRef: ProposalReference;
  readonly planDigest: Sha256Hex;
}

/**
 * The authority-side typed DECISION record (the W022 decision mirror):
 * what the action authority decided about a proposal — allow / deny /
 * requires-approval — sealed by the authority with its own content
 * digest. The adapter records the authority's verdict verbatim; it never
 * forms its own.
 */
export interface AuthorityDecisionRecord {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly outcome: 'allow' | 'deny' | 'requires-approval';
  readonly decisionDigest: Sha256Hex;
  readonly denialCode?: string | undefined;
  readonly denialReason?: string | undefined;
  readonly actionStatus: string;
  readonly decidedAt: Timestamp;
}

/**
 * The authority-side typed OUTCOME record (the W022 outcome mirror):
 * what the authority's execution dispatch actually did — a record-shaped
 * result with evidence references, sealed by the authority.
 */
export interface AuthorityOutcomeRecord {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly kind: 'succeeded' | 'failed';
  readonly failure?: { readonly code: string; readonly reason: string } | undefined;
  readonly evidenceRefs: readonly string[];
  readonly outcomeDigest: Sha256Hex;
  readonly executedAt: Timestamp;
}

/**
 * One routed tool invocation end-to-end: the plan, the authority's
 * decision, the authority's outcome (iff dispatched), and the
 * disposition mapping. Content-addressed and idempotent (a replayed
 * invocation under the same key returns the sealed prior record).
 */
export interface ToolInvocationRecord {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly toolRef: string;
  readonly actionId: string;
  readonly arguments: Readonly<Record<string, JsonValue>>;
  readonly planDigest: Sha256Hex;
  readonly decision: AuthorityDecisionRecord;
  readonly outcome?: AuthorityOutcomeRecord | undefined;
  readonly disposition: InvocationDisposition;
  /** The evaluation subject id (`invocation-<digest12>`). */
  readonly invocationId: string;
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The evaluator surface: evaluation requests + verdicts.
// ---------------------------------------------------------------------------

/** The neutral criteria the evaluator judges a recorded invocation against. */
export interface InvocationCriteria {
  /** The disposition the criteria expects (`executed`, `authority-denied`, ...). */
  readonly 'expected-disposition': InvocationDisposition;
  /** When true, the invocation must carry the authority's outcome record with evidence references. */
  readonly 'require-evidence'?: boolean | undefined;
}

/**
 * The typed evaluation verdict over a recorded invocation. The verdict +
 * justification pieces MIRROR the W007 evaluator payload (which itself
 * parity-pins the W005 evaluation contract) with EXACTLY its
 * mutability — one chain, no drift (pinned by src/parity.ts).
 */
export interface InvocationEvaluation {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly subjectId: string;
  readonly subjectDigest: Sha256Hex;
  readonly verdict:
    | { verdictForm: 'pass-fail'; outcome: 'pass' | 'fail' }
    | {
        verdictForm: 'scored';
        score: number;
        scale: { minimum: number; maximum: number };
      };
  readonly justification: JustificationReference[];
  readonly evaluationDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The action-authority seam (the ONLY route a tool invocation takes).
// ---------------------------------------------------------------------------

/** The W009-shaped authorization context riding every submission. */
export interface AuthorityAuthorization {
  readonly principalId: string;
  readonly context: unknown;
  readonly justification?: string | undefined;
}

/** One proposal submission to the action authority (the W022 seam input). */
export interface ActionAuthoritySubmission {
  readonly tenantId: TenantId;
  readonly actionId: string;
  /** The W003 action-proposal document (admitted by the authority). */
  readonly proposal: unknown;
  readonly authorization: AuthorityAuthorization;
  readonly decidedAt: Timestamp;
  /** Required iff the proposal demands human approval. */
  readonly approval?: { readonly deadline: Timestamp; readonly maxDelegationDepth: number } | undefined;
}

/** The result of a submission: the authority's typed decision, or a typed error. */
export type ActionAuthorityDecisionResult =
  | { readonly ok: true; readonly decision: AuthorityDecisionRecord }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** One execution dispatch request to the action authority. */
export interface ActionAuthorityExecutionRequest {
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly authorization: AuthorityAuthorization;
  readonly evidenceRefs?: readonly string[] | undefined;
  readonly at: Timestamp;
}

/** The result of a dispatch: the authority's typed outcome record, or a typed error. */
export type ActionAuthorityExecutionResult =
  | { readonly ok: true; readonly outcome: AuthorityOutcomeRecord }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/**
 * THE action-authority seam (architecture lock rule 3: actions execute
 * only through the Action Gateway): the ONLY route a tool invocation
 * takes. The adapter holds no credentials and executes NOTHING itself;
 * it submits proposals and requests dispatch, and records the
 * authority's typed decision/outcome records verbatim. The reference
 * wiring over the REAL W022 gateway is exercised by the parity tests
 * (devDependency — never a runtime edge).
 */
export interface ActionAuthorityPort {
  submitAction(request: ActionAuthoritySubmission): ActionAuthorityDecisionResult;
  executeAction(request: ActionAuthorityExecutionRequest): ActionAuthorityExecutionResult;
}
